import { pools, pets, img, elColor, esc } from '../ui.js';

export function poolsPage() {
  return `<main>
    <h1>🌍 Wild Pools</h1>
    <p class="sub">Mỗi ván, pet xuất hiện trong wild được roll từ 7 pool theo hệ.
    Chance = trọng số / tổng trọng số pool. Legendary có trọng số 1 — cực hiếm.</p>
    ${pools.map(poolCard).join('')}
    <p class="footnote">Tổng ${pools.reduce((s, p) => s + p.entries.length, 0)} mục trong 7 pool.</p>
  </main>`;
}

function poolCard(p) {
  const color = elColor(p.affinity, 1);
  const light = elColor(p.affinity, 0);
  return `
  <div class="pool-card">
    <div class="pool-head">
      <h3 style="color:${light}">${ICON[p.affinity] ?? '⭐'} Pool ${p.index} — Hệ ${p.affinityVn}</h3>
      <span class="badge">${p.entries.length} pet · tổng trọng số ${p.totalWeight}</span>
      ${p.entries.some(e => e.legendary) ? '<span class="badge legb">★ Có legendary</span>' : ''}
    </div>
    ${p.entries.map(e => `
      <div class="bar-row ${e.legendary ? 'leg' : ''}">
        ${e.petId
          ? `<a href="#/pet/${petsSlug(e.petId)}"><img src="${img(e.image)}" loading="lazy" title="${esc(e.name)}"></a>`
          : `<img src="${img(e.image)}" loading="lazy" title="${esc(e.name)}">`}
        <div>
          <div style="font-weight:700;font-size:13.5px;margin-bottom:4px">${esc(e.name)} ${e.legendary ? '★' : ''}</div>
          <div class="bar-outer">
            <div class="bar-inner" style="width:${Math.max(e.chance, 2)}%;background:linear-gradient(90deg,${color},${light})"></div>
            <div class="pct">${e.chance}%</div>
          </div>
        </div>
        <span class="num">w=${e.weight}</span>
        <span class="num" style="color:var(--green)">catch ${Math.round(e.catch * 100)}%</span>
      </div>`).join('')}
  </div>`;
}

const ICON = {
  fire: '🔥', water: '💧', grass: '🌿', lightning: '⚡',
  psychic: '🔮', fighter: '🥊', normal: '⭐',
};

const petIndex = Object.fromEntries(pets.map(p => [p.id, p.slug]));
const petsSlug = id => petIndex[id] ?? id;
