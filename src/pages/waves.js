import { html, num, short } from '../lib/html.js';
import { db, label } from '../db.js';
import { unitChip, pageHead, footer } from '../ui.js';

function counters(w) {
  const table = db.damage.table;
  const armors = [...new Set(w.groups.map(g => db.units[g.unit]?.armorType).filter(Boolean))];
  return armors.map(a => {
    const best = Math.max(...Object.keys(table).map(k => table[k][a] ?? 1));
    const strong = best > 1 ? Object.keys(table).filter(k => (table[k][a] ?? 1) === best) : [];
    return { armor: a, strong, best };
  });
}

export default {
  title: () => 'Đợt quái',
  render({ params }) {
    const set = db.waveSets.find(s => s.id === params[0]) ?? db.waveSets[0];
    const focus = params[1];
    const maxHp = Math.max(...set.waves.map(w => w.hp), 1);
    const tabs = html`<div class="chips">${db.waveSets.map(s => html`<a class="chip ${params[0] !== 'roster' && s.id === set.id ? 'on' : ''}" href="#/waves/${s.id}">${s.name} <small>${s.waves.length}</small></a>`)}
      <a class="chip ${params[0] === 'roster' ? 'on' : ''}" href="#/waves/roster">Bảng quái ngẫu nhiên</a></div>`;
    return html`<main>
      ${pageHead(html`Đợt <em>quái</em>`, { lead: params[0] === 'roster' ? 'Danh sách quái có thể được chọn theo từng mốc (trọng số bằng nhau nếu w = 1).' : html`${set.note}. Máu tổng = máu gốc × số lượng. Cột <b>Khắc</b>: loại đòn gây nhiều sát thương nhất lên giáp của đợt đó.`, aside: tabs })}
      ${params[0] === 'roster' ? roster() : html`
      <div class="table-wrap"><table class="waves">
        <thead><tr><th class="n">Đợt</th><th>Quái</th><th>Máu tổng</th><th>Khắc</th><th class="n">Lọt</th><th class="n">Thưởng</th></tr></thead>
        <tbody>${set.waves.map(w => html`<tr id="s-${w.n}" class="${String(w.n) === focus ? 'hl' : ''}">
          <td class="n wn">${w.n}</td>
          <td>${w.groups.map(g => unitChip(g.unit, html` ×${g.count}`))}</td>
          <td><div class="hpbar"><div style="width:${Math.max(1.5, (w.hp / maxHp) * 100).toFixed(1)}%"></div><span>${short(w.hp)}</span></div></td>
          <td class="counter">${counters(w).map(c => html`<div><span class="mono dim">Giáp ${label(c.armor)}</span>${c.strong.length ? html` <b class="up">${c.strong.map(label).join(' / ')} ×${num(c.best)}</b>` : ''}</div>`)}</td>
          <td class="n">${w.lives ? html`<span class="down">−${w.lives}</span>` : '0'}</td>
          <td class="n">${w.gold ? html`<span class="gold">${num(w.gold)}g</span>` : '—'}${w.lumber ? html` <span class="crystal">${num(w.lumber)}c</span>` : ''}</td>
        </tr>`)}</tbody>
      </table></div>`}
      ${footer()}
    </main>`;
  },
};

function roster() {
  return html`<div class="table-wrap"><table class="waves"><thead><tr><th class="n">#</th><th>Quái có thể ra</th></tr></thead>
    <tbody>${db.roster.map(r => html`<tr><td class="n wn">${r.n}</td><td>${r.entries.map(e => unitChip(e.unit, e.weight !== 1 ? html` · w${e.weight}` : ''))}</td></tr>`)}</tbody>
    </table></div>`;
}
