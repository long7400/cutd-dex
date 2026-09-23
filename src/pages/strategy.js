import { html, num } from '../lib/html.js';
import { db, label } from '../db.js';
import { footer } from '../ui.js';

const TIER_CLASS = { 'S+': 't-sp', S: 't-s', A: 't-a', B: 't-b', C: 't-c' };
const unitName = id => {
  const u = db.units[id];
  return u ? `${u.name}${u.level ? ` Lv${u.level}` : ''}` : id;
};
const roleName = r => db.roleNames?.[r] ?? r;
const tier = t => html`<span class="tierb ${TIER_CLASS[t]}">${t}</span>`;
const petLink = l => html`<a href="#/pet/${l.slug}">${l.name}</a>${l.legendary ? html` <span class="leg">★</span>` : ''}`;
const milestone = m => html`<b>${num(Math.round(m.eff))}</b><br><span class="small">${unitName(m.id)}${m.cost ? ` · ${num(m.cost)}g` : ''}</span>`;

function tierTable(lines, key) {
  return html`<div class="table-wrap"><table class="strat">
    <thead><tr><th>Hạng</th><th>Dòng</th><th>Đòn</th><th class="n">DPS thật ≤500g</th><th class="n">≤1.500g</th><th class="n">Đỉnh</th><th>Vai trò (mở từ)</th></tr></thead>
    <tbody>${[...lines].sort((a, b) => b[key].score - a[key].score).map(l => html`<tr>
      <td>${tier(l[key].tier)}</td>
      <td>${petLink(l)}${l.catch < 0.5 ? html`<br><span class="small">bắt ${Math.round(l.catch * 100)}%</span>` : ''}</td>
      <td>${label(l.atk)}</td>
      <td class="n">${milestone(l.e500)}</td><td class="n">${milestone(l.e1500)}</td><td class="n">${milestone(l.emax)}</td>
      <td class="small">${l.roles.filter(([r]) => r !== 'tank' || l.roles.length === 1).map(([r, id, c]) => `${roleName(r)}${c ? ` (${unitName(id)})` : ''}`).join(' · ') || '—'}</td>
    </tr>`)}</tbody>
  </table></div>`;
}

