import { html, num } from '../lib/html.js';
import { ix, unitFromParam } from '../db.js';
import { img, elBadge, legBadge, researchIcons, unitChip, empty, footer, TAGS } from '../ui.js';
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
      <a class="backlink" href="#/units">← Sinh vật</a>
      <div class="detail-head">
        ${img(u.model, u.name, 'big', 128)}
        <div class="grow">
          <h1>${u.name}${u.level != null ? html` <small class="dim">Lv ${u.level}</small>` : ''} ${legBadge(u, true)}</h1>
          <div class="tags">
            ${elBadge(u.el)}
            ${(u.tags ?? []).map(t => html`<span class="badge">${TAGS[t] ?? t}</span> `)}
            ${u.catchable ? html`<span class="badge catch">Bắt được · ${num((u.catch ?? 0) * 100)}%</span>` : ''}
            ${u.killGold ? html`<span class="badge gold">Hạ được ${num(u.killGold)} vàng</span>` : ''}
            ${u.leak ? html`<span class="badge">Lọt: −${u.leak} mạng</span>` : ''}
          </div>
          ${pet ? html`<p class="sub" style="margin:8px 0 0">Thuộc cây tiến hóa của <a class="rootlink" href="#/pet/${pet.slug}/${u.id.replace(/^unit_/, '')}">${pet.name} →</a></p>` : ''}
          ${researchIcons(u.research)}
        </div>
      </div>

      ${stageCard(u)}

      ${from.length || evo.length ? html`<h2>Tiến hóa</h2>
        <div class="evo-links">
          ${from.length ? html`<div><span class="dim">Từ:</span> ${from.map(id => unitChip(id))}</div>` : ''}
          ${evo.length ? html`<div><span class="dim">Lên:</span> ${evo.map(e => unitChip(e.to, html` · ${num(e.cost)}g`))}</div>` : ''}
        </div>` : ''}

      ${family.length ? html`<h2>Cùng gia phả (${family.length})</h2>
        <div class="chip-list">${family.map(x => unitChip(x.id))}</div>` : ''}

      ${u.notes?.length ? html`<h2>Ghi chú dữ liệu</h2>${u.notes.map(n => html`<p class="note">${n}</p>`)}` : ''}
      <p class="dim">ID: <code>${u.id}</code> · model <code>${u.model}</code> · tầm phát hiện ${num(u.acquire)}</p>
      ${footer()}
    </main>`;
  },
};

