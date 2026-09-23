import { pets, img, elBadge, catchBadge, esc, meta } from '../ui.js';
import { buildIndex, debounce } from '../search.js';

export let filters = { q: '', el: 'all', kind: 'all', sort: 'name' };

window.__actions = window.__actions || {};

const index = buildIndex(pets);
const byElement = new Map();
const listLeg = [], listNorm = [];
for (const p of pets) {
  if (!byElement.has(p.element)) byElement.set(p.element, []);
  byElement.get(p.element).push(p);
  (p.legendary ? listLeg : listNorm).push(p);
}
const allElements = [...byElement.keys()];
const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });

function baseList() {
  if (filters.el !== 'all') {
    const g = byElement.get(filters.el) ?? [];
    return filters.kind === 'leg' ? g.filter(p => p.legendary)
         : filters.kind === 'normal' ? g.filter(p => !p.legendary) : g;
  }
  if (filters.kind === 'leg') return listLeg;
  if (filters.kind === 'normal') return listNorm;
  return pets;
}

const SORTERS = {
  name: (a, b) => collator.compare(a.name, b.name),
  catchDesc: (a, b) => a.catch - b.catch || collator.compare(a.name, b.name),
  catchAsc: (a, b) => b.catch - a.catch || collator.compare(a.name, b.name),
  dps: (a, b) => b.dpsMax - a.dpsMax || collator.compare(a.name, b.name),
  hp: (a, b) => b.hpMax - a.hpMax || collator.compare(a.name, b.name),
  stages: (a, b) => b.stages - a.stages || collator.compare(a.name, b.name),
};

function filtered() {
  let list = baseList();
  if (filters.q) {
    const hits = index.query(filters.q);
    if (hits) {
      const set = new Set(hits);
      const ranked = list.filter(p => set.has(p));
      if (filters.sort === 'name') return ranked;
      return [...ranked].sort(SORTERS[filters.sort] ?? SORTERS.name);
    }
  }
  return [...list].sort(SORTERS[filters.sort] ?? SORTERS.name);
}

window.__actions.homeFilter = el => {
  const kind = el.dataset.kind;
  if (kind !== undefined) filters.kind = kind;
  if (el.dataset.field === 'q') {
    filters.q = el.value;
    debouncedRender();
    return;
  }
  renderHome();
};
window.__actions.homeSet = el => { filters.el = el.dataset.el; renderHome(); };
window.__actions.homeSort = el => { filters.sort = el.value; renderHome(); };
const debouncedRender = debounce(renderHome, 90);

export function renderHome() {
  const grid = document.getElementById('home-grid');
  if (!grid) return;
  grid.innerHTML = gridHTML();
  document.querySelectorAll('[data-el]').forEach(el =>
    el.classList.toggle('on', filters.el === el.dataset.el));
  document.querySelectorAll('[data-kind]').forEach(el =>
    el.classList.toggle('on', filters.kind === el.dataset.kind));
  const count = document.getElementById('result-count');
  if (count) count.textContent = String(filtered().length);
  window.__bind?.();
}

function gridHTML() {
  const list = filtered();
  if (!list.length) return `<div class="empty">Không tìm thấy</div><p class="footnote">${esc(meta.catalogHash.slice(0, 12))} · ${new Date(meta.builtAt).toLocaleString('vi-VN')}</p>`;
  return list.map(card).join('') + `<p class="footnote">${esc(meta.catalogHash.slice(0, 12))} · ${new Date(meta.builtAt).toLocaleString('vi-VN')}</p>`;
}

function elChip(e) {
  const map = { fire: '🔥 Lửa', water: '💧 Nước', grass: '🌿 Cỏ', lightning: '⚡ Điện', psychic: '🔮 Siêu', fighter: '🥊 Đấu', normal: '⭐ Thường' };
  return `<span class="chip ${filters.el === e ? 'on' : ''}" data-action="click" data-fn="homeSet" data-el="${e}">${map[e] ?? e}</span>`;
}

function card(p) {
  const last = p.chain[p.chain.length - 1];
  const shown = p.chain.slice(0, 5);
  const more = p.chain.length > 5 ? `<span class="more">+${p.chain.length - 5}</span>` : '';
  return `
  <a class="pet-card ${p.legendary ? 'leg' : ''}" href="#/pet/${p.slug}">
    <div class="row1">
      <img class="portrait" src="${img(p.image)}" alt="${esc(p.name)}" loading="lazy">
      <div>
        <div class="pname">${esc(p.name)}</div>
        <div class="tags">${elBadge(p.element)} ${catchBadge(p.catch)} ${p.legendary ? '<span class="badge legb">★ LEG</span>' : ''}</div>
      </div>
    </div>
    <div class="mini-chain">
      ${shown.map(s => `<img src="${img(s.image)}" title="${esc(s.name)} Lv${s.level}" loading="lazy">`).join('<span class="arr">›</span>')}${more}
    </div>
    <div class="statrow">
      <span>Max <b>${last.name}</b></span><span>HP <b>${fmt(last.hp)}</b></span><span>DPS <b>${fmt(last.dps)}</b></span>
    </div>
  </a>`;
}
const fmt = n => n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace('.0', '') + 'k' : String(n);

export function homePage() {
  const counts = { all: pets.length, leg: listLeg.length, normal: listNorm.length };
  return `<main>
    <h1>Pokédex</h1>
    <p class="sub">${pets.length} pet · ${listLeg.length} legendary</p>
    <div class="controls">
      <input type="search" placeholder="Tìm pet / tiến hóa / skill…" value="${esc(filters.q)}"
             data-action="input" data-fn="homeFilter" data-field="q">
      <span class="chip ${filters.el === 'all' ? 'on' : ''}" data-action="click" data-fn="homeSet" data-el="all">Tất cả hệ</span>
      ${allElements.map(e => elChip(e)).join('')}
      <span class="chip ${filters.kind === 'all' ? 'on' : ''}" data-action="click" data-fn="homeFilter" data-kind="all">Tất cả (${counts.all})</span>
      <span class="chip ${filters.kind === 'leg' ? 'on' : ''}" data-action="click" data-fn="homeFilter" data-kind="leg">★ Legendary (${counts.leg})</span>
      <span class="chip ${filters.kind === 'normal' ? 'on' : ''}" data-action="click" data-fn="homeFilter" data-kind="normal">Thường (${counts.normal})</span>
      <select class="chip" data-action="change" data-fn="homeSort">
        ${[['name', 'Tên A-Z'], ['catchDesc', 'Catch khó nhất'], ['catchAsc', 'Catch dễ nhất'], ['dps', 'DPS max cao nhất'], ['hp', 'HP max cao nhất'], ['stages', 'Nhiều cấp tiến hóa nhất']]
          .map(([v, l]) => `<option value="${v}" ${filters.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
      </select>
      <span class="badge" style="margin-left:auto" id="result-count">${filtered().length}</span>
    </div>
    <div id="home-grid" class="grid">${gridHTML()}</div>
  </main>`;
}
