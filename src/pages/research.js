import { html, num } from '../lib/html.js';
import { db, ix } from '../db.js';
import { elBadge, img, pageHead, footer } from '../ui.js';

const KIND_ORDER = ['attack_speed', 'max_health', 'armor', 'move_speed'];

export default {
  title: () => 'Nghiên cứu',
  render() {
    const byKind = new Map(KIND_ORDER.map(k => [k, []]));
    for (const r of db.research) {
      if (!byKind.has(r.kind)) byKind.set(r.kind, []);
      byKind.get(r.kind).push(r);
    }
    return html`<main>
      ${pageHead(html`Nghiên <em>cứu</em>`, { lead: 'Tiêu Tinh thể (crystal) để nâng vĩnh viễn cho các gia phả theo hệ. Giá tăng dần theo cấp.' })}
      ${[...byKind].filter(([, list]) => list.length).map(([, list]) => html`
        <h2>${list[0].kindVn}</h2>
        <div class="rs-grid">${list.map(r => html`<article class="rs-card">
          <div class="rs-head">
            <img src="${`research/${r.id}.webp`}" alt="" width="48" height="48" loading="lazy">
            <div><b class="rs-name">${r.en}</b><div class="tags">${r.el ? elBadge(r.el) : ''} <span class="badge">${r.perLevel} / cấp · ${r.levels} cấp</span></div></div>
          </div>
          <div class="rs-costs mono">${r.costs.map((c, i) => html`<span title="Cấp ${i + 1}">Lv${i + 1} <b class="crystal">${num(c)}</b></span>`)}
            <span>Σ <b class="crystal">${num(r.costs.reduce((a, b) => a + b, 0))}</b></span></div>
          <details><summary>${r.pets.length} pet · ${r.units} dạng được hưởng</summary>
            <div class="chip-list">${r.pets.map(id => {
              const p = ix.petById.get(id);
              return p ? html`<a class="chipu" href="#/pet/${p.slug}">${img(p.model, p.name, '', 28)}<span>${p.name}</span></a>` : '';
            })}</div>
          </details>
          ${r.notes.map(n => html`<p class="note small">${n}</p>`)}
        </article>`)}</div>`)}
      ${footer()}
    </main>`;
  },
};
