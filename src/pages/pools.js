import { html, pct } from '../lib/html.js';
import { db, linkFor } from '../db.js';
import { img, elColor, footer } from '../ui.js';

export default {
  title: () => 'Wild',
  render() {
    const r = db.game.rules;
    return html`<main>
      <h1>Wild Pools</h1>
      <p class="sub">Sau mỗi đợt, mỗi "finder" rút 1 sinh vật hoang dã theo hệ đã chọn (tỉ lệ = weight / tổng weight của pool).
        Tối đa ${r.wildCap} sinh vật hoang dã · mở đầu ${r.openingWild} con.</p>
      ${db.pools.map(p => {
        const mid = elColor(p.element, 1), light = elColor(p.element, 0);
        return html`<section class="pool-card">
          <div class="pool-head">
            <h3 style="color:${light}">${db.elements[p.element]?.name ?? p.element}</h3>
            <span class="badge">${p.entries.length} pet · Σw ${p.total}</span>
          </div>
          ${[...p.entries].sort((a, b) => b.weight - a.weight).map(e => {
            const u = db.units[e.unit];
            const chance = e.weight / p.total;
            return html`<div class="bar-row ${u.legendary ? 'leg' : ''}">
              <a href="${linkFor(e.unit)}">${img(u.model, u.name, '', 40)}</a>
              <div>
                <div class="bar-name"><a href="${linkFor(e.unit)}">${u.name}</a> ${u.legendary ? '★' : ''}</div>
                <div class="bar-outer">
                  <div class="bar-inner" style="width:${Math.max(chance * 100, 2).toFixed(1)}%;background:linear-gradient(90deg,${mid},${light})"></div>
                  <div class="pct">${pct(chance)}</div>
                </div>
              </div>
              <span class="num">w=${e.weight}</span>
              <span class="num catchc">bắt ${pct(u.catch ?? 0, 0)} · ${u.book ?? 0}g</span>
            </div>`;
          })}
        </section>`;
      })}
      ${footer()}
    </main>`;
  },
};
