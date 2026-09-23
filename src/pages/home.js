import '@fontsource/big-shoulders-display/900';
import '@fontsource/barlow/500';
import '@fontsource/barlow/600';
import '@fontsource/barlow/700';
import '@fontsource/barlow/800';
import '@fontsource/jetbrains-mono/700';
import './home.css';
import { html, toString, num } from '../lib/html.js';
import { db, portrait, label } from '../db.js';
import { evoLines, HERO_TEAM, HERO_CREEPS, COURT } from '../lib/showcase.js';
import tool from '../data/tool.json';

const GAME_URL = 'https://m.cutd.site/';
const TIERS = ['C', 'B', 'A', 'S', 'S+'];
const cls = t => ({ 'S+': 't-sp', S: 't-s', A: 't-a', B: 't-b', C: 't-c' })[t] ?? 't-c';
const TC = { 'S+': '#ffde8f', S: '#ff9f43', A: '#9af0ce', B: '#9fbcd9', C: '#aec4d3' };
const EL = { fire: '#ff9f43', water: '#5aa9ff', grass: '#9af0ce', lightning: '#ffd452', psychic: '#a98bff', fighter: '#ff7a5c', normal: '#e1d2a9' };
const art = name => `art/${name}.glb`;
const bookmarklet = () => `javascript:${encodeURIComponent(tool.code)}`;

const PLAY = html`<svg viewBox="0 0 20 20" fill="currentColor" aria-hidden="true"><path d="M6 3.5v13l11-6.5z"/></svg>`;
const DOWN = html`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 3v10M5.5 8.5 10 13l4.5-4.5M4 17h12"/></svg>`;
const BOOK = html`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 4.5c2.5-1 5-1 7 .5 2-1.5 4.5-1.5 7-.5V16c-2.5-1-5-1-7 .5-2-1.5-4.5-1.5-7-.5z"/><path d="M10 5v11.5"/></svg>`;

function waves() {
  const set = db.waveSets.find(w => w.id === 'mode_survival') ?? db.waveSets[0];
  const good = db.strategy.lines.filter(l => ['S+', 'S'].includes(l.solo.tier)).sort((a, b) => b.solo.score - a.solo.score);
  const table = db.damage.table;
  return (set?.waves ?? []).slice(11, 15).map(w => {
    const g = w.groups[0], u = db.units[g?.unit];
    if (!u) return null;
    const strong = Object.keys(table).filter(a => table[a][u.armorType] >= 2);
    const weak = Object.keys(table).filter(a => table[a][u.armorType] <= 0.5);
    const pets = good.filter(l => strong.includes(l.atk)).slice(0, 3).map(l => ({ ...db.units[l.emax.id], tier: l.solo.tier }));
    const avoid = good.filter(l => weak.includes(l.atk)).slice(0, 1).map(l => db.units[l.emax.id].name);
    return { n: w.n, u, count: g.count, lives: w.lives, strong, weak, pets, avoid };
  }).filter(Boolean);
}

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

