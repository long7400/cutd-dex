import { html, num } from '../lib/html.js';
import { ix, unitFromParam, label } from '../db.js';
import { img, elBadge, elColor, legBadge, tierChip, researchIcons, unitChip, empty, footer, TAGS } from '../ui.js';
import { stageCard } from './pet.js';

export default {
  title: ({ params }) => unitFromParam(params[0])?.name ?? 'Sinh vật',
  render({ params }) {
    const u = unitFromParam(params[0]);
    if (!u) return empty('Không tìm thấy sinh vật', '#/units');
    const pet = u.pet && ix.petById.get(u.pet);
    const family = ix.unitList.filter(x => x.family === u.family && x.id !== u.id);
    const from = u.from ?? [];
    const evo = u.evo ?? [];

    return html`<main>
      <a class="backlink mono" href="#/units">← Toàn bộ sinh vật</a>
      <section class="hero" style="--c:${elColor(u.el)}">
        <div class="hero-art">${img(u.model, u.name, '', 220)}</div>
        <div class="hero-body">
          <div class="mono">${u.level != null ? `Lv ${u.level} · ` : ''}đòn ${label(u.atk)} · giáp ${label(u.armorType)}</div>
          <h1>${u.name} ${tierChip(u.stageTier, 'Hạng so với các con cùng tầm cấp')}</h1>
          <div class="tags">
            ${elBadge(u.el)} ${legBadge(u, true)}
            ${(u.tags ?? []).map(t => html`<span class="badge">${TAGS[t] ?? t}</span> `)}
            ${u.catchable ? html`<span class="badge up">Bắt được · ${num((u.catch ?? 0) * 100)}%</span>` : ''}
            ${u.killGold ? html`<span class="badge gold">Hạ được ${num(u.killGold)} vàng</span>` : ''}
            ${u.leak ? html`<span class="badge warn">Lọt: −${u.leak} mạng</span>` : ''}
          </div>
          ${pet ? html`<p class="lead">Thuộc cây tiến hóa của <a class="rootlink" href="#/pet/${pet.slug}/${u.id.replace(/^unit_/, '')}">${pet.name} →</a></p>` : ''}
          ${researchIcons(u.research)}
        </div>
      </section>

      <div class="timeline">${stageCard(u)}</div>

      ${from.length || evo.length ? html`<h2>Tiến hóa</h2>
        <div class="evo-links">
          ${from.length ? html`<div><span class="mono">Từ</span> ${from.map(id => unitChip(id))}</div>` : ''}
          ${evo.length ? html`<div><span class="mono">Lên</span> ${evo.map(e => unitChip(e.to, html` · ${num(e.cost)}g`))}</div>` : ''}
        </div>` : ''}

      ${family.length ? html`<h2>Cùng gia phả <small class="mono">${family.length}</small></h2>
        <div class="chip-list">${family.map(x => unitChip(x.id))}</div>` : ''}

      ${u.notes?.length ? html`<h2>Ghi chú dữ liệu</h2>${u.notes.map(n => html`<p class="note">${n}</p>`)}` : ''}
      <p class="mono dim idline">ID ${u.id} · model ${u.model} · tầm phát hiện ${num(u.acquire)}</p>
      ${footer()}
    </main>`;
  },
};
