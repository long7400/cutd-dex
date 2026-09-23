import { trade, img, elBadge, esc } from '../ui.js';

export function tradePage() {
  return `<main>
    <h1>🔁 Bảng Trade</h1>
    <p class="sub">7 slot · mỗi slot 3 công thức. Đổi pet thường <b>Lv100</b> lấy pet hiếm <b>chỉ có qua trade</b>.
    Bấm vào kỹ năng để bung chi tiết hệ số.</p>
    ${trade.map(slot => `
      <div class="trade-slot">
        <div class="slot-title">Slot ${slot.slot}</div>
        <div class="trade-grid">${slot.recipes.map(recipe).join('')}</div>
      </div>`).join('')}
    <p class="footnote">Pet đem đổi đều là cấp tiến hóa cuối của pet bắt được ngoài wild — bấm link phía dưới pet đem đổi để xem cách nuôi lên Lv100.</p>
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
    : '<span class="badge">chưa có skill</span>';
  const rootLink = s.rootPet
    ? `<a class="rootlink" href="#/pet/${s.rootPet.slug}">↗ ${esc(s.rootPet.name)} — xem chuỗi tiến hóa</a>`
    : `<span class="rootlink" style="color:var(--dim)">pet độc lập (không tiến hóa)</span>`;
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
