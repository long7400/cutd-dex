import { html, num, pct } from '../lib/html.js';
import { db, ix, unitUrl, linkFor } from '../db.js';
import { img, elBadge, catchBadge, legBadge, statGrid, skillList, researchIcons, unitChip, empty, footer } from '../ui.js';

const sid = id => id.replace(/^unit_/, '');

export function stageCard(u, { cost = null, highlight = false } = {}) {
  const sell = Math.floor((u.book ?? 0) * (db.game.rules.sellGold ?? 0));
  return html`<article class="stage-card ${u.evo ? '' : 'final'} ${highlight ? 'hl' : ''}" id="s-${sid(u.id)}">
    ${img(u.model, u.name, 'stage-img', 96)}
    <div class="grow">
      <div class="stitle">
        ${u.level != null ? html`<span class="lv">Lv ${u.level}</span>` : ''}
        <b>${u.name}</b>
        ${cost != null ? html`<span class="badge gold" title="Giá tiến hóa lên dạng này">⬆ ${num(cost)} vàng</span>` : ''}
        ${sell ? html`<span class="badge" title="Bán nhận ${pct(db.game.rules.sellGold, 0)} giá trị">Bán ${num(sell)}</span>` : ''}
        <a class="permalink" href="${unitUrl(u.id)}" title="Trang riêng của dạng này">#${sid(u.id)}</a>
      </div>
      ${statGrid(u)}
      ${skillList(u.skills)}
    </div>
  </article>`;
}

function tree(id, cost, seen, focus) {
  const u = db.units[id];
  const kids = (u.evo ?? []).filter(e => !seen.has(e.to));
  kids.forEach(k => seen.add(k.to));
  const self = stageCard(u, { cost, highlight: sid(id) === focus });
  if (!kids.length) return self;
  if (kids.length === 1) return html`${self}${tree(kids[0].to, kids[0].cost, seen, focus)}`;
  return html`${self}<div class="branches">${kids.map((k, i) => html`
    <div class="branch"><div class="branch-head">Nhánh ${String.fromCharCode(65 + i)} → ${db.units[k.to].name}</div>${tree(k.to, k.cost, seen, focus)}</div>`)}
  </div>`;
}

export default {
  title: ({ params }) => ix.petBySlug.get(params[0])?.name ?? 'Pet',
  render({ params }) {
    const p = ix.petBySlug.get(params[0]) ?? ix.petById.get(params[0]);
    if (!p) return empty('Không tìm thấy pet');
    const root = db.units[p.id];
    const pool = root.pool && db.pools[root.pool.index];
    const trades = p.stages.flatMap(id => (ix.tradesOf.get(id) ?? []).filter(t => t.give === id));
    const totalCost = p.stages.reduce((s, id) => s + (db.units[id].evo ?? []).reduce((a, e) => a + e.cost, 0), 0);

    return html`<main>
      <a class="backlink" href="#/pets">← Pets</a>
      <div class="detail-head">
        ${img(p.model, p.name, 'big', 128)}
        <div class="grow">
          <h1>${p.name} ${legBadge(root, true)}</h1>
          <div class="tags">
            ${elBadge(p.el)} ${catchBadge(p.catch)}
            <span class="badge gold">Giá bắt ${num(p.book)} vàng</span>
            ${pool ? html`<a class="badge" href="#/pools">Wild ${db.elements[pool.element]?.name} · ${pct(root.pool.weight / root.pool.total)} (${root.pool.weight}/${root.pool.total})</a>` : ''}
            <span class="badge">${p.stages.length} dạng${p.branching ? ' · có rẽ nhánh' : ''}</span>
          </div>
          <div class="sub" style="margin:8px 0 0">Nâng tiến hóa toàn bộ cây: ${num(totalCost)} vàng</div>
          ${researchIcons(root.research)}
        </div>
      </div>

      ${p.legendary ? html`<p class="note">★ Huyền thoại: tối đa ${db.game.rules.legendaryCap} huyền thoại mỗi căn cứ.</p>` : ''}

      <h2>Tiến hóa</h2>
      <div class="timeline">${tree(p.id, null, new Set([p.id]), params[1])}</div>

      ${trades.length ? html`<h2>Đem đi trade</h2>
        <div class="trade-grid">${trades.map(t => html`<div class="recipe">
          <div class="side"><span class="badge">Slot ${t.slot} · ĐỔI ĐI</span>${unitChip(t.give)}</div>
          <div class="arrow">➜</div>
          <div class="side"><span class="badge catch">NHẬN VỀ</span>${unitChip(t.get)}
            <span class="bystats">HP ${num(db.units[t.get].hp)} · DPS ${num(db.units[t.get].dps)}</span>
            <a class="rootlink" href="${linkFor(t.get)}">Xem chi tiết →</a></div>
        </div>`)}</div>` : ''}
      ${footer()}
    </main>`;
  },
};
