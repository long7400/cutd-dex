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
*{box-sizing:border-box;margin:0;font:12.5px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.panel{width:min(360px,calc(100vw - 24px));max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#0f1a2df5;color:#e6f2ff;border:1px solid #33496b;border-radius:12px;box-shadow:0 10px 30px #000a;overflow:hidden}
.top{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 12px;cursor:move;user-select:none}
.top b{color:#ffde8f;font-weight:700;letter-spacing:.2px}
.grow{flex:1}
.x{all:unset;cursor:pointer;width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:#8fb7e8;font-size:15px}
.x:hover{background:#243552;color:#fff}
.stats{display:flex;align-items:baseline;gap:12px;padding:0 12px 8px}
.st small{color:#6f8fb8;margin-right:3px;font-size:11px}.st b{font-weight:700}
.st.gold b{color:#ffde8f}.st.crys b{color:#9fe3ff}
.clock{margin-left:auto;color:#8fb7e8;font-size:11.5px;white-space:nowrap}
.tabs{display:flex;border-top:1px solid #243552;border-bottom:1px solid #243552}
.tab{all:unset;cursor:pointer;flex:1;text-align:center;padding:7px 0;color:#8fb7e8;font-weight:600;border-bottom:2px solid transparent}
.tab small{color:#6f8fb8;font-size:10.5px}
.tab:hover{color:#fff}.tab.on{color:#ffde8f;border-bottom-color:#ffde8f}.tab.on small{color:#ffde8f}
.body{overflow:auto;padding:4px 0 6px}
.bar-row{display:flex;align-items:center;gap:5px;padding:6px 10px 4px}
.chip{all:unset;cursor:pointer;padding:2px 9px;border-radius:99px;border:1px solid #33496b;color:#8fb7e8;font-weight:600;font-size:11.5px}
.chip.on{background:#ffde8f;color:#0b1526;border-color:transparent}
.muted{margin-left:auto;color:#6f8fb8;font-size:11.5px}
.row{display:grid;grid-template-columns:32px 1fr auto;align-items:center;gap:8px;padding:5px 10px}
.row:hover,.trade:hover{background:#17263f}
.pt{width:32px;height:32px;border-radius:7px;background:#0b1526;border:1px solid #2a3d5c;object-fit:cover;flex-shrink:0}
.mid{min-width:0}
.nm{display:flex;align-items:center;gap:5px;white-space:nowrap;overflow:hidden}
.nm a{color:#e6f2ff;font-weight:600;text-decoration:none;overflow:hidden;text-overflow:ellipsis}
.nm a:hover{text-decoration:underline}
.nm small{color:#6f8fb8;font-size:11px;flex-shrink:0}
.dot{display:inline-block;width:7px;height:7px;border-radius:50%;flex-shrink:0}
.leg{color:#ffde8f;flex-shrink:0}
.sub{color:#6f8fb8;font-size:11.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.right{display:flex;gap:4px;align-items:center}
.pill{padding:1px 7px;border-radius:6px;font-size:11.5px;font-weight:700;background:#1b2a44;color:#8fb7e8;white-space:nowrap}
.pill.ok{background:#1d3a2a;color:#9fd6a8}.pill.bad{background:#3d2226;color:#ff9c9c}.pill.warn{background:#3a3016;color:#ffde8f}.pill.mute{color:#6f8fb8}
.hp{height:4px;background:#0b1526;border-radius:2px;overflow:hidden;margin-top:4px}.hp i{display:block;height:100%;background:#9fd6a8}
.trade{display:grid;grid-template-columns:20px minmax(0,1fr) 10px minmax(0,1fr) auto;align-items:center;gap:6px;padding:6px 10px;border-left:3px solid transparent}
.trade.is-ok{border-left-color:#5f9e6a}.trade.is-warn{border-left-color:#b69c62}
.slot{color:#6f8fb8;font-size:11px;font-weight:700}
.side{display:flex;align-items:center;gap:5px;min-width:0}.side .pt{width:28px;height:28px}.side .nm{flex:1}
.arrow{color:#6f8fb8;text-align:center}
.empty{padding:14px 12px;color:#6f8fb8}.bad{color:#ff9c9c}
table{width:100%;border-collapse:collapse}th,td{text-align:right;padding:5px 10px;border-bottom:1px solid #1d2c47}
th{color:#6f8fb8;font-weight:600;font-size:11px}td:first-child,th:first-child{text-align:left}
tr.me td{color:#ffde8f}tr.out td{color:#6f8fb8;text-decoration:line-through}
.mini{all:unset;cursor:pointer;padding:5px 11px;border-radius:9px;background:#0f1a2d;color:#ffde8f;border:1px solid #b69c62;font-weight:700;box-shadow:0 4px 14px #0008}
.panel.h{width:min(1180px,calc(100vw - 24px));max-height:min(340px,45vh)}
.panel.h .body{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));align-content:start;column-gap:4px}
.panel.h .body>.bar-row,.panel.h .body>.empty,.panel.h .body>table,.panel.h .body>.verdict,.panel.h .body>.sec{grid-column:1/-1}
.panel.h .tab{flex:0 0 auto;padding:7px 14px}
.verdict{margin:8px 10px;padding:8px 10px;border-radius:8px;background:#3a3016;color:#ffde8f;font-weight:600}
.kv{display:flex;justify-content:space-between;gap:10px;padding:4px 10px;border-bottom:1px solid #1d2c47}
.kv span{color:#8fb7e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kv b{white-space:nowrap}
.kv.hl b{color:#ffde8f}.kv.file span{font-family:ui-monospace,monospace;font-size:11px}
.sec{padding:8px 10px 2px;color:#6f8fb8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
[hidden]{display:none!important}
`;

(() => {
  if (!/(^|\.)cutd\.site$/.test(location.hostname)) {
    alert('CUTD Helper: mở trang game (cutd.site) rồi bấm bookmark này.');
    return;
  }
  if (window[NS]) { window[NS].toggle(); return; }
  if (!/^(https:\/\/|http:\/\/localhost[:/])/.test(DATA_URL)) return;

  const SAFE_ID = /^[a-z0-9_-]+$/i;
  const state = createState();
  let db = null, socket = null, dirty = true, tab = 'trade', timer = 0, wildSort = 'value', lastRender = 0;
  const famMax = new Map(); // gia phả → DPS cao nhất cả cây

  // ───────────── nghe dữ liệu (chỉ đọc) ─────────────
  const desc = Object.getOwnPropertyDescriptor(MessageEvent.prototype, 'data');
  let patched = false;
  const seen = new WeakSet();

  // Mốc thời gian để chẩn đoán vì sao vào trận lâu mới thấy pet (chỉ đo trên máy, không gửi đi đâu).
  const diag = { start: performance.now(), hello: null, firstMsg: null, keyframe: null, firstWild: null, firstUnit: null, longTaskMs: 0, longTasks: 0 };
  const now = () => performance.now();

  // Trả true nếu đây là message của KẾT NỐI TRẬN (để chỉ bám đúng socket trận, bỏ qua socket sảnh nếu có).
  function handle(text) {
    if (typeof text !== 'string' || text.charCodeAt(0) !== 123) return false; // chỉ frame JSON '{'
    let msg;
    try { msg = JSON.parse(text); } catch { return false; }
    if (msg?.type === 'server_hello') { diag.hello ??= now(); return true; }
    if (!isGameMessage(msg)) return false;
    diag.firstMsg ??= now();
    if (msg.type === 'base_keyframe') diag.keyframe ??= now();
    if (applyMessage(state, msg)) {
      if (state.wilds.size) diag.firstWild ??= now();
      if (state.units.size) diag.firstUnit ??= now();
      invalidate();
    }
    return true;
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
            // Chỉ bám socket khi thấy message của trận; socket khác (sảnh…) để yên, getter vẫn chờ.
            if (handle(v)) {
              const ws = this.target;
              queueMicrotask(() => attach(ws));
            }
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
  const short = n => {
    if (!Number.isFinite(n)) return '—';
    if (n < 1e3) return fmt(Math.round(n));
    if (n < 1e6) return `${+(n / 1e3).toFixed(n < 1e4 ? 1 : 0)}k`;
    return `${+(n / 1e6).toFixed(1)}M`;
  };
  const U = id => db?.u[id];
  const nameOf = id => { const u = U(id); return u ? `${u.n}${u.l ? ` Lv${u.l}` : ''}` : String(id ?? '?'); };
  const label = k => db?.lb[k] ?? k ?? '—';
  const img = (id, size = 32) => {
    const m = U(id)?.m;
    return h('img', { class: 'pt', width: size, height: size, alt: '', src: m && SAFE_ID.test(m) ? `${DATA_URL}portraits/${m}.webp` : null });
  };
  const rgbOf = el => {
    const c = db?.el[el]?.c;
    return Array.isArray(c) ? `rgb(${[0, 1, 2].map(i => Math.max(0, Math.min(255, c[i] | 0))).join(',')})` : '#6488b8';
  };
  const wikiUrl = id => {
    const u = U(id);
    if (!u || typeof id !== 'string') return null;
    const sid = id.replace(/^unit_/, '');
    return DATA_URL + (u.p && SAFE_ID.test(u.p) ? `#/pet/${u.p}/${sid}` : `#/unit/${sid}`);
  };
  const pill = (text, kind = '', tip) => h('span', { class: `pill ${kind}`, text, title: tip });
  // Tên (link wiki) + level nhỏ + chấm màu hệ + sao huyền thoại — 1 dòng, cắt bớt nếu dài.
  const title = (id, { noLevel = false } = {}) => {
    const u = U(id) ?? {};
    return h('div', { class: 'nm' },
      h('i', { class: 'dot', style: `background:${rgbOf(u.el)}`, title: db?.el[u.el]?.n ?? 'Không hệ' }),
      wikiUrl(id) ? h('a', { href: wikiUrl(id), text: u.n, title: 'Mở trên wiki' }) : h('span', { text: String(id ?? '?') }),
      u.l && !noLevel ? h('small', { text: ` Lv${u.l}` }) : null,
      u.L ? h('b', { class: 'leg', text: ' ★' }) : null);
  };
  // Mỗi con 1 dòng: [ảnh] [tên / dòng phụ] [nhãn bên phải]. Chi tiết nằm trong tooltip.
  const row = (id, sub, right, { cls = '', tip } = {}) => h('div', { class: `row ${cls}`, title: tip },
    img(id), h('div', { class: 'mid' }, title(id), sub ? h('div', { class: 'sub' }, sub) : null), h('div', { class: 'right' }, right));
  const statsTip = id => { const u = U(id) ?? {}; return `HP ${fmt(u.hp)} · DPS ${fmt(u.dps)} · đòn ${label(u.a)} · giáp ${label(u.at)}${u.s ? `\nKỹ năng: ${u.s.join(', ')}` : ''}`; };
  const empty = t => h('p', { class: 'empty', text: t });

  // ───────────── các tab ─────────────
  function viewTrade() {
    const list = tradeOptions(state, db);
    if (!list.length) return empty('Chưa có trade offer (trade tắt hoặc đang chờ dữ liệu).');
    return list.map(o => {
      const status = o.ready.length ? pill('Có sẵn', 'ok')
        : o.evolve ? pill(`+${short(o.evolve.cost)}g`, state.gold >= o.evolve.cost ? 'warn' : 'bad',
          `Nâng ${nameOf(o.evolve.unit.stage)} → ${o.evolve.steps.map(nameOf).join(' → ')}: ${fmt(o.evolve.cost)} vàng`)
        : pill('Chưa có', 'mute');
      // Tên 1 dòng, cấp độ xuống dòng dưới → tên không bị cắt cụt.
      const side = id => h('div', { class: 'side', title: statsTip(id) }, img(id, 28),
        h('div', { class: 'mid' }, title(id, { noLevel: true }), h('div', { class: 'sub', text: U(id)?.l ? `Lv${U(id).l}` : '' })));
      return h('div', { class: `trade ${o.ready.length ? 'is-ok' : o.evolve ? 'is-warn' : ''}` },
        h('span', { class: 'slot', text: `S${o.slot}` }), side(o.give), h('span', { class: 'arrow', text: '→' }), side(o.get), status);
    });
  }

  function viewWild() {
    // Gộp các con trùng loài: 1 dòng + ×số lượng.
    const groups = new Map();
    for (const w of state.wilds.values()) groups.set(w.stage, (groups.get(w.stage) ?? 0) + 1);
    const wilds = [...groups].map(([stage, count]) => {
      const u = U(stage) ?? {};
      return { stage, count, u, maxDps: famMax.get(u.f) ?? u.dps ?? 0, trades: offersForFamily(state, db, stage) };
    });
    const sorters = {
      value: (a, b) => (b.u.L ?? 0) - (a.u.L ?? 0) || b.trades.length - a.trades.length || b.maxDps - a.maxDps,
      cheap: (a, b) => (a.u.b ?? 0) - (b.u.b ?? 0),
      catch: (a, b) => (b.u.c ?? 0) - (a.u.c ?? 0),
    };
    wilds.sort(sorters[wildSort]);
    const sortBtn = (k, t) => h('button', { class: `chip sm ${wildSort === k ? 'on' : ''}`, text: t, onClick: () => { wildSort = k; dirty = true; render(true); } });
    return [
      h('div', { class: 'bar-row' }, sortBtn('value', 'Đáng bắt'), sortBtn('cheap', 'Rẻ'), sortBtn('catch', 'Dễ bắt'),
        h('span', { class: 'muted', text: `${state.wilds.size} con` })),
      wilds.length ? wilds.map(({ stage, count, u, maxDps, trades }) => row(stage,
        `bắt ${Math.round((u.c ?? 0) * 100)}% · max DPS ${short(maxDps)}`,
        [count > 1 ? pill(`×${count}`, 'mute') : null,
          trades.length ? pill('Trade', 'warn', trades.map(t => `S${t.slot}: cần ${nameOf(t.give)} → nhận ${nameOf(t.get)}`).join('\n')) : null,
          pill(`${short(u.b ?? 0)}g`, (u.b ?? 0) <= state.gold ? 'ok' : 'bad', 'Giá bắt')],
        { tip: statsTip(stage) }))
        : empty('Bãi đang trống.'),
    ];
  }

  function viewTeam() {
    const mine = myUnits(state);
    if (!mine.length) return empty('Chưa có lính (hoặc đang chờ dữ liệu).');
    const wanted = new Map();
    for (const o of state.offers.values()) wanted.set(o.give, [...(wanted.get(o.give) ?? []), o]);
    return mine.sort((a, b) => (U(b.stage)?.dps ?? 0) - (U(a.stage)?.dps ?? 0)).map(u => {
      const evo = U(u.stage)?.e ?? [];
      const cheapest = evo.reduce((m, e) => (!m || e[1] < m[1] ? e : m), null);
      const trades = wanted.get(u.stage) ?? [];
      const pct = u.maxHp ? Math.round((u.hp / u.maxHp) * 100) : 0;
      return row(u.stage,
        h('div', { class: 'hp', title: `${fmt(u.hp)} / ${fmt(u.maxHp)} HP` }, h('i', { style: `width:${Math.max(0, Math.min(100, pct))}%` })),
        [!u.active ? pill('Gục', 'bad') : null,
          trades.length ? pill(`Trade S${trades[0].slot}`, 'ok', trades.map(t => `S${t.slot} → nhận ${nameOf(t.get)}`).join('\n')) : null,
          cheapest ? pill(`↑${short(cheapest[1])}g`, cheapest[1] <= state.gold ? 'ok' : 'bad',
            evo.map(([to, cost]) => `${nameOf(to)}: ${fmt(cost)} vàng`).join('\n')) : pill('Max', 'mute', 'Dạng cuối')],
        { tip: `${statsTip(u.stage)}\nBán: ${fmt(Math.floor(u.book * (db.sell ?? 0)))} vàng` });
    });
  }

  function viewWave() {
    const groups = nextWaveForBase(state);
    const mine = myUnits(state);
    if (!groups.length) return empty(state.summary ? 'Server chưa công bố đợt tới.' : 'Đang chờ dữ liệu phòng…');
    return groups.map(g => {
      const u = U(g.stage) ?? {};
      const best = bestAttacks(db, u.at);
      const counters = mine.filter(x => (db.dmg?.[U(x.stage)?.a]?.[u.at] ?? 1) > 1).length;
      return row(g.stage, `HP ${short((u.hp ?? 0) * g.count)} · lọt −${(u.lk ?? 0) * g.count} mạng`,
        [pill(`×${g.count}`, 'mute'),
          best[0] && best[0][1] > 1 ? pill(`${label(best[0][0])} ${Math.round(best[0][1] * 100)}%`, 'warn',
            `Khắc giáp ${label(u.at)}: ${best.filter(b => b[1] > 1).map(([a, m]) => `${label(a)} ${Math.round(m * 100)}%`).join(', ')}\n${counters} lính của mày đánh lợi thế`) : null],
        { tip: statsTip(g.stage) });
    });
  }

  function viewPlayers() {
    const s = state.summary;
    if (!s) return empty('Đang chờ dữ liệu phòng…');
    return h('table', null, h('tr', null, ['', 'Mạng', 'Vàng', 'TT', 'Quái'].map(t => h('th', { text: t }))),
      [...s.bases].sort((a, b) => Number(b.alive) - Number(a.alive) || b.lives - a.lives).map(b => h('tr', { class: `${b.baseId === state.baseId ? 'me' : ''} ${b.alive ? '' : 'out'}` },
        [b.name, b.lives, short(b.gold), short(b.lumber), b.creeps].map(v => h('td', { text: String(v) })))));
  }

  // Tab "Đo tải": vào phòng mất bao lâu mới có pet, và chậm ở khâu nào.
  const resources = [];
  const observers = [];
  function observe(type, fn) {
    try {
      const o = new PerformanceObserver(list => list.getEntries().forEach(fn));
      o.observe({ type, buffered: true });
      observers.push(o);
    } catch { /* trình duyệt không hỗ trợ loại này */ }
  }
  observe('resource', e => { if (resources.length < 2000) resources.push(e); });
  observe('longtask', e => { diag.longTaskMs += e.duration; diag.longTasks++; });

  function diagReport() {
    const base = diag.hello ?? diag.firstMsg;
    if (!base) return null;
    const sec = v => (v == null ? null : Math.max(0, (v - base) / 1000));
    const after = resources.filter(r => r.startTime >= base - 50);
    const netEnd = after.length ? Math.max(...after.map(r => r.responseEnd)) : base;
    const bytes = after.reduce((n, r) => n + (r.transferSize || 0), 0);
    const r = {
      helloSeen: diag.hello != null, keyframe: sec(diag.keyframe), wild: sec(diag.firstWild), unit: sec(diag.firstUnit),
      net: sec(netEnd), files: after.length, mb: bytes / 1048576, longMs: diag.longTaskMs, longN: diag.longTasks,
      slow: [...after].sort((a, b) => b.duration - a.duration).slice(0, 6)
        .map(x => ({ file: String(x.name).split('?')[0].split('/').slice(-2).join('/'), ms: Math.round(x.duration), kb: Math.round((x.transferSize || 0) / 1024) })),
    };
    const wild = r.wild ?? Infinity;
    r.verdict = r.wild == null ? 'Server chưa gửi pet nào — đợi thêm.'
      : r.keyframe > 5 ? `Server phản hồi chậm: ${fmt(r.keyframe)}s mới gửi ảnh chụp căn cứ.`
      : wild - r.keyframe > 5 ? 'Pet do server thả muộn (luật/đếm ngược của game), không phải do máy mày.'
      : r.net > 5 && r.net >= wild * 0.6 ? 'Chậm do TẢI FILE (mạng / file nặng) — xem danh sách file chậm bên dưới.'
      : r.longMs > 5000 ? 'Chậm do MÁY xử lý (CPU/GPU) lúc dựng trận.'
      : 'Dữ liệu pet tới nhanh; nếu game vẫn hiện chậm là do game dựng hình 3D — dùng tab Wild để chọn trước.';
    return r;
  }

  function viewDiag() {
    const r = diagReport();
    if (!r) return empty('Bấm bookmark ở SẢNH trước khi vào phòng, tool sẽ đo từ lúc vào trận tới lúc có pet.');
    const s = v => (v == null ? '—' : `${fmt(v)}s`);
    const kv = (k, v, cls = '') => h('div', { class: `kv ${cls}` }, h('span', { text: k }), h('b', { text: v }));
    return [
      h('p', { class: 'verdict', text: r.verdict }),
      kv('Vào phòng', r.helloSeen ? '0s' : 'bấm bookmark muộn'),
      kv('Ảnh chụp căn cứ', s(r.keyframe)), kv('Có pet hoang dã', s(r.wild), 'hl'), kv('Có lính', s(r.unit)),
      kv('Tải xong file trận', `${s(r.net)} · ${r.files} file · ${fmt(r.mb)}MB`),
      kv('Máy bị khựng', `${s(r.longMs / 1000)} · ${r.longN} lần`),
      r.slow.length ? h('div', { class: 'sec', text: 'File tải lâu nhất' }) : null,
      r.slow.map(x => kv(x.file, `${fmt(x.ms)}ms · ${fmt(x.kb)}KB`, 'file')),
      h('div', { class: 'bar-row' }, h('button', { class: 'chip', text: 'Chép báo cáo', onClick: e => {
        const text = JSON.stringify({ v: VERSION, ...r }, null, 1);
        navigator.clipboard?.writeText(text).then(() => { e.target.textContent = 'Đã chép'; }, () => { e.target.textContent = 'Không chép được'; });
      } })),
    ];
  }

  // ───────────── khung panel ─────────────
  const host = h('div', { style: 'position:fixed;top:12px;left:12px;z-index:2147483646;' });
  const root = host.attachShadow({ mode: 'closed' });
  root.append(h('style', { text: CSS }));
  const panel = h('div', { class: 'panel' });
  root.append(panel);
  document.documentElement.append(host);

  let drag = null;
  const TABS = [['trade', 'Trade'], ['wild', 'Wild'], ['team', 'Đội'], ['wave', 'Đợt'], ['players', 'Phòng'], ['diag', 'Đo tải']];
  let layout = 'v'; // 'v' = dọc (panel), 'h' = ngang (thanh dưới đáy màn hình)
  function setLayout(next) {
    layout = next;
    Object.assign(host.style, layout === 'h' ? { top: 'auto', bottom: '12px', left: '12px' } : { top: '12px', bottom: 'auto', left: '12px' });
    dirty = true; render(true);
  }

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
    const header = h('div', { class: 'top', title: `CUTD Helper v${VERSION} — chỉ đọc dữ liệu trận, không gửi gì lên server` },
      h('b', { text: 'CUTD Helper' }),
      h('span', { class: 'grow' }),
      h('button', { class: 'x', text: layout === 'h' ? '▯' : '▭', title: layout === 'h' ? 'Chuyển sang dọc' : 'Chuyển sang ngang', onClick: () => setLayout(layout === 'h' ? 'v' : 'h') }),
      h('button', { class: 'x', text: '–', title: 'Thu nhỏ', onClick: () => toggle() }),
      h('button', { class: 'x', text: '×', title: 'Tắt tool', onClick: () => destroy() }));
    header.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'BUTTON') return;
      const r = host.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    });
    const stat = (k, v, cls = '') => h('span', { class: `st ${cls}` }, h('small', { text: k }), h('b', { text: v }));
    const stats = db && state.haveKeyframe ? h('div', { class: 'stats', title: owner ? `Căn cứ: ${owner.name}` : null },
      stat('Vàng', short(state.gold), 'gold'), stat('TT', short(state.lumber), 'crys'), stat('Mạng', fmt(state.lives)),
      (clockEl = h('span', { class: 'clock', text: clock() }))) : null;
    const count = { trade: state.offers.size, wild: state.wilds.size, team: myUnits(state).length, wave: nextWaveForBase(state).length };
    const tabs = h('div', { class: 'tabs' }, TABS.map(([k, t]) => h('button', { class: `tab ${tab === k ? 'on' : ''}`, onClick: () => { tab = k; dirty = true; render(true); if (bodyEl) bodyEl.scrollTop = 0; } },
      t, count[k] ? h('small', { text: ` ${count[k]}` }) : null)));
    let content;
    try {
      content = status && tab !== 'diag' ? empty(status) : ({
        trade: viewTrade, wild: viewWild, team: viewTeam, wave: viewWave, players: viewPlayers, diag: viewDiag,
      })[tab]();
    } catch (err) {
      content = h('p', { class: 'empty bad', text: `Lỗi hiển thị: ${err?.message ?? err}` });
    }
    const body = bodyEl = h('div', { class: 'body' }, content);
    panel.className = `panel ${layout}`;
    panel.replaceChildren(header, stats ?? '', tabs, body);
    body.scrollTop = scroll;
  }
  const clock = () => (state.summary ? `Đợt ${state.summary.wave} · ${state.summary.phase === 'wave' ? 'đánh' : 'nghỉ'} ${fmt(Math.ceil(secondsLeft(state) ?? 0))}s` : '');

  const onMove = e => { if (drag) { host.style.bottom = 'auto'; host.style.left = `${Math.max(0, e.clientX - drag.dx)}px`; host.style.top = `${Math.max(0, e.clientY - drag.dy)}px`; } };
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
    observers.forEach(o => o.disconnect());
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
    .catch(err => { panel.replaceChildren(h('p', { class: 'empty bad', text: `CUTD Helper: không tải được dữ liệu wiki (${err.message}).` })); });
})();
