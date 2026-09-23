import { trade, img, elBadge, esc } from '../ui.js';

export function tradePage() {
  return `<main>
    <h1>Trade</h1>
    <p class="sub">Đổi pet Lv100 lấy pet chỉ có qua trade · bấm skill để xem chi tiết</p>
    ${trade.map(slot => `
      <div class="trade-slot">
        <div class="slot-title">Slot ${slot.slot}</div>
        <div class="trade-grid">${slot.recipes.map(recipe).join('')}</div>
      </div>`).join('')}
  </main>`;
}

function recipe(r) {
  return `
  <div class="recipe">
    ${side(r.required, 'ĐỔI ĐI', true)}
    <div class="arrow">➜</div>
    ${side(r.offered, 'NHẬN VỀ', false)}
  </div>`;
}

function side(s, label, isReq) {
  const skills = s.skills?.length
    ? s.skills.map(k => `<span class="badge" style="color:var(--green)">⚡ ${esc(k.name)}</span>`).join(' ')
    : '<span class="badge">—</span>';
  const rootLink = s.rootPet
    ? `<a class="rootlink" href="#/pet/${s.rootPet.slug}">↗ ${esc(s.rootPet.name)}</a>`
    : `<span class="rootlink" style="color:var(--dim)">không tiến hóa</span>`;
  return `
  <div class="side">
    <span class="badge ${isReq ? '' : 'catch'}">${label}</span>
    <img src="${img(s.image)}" alt="${esc(s.name)}" loading="lazy">
    <span class="who">${esc(s.name)}${s.level ? ` · Lv${s.level}` : ''}</span>
    ${elBadge(s.element)}
    <span class="bystats">HP ${s.hp.toLocaleString('vi-VN')} · DMG ${s.dmg.toLocaleString('vi-VN')} · DPS ${s.dps.toLocaleString('vi-VN')}</span>
    <div style="display:flex;flex-wrap:wrap;gap:4px;justify-content:center">${skills}</div>
    ${isReq ? rootLink : ''}
  </div>`;
}
