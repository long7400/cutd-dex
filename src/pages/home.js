import { pets, img, elBadge, catchBadge, esc, meta } from '../ui.js';

export let filters = { q: '', el: 'all', kind: 'all', sort: 'name' };

window.__actions = window.__actions || {};

function filtered() {
  let list = pets;
  if (filters.el !== 'all') list = list.filter(p => p.element === filters.el);
  if (filters.kind === 'leg') list = list.filter(p => p.legendary);
  if (filters.kind === 'normal') list = list.filter(p => !p.legendary);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    list = list.filter(p => p.name.toLowerCase().includes(q)
      || p.chain.some(s => s.name.toLowerCase().includes(q)));
  }
  const sorters = {
    name: (a, b) => a.name.localeCompare(b.name),
    catchDesc: (a, b) => a.catch - b.catch,
    catchAsc: (a, b) => b.catch - a.catch,
    dps: (a, b) => b.chain[b.chain.length - 1].dps - a.chain[a.chain.length - 1].dps,
    hp: (a, b) => b.chain[b.chain.length - 1].hp - a.chain[a.chain.length - 1].hp,
    stages: (a, b) => b.chain.length - a.chain.length,
  };
  return [...list].sort(sorters[filters.sort]);
}

window.__actions.homeFilter = el => {
  const kind = el.dataset.kind;
  if (kind !== undefined) filters.kind = kind;
  const f = el.dataset.field;
  if (f === 'q') filters.q = el.value;
  renderHome();
};
window.__actions.homeSet = el => { filters.el = el.dataset.el; renderHome(); };
window.__actions.homeSort = el => { filters.sort = el.value; renderHome(); };

export function renderHome() {
  const mount = document.getElementById('home-root');
  if (mount) {
    mount.innerHTML = listHTML();
    window.__bind?.();
  }
}

function listHTML() {
  const els = ['all', ...new Set(pets.map(p => p.element))];
  const list = filtered();
  const counts = {
    all: pets.length,
    leg: pets.filter(p => p.legendary).length,
    normal: pets.filter(p => !p.legendary).length,
  };
  return `
  <div class="controls">
    <input type="search" placeholder="Tìm pet / tiến hóa… (vd: charizard, mew)" value="${esc(filters.q)}"
           data-action="input" data-fn="homeFilter" data-field="q">
    ${els.map(e => e === 'all'
      ? `<span class="chip ${filters.el === 'all' ? 'on' : ''}" data-action="click" data-fn="homeSet" data-el="all">Tất cả hệ</span>`
      : elChip(e)).join('')}
    <span class="chip ${filters.kind === 'all' ? 'on' : ''}" data-action="click" data-fn="homeFilter" data-kind="all">Tất cả (${counts.all})</span>
    <span class="chip ${filters.kind === 'leg' ? 'on' : ''}" data-action="click" data-fn="homeFilter" data-kind="leg">★ Legendary (${counts.leg})</span>
    <span class="chip ${filters.kind === 'normal' ? 'on' : ''}" data-action="click" data-fn="homeFilter" data-kind="normal">Thường (${counts.normal})</span>
    <select class="chip" data-action="change" data-fn="homeSort">
      ${[['name', 'Tên A-Z'], ['catchDesc', 'Catch khó nhất'], ['catchAsc', 'Catch dễ nhất'], ['dps', 'DPS max cao nhất'], ['hp', 'HP max cao nhất'], ['stages', 'Nhiều cấp tiến hóa nhất']]
        .map(([v, l]) => `<option value="${v}" ${filters.sort === v ? 'selected' : ''}>${l}</option>`).join('')}
    </select>
  </div>
  <div class="grid">${list.map(card).join('') || '<div class="empty">Không tìm thấy pet nào</div>'}</div>
  <p class="footnote">Dữ liệu game: <code>${esc(meta.catalogHash.slice(0, 12))}</code> · bóc lúc ${new Date(meta.builtAt).toLocaleString('vi-VN')} · tự cập nhật mỗi ngày qua GitHub Action · ảnh portrait gốc từ game.</p>`;
}

function elChip(e) {
  const on = filters.el === e;
  return `<span class="chip ${on ? 'on' : ''}" data-action="click" data-fn="homeSet" data-el="${e}">${elementsLabel(e)}</span>`;
}
function elementsLabel(e) {
  const map = { fire: '🔥 Lửa', water: '💧 Nước', grass: '🌿 Cỏ', lightning: '⚡ Điện', psychic: '🔮 Siêu', fighter: '🥊 Đấu', normal: '⭐ Thường' };
  return map[e] ?? e;
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
  return `<main>
    <h1>Pokédex CUTD</h1>
    <p class="sub">${pets.length} pet bắt được (${pets.filter(p => p.legendary).length} legendary) · bấm vào pet để xem chi tiết tiến hóa &amp; kỹ năng</p>
    <div id="home-root">${listHTML()}</div>
  </main>`;
}
