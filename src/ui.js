import { html, num, pct, short } from './lib/html.js';
import { db, ix, portrait, label, linkFor, elementName } from './db.js';

const rgb = a => `rgb(${a.join(',')})`;
export const TAGS = { pet: 'Pet', wave: 'Quái đợt', wild: 'Wild', trade: 'Chỉ có qua trade', 'trade-give': 'Đem trade được', summon: 'Triệu hồi' };

export const img = (model, alt = '', cls = '', size = 64) =>
  html`<img class="${cls}" src="${portrait(model)}" alt="${alt}" width="${size}" height="${size}" loading="lazy" decoding="async">`;

export function elBadge(el) {
  const c = db.elements[el];
  if (!c) return html`<span class="badge">Không hệ</span>`;
  return html`<span class="badge el" style="${`background:linear-gradient(135deg,${rgb(c.light)},${rgb(c.mid)});color:${rgb(c.dark)}`}">${c.name}</span>`;
}

export const elColor = (el, i = 1) => {
  const c = db.elements[el] ?? db.elements.normal;
  return rgb([c.light, c.mid, c.dark][i]);
};

export const catchBadge = c => html`<span class="badge catch">Bắt ${pct(c, 0)}</span>`;
export const legBadge = (u, full = false) => (u.legendary ? html`<span class="badge legb">★ ${full ? 'Huyền thoại' : 'LEG'}</span>` : '');

export function unitChip(id, extra = '') {
  const u = db.units[id];
  if (!u) return html`<span class="chipu">${id}</span>`;
  return html`<a class="chipu" href="${linkFor(id)}" title="${u.name}${u.level ? ` Lv${u.level}` : ''}">
    ${img(u.model, u.name, '', 32)}<span>${u.name}${u.level ? html` <small>Lv${u.level}</small>` : ''}${extra}</span></a>`;
}

export function statGrid(u) {
  const dmg = u.dmgMin != null ? `${num(u.dmgMin)}–${num(u.dmgMax)}` : num(u.dmg);
  const cells = [
    ['Máu', num(u.hp), u.regen ? `+${num(u.regen)}/s` : ''],
    ['Sát thương', dmg, label(u.atk)],
    ['DPS', num(u.dps), `${num(u.aps)} đòn/s`],
    ['Tầm đánh', num(u.range), u.groundOnly ? 'chỉ mặt đất' : ''],
    ['Giáp', num(u.armor ?? 0), label(u.armorType)],
    ['Tốc chạy', num(u.move), label(u.movement)],
  ];
  return html`<div class="statgrid">${cells.map(([k, v, s]) => html`
    <div class="stat"><div class="k">${k}</div><div class="v">${v}</div>${s ? html`<div class="s">${s}</div>` : ''}</div>`)}
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
  if (!ids?.length) return html`<div class="sub" style="margin:0">—</div>`;
  return ids.map(id => {
    const s = db.abilities[id];
    if (!s) return '';
    const off = !s.available || s.inert;
    return html`<div class="skill-card ${open ? 'open' : ''} ${off ? 'off' : ''}">
      <div class="skill-head">
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
  return html`<footer class="foot">Dữ liệu: <code>${m.ruleset}</code> · catalog <code>${m.catalogHash.slice(0, 12)}</code> · build ${new Date(m.builtAt).toLocaleString('vi-VN')}
    · <a href="#/changelog">lịch sử cập nhật</a></footer>`;
}

export const empty = (msg, back = '#/pets') => html`<main><div class="empty">${msg}<br><a class="backlink" href="${back}">← Quay lại</a></div></main>`;

export { elementName, short };