export default {
  title: () => 'Chiến thuật',
  render() {
    const S = db.strategy;
    const lines = S.lines;
    const atkTypes = Object.keys(S.modes[0]?.atk ?? {}).sort((a, b) => (S.modes[0].atk[b] ?? 0) - (S.modes[0].atk[a] ?? 0));
    const cell = v => html`<td class="n ${v >= 1.15 ? 'up' : v <= 0.95 ? 'down' : ''}">×${v.toFixed(2)}</td>`;
    const traps = lines.flatMap(l => l.traps.map(([from, to, kind]) => ({ l, from, to, kind })));
    const byRole = {};
    for (const l of lines) for (const [r, id, c] of l.roles) (byRole[r] ??= []).push({ l, id, c });
    const unsure = lines.filter(l => l.unsure.length);
    return html`<main>
      <h1>Chiến thuật</h1>
      <p class="sub">Đánh giá từng dòng pet theo sức mạnh <b>thật</b> (chỉ số + kỹ năng nội tại + kỹ năng mở khi tiến hóa), vai trò trong đội
        và độ hợp với từng chế độ. Số liệu tính tự động từ catalog game (ruleset <code>${db.meta.ruleset}</code>) — game đổi số thì bảng tự cập nhật.
        Trong trận, <a href="#/tool">CUTD Helper</a> chấm lại theo đội đang có, vàng, nghiên cứu và đợt quái sắp tới.</p>

      <h2>Cách đọc</h2>
      <ul class="notes">
        <li><b>DPS thật</b> = sát thương thường × (1 + chí mạng / đòn phụ theo xác suất) × buff tốc đánh (tính thời gian hiệu lực) + sát thương cố định / theo % máu mỗi đòn.
          Kỹ năng bị ruleset khoá, vô tác dụng hoặc cần điều kiện chưa rõ thì <b>không cộng</b>.</li>
        <li>Mốc <b>≤500g / ≤1.500g</b>: dạng mạnh nhất đạt được với số vàng tiến hóa đó (dòng khó bắt đã trừ tiền bắt kỳ vọng). Hạng dựa trên mốc 1.500g — giai đoạn giữa trận quyết định thắng thua.</li>
        <li><b>PvE</b> nhân hệ số khắc chế của chế độ Sinh tồn. <b>PvP</b>: 70% sức thủ + 30% độ trâu khi đội mày bị gửi sang làm quái đánh đối thủ.</li>
        <li><b>Vai trò</b> cộng điểm: hào quang cả đội (quan trọng nhất), khống chế, hồi máu, khiêu khích, diệt boss. Ghi kèm dạng mở ra vai trò đó.</li>
      </ul>

      <h2>Khắc chế theo chế độ</h2>
      <p class="sub">Hệ số trung bình của từng loại đòn lên toàn bộ máu quái của chế độ (tính theo kịch bản đợt). Sinh tồn: gần nửa máu quái là giáp Small → đòn Magic (hệ Lửa) ×2, đòn Hero (hệ Tâm linh) ×0,5.</p>
      <div class="table-wrap"><table class="dmg">
        <thead><tr><th>Đòn</th>${S.modes.map(m => html`<th class="n">${m.name}</th>`)}</tr></thead>
        <tbody>${atkTypes.map(a => html`<tr><td><b>${label(a)}</b></td>${S.modes.map(m => cell(m.atk[a] ?? 1))}</tr>`)}</tbody>
      </table></div>
      <p class="small">Giáp chiếm nhiều máu nhất — ${S.modes.map(m => `${m.name}: ${Object.entries(m.mix).slice(0, 2).map(([k, v]) => `${label(k)} ${Math.round(v * 100)}%`).join(', ')}`).join(' · ')}.</p>

      <h2>Hạng PvE (Sinh tồn)</h2>
      ${tierTable(lines, 'pve')}

      <h2>Hạng PvP (Đối kháng)</h2>
      <p class="sub">Quái đánh mày là đội hình đối thủ → trong trận hãy xem hạng của CUTD Helper (tool đọc được chính xác đợt tới gồm con gì để chọn loại đòn khắc chế).</p>
      ${tierTable(lines, 'pvp')}

      <h2>Đội hình gợi ý</h2>
      <ul class="notes">
        <li><b>Luôn có 1 dòng Machop</b>: Machoke Lv16 mở hào quang +20% sát thương cả căn cứ, Machamp Lv36 thêm +20% tốc đánh → cả đội ×1,44. Không cần 2 con — hào quang trùng không cộng.</li>
        <li><b>PvE Sinh tồn</b>: 2–3 dòng Lửa (đòn Magic) làm chủ lực + 1 dòng Điện (đòn Pierce, khắc giáp Divine) + Machop. Nghiên cứu tốc đánh đúng 2 hệ đó. Hay bị lọt → thêm Arbok (làm chậm quái 30%).</li>
        <li><b>PvE thuần Giác đấu</b>: Nacli (rẽ nhánh <b>Hitmonlee</b> — chí mạng), Mankey, Naclstack + Machop — cùng hệ nên 1 nhánh nghiên cứu tốc đánh buff cả đội.</li>
        <li><b>PvP</b>: 3–4 dòng DPS chọn theo đợt tới + Machop + 1–2 con trâu (hồi máu / né / giáp cao) để khi bị gửi sang nhà đối thủ khó giết, làm họ mất mạng.</li>
        <li><b>Huyền thoại</b>: bắt 12% → trung bình tốn hơn 1.600 vàng, không tiến hóa, DPS thấp. Chỉ đáng khi dư vàng và cần đúng vai trò: Kyogre (hồi máu cả đội), Onix (khiêu khích, trâu), Darkrai (5% máu tối đa mục tiêu mỗi đòn — diệt boss). Tối đa 1 con.</li>
      </ul>

      <h2>Bẫy tiến hóa</h2>
      <p class="sub"><b>Bẫy</b>: lên cấp làm DPS thật tụt và các cấp sau không gỡ lại → dừng ở cấp trước. <b>Tụt tạm</b>: tụt một bước rồi các cấp sau mạnh hơn.</p>
      <div class="table-wrap"><table>
        <thead><tr><th>Dòng</th><th>Từ</th><th>Lên</th><th class="n">DPS thật</th><th>Loại</th></tr></thead>
        <tbody>${traps.map(t => html`<tr><td>${petLink(t.l)}</td><td>${unitName(t.from)}</td><td>${unitName(t.to)}</td>
          <td class="n">${num(Math.round(db.units[t.from].eff))} → ${num(Math.round(db.units[t.to].eff))}</td>
          <td>${t.kind === 'trap' ? html`<span class="badge warn">Bẫy — dừng lại</span>` : 'Tụt tạm'}</td></tr>`)}</tbody>
      </table></div>

      <h2>Vai trò</h2>
      <div class="kv">${Object.entries(byRole).sort((a, b) => b[1].length - a[1].length).map(([r, list]) => html`<div>
        <span>${roleName(r)}</span><b class="small">${list.map(({ l, id, c }) => `${l.name}${c ? ` (${unitName(id)})` : ''}`).join(', ')}</b></div>`)}</div>

      ${unsure.length ? html`<h2>Cần thử trong trận</h2>
        <p class="sub">Kỹ năng có điều kiện chưa rõ nguồn (vd cần 1 hiệu ứng đặc biệt) hoặc xoá sổ quái — không cộng vào điểm tới khi kiểm chứng.</p>
        <p>${unsure.map(l => html`<a class="chip" href="#/pet/${l.slug}">${l.name}</a> `)}</p>` : ''}
    </main>${footer()}`;
  },
};
