import { html, num, pct } from '../lib/html.js';
import { db, label } from '../db.js';
import { footer } from '../ui.js';

const yes = b => (b ? 'Có' : 'Không');

export default {
  title: () => 'Luật chơi',
  render() {
    const r = db.game.rules;
    const d = db.damage;
    const k = d.armorCoefficient;
    const rows = [
      ['Vàng khởi đầu', num(r.initialGold)], ['Mạng mặc định', `${r.initialLives} (chọn ${r.livesOptions?.join(' / ')})`],
      ['Người chơi tối đa', r.maxPlayers], ['Huyền thoại tối đa / căn cứ', r.legendaryCap],
      ['Giới hạn quân', r.creatureCap || 'Không giới hạn'], ['Sinh vật hoang dã tối đa', r.wildCap],
      ['Lãi suất', `${pct(r.interest, 0)} (muộn: ${pct(r.lateInterest, 0)})`], ['Hệ số vàng mỗi đợt', `×${r.waveGoldMultiplier}`],
      ['Bán quân nhận lại', `${pct(r.sellGold, 0)} giá trị (vàng)`], ['Trade', yes(r.tradeEnabled)],
      ['Chuẩn bị đợt đầu', `${num(r.firstPlanningSec)}s`], ['Chuẩn bị giữa các đợt', `${num(r.planningSec)}s`],
      ['Giới hạn thời gian đợt', `${num(r.waveLimitSec)}s`], ['Hết giờ có mất mạng', yes(r.timeoutCostsLives)],
      ['Ra lệnh trong đợt', yes(r.inWaveOrders)], ['Tầm phát hiện của quái', num(r.creepAcquireRange)],
      ['Tốc chạy tối đa', num(r.maxMoveSpeed)], ['Hệ số tốc đánh', `${r.attackSpeedRange?.[0]}× – ${r.attackSpeedRange?.[1]}×`],
    ];
    const cellColor = m => (m > 1 ? 'up' : m < 1 ? 'down' : '');
    return html`<main>
      <h1>Luật chơi</h1>
      <p class="sub">Thông số lấy thẳng từ catalog của server (ruleset <code>${db.meta.ruleset}</code>, ${db.meta.tickRate} tick/giây).</p>

      <h2>Thông số chung</h2>
      <div class="kv">${rows.map(([a, b]) => html`<div><span>${a}</span><b>${b}</b></div>`)}</div>

      <h2>Chế độ chơi</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Chế độ</th><th class="n">Vàng đầu</th><th class="n">Lãi</th><th class="n">Mạng</th><th>Nguồn quái</th><th>Ghi chú</th></tr></thead>
        <tbody>${db.game.modes.map(m => html`<tr>
          <td><b>${m.name}</b>${m.isDefault ? html` <span class="badge">mặc định</span>` : ''}</td>
          <td class="n">${num(m.gold)}</td><td class="n">${pct(m.interest, 0)}</td><td class="n">${m.lives ?? '—'}</td>
          <td>${m.source === 'scripted' ? html`<a href="#/waves/${m.id}">Kịch bản (${m.waves} đợt)</a>` : 'Đối thủ ngẫu nhiên'}</td>
          <td class="small">${[
            m.duelFrom ? `quái bổ sung từ đợt ${m.duelFrom}` : '',
            m.flatGoldThrough ? `vàng cố định tới đợt ${m.flatGoldThrough}` : '',
            m.bountyThrough ? `thưởng hạ địch tới đợt ${m.bountyThrough}` : '',
          ].filter(Boolean).join(' · ')}</td>
        </tr>`)}</tbody>
      </table></div>

      <h2>Tốc độ</h2>
      <div class="table-wrap"><table>
        <thead><tr><th>Tốc độ</th><th class="n">Chuẩn bị đợt đầu</th><th class="n">Giữa các đợt</th><th class="n">+ khi có trade</th></tr></thead>
        <tbody>${db.game.speeds.map(s => html`<tr><td><b>${s.name}</b>${s.isDefault ? html` <span class="badge">mặc định</span>` : ''}</td>
          <td class="n">${num(s.firstSec)}s</td><td class="n">${num(s.planSec)}s</td><td class="n">+${num(s.tradeBonusSec)}s</td></tr>`)}</tbody>
      </table></div>

      <h2>Thu nhập</h2>
      <div class="chips">${db.game.incomes.map(o => html`<span class="chip ${o.isDefault ? 'on' : ''}">${o.mode === 'kill_bounty' ? 'Thưởng hạ địch' : o.multiplier ? `Lãi · ×${o.multiplier}` : 'Lãi · mặc định'}</span>`)}</div>

      <h2>Bảng sát thương (loại đòn × loại giáp)</h2>
      <p class="sub">Sát thương thực = sát thương × hệ số bảng × (1 − giảm do giáp).
        Giảm do giáp = <code>giáp × ${k} / (1 + giáp × ${k})</code> — vd 10 giáp giảm ${pct((10 * k) / (1 + 10 * k))}, 50 giáp giảm ${pct((50 * k) / (1 + 50 * k))}.</p>
      <div class="table-wrap"><table class="dmg">
        <thead><tr><th>Đòn \\ Giáp</th>${d.armorTypes.map(a => html`<th class="n">${label(a)}</th>`)}</tr></thead>
        <tbody>${d.attackTypes.map(a => html`<tr><th>${label(a)}</th>${d.armorTypes.map(t => {
          const m = d.table[a]?.[t] ?? 1;
          return html`<td class="n ${cellColor(m)}">${pct(m, 0)}</td>`;
        })}</tr>`)}</tbody>
      </table></div>

      ${r.notes?.length ? html`<h2>Ghi chú</h2>${r.notes.map(n => html`<p class="note small">${n}</p>`)}` : ''}
      ${footer()}
    </main>`;
  },
};
