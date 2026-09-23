import { pets, trade, img, elBadge, catchBadge, skillsHTML, esc } from '../ui.js';

export function petPage(slug) {
  const p = pets.find(x => x.slug === slug || x.id === slug);
  if (!p) return `<main><div class="empty">Không tìm thấy pet.<br><a class="backlink" href="#/pets">← Về danh sách</a></div></main>`;

  const obtain = [];
  if (p.pool) {
    obtain.push(`<span class="badge">🌍 Wild pool hệ <b>${p.pool.affinityVn}</b> · tỉ lệ xuất hiện ${(p.pool.chance * 100).toFixed(1)}% (w=${p.pool.weight})</span>`);
  }
  obtain.push(catchBadge(p.catch));
  obtain.push(`<span class="badge">💰 Bán ${p.book} gold</span>`);

  const stages = p.chain.map((s, i) => `
    <div class="stage-card ${i === p.chain.length - 1 ? 'final' : ''}">
      <img src="${img(s.image)}" alt="${esc(s.name)}" loading="lazy">
      <div class="grow">
        <div class="stitle">
          <span class="lv">Lv ${s.level ?? '?'}</span>
          <b>${esc(s.name)}</b>
          ${i === p.chain.length - 1 ? '<span class="badge legb">Cấp tối đa</span>' : ''}
          ${s.evolveCost != null ? `<span class="badge">⬆ Tiến hóa tiếp: ${s.evolveCost} gold</span>` : ''}
        </div>
        <div class="statgrid">
          <div class="stat"><div class="k">Máu</div><div class="v">${fmtN(s.hp)}</div></div>
          <div class="stat"><div class="k">Sát thương</div><div class="v">${fmtN(s.dmg)}</div></div>
          <div class="stat"><div class="k">Tầm đánh</div><div class="v">${s.range}</div></div>
          <div class="stat"><div class="k">Giáp</div><div class="v">${s.armor}</div></div>
          <div class="stat"><div class="k">Đánh / giây</div><div class="v">${s.aps}</div></div>
          <div class="stat"><div class="k">DPS</div><div class="v">${fmtN(s.dps)}</div></div>
          <div class="stat"><div class="k">Kiểu đánh</div><div class="v"><small>${esc(s.attackType)}</small></div></div>
          <div class="stat"><div class="k">Tốc chạy</div><div class="v">${s.moveSpeed}</div></div>
        </div>
        ${skillsHTML(s.skills)}
      </div>
    </div>`).join('');

  const evolves = p.chain.length > 1;
  const prev = p.chain[0];
  const final = p.chain[p.chain.length - 1];

  // các recipe trade mà pet này (cấp cuối) dùng để đổi
  const relatedTrades = [];
  for (const slot of trade) for (const r of slot.recipes) {
    if (r.required.rootPet?.slug === p.slug) relatedTrades.push({ slot: slot.slot, r });
  }

  return `<main>
    <a class="backlink" href="#/pets">← Danh sách pet</a>
    <div class="detail-head">
      <img class="big" src="${img(p.image)}" alt="${esc(p.name)}">
      <div style="flex:1;min-width:220px">
        <h1>${esc(p.name)} ${p.legendary ? '<span class="badge legb">★ LEGENDARY</span>' : ''}</h1>
        <div class="tags" style="display:flex;gap:6px;flex-wrap:wrap">${elBadge(p.element)} ${obtain.join(' ')}</div>
        <p class="sub" style="margin-top:10px">
          ${evolves
            ? `Tiến hóa <b>${esc(prev.name)}</b> → <b>${esc(final.name)}</b> qua ${p.chain.length} cấp (Lv ${prev.level} → Lv ${final.level}).`
            : 'Pet đơn cấp — không tiến hóa.'}
        </p>
      </div>
    </div>

    <h2>🧬 Chuỗi tiến hóa (${p.chain.length} cấp)</h2>
    <div class="timeline">${stages}</div>

    ${relatedTrades.length ? `
    <h2>🔁 Trade liên quan</h2>
    <p class="sub">Nuôi <b>${esc(final.name)}</b> lên Lv${final.level} rồi đem đổi:</p>
    <div class="trade-grid">${relatedTrades.map(({ slot, r }) => `
      <div class="recipe">
        <div class="side">
          <span class="badge">Slot ${slot} · ĐỔI ĐI</span>
          <img src="${img(r.required.image)}" loading="lazy">
          <span class="who">${esc(r.required.name)} · Lv${r.required.level}</span>
        </div>
        <div class="arrow">➜</div>
        <div class="side">
          <span class="badge catch">NHẬN VỀ</span>
          <img src="${img(r.offered.image)}" loading="lazy">
          <span class="who">${esc(r.offered.name)} · Lv${r.offered.level}</span>
          <span class="bystats">HP ${r.offered.hp.toLocaleString('vi-VN')} · DPS ${r.offered.dps.toLocaleString('vi-VN')}</span>
          <a class="rootlink" href="#/trade">↗ xem trong bảng trade</a>
        </div>
      </div>`).join('')}</div>` : ''}

    ${p.legendary && p.pool ? `
    <h2>⭐ Ghi chú Legendary</h2>
    <p class="sub" style="margin:0">Legendary <b>không thể trade</b>. Chỉ xuất hiện ngẫu nhiên trong wild pool hệ <b>${p.pool.affinityVn}</b>
    với trọng số 1/${p.pool.totalWeight} (~${(p.pool.chance * 100).toFixed(1)}% mỗi lần roll) và chỉ <b>${Math.round(p.catch * 100)}%</b> bắt thành công.</p>` : ''}
  </main>`;
}

const fmtN = n => n >= 10000 ? n.toLocaleString('vi-VN') : String(n);
