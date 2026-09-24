import { html, num, pct, short } from '../lib/html.js';
import { db, ix, unitUrl, linkFor, label } from '../db.js';
import { img, elBadge, elColor, catchBadge, legBadge, tierChip, statGrid, skillList, researchIcons, unitChip, empty, footer } from '../ui.js';

const sid = id => id.replace(/^unit_/, '');
const ROLE_LABEL = { atk: 'ATK · gây sát thương', tank: 'TANK · chặn đầu', buff: 'BUFF · tăng sức cả đội', debuff: 'DEBUFF · làm yếu quái' };
const lv = id => (db.units[id]?.level != null ? `Lv${db.units[id].level}` : '');

export function stageCard(u, { cost = null, highlight = false } = {}) {
  const sell = Math.floor((u.book ?? 0) * (db.game.rules.sellGold ?? 0));
  return html`<article class="stage-card ${u.evo?.length ? '' : 'final'} ${highlight ? 'hl' : ''}" id="s-${sid(u.id)}" style="--c:${elColor(u.el)}">
    <div class="sc-side">
      ${u.level != null ? html`<span class="lv">Lv ${u.level}</span>` : ''}
      ${img(u.model, u.name, 'stage-img', 96)}
    </div>
    <div class="grow">
      <div class="stitle">
        <b>${u.name}</b>
        ${u.role ? html`<span class="role r-${u.role}" title="Vai trò của dạng này (đọc từ chỉ số + kỹ năng của chính nó)">${u.role.toUpperCase()}</span>` : ''}${tierChip(u.stageTier, 'Hạng so với các con cùng vai trò, cùng tầm cấp')}${u.selfDps ? html`<span class="badge warn" title="Chí mạng / choáng dạng self dội vào chính con pet (issue #1)">⚠ tự mất ${num(Math.round(u.selfDps))} máu/s</span>` : ''}
        ${cost != null ? html`<span class="badge gold" title="Giá tiến hóa lên dạng này">⬆ ${num(cost)} vàng</span>` : ''}
        ${sell ? html`<span class="badge" title="Bán nhận ${pct(db.game.rules.sellGold, 0)} giá trị">Bán ${num(sell)}</span>` : ''}
        <a class="permalink mono" href="${unitUrl(u.id)}" title="Trang riêng của dạng này">#${sid(u.id)}</a>
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
    <div class="branch"><div class="branch-head mono">Nhánh ${String.fromCharCode(65 + i)} → ${db.units[k.to].name}</div>${tree(k.to, k.cost, seen, focus)}</div>`)}
  </div>`;
}

function verdict(line) {
  if (!line) return '';
  const trap = line.traps.find(([, , k]) => k === 'trap');
  const roles = line.roles.filter(([r]) => r !== 'selfharm');
  return html`<div class="verdict">
    <div class="vt-tiers"><a class="vt" href="#/strategy/${line.role}" title="Xem bảng hạng ${ROLE_LABEL[line.role]}">${tierChip(line.rank.tier)}<span class="mono">${ROLE_LABEL[line.role]}</span></a></div>
    ${roles.length || trap || line.harm ? html`<div class="vt-roles">
      ${line.harm ? html`<span class="rchip trap" title="Chí mạng / choáng dạng self dội vào chính con pet (issue #1)">⚠ Tự hại: ${db.units[line.harm[0]]?.name} ${lv(line.harm[0])} chết sau ~${line.harm[1]}s nếu không hồi</span>` : ''}
      ${roles.map(([r, id, c]) => html`<span class="rchip r-${r}" title="${c ? `Mở ở ${db.units[id]?.name} ${lv(id)} (${num(c)} vàng)` : 'Có sẵn từ đầu'}">${db.roleNames?.[r] ?? r}${c ? html` <small>${lv(id)}</small>` : ''}</span>`)}
      ${trap ? html`<span class="rchip trap" title="Lên ${db.units[trap[1]]?.name} bị tụt và các cấp sau không gỡ lại">⚠ Dừng ở ${db.units[trap[0]]?.name} ${lv(trap[0])}</span>` : ''}
    </div>` : ''}
  </div>`;
}

export default {
  title: ({ params }) => ix.petBySlug.get(params[0])?.name ?? 'Pet',
  render({ params }) {
    const p = ix.petBySlug.get(params[0]) ?? ix.petById.get(params[0]);
    if (!p) return empty('Không tìm thấy pet');
    const root = db.units[p.id];
    const pool = root.pool && db.pools[root.pool.index];
    const line = ix.lineById.get(p.id);
    const trades = p.stages.flatMap(id => (ix.tradesOf.get(id) ?? []).filter(t => t.give === id));
    const totalCost = p.stages.reduce((s, id) => s + (db.units[id].evo ?? []).reduce((a, e) => a + e.cost, 0), 0);

    return html`<main>
      <a class="backlink mono" href="#/pets">← Pokédex</a>
      <section class="hero" style="--c:${elColor(p.el)}">
        <div class="hero-art">${img(p.model, p.name, '', 220)}</div>
        <div class="hero-body">
          <div class="mono">${db.elements[p.el]?.name ?? 'Không hệ'} · đòn ${label(root.atk)} · ${p.stages.length} dạng${p.branching ? ' · có rẽ nhánh' : ''}</div>
          <h1>${p.name}${p.legendary ? html` <span class="gold">★</span>` : ''}</h1>
          <div class="tags">
            ${elBadge(p.el)} ${catchBadge(p.catch)} ${legBadge(root, true)}
            ${pool ? html`<a class="badge" href="#/pools">Bãi ${db.elements[pool.element]?.name} · ${pct(root.pool.weight / root.pool.total)}</a>` : ''}
          </div>
          <div class="hero-stats">
            <div><b>${num(p.book)}</b><span class="mono">Giá bắt</span></div>
            <div><b>${num(totalCost)}</b><span class="mono">Vàng cả cây</span></div>
            <div><b class="gold">${short(p.dpsMax)}</b><span class="mono">DPS đỉnh</span></div>
            <div><b>${short(p.hpMax)}</b><span class="mono">Máu đỉnh</span></div>
          </div>
          ${verdict(line)}
          ${researchIcons(root.research)}
        </div>
      </section>

      ${p.legendary ? html`<p class="note">★ Huyền thoại: tối đa ${db.game.rules.legendaryCap} huyền thoại mỗi căn cứ.</p>` : ''}

      <h2>Tiến hóa</h2>
      <div class="timeline">${tree(p.id, null, new Set([p.id]), params[1])}</div>

      ${trades.length ? html`<h2>Đem đi trade</h2>
        <div class="trade-grid">${trades.map(t => html`<div class="recipe">
          <div class="side"><span class="mono">Slot ${t.slot} · đổi đi</span>${unitChip(t.give)}${tierChip(db.units[t.give].stageTier)}</div>
          <div class="arrow">➜</div>
          <div class="side"><span class="mono up">Nhận về</span>${unitChip(t.get)}${tierChip(db.units[t.get].stageTier)}
            <span class="bystats mono">HP ${num(db.units[t.get].hp)} · DPS ${num(db.units[t.get].dps)}</span>
            <a class="rootlink" href="${linkFor(t.get)}">Xem chi tiết →</a></div>
        </div>`)}</div>` : ''}
      ${footer()}
    </main>`;
  },
};
