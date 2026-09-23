import { html, num } from '../lib/html.js';
import { db, ix, linkFor } from '../db.js';
import { img, elBadge, tierChip, pageHead, footer } from '../ui.js';

function side(id, give) {
  const u = db.units[id];
  const pet = u.pet && ix.petById.get(u.pet);
  return html`<div class="side">
    <span class="mono ${give ? '' : 'up'}">${give ? 'Đổi đi' : 'Nhận về'}</span>
    <a class="side-art" href="${linkFor(id)}">${img(u.model, u.name, '', 96)}${tierChip(u.stageTier, 'Hạng so với các con cùng tầm cấp')}</a>
    <a class="who" href="${linkFor(id)}">${u.name}${u.level != null ? html` <small class="mono">Lv${u.level}</small>` : ''}</a>
    ${elBadge(u.el)}
    <span class="bystats mono">HP ${num(u.hp)} · DPS ${num(u.dps)}</span>
    <div class="skillnames">${(u.skills ?? []).map(s => html`<span class="badge"><img class="skill-icon sm" src="${`skills/${db.abilities[s]?.icon ?? 'icon-ability'}.webp`}" alt="" width="18" height="18" loading="lazy">${db.abilities[s]?.name}</span>`)}</div>
    ${give ? (pet ? html`<a class="rootlink" href="#/pet/${pet.slug}">↗ Cây ${pet.name}</a>` : html`<span class="dim">không thuộc pet nào</span>`) : ''}
  </div>`;
}

export default {
  title: () => 'Trade',
  render() {
    return html`<main>
      ${pageHead('Trade', { lead: `Đổi pet lấy pet chỉ có qua trade. Mỗi slot có ${db.trade[0]?.recipes.length ?? 0} lựa chọn, đề nghị làm mới mỗi đợt. Chữ trên ảnh là hạng của dạng đó so với các con cùng tầm cấp.` })}
      ${db.trade.map(slot => html`<section class="trade-slot">
        <div class="slot-title mono">Slot ${slot.slot}</div>
        <div class="trade-grid">${slot.recipes.map(r => html`<div class="recipe">${side(r.give, true)}<div class="arrow">➜</div>${side(r.get, false)}</div>`)}</div>
      </section>`)}
      ${footer()}
    </main>`;
  },
};
