import { html, num, pct } from './lib/html.js';
import { db, ix, portrait, label, linkFor } from './db.js';

export const TAGS = { pet: 'Pet', wave: 'Quái đợt', wild: 'Wild', trade: 'Chỉ có qua trade', 'trade-give': 'Đem trade được', summon: 'Triệu hồi' };

export const img = (model, alt = '', cls = '', size = 64) =>
  html`<img class="${cls}" src="${portrait(model)}" alt="${alt}" width="${size}" height="${size}" loading="lazy" decoding="async">`;

export const EL = { fire: '#ff9f43', water: '#5aa9ff', grass: '#9af0ce', lightning: '#ffd452', psychic: '#a98bff', fighter: '#ff7a5c', normal: '#e1d2a9' };
export const elColor = el => EL[el] ?? '#aec4d3';

export function elBadge(el) {
  const c = db.elements[el];
  if (!c) return html`<span class="el" style="--c:#7599ad">Không hệ</span>`;
  return html`<span class="el" style="--c:${elColor(el)}">${c.name}</span>`;
}

const TIER_CLASS = { 'S+': 't-sp', S: 't-s', A: 't-a', B: 't-b', C: 't-c' };
export const tierClass = t => TIER_CLASS[t] ?? 't-c';
export const tierChip = (t, title = '', cls = '') => (t ? html`<i class="tier ${tierClass(t)} ${cls}" title="${title}">${t}</i>` : '');

export const pageHead = (title, { kick = '', lead = '', aside = '' } = {}) => html`<header class="phead">
  <div><h1>${title}</h1>${kick ? html`<div class="mono kick">${kick}</div>` : ''}${lead ? html`<p class="lead">${lead}</p>` : ''}</div>${aside}
</header>`;

export const catchBadge = c => html`<span class="badge up">Bắt ${pct(c, 0)}</span>`;
export const legBadge = (u, full = false) => (u.legendary ? html`<span class="badge legb">★ ${full ? 'Huyền thoại' : 'LEG'}</span>` : '');

export function unitChip(id, extra = '') {
  const u = db.units[id];
  if (!u) return html`<span class="chipu">${id}</span>`;
  return html`<a class="chipu" href="${linkFor(id)}" title="${u.name}${u.level ? ` Lv${u.level}` : ''}">
    ${img(u.model, u.name, '', 32)}<span>${u.name}${u.level ? html` <small>Lv${u.level}</small>` : ''}${extra}</span></a>`;
}

const DPS_PARTS = [['basic', 'đòn thường'], ['proc', 'chí mạng / proc'], ['skill', 'kỹ năng'], ['dot', 'độc'], ['aoe', 'lan (giả định 3 quái đứng gần)']];
const dpsParts = u => `DPS chưa tính buff đồng đội: ${DPS_PARTS.filter(([k]) => u.parts?.[k] > 0).map(([k, t]) => `${t} ${num(Math.round(u.parts[k]))}`).join(' · ') || num(u.dps)}`;

export function statGrid(u) {
  const dmg = u.dmgMin != null ? `${num(u.dmgMin)}–${num(u.dmgMax)}` : num(u.dmg);
  const cells = [
    ['Máu', num(u.hp), u.regen ? `+${num(u.regen)}/s` : ''],
    ['Sát thương', dmg, label(u.atk)],
    ['DPS', num(Math.round(u.eff ?? u.dps)), `${num(u.aps)} đòn/s`, dpsParts(u)],
    ['Tầm đánh', num(u.range), u.groundOnly ? 'chỉ mặt đất' : ''],
    ['Giáp', num(u.armor ?? 0), label(u.armorType)],
    ['Tốc chạy', num(u.move), label(u.movement)],
  ];
  return html`<div class="statgrid">${cells.map(([k, v, s, tip]) => html`
    <div class="stat" title="${tip ?? ''}"><div class="v">${v}</div><div class="k">${k}</div>${s ? html`<div class="s">${s}</div>` : ''}</div>`)}
  </div>
  ${u.splash ? html`<div class="note">Đánh lan: bán kính ${num(u.splash.small_radius)}${u.splash.medium_radius ? ` · ${num(u.splash.medium_factor * 100)}% trong ${num(u.splash.medium_radius)}` : ''}${u.splash.small_factor ? ` · ${num(u.splash.small_factor * 100)}% vùng ngoài` : ''}</div>` : ''}
  ${u.bounce ? html`<div class="note">Đánh nảy: tối đa ${u.bounce.targets} mục tiêu · tầm nảy ${num(u.bounce.radius)}${u.bounce.damage_loss ? ` · mất ${num(u.bounce.damage_loss * 100)}%/lần` : ''}</div>` : ''}`;
}

const EFFECT_KIND = {
  damage: 'Sát thương', heal: 'Hồi máu', apply_modifier: 'Trạng thái', summon: 'Triệu hồi', health_loss: 'Mất máu',
  force_attack_target: 'Taunt', destroy: 'Tiêu diệt', displace: 'Đẩy dời', set_health: 'Đặt máu', transform: 'Biến hình',
  modify_resource: 'Tài nguyên', remove_modifier: 'Giải trạng thái', spawn_projectile: 'Đạn', destroy_self: 'Tự huỷ',
};

export function skillList(ids, open = false) {
  if (!ids?.length) return '';
  return ids.map(id => {
    const s = db.abilities[id];
    if (!s) return '';
    const off = !s.available || s.inert;
    return html`<div class="skill-card ${open ? 'open' : ''} ${off ? 'off' : ''}">
      <div class="skill-head">
        <img class="skill-icon" src="${`skills/${s.icon ?? 'icon-ability'}.webp`}" alt="" width="36" height="36" loading="lazy" decoding="async">
        <span class="sname">${s.name}</span>
        <span class="trig">${s.inert ? 'Không có tác dụng' : s.summary}</span>
        ${s.cd ? html`<span class="badge">CD ${num(s.cd)}s</span>` : ''}
        <span class="caret">▶</span>
      </div>
      <div class="skill-body">
        ${s.inert ? html`<div class="meta">Trong ruleset hiện tại kỹ năng này chỉ có sát thương 0 và trạng thái rỗng (chưa được port) nên thực tế không có hiệu ứng. Điều kiện gốc: ${s.summary}</div>`
          : s.available ? html`<ul>${s.effects.map(e => html`<li><b>${EFFECT_KIND[e.k] ?? e.k}</b> — <span class="desc">${e.t}</span></li>`)}</ul>
            ${s.targeting ? html`<div class="meta">${s.targeting}</div>` : ''}`
          : html`<div class="meta">${s.reason ?? s.summary}</div>`}
      </div>
    </div>`;
  });
}

export function researchIcons(ids) {
  if (!ids?.length) return '';
  return html`<div class="rsicons">${ids.map(id => {
    const r = ix.researchById.get(id);
    return r ? html`<a href="#/research" title="${r.en} · ${r.perLevel}/cấp"><img src="${`research/${r.id}.webp`}" alt="${r.en}" width="28" height="28" loading="lazy"></a>` : '';
  })}</div>`;
}

export function footer() {
  const m = db.meta;
  return html`<footer class="foot mono"><span>Dữ liệu từ cutd.site · ruleset ${m.ruleset} · catalog ${m.catalogHash.slice(0, 12)} · build ${new Date(m.builtAt).toLocaleString('vi-VN')}</span>
    <a href="#/changelog">Lịch sử cập nhật</a></footer>`;
}

export const empty = (msg, back = '#/pets') => html`<main><div class="empty">${msg}<br><a class="backlink" href="${back}">← Quay lại</a></div></main>`;

