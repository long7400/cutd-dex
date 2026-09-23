import { html, toString, num, short, debounce } from '../lib/html.js';
import { buildIndex } from '../lib/search.js';
import { db, ix, label, linkFor } from '../db.js';
import { img, elBadge, footer, TAGS } from '../ui.js';

const PAGE = 120;
const state = { q: '', tag: 'all', el: 'all', sort: 'name', dir: 1, limit: PAGE };

const COLS = [
  ['name', 'Tên', u => u.name],
  ['hp', 'Máu', u => u.hp],
  ['dmg', 'ST', u => u.dmg],
  ['dps', 'DPS', u => u.dps],
  ['range', 'Tầm', u => u.range],
  ['armor', 'Giáp', u => u.armor ?? 0],
  ['move', 'Tốc', u => u.move],
  ['book', 'Giá trị', u => u.book ?? 0],
];

let index = null, collator = null;
function prepare() {
  if (index) return;
  collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
  index = buildIndex(ix.unitList, u => [u.name, ...(u.skills ?? []).map(s => db.abilities[s]?.name ?? ''), u.id.replace(/^unit_/, '')]);
}

function results() {
  let list = ix.unitList;
  if (state.q) {
    const hits = index.query(state.q);
    if (hits) list = hits.map(i => ix.unitList[i]);
  }
  if (state.tag === 'other') list = list.filter(u => !u.tags?.length);
  else if (state.tag !== 'all') list = list.filter(u => u.tags?.includes(state.tag));
  if (state.el !== 'all') list = list.filter(u => (u.el ?? 'none') === state.el);
  if (state.q && state.sort === 'name') return list; // giữ thứ tự độ liên quan
  const get = COLS.find(c => c[0] === state.sort)?.[2] ?? COLS[0][2];
  const cmp = state.sort === 'name'
    ? (a, b) => collator.compare(a.name, b.name) || (a.level ?? 0) - (b.level ?? 0)
    : (a, b) => get(a) - get(b) || collator.compare(a.name, b.name);
  return [...list].sort((a, b) => cmp(a, b) * state.dir);
}

function rows(list) {
  if (!list.length) return html`<tr><td colspan="${COLS.length + 2}" class="empty">Không có kết quả</td></tr>`;
  return list.slice(0, state.limit).map(u => html`<tr>
    <td class="namecell"><a href="${linkFor(u.id)}">${img(u.model, u.name, '', 36)}<span><b>${u.name}</b>${u.level != null ? html` <small>Lv${u.level}</small>` : ''}${u.legendary ? html` <span class="legb-t">★</span>` : ''}</span></a></td>
    <td>${elBadge(u.el)}</td>
    <td class="n">${short(u.hp)}</td>
    <td class="n" title="${label(u.atk)}">${u.dmgMin != null ? `${short(u.dmgMin)}–${short(u.dmgMax)}` : short(u.dmg)}</td>
    <td class="n">${short(u.dps)}</td>
    <td class="n">${num(u.range)}</td>
    <td class="n" title="${label(u.armorType)}">${num(u.armor ?? 0)}</td>
    <td class="n">${num(u.move)}</td>
    <td class="n">${short(u.book ?? 0)}</td>
    <td class="tagcell">${(u.tags ?? []).map(t => html`<span class="mini-tag t-${t}">${TAGS[t] ?? t}</span>`)}</td>
  </tr>`);
}

const more = n => (n > state.limit ? html`<button type="button" class="chip" data-more>Hiện thêm (${n - state.limit} còn lại)</button>` : '');

export default {
  title: () => 'Sinh vật',
  render() {
    prepare();
    const list = results();
    const tagCounts = { all: ix.unitList.length, other: ix.unitList.filter(u => !u.tags?.length).length };
    for (const u of ix.unitList) for (const t of u.tags ?? []) tagCounts[t] = (tagCounts[t] ?? 0) + 1;
    const tagOrder = ['all', 'pet', 'wave', 'wild', 'trade', 'trade-give', 'summon', 'other'];
    const tagLabel = { all: 'Tất cả', other: 'Khác', ...TAGS };
    return html`<main>
      <h1>Sinh vật</h1>
      <p class="sub">Toàn bộ ${ix.unitList.length} species trong catalog: pet mọi cấp, quái các đợt, boss, unit trade…</p>
      <div class="controls">
        <input type="search" placeholder="Tìm tên, kỹ năng, mã (h0gt)…" value="${state.q}" data-q autocomplete="off" aria-label="Tìm kiếm">
        <div class="chips">${tagOrder.filter(t => tagCounts[t]).map(t => html`<button type="button" class="chip ${state.tag === t ? 'on' : ''}" data-tag="${t}">${tagLabel[t]} (${tagCounts[t]})</button>`)}</div>
        <div class="chips">
          <select class="chip" data-el aria-label="Hệ">
            <option value="all">Mọi hệ</option>
            ${Object.entries(db.elements).map(([k, e]) => html`<option value="${k}" ${state.el === k ? html`selected` : ''}>${e.name}</option>`)}
            <option value="none" ${state.el === 'none' ? html`selected` : ''}>Không hệ</option>
          </select>
          <span class="badge count" id="u-count">${list.length}</span>
        </div>
      </div>
      <div class="table-wrap"><table class="units">
        <thead><tr>
          ${COLS.slice(0, 1).map(c => th(c))}<th>Hệ</th>${COLS.slice(1).map(c => th(c))}<th>Nguồn</th>
        </tr></thead>
        <tbody id="u-body">${rows(list)}</tbody>
      </table></div>
      <div id="u-more" class="center">${more(list.length)}</div>
      ${footer()}
    </main>`;
  },
  mount(root) {
    const body = root.querySelector('#u-body'), count = root.querySelector('#u-count'), moreEl = root.querySelector('#u-more');
    const refresh = (resetLimit = true) => {
      if (resetLimit) state.limit = PAGE;
      const list = results();
      body.innerHTML = toString(rows(list));
      count.textContent = list.length;
      moreEl.innerHTML = toString(more(list.length));
      root.querySelectorAll('[data-tag]').forEach(b => b.classList.toggle('on', b.dataset.tag === state.tag));
      root.querySelectorAll('th[data-sort]').forEach(t => {
        t.classList.toggle('on', t.dataset.sort === state.sort);
        t.dataset.dir = t.dataset.sort === state.sort ? (state.dir > 0 ? '▲' : '▼') : '';
      });
    };
    const onType = debounce(refresh, 110);
    root.addEventListener('input', e => { if (e.target.matches('[data-q]')) { state.q = e.target.value; onType(); } });
    root.addEventListener('change', e => { if (e.target.matches('[data-el]')) { state.el = e.target.value; refresh(); } });
    root.addEventListener('click', e => {
      const t = e.target.closest('[data-tag],[data-sort],[data-more]');
      if (!t) return;
      if (t.dataset.tag) { state.tag = t.dataset.tag; refresh(); }
      else if (t.dataset.sort) {
        if (state.sort === t.dataset.sort) state.dir = -state.dir;
        else { state.sort = t.dataset.sort; state.dir = t.dataset.sort === 'name' ? 1 : -1; }
        refresh();
      } else if (t.hasAttribute('data-more')) { state.limit += PAGE * 2; refresh(false); }
    });
    refresh(false);
  },
};

function th([key, text]) {
  return html`<th data-sort="${key}" class="${key === 'name' ? '' : 'n'} ${state.sort === key ? 'on' : ''}" data-dir="${state.sort === key ? (state.dir > 0 ? '▲' : '▼') : ''}">${text}</th>`;
}
