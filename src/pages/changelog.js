import { html, num } from '../lib/html.js';
import { db, linkFor } from '../db.js';
import { footer } from '../ui.js';

const FIELD = {
  max_health: 'Máu', attack_damage: 'Sát thương', attack_cooldown_ticks: 'Hồi đòn (tick)', attack_range: 'Tầm',
  armor: 'Giáp', armor_type: 'Loại giáp', attack_type: 'Loại đòn', move_speed: 'Tốc chạy', catch_chance: 'Tỉ lệ bắt',
  book_value: 'Giá trị', kill_gold: 'Vàng khi hạ', leak_lives: 'Mạng mất khi lọt', catchable: 'Bắt được', legendary: 'Huyền thoại',
};
const SECTION = {
  waves: 'Đợt quái', duel_waves: 'Đợt đối kháng', trade: 'Trade', wild: 'Wild pool', research: 'Nghiên cứu', rules: 'Luật',
  modes: 'Chế độ', damage: 'Bảng sát thương', speed_options: 'Tốc độ', income_options: 'Thu nhập', survival_roster: 'Roster sinh tồn',
};
const val = v => (typeof v === 'number' ? num(v) : v == null ? '—' : String(v));
const who = it => (db.units[it.id] ? html`<a href="${linkFor(it.id)}">${it.name}</a>` : html`<span>${it.name}</span>`);

export default {
  title: () => 'Lịch sử cập nhật',
  render() {
    const log = db.changelog ?? [];
    return html`<main>
      <h1>Lịch sử cập nhật</h1>
      <p class="sub">Mỗi lần game đổi catalog, bot tự so sánh bản cũ và bản mới rồi ghi lại ở đây.</p>
      ${log.length ? log.map(e => html`<section class="log">
        <div class="log-head">
          <b>${new Date(e.at).toLocaleString('vi-VN')}</b>
          <code>${e.prevHash?.slice(0, 8)} → ${e.hash.slice(0, 8)}</code>
          ${e.prevRuleset ? html`<span class="badge">${e.prevRuleset} → ${e.ruleset}</span>` : ''}
        </div>
        <div class="tags">
          ${e.summary.unitsAdded ? html`<span class="badge catch">+${e.summary.unitsAdded} sinh vật</span>` : ''}
          ${e.summary.unitsRemoved ? html`<span class="badge warn">−${e.summary.unitsRemoved} sinh vật</span>` : ''}
          ${e.summary.statChanges ? html`<span class="badge">${e.summary.statChanges} thay đổi chỉ số</span>` : ''}
          ${e.summary.abilityChanges ? html`<span class="badge">${e.summary.abilityChanges} kỹ năng đổi</span>` : ''}
          ${e.summary.sections.map(s => html`<span class="badge">${SECTION[s] ?? s}</span>`)}
        </div>
        <ul class="log-items">${e.items.map(it => html`<li>${
          it.kind === 'unit+' ? html`<span class="up">＋</span> ${who(it)}`
          : it.kind === 'unit-' ? html`<span class="down">－</span> ${it.name}`
          : it.kind === 'stat' ? html`${who(it)}: ${FIELD[it.field] ?? it.field} <s>${val(it.from)}</s> → <b>${val(it.to)}</b>`
          : it.kind === 'evo' ? html`${who(it)}: đổi đường tiến hóa`
          : it.kind === 'skills' ? html`${who(it)}: đổi danh sách kỹ năng`
          : it.kind === 'rename' ? html`Đổi tên: ${it.from} → ${it.to}` : it.kind
        }</li>`)}</ul>
        ${e.truncated ? html`<p class="dim">…và nhiều thay đổi khác</p>` : ''}
      </section>`) : html`<div class="empty">Chưa có lần cập nhật nào được ghi lại kể từ khi bật tính năng này.</div>`}
      ${footer()}
    </main>`;
  },
};
