import './video.css';
import { html, toString } from '../../lib/html.js';
import { db, portrait } from '../../db.js';
import { evoLines } from '../../lib/showcase.js';
import { DOWN } from '../../lib/icons.js';

const TIERS = ['C', 'B', 'A', 'S', 'S+'];

function evoExample(lines) {
  let best = null;
  for (const l of lines) {
    l.stages.forEach((s, i) => {
      const p = l.stages[i - 1];
      if (!p || p.model === s.model) return;
      const gain = TIERS.indexOf(s.tier) - TIERS.indexOf(p.tier);
      if (!best || gain > best.gain) best = { gain, p, s, next: l.stages[i + 1] };
    });
  }
  if (!best) return null;
  const { p, s, next } = best;
  return {
    from: { m: p.model, n: p.name, t: p.tier, lv: p.level, dps: p.dps },
    to: { m: s.model, n: s.name, t: s.tier, lv: s.level, dps: s.dps, next: next ? next.cost - s.cost : 0 },
    cost: s.cost - p.cost,
  };
}

function tradeExample() {
  const rank = t => TIERS.indexOf(t ?? 'C');
  const all = (db.trade ?? []).flatMap(s => s.recipes.map(r => ({ slot: s.slot, give: db.units[r.give], get: db.units[r.get] }))).filter(x => x.give && x.get);
  const best = all.sort((a, b) => (rank(b.get.stageTier) - rank(b.give.stageTier)) - (rank(a.get.stageTier) - rank(a.give.stageTier)))[0];
  if (!best) return null;
  const pack = u => ({ m: u.model, n: u.name, t: u.stageTier ?? 'C', lv: u.level });
  const others = all.filter(x => x.slot === best.slot && x !== best).slice(0, 1).map(x => ({ ...pack(x.give), slot: x.slot }));
  return { slot: best.slot, give: pack(best.give), get: pack(best.get), others };
}

export const videoMarkup = (cta = '') => html`<div class="h-video">
  <div class="vstage">
    <div class="vboard" style="background-image:url(art/top.webp)">
      <div class="vlane" style="top:20%" data-row="0">TANK</div><div class="vlane" style="top:39%" data-row="1">CẬN</div><div class="vlane" style="top:58%" data-row="2">XA</div><div class="vlane" style="top:77%" data-row="3">HEAL</div>
    </div>
    <div class="vpanel">
      <div class="top"><b>CUTD Helper</b><small>m. · móc</small></div>
      <div class="vtabs"><span data-t="trade">Trade</span><span data-t="wild">Wild</span><span data-t="team">Đội</span><span data-t="wave">Đợt</span></div>
      <div class="vbody"></div>
    </div>
    <canvas class="vfx"></canvas>
    <div class="vtoast"></div>
    <div class="vcursor"></div>
  </div>
  <div class="vctrl"><button class="vplay" type="button" aria-label="Tạm dừng">❚❚</button><div class="vbar"><i></i><div class="vmarks"></div></div></div>
</div>
<div class="h-caption"><span class="h-mono vcap"></span>${cta ? html`<a class="h-btn primary bm" href="${cta}" title="Kéo nút này lên thanh bookmark">${DOWN}Kéo lên thanh bookmark</a>` : ''}</div>`;

export function mountVideo(section, cleanups) {
  const evo = evoExample(evoLines(db)), trade = tradeExample();
  if (!evo || !trade || !('IntersectionObserver' in window) || !('ResizeObserver' in window)) { section.hidden = true; return; }
  import('./demo.js').then(({ mountDemo }) => {
    if (!section.isConnected) return;
    const demo = mountDemo(section.querySelector('.h-video'), { img: portrait, evo, trade });
    section.querySelector('.vmarks').innerHTML = toString(demo.chapters.slice(1).map(c => html`<span style="left:${(c.start * 100).toFixed(2)}%"></span>`));
    cleanups.push(() => demo.destroy());
  }).catch(() => { section.hidden = true; });
}
