// CUTD Helper — bookmarklet chạy trên trang game (cutd.site / m.cutd.site).
//
// Cam kết an toàn (kiểm chứng được bằng cách đọc file này):
//  • Toàn bộ code nằm trong bookmark. KHÔNG nạp <script> từ đâu, KHÔNG eval / new Function / innerHTML.
//  • Chỉ fetch 1 file DỮ LIỆU (overlay.json của wiki) → JSON.parse → hiển thị bằng textContent.
//  • KHÔNG gửi gì lên server game (không gọi socket.send), không điều khiển, không tự động thao tác.
//  • Đọc dữ liệu: bọc getter MessageEvent.data ĐÚNG 1 lần để lấy tham chiếu WebSocket của game,
//    gắn listener chỉ-đọc rồi trả getter về nguyên bản ngay.
//  • UI nằm trong Shadow DOM đóng → không đụng CSS/DOM của game. Không ghi cookie/localStorage.
import {
  createState, applyMessage, isGameMessage, myUnits, tradeOptions, offersForFamily,
  bestAttacks, secondsLeft, nextWaveForBase, ownerOf,
} from './logic.js';

const DATA_URL = '__CUTD_DATA_URL__';
const VERSION = '__CUTD_VERSION__';
const NS = '__cutdHelper';

const CSS = `
:host{all:initial}
*{box-sizing:border-box;font:13px/1.45 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.panel{width:min(400px,calc(100vw - 24px));max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#101c30f2;color:#e6f2ff;border:1px solid #3a5480;border-radius:14px;box-shadow:0 10px 34px #000a;overflow:hidden}
.top{display:flex;align-items:center;gap:6px;padding:8px 10px;background:#16243c;cursor:move;user-select:none}
.top b{color:#ffde8f}
.grow{flex:1;min-width:0}
.x{all:unset;cursor:pointer;width:24px;height:24px;text-align:center;border-radius:6px;color:#8fb7e8;font-size:16px}
.x:hover{background:#2b3f60;color:#fff}
.stats{display:flex;flex-wrap:wrap;gap:4px 10px;padding:6px 10px;color:#8fb7e8;border-bottom:1px solid #2b3f60}
.stats span:first-child{color:#ffde8f;font-weight:700}
.tabs,.row{display:flex;flex-wrap:wrap;gap:5px;padding:8px 10px;align-items:center}
.chip{all:unset;cursor:pointer;padding:3px 10px;border-radius:99px;border:1px solid #3a5480;color:#8fb7e8;font-weight:600;font-size:12px}
.chip.on{background:#ffde8f;color:#0b1526;border-color:transparent}
.body{overflow:auto;padding:0 10px 10px}
.card{background:#16243c;border:1px solid #2b3f60;border-radius:10px;padding:8px;margin:6px 0}
.card.ok{border-color:#5f9e6a}.card.warn{border-color:#b69c62}
.hd{display:flex;justify-content:space-between;align-items:center;font-weight:800;color:#ffde8f;margin-bottom:4px}
.st{font-size:11.5px;font-weight:700;color:#6488b8}.st.ok,.okc{color:#9fd6a8}.st.warn{color:#ffde8f}.bad{color:#ff9c9c}
.lbl{font-size:10.5px;letter-spacing:.5px;color:#6488b8;font-weight:700;margin-top:4px}
.ul{display:flex;gap:8px;align-items:flex-start}
.pt{width:40px;height:40px;border-radius:8px;background:#0b1526;border:1px solid #3a5480;flex-shrink:0;object-fit:cover}
.nm{font-weight:700}
.sub,.dim{color:#8fb7e8;font-size:12px}
.dim{color:#6488b8}
.sk{font-size:11.5px;color:#9fd6a8}
.hint{font-size:12px;color:#ffde8f;margin-top:2px}
.tag{display:inline-block;padding:0 6px;border-radius:5px;font-size:10.5px;font-weight:700;vertical-align:1px}
.leg{color:#ffde8f}
.wk{color:#cbb3ff;font-size:11px;text-decoration:underline}
.bar{height:5px;background:#0b1526;border-radius:3px;overflow:hidden;margin:3px 0}.bar i{display:block;height:100%;background:#9fd6a8}
table{width:100%;border-collapse:collapse}th,td{text-align:left;padding:4px;border-bottom:1px solid #2b3f60;font-size:12px}th{color:#6488b8}
tr.me td{color:#ffde8f}
.foot{padding:6px 10px;font-size:10.5px;color:#6488b8;border-top:1px solid #2b3f60}
.mini{all:unset;cursor:pointer;padding:6px 12px;border-radius:10px;background:#16243c;color:#ffde8f;border:1px solid #b69c62;font-weight:700;box-shadow:0 4px 14px #0008}
[hidden]{display:none!important}
`;

