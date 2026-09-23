import { html, toString, short, debounce } from '../lib/html.js';
import { buildIndex } from '../lib/search.js';
import { db } from '../db.js';
import { img, elBadge, catchBadge, legBadge, footer, ICON } from '../ui.js';

// State bộ lọc sống ở module → quay lại trang vẫn giữ nguyên.
export const filters = { q: '', el: 'all', kind: 'all', sort: 'name' };

let index = null, collator = null, groups = null;
function prepare() {
  if (index) return;
  collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
  index = buildIndex(db.pets, p => {
    const toks = [p.name];
    for (const id of p.stages) {
      const u = db.units[id];
      toks.push(u.name);
      for (const s of u.skills ?? []) toks.push(db.abilities[s]?.name ?? '');
    }
    return toks;
  });
  groups = { byEl: new Map(), leg: [], normal: [] };
  for (const p of db.pets) {
    if (!groups.byEl.has(p.el)) groups.byEl.set(p.el, []);
    groups.byEl.get(p.el).push(p);
    (p.legendary ? groups.leg : groups.normal).push(p);
  }
}

const byName = (a, b) => collator.compare(a.name, b.name);
const SORTS = {
  name: ['Tên A→Z', byName],
  catchHard: ['Khó bắt nhất', (a, b) => a.catch - b.catch || byName(a, b)],
  catchEasy: ['Dễ bắt nhất', (a, b) => b.catch - a.catch || byName(a, b)],
  cost: ['Giá bắt thấp nhất', (a, b) => a.book - b.book || byName(a, b)],
  dps: ['DPS cao nhất', (a, b) => b.dpsMax - a.dpsMax || byName(a, b)],
  hp: ['Máu cao nhất', (a, b) => b.hpMax - a.hpMax || byName(a, b)],
  stages: ['Nhiều dạng tiến hóa nhất', (a, b) => b.stages.length - a.stages.length || byName(a, b)],
};

function base() {
  const pool = filters.el === 'all' ? db.pets : groups.byEl.get(filters.el) ?? [];
  if (filters.kind === 'leg') return pool.filter(p => p.legendary);
  if (filters.kind === 'normal') return pool.filter(p => !p.legendary);
  return pool;
}

function results() {
  const list = base();
  const sorter = (SORTS[filters.sort] ?? SORTS.name)[1];
  const hits = filters.q ? index.query(filters.q) : null;
  if (!hits) return [...list].sort(sorter);
  const allowed = new Set(list);
  const ranked = hits.map(i => db.pets[i]).filter(p => allowed.has(p));
  return filters.sort === 'name' ? ranked : ranked.sort(sorter);
}

function card(p) {
  const final = db.units[p.finalId];
  const shown = p.stages.slice(0, 6);
  return html`<a class="pet-card ${p.legendary ? 'leg' : ''}" href="#/pet/${p.slug}">
    <div class="row1">
      ${img(p.model, p.name, 'portrait', 64)}
      <div>
        <div class="pname">${p.name}</div>
        <div class="tags">${elBadge(p.el)} ${catchBadge(p.catch)} ${legBadge(p)}</div>
      </div>
    </div>
    <div class="mini-chain">${shown.map((id, i) => html`${i ? html`<span class="arr">›</span>` : ''}${img(db.units[id].model, db.units[id].name, '', 26)}`)}${p.stages.length > 6 ? html`<span class="more">+${p.stages.length - 6}</span>` : ''}${p.branching ? html`<span class="more" title="Có nhánh tiến hóa">⑂</span>` : ''}</div>
    <div class="statrow"><span>💰 <b>${p.book}</b></span><span>Max HP <b>${short(p.hpMax)}</b></span><span>DPS <b>${short(p.dpsMax)}</b></span><span>→ <b>${final?.name}</b></span></div>
  </a>`;
}

function grid(list) {
  return list.length ? list.map(card) : html`<div class="empty">Không tìm thấy pet nào</div>`;
}

export default {
  title: () => 'Pets',
  render() {
    prepare();
    const list = results();
    const chip = (attr, val, text, on) => html`<button type="button" class="chip ${on ? 'on' : ''}" data-${attr}="${val}">${text}</button>`;
    return html`<main>
      <h1>Pokédex</h1>
      <p class="sub">${db.pets.length} pet bắt được · ${groups.leg.length} huyền thoại · ${db.meta.counts.units} sinh vật trong game</p>
      <div class="controls">
        <input type="search" placeholder="Tìm pet, dạng tiến hóa, kỹ năng… (chịu gõ sai)" value="${filters.q}" data-q autocomplete="off" aria-label="Tìm kiếm">
        <div class="chips">
          ${chip('el', 'all', 'Mọi hệ', filters.el === 'all')}
          ${Object.keys(db.elements).filter(e => groups.byEl.has(e)).map(e => chip('el', e, `${ICON[e] ?? ''} ${db.elements[e].name}`, filters.el === e))}
        </div>
        <div class="chips">
          ${chip('kind', 'all', `Tất cả (${db.pets.length})`, filters.kind === 'all')}
          ${chip('kind', 'leg', `★ Huyền thoại (${groups.leg.length})`, filters.kind === 'leg')}
          ${chip('kind', 'normal', `Thường (${groups.normal.length})`, filters.kind === 'normal')}
          <select class="chip" data-sort aria-label="Sắp xếp">${Object.entries(SORTS).map(([k, [l]]) => html`<option value="${k}" ${filters.sort === k ? html`selected` : ''}>${l}</option>`)}</select>
          <span class="badge count" id="result-count">${list.length}</span>
        </div>
      </div>
      <div id="home-grid" class="grid">${grid(list)}</div>
      ${footer()}
    </main>`;
  },
  mount(root) {
    const gridEl = root.querySelector('#home-grid');
    const count = root.querySelector('#result-count');
    const refresh = () => {
      const list = results();
      gridEl.innerHTML = toString(grid(list));
      count.textContent = list.length;
      root.querySelectorAll('[data-el]').forEach(b => b.classList.toggle('on', b.dataset.el === filters.el));
      root.querySelectorAll('[data-kind]').forEach(b => b.classList.toggle('on', b.dataset.kind === filters.kind));
    };
    const onType = debounce(refresh, 90);
    root.addEventListener('input', e => {
      if (e.target.matches('[data-q]')) { filters.q = e.target.value; onType(); }
    });
    root.addEventListener('change', e => {
      if (e.target.matches('[data-sort]')) { filters.sort = e.target.value; refresh(); }
    });
    root.addEventListener('click', e => {
      const b = e.target.closest('[data-el],[data-kind]');
      if (!b) return;
      if (b.dataset.el) filters.el = b.dataset.el;
      if (b.dataset.kind) filters.kind = b.dataset.kind;
      refresh();
    });
  },
};

