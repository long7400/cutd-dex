import { html, pct } from '../lib/html.js';
import { db, ix, linkFor } from '../db.js';
import { img, elColor, tierChip, pageHead, footer } from '../ui.js';

export default {
  title: () => 'Bãi hoang',
  render() {
    const r = db.game.rules;
    return html`<main>
      ${pageHead(html`Bãi <em>hoang</em>`, { lead: `Sau mỗi đợt, mỗi "finder" rút 1 sinh vật hoang dã theo hệ đã chọn (tỉ lệ = trọng số / tổng trọng số của bãi). Tối đa ${r.wildCap} con hoang dã · mở đầu ${r.openingWild} con.` })}
      <div class="pools">${db.pools.map(p => html`<section class="pool-card" style="--c:${elColor(p.element)}">
        <div class="pool-head">
          <h3>${db.elements[p.element]?.name ?? p.element}</h3>
          <span class="mono">${p.entries.length} pet · Σw ${p.total}</span>
        </div>
        ${[...p.entries].sort((a, b) => b.weight - a.weight).map(e => {
          const u = db.units[e.unit];
          const chance = e.weight / p.total;
          const line = ix.lineById.get(e.unit);
          return html`<a class="bar-row ${u.legendary ? 'leg' : ''}" href="${linkFor(e.unit)}">
            ${img(u.model, u.name, '', 44)}
            <div class="bar-main">
              <div class="bar-name">${u.name}${u.legendary ? html` <span class="gold">★</span>` : ''} ${line ? tierChip(line.rank.tier, `Hạng trong vai trò ${line.role.toUpperCase()}`, 'sm') : ''}</div>
              <div class="bar-outer"><div class="bar-inner" style="width:${Math.max(chance * 100, 2).toFixed(1)}%"></div></div>
            </div>
            <b class="pct">${pct(chance)}</b>
            <span class="num mono">bắt ${pct(u.catch ?? 0, 0)} · ${u.book ?? 0}g</span>
          </a>`;
        })}
      </section>`)}</div>
      ${footer()}
    </main>`;
  },
};