export default {
  chrome: false,
  title: () => '',
  render() {
    const W = waves();
    return html`<div class="home">
      <nav class="h-nav h-wrap">
        <a class="h-mark" href="#/">CUTD <b>DEX</b></a>
        <a href="#/pets">Pets</a><a href="#/strategy">Chiến thuật</a><a href="#/waves">Đợt quái</a><a href="#/trade">Trade</a><a href="#/tool">Công cụ</a>
      </nav>

      <section class="h-hero">
        <img class="h-still" src="art/hero.webp" alt="">
        <canvas class="h-court" aria-label="Sân Moonlit Court 3D — kéo để xoay"></canvas>
        <div class="h-shade"></div>
        <div class="h-copy h-wrap">
          <h1>CUTD<br><b>DEX</b></h1>
          <p>Sổ tay chiến thuật của sân Moonlit Court: hạng từng pet theo từng cấp, đợt quái sắp tới, trade, bãi hoang — đọc thẳng từ dữ liệu game mỗi giờ.</p>
          <div class="h-btns">
            <a class="h-btn primary" href="${GAME_URL}" target="_blank" rel="noopener noreferrer">${PLAY}Mở game</a>
            <a class="h-btn" href="#/tool">${DOWN}Tải tool</a>
            <a class="h-btn quiet" href="#/pets">${BOOK}Mở wiki</a>
          </div>
        </div>
        <div class="h-drag h-mono">KÉO ĐỂ XOAY SÂN</div>
      </section>

      <section class="h-evo h-wrap">
        <div class="h-hd">
          <div><h2>Nuôi con nào tới <em>Lv100?</em></h2><div class="h-mono h-hint">MỖI DÒNG 3 DẠNG · BẤM TỪNG CẤP ĐỂ XEM HẠNG Ở CẤP ĐÓ</div></div>
          <div class="h-lines"></div>
        </div>
        <div class="h-stage">
          <div class="h-ghost"></div>
          <div class="h-tierbig"><b></b><span class="h-mono">HẠNG Ở CẤP NÀY</span></div>
          <canvas class="h-ped" aria-label="Pet 3D trên bệ — kéo để xoay"></canvas><img class="h-pedimg" alt="">
          <div class="h-stat">
            <div class="nm"></div><div class="lvl h-mono"></div>
            <div class="row"><b data-k="dps"></b><span class="h-mono">DPS THẬT</span></div>
            <div class="row"><b data-k="cost"></b><span class="h-mono">VÀNG TỪ LV1</span></div>
            <div class="row"><b data-k="hp"></b><span class="h-mono">MÁU</span></div>
          </div>
        </div>
        <div class="h-forms"></div>
        <div class="h-play"><span class="h-mono h-note"></span><button class="h-btn" type="button" data-auto>▶ Xem tiến hóa</button></div>
      </section>

      <section class="h-band h-wrap">
        <h2>Đợt tới — <em>đem ai ra?</em></h2>
        <p class="h-lead">Mỗi loại quái mặc một loại giáp. Đòn đúng khắc gây <b class="up">×2 sát thương</b>, đòn sai chỉ còn <b class="down">×0,5</b>. Wiki tính sẵn cho từng đợt: nên đem pet nào, tránh pet nào.</p>
        <div class="h-matchup">${W.map(w => html`<div class="h-mrow">
          <div class="no"><span class="h-mono">ĐỢT</span><b>${w.n}</b></div>
          <div class="foe"><img src="${portrait(w.u.model)}" alt="" loading="lazy"><div><b>${w.count} × ${w.u.name}</b><span class="h-mono">${num(w.u.hp * w.count)} MÁU · MẤT ${w.lives} MẠNG NẾU LỌT</span><br><span class="armor">GIÁP ${label(w.u.armorType).toUpperCase()}</span></div></div>
          <div class="bring"><div class="lab">ĐEM ĐÒN ${w.strong.map(a => label(a)).join(' / ').toUpperCase()} — ×2</div><div class="pets">${w.pets.map(p => html`<span class="pp"><img src="${portrait(p.model)}" alt="" loading="lazy"><i class="${cls(p.tier)}">${p.tier}</i>${p.name}</span>`)}</div></div>
          <div class="avoid"><b>TRÁNH ĐÒN ${w.weak.map(a => label(a)).join(' / ').toUpperCase()} ×0,5</b>${w.avoid.length ? `vd ${w.avoid.join(', ')}` : ''}</div>
        </div>`)}</div>
      </section>

      <section class="h-band h-tool h-wrap" id="helper">
        <h2>Trợ lý <em>ngay trong trận.</em></h2>
        <div class="h-video">
          <div class="vstage">
            <div class="vboard" style="background-image:url(art/top.webp)">
              <div class="vlane" style="top:20%" data-row="0">TANK</div><div class="vlane" style="top:39%" data-row="1">CẬN</div><div class="vlane" style="top:58%" data-row="2">BUFF</div><div class="vlane" style="top:77%" data-row="3">XA</div>
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
        <div class="h-caption"><span class="h-mono vcap"></span><a class="h-btn primary" href="${bookmarklet()}" title="Kéo nút này lên thanh bookmark">${DOWN}Kéo lên thanh bookmark</a></div>
      </section>

      <section class="h-final" style="background-image:url(art/finale.webp)">
        <div>
          <h2>Vào trận.</h2>
          <div class="h-btns"><a class="h-btn primary" href="${GAME_URL}" target="_blank" rel="noopener noreferrer">${PLAY}Mở game</a><a class="h-btn" href="#/tool">${DOWN}Cài tool</a></div>
        </div>
      </section>
      <footer class="h-foot h-wrap h-mono"><span>DỮ LIỆU TỪ CUTD.SITE · CẬP NHẬT MỖI GIỜ</span><a href="https://github.com/long7400/cutd-dex" target="_blank" rel="noopener noreferrer">GITHUB.COM/LONG7400/CUTD-DEX</a></footer>
    </div>`;
  },

  mount(root) {
    const home = root.querySelector('.home');
    const $ = s => home.querySelector(s);
    const cleanups = [];
    this.unmount = () => { cleanups.splice(0).forEach(fn => { try { fn(); } catch { } }); };
    const hasGL = (() => { try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; } })();
    const lowPower = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

    const lines = evoLines(db);
    let line = 0, stage = 0, timer = 0, ped = null;
    const forms = L => { const out = []; L.stages.forEach((s, i) => { const f = out.at(-1); if (f && f.model === s.model) f.idx.push(i); else out.push({ model: s.model, name: s.name, idx: [i] }); }); return out; };
    const renderLines = () => { $('.h-lines').innerHTML = toString(lines.map((l, i) => html`<button type="button" class="line ${i === line ? 'on' : ''}" data-i="${i}"><img src="${portrait(l.stages.at(-1).model)}" alt="">${l.stages.at(-1).name}</button>`)); };
    const setStage = (i, mode = 'jump') => {
      const L = lines[line], s = L.stages[i], prev = L.stages[stage], forward = i > stage;
      stage = i;
      home.style.setProperty('--el', EL[L.el] ?? '#5aa9ff');
      $('.h-ghost').textContent = s.name;
      $('.h-pedimg').src = portrait(s.model);
      const tb = $('.h-tierbig b'); tb.textContent = s.tier; tb.style.color = TC[s.tier];
      $('.h-stat .nm').textContent = s.name;
      $('.h-stat .lvl').textContent = `LV${s.level} · ĐÒN ${label(L.atk).toUpperCase()}`;
      $('[data-k="dps"]').textContent = num(s.dps); $('[data-k="cost"]').textContent = num(s.cost); $('[data-k="hp"]').textContent = num(s.hp);
      $('.h-forms').innerHTML = toString(forms(L).map(f => html`<div class="form ${f.idx.includes(i) ? 'on' : ''} ${f.idx.at(-1) < i ? 'past' : ''}" data-j="${f.idx[0]}"><img src="${portrait(f.model)}" alt=""><div><b>${f.name}</b><div class="lv">${f.idx.map(j => html`<i class="${cls(L.stages[j].tier)} ${j === i ? 'on' : ''}" data-j="${j}">Lv${L.stages[j].level} ${L.stages[j].tier}</i>`)}</div></div></div>`));
      const peak = L.stages.at(-1);
      $('.h-note').textContent = `${L.stages[0].name.toUpperCase()} LV1 → ${peak.name.toUpperCase()} LV${peak.level} · ${num(peak.cost)} VÀNG · HẠNG DÒNG ${L.tier}`;
      if (ped && (mode === 'init' || s.model !== prev?.model)) ped.show(art(s.model), { evolve: mode !== 'init' && forward && s.model !== prev?.model, color: EL[L.el] ?? '#ffffff' });
    };
    const stopAuto = () => { clearInterval(timer); timer = 0; $('[data-auto]').textContent = '▶ Xem tiến hóa'; };
    cleanups.push(stopAuto);
    if (lines.length) {
      $('.h-lines').addEventListener('click', e => { const b = e.target.closest('.line'); if (b) { line = +b.dataset.i; stage = 0; renderLines(); stopAuto(); setStage(0, 'init'); } });
      $('.h-forms').addEventListener('click', e => { const t = e.target.closest('[data-j]'); if (t) { stopAuto(); setStage(+t.dataset.j); } });
      $('[data-auto]').addEventListener('click', () => {
        if (timer) return stopAuto();
        $('[data-auto]').textContent = '■ Dừng';
        setStage(0);
        timer = setInterval(() => { if (stage + 1 >= lines[line].stages.length) return stopAuto(); setStage(stage + 1); }, 1900);
      });
      renderLines();
      setStage(0, 'init');
    }

    if (!hasGL) { home.classList.add('no-gl'); } else {
      import('../three/pedestal.js').then(({ mountPedestal }) => {
        if (!home.isConnected) return;
        ped = mountPedestal($('.h-ped'), { monster: m => m });
        cleanups.push(() => ped.destroy());
        if (lines.length) ped.show(art(lines[line].stages[stage].model), { color: EL[lines[line].el] ?? '#ffffff' });
      }).catch(() => home.classList.add('no-gl'));
      if (!lowPower) {
        import('../three/court.js').then(({ mountCourt }) => mountCourt($('.h-court'), {
          court: art(COURT), monster: art, team: HERO_TEAM, creeps: HERO_CREEPS, view: { pos: [7, 2.4, 16.5], target: [0, 1.4, 0] },
        })).then(stop => {
          if (!home.isConnected) return stop();
          cleanups.push(stop);
          home.classList.add('gl-ready');
        }).catch(() => { });
      }
    }

    const evo = evoExample(lines), trade = tradeExample();
    if (evo && trade && 'IntersectionObserver' in window && 'ResizeObserver' in window) {
      import('./home/demo.js').then(({ mountDemo }) => {
        if (!home.isConnected) return;
        const demo = mountDemo($('.h-video'), { img: portrait, evo, trade });
        $('.vmarks').innerHTML = toString(demo.chapters.slice(1).map(c => html`<span style="left:${(c.start * 100).toFixed(2)}%"></span>`));
        cleanups.push(() => demo.destroy());
      });
    } else $('.h-tool').hidden = true;
  },
};
