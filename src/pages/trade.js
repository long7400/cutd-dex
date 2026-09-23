import { html, num } from '../lib/html.js';
import { db, linkFor } from '../db.js';
import { img, elBadge, footer } from '../ui.js';

function side(id, label, give) {
  const u = db.units[id];
  const pet = u.pet && db.pets.find(p => p.id === u.pet);
  return html`<div class="side">
    <span class="badge ${give ? '' : 'catch'}">${label}</span>
    <a href="${linkFor(id)}">${img(u.model, u.name, '', 88)}</a>
    <span class="who">${u.name}${u.level != null ? ` · Lv${u.level}` : ''}</span>
    ${elBadge(u.el)}
    <span class="bystats">HP ${num(u.hp)} · ST ${num(u.dmg)} · DPS ${num(u.dps)}</span>
    <div class="skillnames">${(u.skills ?? []).map(s => html`<span class="badge"><img class="skill-icon sm" src="${`skills/${db.abilities[s]?.icon ?? 'icon-ability'}.webp`}" alt="" width="18" height="18" loading="lazy">${db.abilities[s]?.name}</span>`)}</div>
    ${give ? (pet ? html`<a class="rootlink" href="#/pet/${pet.slug}">↗ Cây ${pet.name}</a>` : html`<span class="rootlink dim">không thuộc pet nào</span>`) : ''}
  </div>`;
}

export default {
  title: () => 'Trade',
  render() {
    return html`<main>
      <h1>Trade</h1>
      <p class="sub">Đổi pet lấy pet chỉ có qua trade. Mỗi slot có ${db.trade[0]?.recipes.length ?? 0} lựa chọn, đề nghị làm mới mỗi đợt.</p>
      ${db.trade.map(slot => html`<section class="trade-slot">
        <div class="slot-title">Slot ${slot.slot}</div>
        <div class="trade-grid">${slot.recipes.map(r => html`<div class="recipe">${side(r.give, 'ĐỔI ĐI', true)}<div class="arrow">➜</div>${side(r.get, 'NHẬN VỀ', false)}</div>`)}</div>
      </section>`)}
      ${footer()}
    </main>`;
  },
};
