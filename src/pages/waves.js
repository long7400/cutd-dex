import { html, num, short } from '../lib/html.js';
import { db } from '../db.js';
import { unitChip, footer } from '../ui.js';

export default {
  title: () => 'Đợt quái',
  render({ params }) {
    const set = db.waveSets.find(s => s.id === params[0]) ?? db.waveSets[0];
    const focus = params[1];
    const maxHp = Math.max(...set.waves.map(w => w.hp), 1);
    return html`<main>
      <h1>Đợt quái</h1>
      <p class="sub">${set.note} · Máu tổng = máu gốc × số lượng (chưa tính hiệu ứng/nghiên cứu).</p>
      <div class="chips tabs">${db.waveSets.map(s => html`<a class="chip ${s.id === set.id ? 'on' : ''}" href="#/waves/${s.id}">${s.name} <small>(${s.waves.length})</small></a>`)}
        <a class="chip ${params[0] === 'roster' ? 'on' : ''}" href="#/waves/roster">Bảng quái ngẫu nhiên</a></div>
      ${params[0] === 'roster' ? roster() : html`
      <div class="table-wrap"><table class="waves">
        <thead><tr><th class="n">Đợt</th><th>Quái</th><th class="n">SL</th><th>Máu tổng</th><th class="n">Lọt</th><th class="n">Thưởng</th></tr></thead>
        <tbody>${set.waves.map(w => html`<tr id="s-${w.n}" class="${String(w.n) === focus ? 'hl' : ''}">
          <td class="n"><b>${w.n}</b></td>
          <td>${w.groups.map(g => unitChip(g.unit, html` ×${g.count}`))}</td>
          <td class="n">${w.count}</td>
          <td><div class="hpbar"><div style="width:${Math.max(1.5, (w.hp / maxHp) * 100).toFixed(1)}%"></div><span>${short(w.hp)}</span></div></td>
          <td class="n">${w.lives ? `−${w.lives}` : '0'}</td>
          <td class="n">${w.gold ? html`<span class="gold">${num(w.gold)}g</span>` : '—'}${w.lumber ? html` <span class="crystal">${num(w.lumber)}c</span>` : ''}</td>
        </tr>`)}</tbody>
      </table></div>`}
      ${footer()}
    </main>`;
  },
};

function roster() {
  return html`<p class="sub">catalog.survival_roster — danh sách quái có thể được chọn theo từng mốc (trọng số bằng nhau nếu weight = 1).</p>
    <div class="table-wrap"><table class="waves"><thead><tr><th class="n">#</th><th>Quái có thể ra</th></tr></thead>
    <tbody>${db.roster.map(r => html`<tr><td class="n"><b>${r.n}</b></td><td>${r.entries.map(e => unitChip(e.unit, e.weight !== 1 ? html` · w${e.weight}` : ''))}</td></tr>`)}</tbody>
    </table></div>`;
}