(() => {
  if (window[NS]) { window[NS].toggle(); return; }
  if (!/(^|\.)cutd\.site$/.test(location.hostname)) {
    alert('CUTD Helper: mở trang game (cutd.site) rồi bấm bookmark này.');
    return;
  }
  if (!/^(https:\/\/|http:\/\/localhost[:/])/.test(DATA_URL)) return;

  const SAFE_ID = /^[a-z0-9_-]+$/i;
  const state = createState();
  let db = null, socket = null, dirty = true, tab = 'trade', timer = 0, wildSort = 'value', lastRender = 0;
  const famMax = new Map(); // gia phả → DPS cao nhất cả cây

  // ───────────── nghe dữ liệu (chỉ đọc) ─────────────
  const desc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data');
  let patched = false;
  const seen = new WeakSet();

  function handle(text) {
    if (typeof text !== 'string' || text.charCodeAt(0) !== 123) return; // chỉ frame JSON '{'
    let msg;
    try { msg = JSON.parse(text); } catch { return; }
    if (isGameMessage(msg) && applyMessage(state, msg)) invalidate();
  }
  let pending = 0;
  // Gom nhiều message thành tối đa 1 lần vẽ mỗi giây, nhưng không bao giờ để trễ quá 1 giây.
  function invalidate() {
    dirty = true;
    if (pending) return;
    pending = setTimeout(() => { pending = 0; render(); }, Math.max(0, 1000 - (performance.now() - lastRender)));
  }
  const onMessage = e => handle(e.data);
  const onClose = () => { socket?.removeEventListener('message', onMessage); socket = null; patch(); invalidate(); };

  function attach(ws) {
    if (socket) return;
    socket = ws;
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
    unpatch();
    invalidate();
  }
  function patch() {
    if (patched || !desc?.get) return;
    Object.defineProperty(MessageEvent.prototype, 'data', {
      configurable: true, enumerable: desc.enumerable,
      get() {
        const v = desc.get.call(this);
        try {
          if (!socket && this.target instanceof WebSocket && !seen.has(this)) {
            seen.add(this);
            handle(v);
            const ws = this.target;
            queueMicrotask(() => attach(ws));
          }
        } catch { /* không bao giờ làm hỏng game */ }
        return v;
      },
    });
    patched = true;
  }
  function unpatch() {
    if (!patched) return;
    Object.defineProperty(MessageEvent.prototype, 'data', desc);
    patched = false;
  }

  // ───────────── DOM an toàn ─────────────
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props ?? {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'onClick') el.addEventListener('click', v);
      else if (k === 'href') { if (/^https?:\/\//.test(v)) { el.href = v; el.target = '_blank'; el.rel = 'noopener noreferrer'; } }
      else if (k === 'src') { if (String(v).startsWith(DATA_URL)) el.src = v; }
      else el.setAttribute(k, String(v));
    }
    for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c instanceof Node ? c : String(c));
    return el;
  }

  const fmt = n => (Number.isFinite(n) ? n.toLocaleString('vi-VN', { maximumFractionDigits: 1 }) : '—');
  const short = n => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : fmt(n));
  const U = id => db?.u[id];
  const nameOf = id => { const u = U(id); return u ? `${u.n}${u.l ? ` Lv${u.l}` : ''}` : String(id ?? '?'); };
  const label = k => db?.lb[k] ?? k ?? '—';
  const img = (id, size = 40) => {
    const m = U(id)?.m;
    return h('img', { class: 'pt', width: size, height: size, alt: '', src: m && SAFE_ID.test(m) ? `${DATA_URL}portraits/${m}.webp` : null });
  };
  const elTag = el => {
    const e = db?.el[el];
    if (!e || !Array.isArray(e.c)) return null;
    const [r, g, b] = e.c.map(x => Math.max(0, Math.min(255, x | 0)));
    return h('span', { class: 'tag', style: `background:rgb(${r},${g},${b});color:#0b1526` , text: e.n });
  };
  const wiki = id => {
    const u = U(id);
    if (!u) return null;
    const path = u.p && SAFE_ID.test(u.p) ? `#/pet/${u.p}/${id.replace(/^unit_/, '')}` : `#/unit/${id.replace(/^unit_/, '')}`;
    return h('a', { class: 'wk', href: DATA_URL + path, text: 'wiki' });
  };
  const unitLine = (id, extra) => h('div', { class: 'ul' }, img(id), h('div', { class: 'grow' },
    h('div', { class: 'nm' }, nameOf(id), ' ', U(id)?.L ? h('span', { class: 'leg', text: '★' }) : null, ' ', elTag(U(id)?.el), ' ', wiki(id)),
    h('div', { class: 'sub' }, `HP ${short(U(id)?.hp)} · DPS ${short(U(id)?.dps)} · ${label(U(id)?.a)} · giáp ${label(U(id)?.at)}`),
    extra));

  // ───────────── các tab ─────────────
  function viewTrade() {
    const list = tradeOptions(state, db);
    if (!list.length) return h('p', { class: 'dim', text: 'Chưa thấy trade offer nào (trade tắt, hoặc đang chờ dữ liệu).' });
    return list.map(o => h('div', { class: `card ${o.ready.length ? 'ok' : o.evolve ? 'warn' : ''}` },
      h('div', { class: 'hd' }, `Slot ${o.slot}`,
        o.ready.length ? h('span', { class: 'st ok', text: `Trade được ngay (có ${o.ready.length} con)` })
          : o.evolve ? h('span', { class: 'st warn', text: `Tiến hóa thêm ${fmt(o.evolve.cost)} vàng` })
          : h('span', { class: 'st', text: 'Chưa có' })),
      h('div', { class: 'lbl', text: 'NHẬN' }), unitLine(o.get, U(o.get)?.s ? h('div', { class: 'sk', text: U(o.get).s.join(' · ') }) : null),
      h('div', { class: 'lbl', text: 'CẦN ĐƯA' }), unitLine(o.give,
        o.evolve ? h('div', { class: 'hint' }, `Có ${nameOf(o.evolve.unit.stage)} → `, o.evolve.steps.map(nameOf).join(' → '),
          ` (${fmt(o.evolve.cost)} vàng${state.gold >= o.evolve.cost ? ', đủ tiền' : `, thiếu ${fmt(o.evolve.cost - state.gold)}`})`)
          : !o.ready.length && U(o.give)?.p ? h('div', { class: 'hint', text: 'Bắt/nuôi từ cây tiến hóa này (xem wiki).' }) : null)));
  }

  function viewWild() {
    const wilds = [...state.wilds.values()].map(w => {
      const u = U(w.stage) ?? {};
      return { w, u, maxDps: famMax.get(u.f) ?? u.dps ?? 0, trades: offersForFamily(state, db, w.stage) };
    });
    const sorters = {
      value: (a, b) => (b.u.L ?? 0) - (a.u.L ?? 0) || b.trades.length - a.trades.length || b.maxDps - a.maxDps,
      cheap: (a, b) => (a.u.b ?? 0) - (b.u.b ?? 0),
      catch: (a, b) => (b.u.c ?? 0) - (a.u.c ?? 0),
    };
    wilds.sort(sorters[wildSort]);
    const sortBtn = (k, t) => h('button', { class: `chip ${wildSort === k ? 'on' : ''}`, text: t, onClick: () => { wildSort = k; dirty = true; render(true); } });
    return [
      h('div', { class: 'row' }, sortBtn('value', 'Đáng bắt'), sortBtn('cheap', 'Rẻ nhất'), sortBtn('catch', 'Dễ bắt'),
        h('span', { class: 'dim', text: `${wilds.length} con · vàng ${fmt(state.gold)}` })),
      wilds.length ? wilds.map(({ w, u, maxDps, trades }) => h('div', { class: 'card' }, unitLine(w.stage,
        h('div', null,
          h('span', { class: (u.b ?? 0) <= state.gold ? 'okc' : 'bad', text: `Giá ${fmt(u.b ?? 0)} vàng` }),
          ` · bắt ${Math.round((u.c ?? 0) * 100)}% · DPS tối đa cả cây ${short(maxDps)}`,
          trades.length ? h('div', { class: 'hint', text: `Cây này đang được trade: ${trades.map(t => `slot ${t.slot} cần ${nameOf(t.give)} → nhận ${nameOf(t.get)}`).join('; ')}` }) : null))))
        : h('p', { class: 'dim', text: 'Không có sinh vật hoang dã (hoặc đang chờ dữ liệu).' }),
    ];
  }

  function viewTeam() {
    const mine = myUnits(state);
    if (!mine.length) return h('p', { class: 'dim', text: 'Chưa có lính (hoặc đang chờ keyframe).' });
    const wanted = new Map();
    for (const o of state.offers.values()) wanted.set(o.give, [...(wanted.get(o.give) ?? []), o]);
    return mine.sort((a, b) => (U(b.stage)?.dps ?? 0) - (U(a.stage)?.dps ?? 0)).map(u => {
      const evo = U(u.stage)?.e ?? [];
      const trades = wanted.get(u.stage) ?? [];
      return h('div', { class: `card ${trades.length ? 'ok' : ''}` }, unitLine(u.stage, h('div', null,
        h('div', { class: 'bar' }, h('i', { style: `width:${u.maxHp ? Math.round((u.hp / u.maxHp) * 100) : 0}%` })),
        u.active ? null : h('span', { class: 'bad', text: 'Đang gục · ' }),
        `Bán: ${fmt(Math.floor(u.book * (db.sell ?? 0)))} vàng`,
        evo.length ? h('div', { class: 'hint' }, 'Tiến hóa: ', evo.map(([to, cost], i) => [i ? ' · ' : '', nameOf(to), ' ',
          h('span', { class: cost <= state.gold ? 'okc' : 'bad', text: `${fmt(cost)}g` })])) : h('div', { class: 'dim', text: 'Dạng cuối' }),
        trades.map(t => h('div', { class: 'okc', text: `Trade được: slot ${t.slot} → nhận ${nameOf(t.get)}` })))));
    });
  }

  function viewWave() {
    const groups = nextWaveForBase(state);
    const mine = myUnits(state);
    const s = state.summary;
    const head = h('p', { class: 'dim', text: s ? `Đợt hiện tại: ${s.wave} · ${s.phase === 'wave' ? 'đang đánh' : 'chuẩn bị'} · còn ${fmt(secondsLeft(state))}s` : 'Chờ room_summary…' });
    if (!groups.length) return [head, h('p', { class: 'dim', text: 'Server chưa công bố đợt tới.' })];
    return [head, groups.map(g => {
      const u = U(g.stage) ?? {};
      const best = bestAttacks(db, u.at).slice(0, 3);
      const myBest = mine.filter(x => (db.dmg?.[U(x.stage)?.a]?.[u.at] ?? 1) > 1).length;
      return h('div', { class: 'card' }, unitLine(g.stage, h('div', null,
        `× ${g.count} · tổng HP ${short((u.hp ?? 0) * g.count)} · lọt mất ${(u.lk ?? 0) * g.count} mạng`,
        h('div', { class: 'hint', text: `Khắc chế giáp ${label(u.at)}: ${best.map(([a, m]) => `${label(a)} ${Math.round(m * 100)}%`).join(', ')} · ${myBest} lính của mày đánh được ×>100%` }))));
    })];
  }

  function viewPlayers() {
    const s = state.summary;
    if (!s) return h('p', { class: 'dim', text: 'Chờ room_summary…' });
    return h('table', null, h('tr', null, ['Người chơi', 'Mạng', 'Vàng', 'Tinh thể', 'Quái', 'Wild'].map(t => h('th', { text: t }))),
      [...s.bases].sort((a, b) => Number(b.alive) - Number(a.alive) || b.lives - a.lives).map(b => h('tr', { class: b.baseId === state.baseId ? 'me' : '' },
        [b.name + (b.alive ? '' : ' (bị loại)'), b.lives, short(b.gold), short(b.lumber), b.creeps, b.wilds].map(v => h('td', { text: String(v) })))));
  }

  // ───────────── khung panel ─────────────
  const host = h('div', { style: 'position:fixed;top:12px;left:12px;z-index:2147483646;' });
  const root = host.attachShadow({ mode: 'closed' });
  root.append(h('style', { text: CSS }));
  const panel = h('div', { class: 'panel' });
  root.append(panel);
  document.documentElement.append(host);

  let drag = null;
  const TABS = [['trade', 'Trade'], ['wild', 'Wild'], ['team', 'Đội hình'], ['wave', 'Đợt tới'], ['players', 'Người chơi']];

  let clockEl = null, bodyEl = null;
  function render(force = false) {
    if (!dirty || panel.hidden) return;
    if (!force && performance.now() - lastRender < 1000) { invalidate(); return; }
    lastRender = performance.now();
    dirty = false;
    const scroll = bodyEl?.scrollTop ?? 0;
    const owner = ownerOf(state);
    const status = !db ? 'Đang tải dữ liệu wiki…'
      : !socket && !state.messages ? 'Đang chờ dữ liệu trận… (vào phòng chơi)'
      : !state.haveKeyframe ? 'Đã kết nối — chờ ảnh chụp đầy đủ của căn cứ…' : null;
    const header = h('div', { class: 'top' },
      h('b', { text: 'CUTD Helper' }), h('span', { class: 'dim', text: ` v${VERSION}` }),
      h('span', { class: 'grow' }),
      h('button', { class: 'x', text: '–', title: 'Thu nhỏ', onClick: () => toggle() }),
      h('button', { class: 'x', text: '×', title: 'Tắt tool', onClick: () => destroy() }));
    header.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'BUTTON') return;
      const r = host.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    });
    const stats = db && state.haveKeyframe ? h('div', { class: 'stats' },
      owner ? h('span', { text: owner.name }) : null,
      h('span', { text: `Vàng ${fmt(state.gold)}` }), h('span', { text: `Tinh thể ${fmt(state.lumber)}` }),
      h('span', { text: `Mạng ${fmt(state.lives)}` }),
      (clockEl = h('span', { text: clock() }))) : null;
    const tabs = h('div', { class: 'tabs' }, TABS.map(([k, t]) => h('button', { class: `chip ${tab === k ? 'on' : ''}`, text: t, onClick: () => { tab = k; dirty = true; render(true); if (bodyEl) bodyEl.scrollTop = 0; } })));
    let content;
    try {
      content = status ? h('p', { class: 'dim', text: status }) : ({
        trade: viewTrade, wild: viewWild, team: viewTeam, wave: viewWave, players: viewPlayers,
      })[tab]();
    } catch (err) {
      content = h('p', { class: 'bad', text: `Lỗi hiển thị: ${err?.message ?? err}` });
    }
    const body = bodyEl = h('div', { class: 'body' }, content);
    panel.replaceChildren(header, stats ?? '', tabs, body,
      h('div', { class: 'foot', text: 'Chỉ đọc dữ liệu trận mà game đã gửi cho máy mày · không gửi gì lên server' }));
    body.scrollTop = scroll;
  }
  const clock = () => (state.summary ? `Đợt ${state.summary.wave} · ${state.summary.phase === 'wave' ? 'đánh' : 'chuẩn bị'} ${fmt(Math.ceil(secondsLeft(state) ?? 0))}s` : '');

  const onMove = e => { if (drag) { host.style.left = `${Math.max(0, e.clientX - drag.dx)}px`; host.style.top = `${Math.max(0, e.clientY - drag.dy)}px`; } };
  const onUp = () => { drag = null; };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  function toggle() { panel.hidden = !panel.hidden; mini.hidden = !panel.hidden; dirty = true; render(true); }
  const mini = h('button', { class: 'mini', text: 'CUTD Helper', onClick: () => toggle() });
  mini.hidden = true;
  root.append(mini);

  function destroy() {
    unpatch();
    socket?.removeEventListener('message', onMessage);
    socket?.removeEventListener('close', onClose);
    clearInterval(timer);
    clearTimeout(pending);
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    host.remove();
    delete window[NS];
  }

  window[NS] = { toggle, destroy };
  patch();
  timer = setInterval(() => { if (clockEl) clockEl.textContent = clock(); }, 500);
  render(true);

  fetch(`${DATA_URL}overlay.json`, { credentials: 'omit', cache: 'no-cache' })
    .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
    .then(d => {
      if (!d || typeof d.u !== 'object') throw new Error('dữ liệu sai định dạng');
      db = d;
      for (const x of Object.values(d.u)) if (x && x.f) famMax.set(x.f, Math.max(famMax.get(x.f) ?? 0, x.dps ?? 0));
      dirty = true; render(true);
    })
    .catch(err => { panel.replaceChildren(h('p', { class: 'bad', text: `CUTD Helper: không tải được dữ liệu wiki (${err.message}).` })); });
})();
