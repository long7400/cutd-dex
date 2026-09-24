const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = t => 1 - Math.pow(1 - clamp(t), 3);
const easeInOut = t => { t = clamp(t); return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; };
const back = t => { t = clamp(t); const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); };
const win = (t, a, b) => clamp((t - a) / (b - a));
const TIER = { 'S+': 't-sp', S: 't-s', A: 't-a', B: 't-b', C: 't-c' };
const E = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export function mountDemo(root, { img, evo, trade }) {
  const stage = root.querySelector('.vstage');
  const board = root.querySelector('.vboard');
  const fx = root.querySelector('.vfx');
  const ctx = fx.getContext('2d');
  const body = root.querySelector('.vbody');
  const tabs = [...root.querySelectorAll('.vtabs span')];
  const cursor = root.querySelector('.vcursor');
  const toast = root.querySelector('.vtoast');
  const bar = root.querySelector('.vbar i');
  const caption = root.querySelector('.vcap') ?? document.querySelector('.vcap');
  const playBtn = root.querySelector('.vplay');

  const TEAM = [
    { m: 'pet_banjilasi', n: 'Tyranitar', r: 0, t: 'S+' }, { m: 'pet_kuailong', n: 'Dragonite', r: 0, t: 'B' },
    { m: 'download_primeape', n: 'Primeape', r: 1, t: 'S+' }, { ...evo.from, r: 1 }, { ...trade.give, r: 1 },
    { m: 'pet_michunjie', n: 'Jynx', r: 3, t: 'S+' }, { m: 'pet_hudi', n: 'Alakazam', r: 2, t: 'S+' }, { m: 'pet_s_baolilong', n: 'Mega Gyarados', r: 2, t: 'S+' },
  ];
  const rowY = [27, 46, 65, 84];
  const HOME = TEAM.map(p => { const same = TEAM.filter(x => x.r === p.r); const k = same.indexOf(p); return [46 + (k - (same.length - 1) / 2) * 13, rowY[p.r]]; });
  const MESSY = [[30, 62], [72, 40], [24, 34], [60, 80], [80, 70], [40, 46], [66, 22], [52, 58]];
  const TY = evo.to, MB = trade.get, EV = { m: 'download_eevee', n: 'Eevee', t: 'S+' };
  const fmt = n => Number(n).toLocaleString('vi-VN');
  const EVEE_AT = [78, 46];

  const toks = [...TEAM, EV].map(p => {
    const d = document.createElement('div');
    d.className = 'vtok';
    d.innerHTML = `<div class="sh"></div><img alt=""><span class="tg"></span><span class="ok">✓</span>`;
    board.appendChild(d);
    return { el: d, img: d.querySelector('img'), tg: d.querySelector('.tg'), ok: d.querySelector('.ok'), cur: '', tier: '' };
  });
  const setLook = (k, p) => {
    if (k.cur !== p.m) { k.img.src = img(p.m); k.cur = p.m; }
    if (k.tier !== p.t) { k.tg.textContent = p.t; k.tg.className = `tg ${TIER[p.t]}`; k.tier = p.t; }
  };

  const row = (p, sub, right, id = '') => `<div class="r"><img src="${E(img(p.m))}" alt=""><span>${E(p.n)}<small>${E(sub)}</small></span><span class="tg ${TIER[p.t] ?? ''}">${E(p.t)}</span>${right.replace('<span class="act"', `<span class="act"${id ? ` data-id="${id}"` : ''}`)}</div>`;
  const PANELS = {
    xep: s => `<span class="xep" data-id="btn">${s.xep}</span>${TEAM.slice(0, 4).map(p => row(p, 'Lv100', '<span class="act">↑</span>')).join('')}`,
    nang: s => (s.evolved ? row(TY, `Lv${TY.lv} · DPS ${fmt(TY.dps)}`, `<span class="act">${TY.next ? `↑ ${fmt(TY.next)}g` : 'Max'}</span>`) : row(TEAM[3], `Lv${evo.from.lv} · DPS ${fmt(evo.from.dps)}`, `<span class="act">↑ ${E(TY.n)} ${fmt(evo.cost)}g</span>`, 'btn'))
      + row(TEAM[4], 'Lv100', '<span class="act">Max</span>') + row(TEAM[1], 'Lv55', '<span class="act">↑ 900g</span>'),
    trade: s => `<div class="r ${s.traded ? 'dim' : ''}"><img src="${E(img(TEAM[4].m))}"><span>S${E(trade.slot)} · đưa ${E(TEAM[4].n)}<small>hạng ${E(TEAM[4].t)} · có trong đội</small></span><span class="tg ${TIER[TEAM[4].t] ?? ''}">${E(TEAM[4].t)}</span><span class="act" data-id="btn">${s.traded ? 'Đã đổi' : '⇄ Trade'}</span></div>`
      + `<div class="r"><img src="${E(img(MB.m))}"><span>nhận ${E(MB.n)}<small>Lv${E(MB.lv)}</small></span><span class="tg ${TIER[MB.t] ?? ''}">${E(MB.t)}</span><span></span></div>`
      + trade.others.map(o => `<div class="r dim"><img src="${E(img(o.m))}"><span>S${E(o.slot)} · đưa ${E(o.n)}<small>chưa có</small></span><span class="tg ${TIER[o.t] ?? ''}">${E(o.t)}</span><span class="act">Chưa có</span></div>`).join(''),
    bat: s => [EV, { m: 'pet_piqiu', n: 'Pichu', t: 'S' }, { m: 'pet_guisi', n: 'Gastly', t: 'A' }, { m: 'download_magnemite', n: 'Magnemite', t: 'B' }]
      .map((w, i) => row(w, `Lv1 · dòng hạng ${w.t}`, `<span class="act">${i === 0 && s.caught ? 'Đã bắt' : `Bắt ${[20, 20, 30, 10][i]}g`}</span>`, i === 0 ? 'btn' : '')).join('')
      + `<div class="gold"><span>VÀNG</span><b>${s.gold}</b></div>`,
  };

  const CH = [
    { k: 'xep', tab: 'team', len: 8.6, cap: 'Đội đứng lộn xộn → một chạm Xếp đội: TANK chặn đầu, tay dài và hồi máu đứng sau, mỗi lệnh chờ game xác nhận ✓', toast: [6.6, 8.3, 'Đội hình xong · 8/8 ✓'], click: 1.4 },
    { k: 'nang', tab: 'team', len: 7.2, cap: 'Hạng hiện tại nằm cạnh nút ↑ — biết ngay lên cấp có đáng không', toast: [2.9, 6.8, `${evo.from.n} → ${evo.to.n} · hạng ${evo.from.t} → ${evo.to.t} · DPS ${fmt(evo.from.dps)} → ${fmt(evo.to.dps)}`], click: 1.3 },
    { k: 'trade', tab: 'trade', len: 7.2, cap: `Slot trade đổi được ngay sẽ sáng lên — con hạng ${trade.give.t} đổi lấy con hạng ${trade.get.t} chỉ một chạm`, toast: [2.8, 6.8, `${trade.give.n} (${trade.give.t}) ⇄ ${trade.get.n} (${trade.get.t})`], click: 1.3 },
    { k: 'bat', tab: 'wild', len: 7.2, cap: 'Bãi hoang có hạng ngay cạnh nút Bắt — không cần nhớ tên pet', toast: [2.6, 6.8, 'Đã bắt Eevee (S+) · −20 vàng'], click: 1.3 },
  ];
  const starts = []; let total = 0;
  for (const c of CH) { starts.push(total); total += c.len; }

  let W = 0, H = 0, BW = 0, BH = 0, BX = 0, BY = 0, dpr = 1;
  const measure = () => {
    const r = stage.getBoundingClientRect(), b = board.getBoundingClientRect();
    W = r.width; H = r.height; BW = b.width; BH = b.height; BX = b.left - r.left; BY = b.top - r.top;
    dpr = Math.min(2, devicePixelRatio);
    fx.width = W * dpr; fx.height = H * dpr;
    for (const k of toks) k.el.style.width = `${BW * 0.11}px`;
  };
  const ro = new ResizeObserver(measure);
  ro.observe(stage);
  measure();
  const bp = ([x, y]) => [BX + x / 100 * BW, BY + y / 100 * BH];

  let chapter = -1, panelKey = '', particles = [], lastFx = new Set();
  const panelTarget = () => {
    const el = body.querySelector('[data-id="btn"]');
    if (!el) return [W * 0.8, H * 0.3];
    const r = el.getBoundingClientRect(), s = stage.getBoundingClientRect();
    return [r.left - s.left + r.width * 0.55, r.top - s.top + r.height * 0.6];
  };
  const burst = (x, y, kind, color = '#ffde8f') => {
    const n = kind === 'ripple' ? 0 : kind === 'evolve' ? 70 : kind === 'swirl' ? 60 : 36;
    particles.push({ kind: kind + '-ring', x, y, t: 0, life: kind === 'ripple' ? 0.55 : 0.9, color });
    if (kind === 'evolve') particles.push({ kind: 'rays', x, y, t: 0, life: 1.1, color });
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2, sp = (kind === 'swirl' ? 60 : 90) + Math.random() * 160;
      particles.push({ kind: kind === 'swirl' ? 'orb' : kind === 'dust' ? 'dust' : 'spark', x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (kind === 'dust' ? 20 : 60), a, r: 20 + Math.random() * 40, t: 0, life: 0.6 + Math.random() * 0.6, color });
    }
  };
  const drawFx = dt => {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, W, H);
    particles = particles.filter(p => (p.t += dt) < p.life);
    for (const p of particles) {
      const k = p.t / p.life;
      ctx.globalAlpha = 1 - k;
      if (p.kind.endsWith('-ring')) {
        ctx.strokeStyle = p.color; ctx.lineWidth = p.kind.startsWith('ripple') ? 2.5 : 3 * (1 - k) + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, (p.kind.startsWith('ripple') ? 26 : BW * 0.12) * ease(k) + 4, 0, Math.PI * 2); ctx.stroke();
      } else if (p.kind === 'rays') {
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(k * 0.8);
        for (let i = 0; i < 12; i++) { ctx.rotate(Math.PI / 6); const g = ctx.createLinearGradient(0, 0, BW * 0.16, 0); g.addColorStop(0, p.color); g.addColorStop(1, 'rgba(255,255,255,0)'); ctx.fillStyle = g; ctx.beginPath(); ctx.moveTo(0, -3); ctx.lineTo(BW * 0.16 * ease(k * 1.4), 0); ctx.lineTo(0, 3); ctx.fill(); }
        ctx.restore();
      } else if (p.kind === 'orb') {
        const ang = p.a + p.t * 7, rr = p.r * (1 - k * 0.6);
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(p.x + Math.cos(ang) * rr, p.y - 20 + Math.sin(ang) * rr * 0.5 - p.t * 30, 3 * (1 - k) + 1, 0, Math.PI * 2); ctx.fill();
      } else {
        p.vy += (p.kind === 'dust' ? 60 : 160) * dt;
        p.x += p.vx * dt * (p.kind === 'dust' ? 0.6 : 1); p.y += p.vy * dt * (p.kind === 'dust' ? 0.35 : 1);
        ctx.fillStyle = p.kind === 'dust' ? 'rgba(230,242,255,.8)' : p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.kind === 'dust' ? 4 * (1 - k) + 1 : 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  };

  const place = (k, xy, { scale = 1, rot = 0, lift = 0, glow = 0, alpha = 1 } = {}) => {
    const [x, y] = bp(xy);
    k.el.style.transform = `translate(${x}px, ${y - lift}px) translate(-50%, -80%) scale(${scale}) rotateY(${rot}deg)`;
    k.el.style.opacity = alpha;
    k.img.style.filter = glow ? `brightness(${1 + glow * 2.5}) drop-shadow(0 0 ${12 * glow}px #fff)` : '';
  };
  const render = (t, dt) => {
    let c = 0;
    while (c + 1 < CH.length && t >= starts[c + 1]) c++;
    const lt = t - starts[c], C = CH[c];
    if (c !== chapter) { chapter = c; particles = []; lastFx.clear(); caption.textContent = C.cap; tabs.forEach(s => s.classList.toggle('on', s.dataset.t === C.tab)); }
    const st = { xep: 'Xếp đội', evolved: false, traded: false, caught: false, gold: 500 };
    const fire = (id, at, fn) => { if (lt >= at && !lastFx.has(id)) { lastFx.add(id); fn(); } };

    const look = TEAM.slice();
    if (c >= 2) look[3] = TY;
    if (c >= 3) look[4] = MB;
    toks[8].el.style.opacity = 0;
    if (C.k === 'xep') {
      let arrived = 0;
      TEAM.forEach((p, i) => {
        const s0 = 1.8 + i * 0.52, m = back(win(lt, s0, s0 + 0.62));
        const a = MESSY[i], b = HOME[i];
        place(toks[i], [a[0] + (b[0] - a[0]) * m, a[1] + (b[1] - a[1]) * m], { lift: Math.sin(Math.PI * win(lt, s0, s0 + 0.62)) * BH * 0.05 });
        const ok = win(lt, s0 + 0.6, s0 + 0.8);
        toks[i].ok.style.transform = `scale(${back(ok)})`; toks[i].ok.style.opacity = ok;
        if (lt >= s0 + 0.62) arrived++;
        fire(`land${i}`, s0 + 0.62, () => { const [x, y] = bp(b); burst(x, y, 'dust'); });
      });
      root.querySelectorAll('.vlane').forEach(l => { const r = +l.dataset.row; l.classList.toggle('lit', TEAM.some((p, i) => p.r === r && lt >= 1.8 + i * 0.52 + 0.62)); });
      st.xep = lt >= 1.5 && arrived < 8 ? `Dừng ${Math.min(8, arrived + 1)}/8` : 'Xếp đội';
    } else {
      root.querySelectorAll('.vlane').forEach(l => l.classList.add('lit'));
      TEAM.forEach((p, i) => { place(toks[i], HOME[i], { lift: Math.sin(t * 2.2 + i) * 2 }); toks[i].ok.style.opacity = 0; });
    }
    if (C.k === 'nang') {
      const g = win(lt, 1.5, 2.1), g2 = win(lt, 2.1, 2.7);
      const k = toks[3];
      if (lt >= 2.1) look[3] = TY;
      place(k, HOME[3], { scale: lt < 2.1 ? 1 - 0.35 * easeInOut(g) : 0.65 + 0.35 * back(g2), glow: lt < 2.1 ? g : 1 - g2, lift: Math.sin(Math.PI * clamp((lt - 1.5) / 1.2)) * BH * 0.04 });
      fire('evo', 2.1, () => { const [x, y] = bp(HOME[3]); burst(x, y - BW * 0.05, 'evolve', '#ffde8f'); });
      st.evolved = lt >= 2.1;
    }
    if (C.k === 'trade') {
      const k = toks[4], g = win(lt, 1.5, 2.0), g2 = win(lt, 2.0, 2.5);
      if (lt >= 2.0) look[4] = MB;
      place(k, HOME[4], { rot: lt < 2.0 ? 90 * easeInOut(g) : 90 - 90 * ease(g2), scale: lt < 2.0 ? 1 - 0.2 * g : 0.8 + 0.2 * back(g2) });
      fire('swirl', 1.6, () => { const [x, y] = bp(HOME[4]); burst(x, y - BW * 0.05, 'swirl', '#9af0ce'); });
      st.traded = lt >= 2.0;
    }
    if (C.k === 'bat') {
      const k = toks[8], g = win(lt, 1.5, 2.15);
      setLook(k, EV);
      k.el.style.opacity = lt >= 1.5 ? 1 : 0;
      if (lt >= 1.5) place(k, [EVEE_AT[0], EVEE_AT[1] - (1 - back(g)) * 40], { scale: 0.7 + 0.3 * ease(g) });
      fire('land', 2.0, () => { const [x, y] = bp(EVEE_AT); burst(x, y, 'dust'); });
      st.caught = lt >= 1.5;
      st.gold = Math.round(500 - 20 * ease(win(lt, 1.5, 2.1)));
    }

    toks.forEach((k, i) => { if (i < TEAM.length) setLook(k, look[i]); });
    const key = C.k + JSON.stringify(st);
    if (key !== panelKey) { panelKey = key; body.innerHTML = PANELS[C.k](st); }
    const press = lt >= C.click && lt < C.click + 0.28;
    body.querySelector('[data-id="btn"]')?.classList.toggle('hit', press || (C.k === 'xep' && st.xep !== 'Xếp đội'));
    fire('click', C.click, () => { const [x, y] = panelTarget(); burst(x, y, 'ripple', '#ffde8f'); });

    const [tx, ty] = panelTarget();
    const from = [W * 0.46, H * 0.62];
    const m = easeInOut(win(lt, 0.25, C.click - 0.05));
    const back2 = easeInOut(win(lt, C.len - 1.2, C.len - 0.2));
    const cx = from[0] + (tx - from[0]) * m + (from[0] - tx) * back2, cy = from[1] + (ty - from[1]) * m + (from[1] - ty) * back2;
    cursor.style.transform = `translate(${cx}px, ${cy}px) scale(${press ? 0.85 : 1})`;

    const [a, b, text] = C.toast;
    const tin = ease(win(lt, a, a + 0.35)), tout = easeInOut(win(lt, b - 0.35, b));
    const vis = tin * (1 - tout);
    if (toast.textContent !== text) toast.textContent = text;
    toast.style.opacity = vis;
    toast.style.transform = `translate(-50%, ${(1 - tin) * -14 + tout * -8}px) scale(${0.96 + 0.04 * tin})`;

    bar.style.transform = `scaleX(${t / total})`;
    drawFx(dt);
  };

  let t = 0, playing = true, visible = false, last = performance.now(), raf = 0, alive = true;
  const loop = now => {
    if (!alive) return;
    raf = requestAnimationFrame(loop);
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!visible) return;
    if (playing) t = (t + dt) % total;
    render(t, playing ? dt : 0);
  };
  raf = requestAnimationFrame(loop);
  const io = new IntersectionObserver(([e]) => { visible = e.isIntersecting; last = performance.now(); }, { threshold: 0.2 });
  io.observe(stage);
  playBtn.addEventListener('click', () => { playing = !playing; playBtn.textContent = playing ? '❚❚' : '▶'; playBtn.setAttribute('aria-label', playing ? 'Tạm dừng' : 'Phát'); });
  root.querySelector('.vbar').addEventListener('click', e => { const r = e.currentTarget.getBoundingClientRect(); t = clamp((e.clientX - r.left) / r.width) * total; chapter = -1; lastFx.clear(); });
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) { playing = false; playBtn.textContent = '▶'; t = starts[0] + CH[0].len - 1.5; }
  return { chapters: CH.map((c, i) => ({ start: starts[i] / total })), destroy() { alive = false; cancelAnimationFrame(raf); ro.disconnect(); io.disconnect(); } };
}
