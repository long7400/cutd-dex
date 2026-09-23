import {
  createState, applyMessage, isGameMessage, myUnits, tradeOptions, offersForFamily,
  bestAttacks, nextWaveForBase, buildGameCatalog, formation, formationRow,
} from './logic.js';
import * as web from './web-input.js';
import { findGame, findEntity, selectEntity, catchWild, evolveCreature, tradePet, moveCreature, groundOf, probe, clientKind, armWebCapture, disarmWebCapture, webCaptured, webTouched, forgetWebCapture } from './game-bridge.js';
import { realm, gameDoc } from './realm.js';
import { analyzeCatalog, overlayFields, powerTier } from './analyze.js';

const DATA_URL = __CUTD_DATA_URL__;
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
.tabs{display:flex;border-bottom:1px solid #243552}
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
.panel.h{width:min(1180px,calc(100vw - 24px));max-height:min(320px,50vh);display:grid;grid-template-columns:auto minmax(0,1fr);grid-template-rows:auto minmax(0,1fr)}
.panel.h .top{grid-column:1;padding-right:4px}.panel.h .top .grow{flex:0 0 6px}
.panel.h .tabs{grid-column:2;border:0;border-left:1px solid #243552;overflow-x:auto;scrollbar-width:none}
.panel.h .tabs::-webkit-scrollbar{display:none}
@media (max-width:700px){.panel.h{grid-template-columns:minmax(0,1fr);grid-template-rows:auto auto minmax(0,1fr)}
.panel.h .tabs{grid-column:1/-1;border-left:0;border-top:1px solid #243552}.panel.h .tab{flex:1 0 auto}}
.panel.h .body{grid-column:1/-1;border-top:1px solid #243552}
.panel.h .body{display:grid;grid-template-columns:repeat(auto-fill,minmax(270px,1fr));align-content:start;column-gap:4px}
.panel.h .body>.bar-row,.panel.h .body>.empty,.panel.h .body>table,.panel.h .body>.verdict,.panel.h .body>.sec{grid-column:1/-1}
.panel.h .tab{flex:0 0 auto;padding:7px 14px}
.verdict{margin:8px 10px;padding:8px 10px;border-radius:8px;background:#3a3016;color:#ffde8f;font-weight:600}
.kv{display:flex;justify-content:space-between;gap:10px;padding:4px 10px;border-bottom:1px solid #1d2c47}
.kv span{color:#8fb7e8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.kv b{white-space:nowrap}
.kv.hl b{color:#ffde8f}.kv.file span{font-family:ui-monospace,monospace;font-size:11px}
.sec{padding:8px 10px 2px;color:#6f8fb8;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.4px}
.pick{cursor:pointer}.pick:active{background:#22375a}
.act{all:unset;cursor:pointer;padding:2px 8px;border-radius:6px;font-size:11.5px;font-weight:700;background:#1b2a44;color:#8fb7e8;white-space:nowrap;border:1px solid transparent}
.act.ok{background:#1d3a2a;color:#9fd6a8;border-color:#2f5c40}.act.bad{background:#3d2226;color:#ff9c9c;border-color:#5c2f35}
.act:hover{filter:brightness(1.25)}.act:disabled{opacity:.5;cursor:wait}
.tier{min-width:26px;text-align:center;padding:1px 6px;border-radius:6px;font-size:11.5px;font-weight:800;background:#1b2a44;color:#8fb7e8}
.tier.t-sp{background:#ffde8f;color:#0b1526}.tier.t-s{background:#f0a35e;color:#0b1526}.tier.t-a{background:#1d3a2a;color:#9fd6a8}
.tier.t-b{background:#1b2a44;color:#8fb7e8}.tier.t-c,.tier.t-x{background:transparent;color:#6f8fb8;border:1px solid #2a3d5c}
.line2{display:flex;align-items:center;gap:6px;margin-top:3px;min-width:0}
.ptw{width:32px;height:32px}.ptw.down img{filter:grayscale(1) brightness(.6)}
.hpw{display:inline-flex;align-items:center;gap:4px;flex-shrink:0;font-size:10.5px;font-weight:700;color:#9fd6a8}
.hpw .hpb{width:40px;height:5px;border-radius:3px;background:#0b1526;overflow:hidden;box-shadow:inset 0 0 0 1px #243552}.hpw .hpb i{display:block;height:100%;background:#9fd6a8}
.hpw.half{color:#ffde8f}.hpw.half .hpb i{background:#ffde8f}.hpw.low{color:#ff9c9c}.hpw.low .hpb i{background:#ff9c9c}.hpw.down{color:#6f8fb8}
.strip{display:inline-flex;gap:2px;flex-shrink:0}.strip i{width:9px;height:9px;border-radius:2px;background:#4a6fa5}
.strip i.t-sp{background:#ffde8f}.strip i.t-s{background:#f0a35e}.strip i.t-a{background:#5f9e6a}.strip i.t-c{background:transparent;box-shadow:inset 0 0 0 1px #3a5480}
.rare{color:#ff9c9c;font-size:11px;font-weight:700}
.tier.sm{min-width:0;padding:0 4px;font-size:10px;line-height:14px;margin-left:4px;vertical-align:1px}
.kit{display:inline-flex;gap:3px;flex-shrink:0}.kit b{font-size:9.5px;font-weight:800;letter-spacing:.2px;padding:0 4px;border-radius:4px;line-height:14px;background:#1b2a44;color:#8fb7e8}
.kit .k-atk{background:#3d2226;color:#ff9c9c}.kit .k-tank{background:#1b2d4a;color:#9fe3ff}.kit .k-buff{background:#3a2f10;color:#ffde8f}
.kit .k-cc{background:#16324a;color:#9fe3ff}.kit .k-heal{background:#1d3a2a;color:#9fd6a8}.kit .k-evade{background:#2a2148;color:#cbb3ff}
.kit .k-taunt,.kit .k-boss{background:#3d2226;color:#ffb4aa}.kit .k-aoe{background:#3a3016;color:#f0a35e}
.legend{display:flex;flex-wrap:nowrap;white-space:nowrap;align-items:center;gap:3px 7px;padding:2px 10px 5px;font-size:10.5px;color:#6f8fb8}
.legend span{display:inline-flex;align-items:center;gap:3px}.legend .strip i{width:8px;height:8px}
.toast{margin:6px 10px;padding:6px 10px;border-radius:8px;background:#3d2226;color:#ff9c9c;font-size:12px}
[hidden]{display:none!important}
`;

(() => {
  if (!/(^|\.)cutd\.site$/.test(location.hostname)) {
    alert('CUTD Helper: mở trang game (cutd.site) rồi bấm bookmark này.');
    return;
  }
  const old = window[NS];
  if (old) {
    if (old.version === VERSION) { old.toggle?.(); return; }
    try { old.destroy?.(); } catch { }
    delete window[NS];
  }
  if (!/^(https:\/\/|http:\/\/localhost[:/])/.test(DATA_URL)) return;

  const SAFE_ID = /^[a-z0-9_-]+$/i;
  const state = createState();
  let db = null, socket = null, dirty = true, tab = 'trade', wildSort = 'value', lastRender = 0;
  let gameCat = new Map(), gameCatReady = false, ownBase = null;

  let savedDesc = null, patchedWin = null;
  const seen = new WeakSet();

  const acks = new Map();
  let dead = false;
  const diag = { start: performance.now(), hello: null, firstMsg: null, keyframe: null, firstWild: null, firstUnit: null, longTaskMs: 0, longTasks: 0 };
  const now = () => performance.now();

  function handle(text) {
    if (typeof text !== 'string' || text.charCodeAt(0) !== 123) return false;
    let msg;
    try { msg = JSON.parse(text); } catch { return false; }
    if (msg?.type === 'server_hello') {
      diag.hello ??= now();
      if (Number.isInteger(msg.base_id)) ownBase = msg.base_id;
      return true;
    }
    if (msg?.type === 'command_ack' && Number.isInteger(msg.sequence)) {
      acks.set(msg.sequence, { ok: msg.accepted === true, reason: typeof msg.reason === 'string' ? msg.reason.slice(0, 80) : '' });
      if (acks.size > 64) acks.delete(acks.keys().next().value);
      return true;
    }
    if (!isGameMessage(msg)) return false;
    diag.firstMsg ??= now();
    if (msg.type === 'base_keyframe') { diag.keyframe ??= now(); autoHook(); }
    if (applyMessage(state, msg)) {
      if (state.wilds.size) diag.firstWild ??= now();
      if (state.units.size) diag.firstUnit ??= now();
      invalidate();
    }
    return true;
  }
  let pending = 0;
  function invalidate() {
    dirty = true;
    if (pending) return;
    pending = setTimeout(() => { pending = 0; render(); }, Math.max(0, 1000 - (performance.now() - lastRender)));
  }
  const onMessage = e => handle(e.data);
  const onClose = () => { socket?.removeEventListener('message', onMessage); socket = null; patch(); invalidate(); };

  function attach(ws) {
    if (socket || dead) return;
    socket = ws;
    acks.clear();
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
    unpatch();
    invalidate();
  }
  function patch() {
    const win = realm.win;
    if (patchedWin) return;
    const desc = Object.getOwnPropertyDescriptor(win.MessageEvent.prototype, 'data');
    if (!desc?.get) return;
    const WS = win.WebSocket;
    savedDesc = desc;
    Object.defineProperty(win.MessageEvent.prototype, 'data', {
      configurable: true, enumerable: desc.enumerable,
      get() {
        const v = desc.get.call(this);
        try {
          if (!socket && this.target instanceof WS && !seen.has(this)) {
            seen.add(this);
            if (handle(v)) {
              const ws = this.target;
              queueMicrotask(() => attach(ws));
            }
          }
        } catch { }
        return v;
      },
    });
    patchedWin = win;
  }
  function unpatch() {
    if (!patchedWin) return;
    Object.defineProperty(patchedWin.MessageEvent.prototype, 'data', savedDesc);
    patchedWin = null;
  }

  function h(tag, props, ...kids) {
    if (!/^(a|b|button|div|i|img|p|small|span|style|table|td|th|tr)$/.test(tag)) throw new Error('thẻ không cho phép');
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props ?? {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = String(v);
      else if (k === 'style') el.style.cssText = v;
      else if (k === 'onClick') el.addEventListener('click', v);
      else if (k === 'href') { if (/^https?:\/\//.test(v)) { el.href = v; el.target = '_blank'; el.rel = 'noopener noreferrer'; } }
      else if (k === 'src') { if (String(v).startsWith(DATA_URL)) el.src = v; }
      else if (/^(title|tabindex|disabled|alt|width|height)$/.test(k)) el.setAttribute(k, String(v));
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
  const title = (id, { noLevel = false } = {}) => {
    const u = U(id) ?? {};
    return h('div', { class: 'nm' },
      h('i', { class: 'dot', style: `background:${rgbOf(u.el)}`, title: db?.el[u.el]?.n ?? 'Không hệ' }),
      wikiUrl(id) ? h('a', { href: wikiUrl(id), text: u.n, title: 'Mở trên wiki' }) : h('span', { text: String(id ?? '?') }),
      u.l && !noLevel ? h('small', { text: ` Lv${u.l}` }) : null,
      u.L ? h('b', { class: 'leg', text: ' ★' }) : null);
  };
  const row = (id, sub, right, { cls = '', tip, portrait } = {}) => h('div', { class: `row ${cls}`, title: tip },
    portrait ?? img(id), h('div', { class: 'mid' }, title(id), sub ? h('div', { class: 'sub' }, sub) : null), h('div', { class: 'right' }, right));
  const unitPortrait = u => h('div', { class: `ptw${u.active ? '' : ' down'}` }, img(u.stage));
  const hpBar = u => {
    const pct = u.maxHp ? Math.max(0, Math.min(100, Math.round((u.hp / u.maxHp) * 100))) : 100;
    return h('span', { class: `hpw${!u.active ? ' down' : pct < 35 ? ' low' : pct < 70 ? ' half' : ''}`, title: u.active ? `${fmt(u.hp)} / ${fmt(u.maxHp)} HP` : 'Gục — trở lại đợt sau' },
      h('span', { class: 'hpb' }, h('i', { style: `width:${u.active ? pct : 0}%` })), u.active ? short(u.hp) : 'gục');
  };
  const statsTip = id => {
    const u = U(id) ?? {};
    const roles = (u.r ?? []).map(r => db?.rn?.[r] ?? r);
    return `HP ${fmt(u.hp)} · DPS ${fmt(u.dps)}${u.ed && Math.round(u.ed) !== Math.round(u.dps) ? ` (thật ${fmt(u.ed)} nhờ kỹ năng)` : ''} · đòn ${label(u.a)} · giáp ${label(u.at)}`
      + `${roles.length ? `\nVai trò: ${roles.join(', ')}` : ''}${u.s ? `\nKỹ năng: ${u.s.join(', ')}` : ''}`;
  };
  const empty = t => h('p', { class: 'empty', text: t });

  let toast = '';
  const cycles = new Map();
  const cycle = (group, keys) => () => {
    const i = ((cycles.get(group) ?? -1) + 1) % Math.max(1, keys.length);
    cycles.set(group, i);
    return keys[i];
  };
  const FAIL = {
    game: 'Không thấy game — vào trận rồi thử lại (xem mục "Kiểm tra nút" ở tab Đo tải).',
    entity: 'Không thấy con này trong game (có thể vừa bị bắt/biến mất).',
    fn: 'Bản game này không có hàm cho nút đó (xem "Kiểm tra nút" ở tab Đo tải).',
    rule: 'Không hợp lệ (sai nhánh / sai slot / con đã đổi / chưa đủ vàng / đang trong đợt) — thử lại sau khi panel cập nhật.',
    data: 'Chưa tải xong dữ liệu của game — đợi 1–2 giây.',
    other: 'Đang xem căn cứ của người khác — về nhà mình để thao tác.',
    wave: 'Chỉ xếp được lúc chuẩn bị (game khoá lệnh trong đợt).',
    hook: 'Bản web chưa móc được hàm game — tool tự móc sau vài giây trong trận (hoặc bấm "Móc").',
  };
  const isWeb = () => clientKind() === 'web';
  const blockReason = () => (!gameCatReady ? 'data' : isWeb() && !findGame() ? 'hook'
    : ownBase != null && state.baseId !== ownBase ? 'other' : null);
  const realClick = e => e?.isTrusted && e.detail > 0;

  function selectInGame(key, e) {
    if (!realClick(e)) return;
    const g = findGame();
    const found = g && findEntity(g, key);
    if (found) selectEntity(g, found.id);
    toast = found ? '' : FAIL[g ? 'entity' : isWeb() ? 'hook' : 'game'];
    dirty = true; render(true);
  }
  const pickable = (el, key) => {
    el.classList.add('pick');
    el.addEventListener('click', e => { if (!e.target.closest('a,.act')) selectInGame(typeof key === 'function' ? key() : key, e); });
    return el;
  };

  let lastAction = 0;
  function runAction(e, kind, key, arg, expect) {
    e.stopPropagation();
    e.currentTarget.blur();
    if (!realClick(e)) return;
    const t = performance.now();
    if (t - lastAction < 600) return;
    lastAction = t;
    e.currentTarget.disabled = true;
    setTimeout(() => { dirty = true; render(true); }, 600);
    let fail = blockReason();
    const g = fail ? null : findGame();
    if (!fail && !g) fail = 'game';
    const ent = fail ? null : findEntity(g, key)?.ent;
    if (!fail && !ent) fail = 'entity';
    if (!fail && ent.contentId !== expect.stage) fail = 'rule';
    if (!fail) {
      if (kind === 'catch' && key[0] === 'w') fail = catchWild(g, ent);
      else if (kind === 'evolve' && key[0] === 'u' && typeof arg === 'string' && (gameCat.get(ent.contentId)?.e ?? []).some(([to]) => to === arg)) fail = evolveCreature(g, ent, arg);
      else if (kind === 'trade' && key[0] === 'u' && Number.isInteger(arg) && state.offers.get(arg)?.give === ent.contentId && state.offers.get(arg)?.get === expect.get) fail = tradePet(g, ent, arg);
      else fail = 'rule';
    }
    toast = fail ? FAIL[fail] : '';
  }
  const act = (text, kind, key, arg, expect, cls = '', tip) => {
    const blocked = blockReason();
    return h('button', {
      class: `act ${cls}`, text, tabindex: '-1', disabled: !!blocked, title: blocked ? FAIL[blocked] : tip,
      onClick: e => runAction(e, kind, key, arg, expect),
    });
  };

  const ROWS = [['TANK', 'k-tank', 'Hàng đầu: máu / giáp dày'], ['CẬN', 'k-atk', 'Hàng 2: đấu sĩ cận chiến / phép tầm ngắn'], ['BUFF', 'k-buff', 'Hàng 3: hào quang / hồi máu'], ['XA', 'k-cc', 'Hàng cuối: tay dài (tầm > 300)']];
  const MOVE_GAP = 300, ACK_WAIT = 1500, ARRANGE_COOLDOWN = 4000, IN_PLACE = 24;
  let arranging = null, arrangeReady = 0;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function waitAck(seq) {
    for (let t = 0; t < ACK_WAIT; t += 50) {
      if (acks.has(seq)) return acks.get(seq);
      await wait(50);
    }
    return null;
  }
  function arrangePlan(g) {
    const ground = groundOf(g);
    if (!ground) return null;
    const members = myUnits(state).filter(u => u.active).map(u => {
      const d = U(u.stage);
      const row = formationRow(d);
      return { key: `u${u.id}`, stage: u.stage, row, score: row === 0 ? (d?.hp ?? 0) : (d?.ed ?? d?.dps ?? 0) };
    });
    return formation(members, ground).map(m => ({ ...m, stage: members.find(x => x.key === m.key).stage }));
  }
  async function arrange(e) {
    e.stopPropagation();
    e.currentTarget.blur();
    if (!realClick(e)) return;
    if (arranging) { arranging.stop = true; return; }
    if (performance.now() < arrangeReady) return;
    let fail = blockReason();
    const g = fail ? null : findGame();
    if (!fail && !g) fail = 'game';
    if (!fail && state.summary?.phase !== 'planning') fail = 'wave';
    const plan = fail ? null : arrangePlan(g);
    if (!fail && !plan) fail = 'fn';
    toast = fail ? FAIL[fail] : '';
    if (fail) { dirty = true; render(true); return; }
    const run = arranging = { done: 0, n: plan.length, stop: false };
    dirty = true; render(true);
    for (const m of plan) {
      if (run.stop || dead || state.summary?.phase !== 'planning' || findGame() !== g) break;
      const found = findEntity(g, m.key);
      if (!found || found.ent.contentId !== m.stage) { run.n--; continue; }
      const pos = found.ent.pos;
      if (pos && Math.hypot(pos.x - m.x, pos.y - m.y) <= IN_PLACE) { run.n--; continue; }
      const r = moveCreature(g, found.ent, m);
      if (r.fail) { toast = FAIL[r.fail]; break; }
      const ack = await waitAck(r.seq);
      if (!ack) { toast = 'Game chưa xác nhận lệnh — dừng xếp để tránh spam.'; break; }
      if (!ack.ok) { toast = `Game từ chối: ${ack.reason.replace(/_/g, ' ') || 'không rõ'} — đã dừng.`; break; }
      run.done++;
      dirty = true; render(true);
      await wait(MOVE_GAP);
    }
    arranging = null;
    arrangeReady = performance.now() + ARRANGE_COOLDOWN;
    setTimeout(() => { dirty = true; render(true); }, ARRANGE_COOLDOWN + 50);
    dirty = true; render(true);
  }
  function arrangeBar() {
    const mine = myUnits(state).filter(u => u.active);
    const count = [0, 0, 0, 0];
    for (const u of mine) count[formationRow(U(u.stage))]++;
    const blocked = blockReason() ?? (state.summary?.phase !== 'planning' ? 'wave' : null);
    const cooling = !arranging && performance.now() < arrangeReady;
    return h('div', { class: 'bar-row' },
      h('button', {
        class: `chip ${arranging ? 'on' : ''}`, tabindex: '-1', disabled: !arranging && (!!blocked || cooling || !mine.length),
        text: arranging ? `Dừng ${arranging.done}/${arranging.n}` : 'Xếp đội',
        title: arranging ? 'Bấm để dừng' : blocked ? FAIL[blocked] : cooling ? 'Chờ vài giây rồi xếp lại' : 'Dàn đội từ phía quái vào: TANK → CẬN → BUFF → XA. Gửi từng lệnh một, chờ game xác nhận, con đã đúng chỗ thì bỏ qua.',
        onClick: arrange,
      }),
      h('span', { class: 'kit' }, ROWS.map(([t, c, tip], i) => count[i] ? h('b', { class: c, text: `${t} ${count[i]}`, title: tip }) : null)));
  }

  const CAM_KEYS = { up: ['KeyW', 'w'], down: ['KeyS', 's'], left: ['KeyA', 'a'], right: ['KeyD', 'd'] };
  const held = new Map();
  const DRAG_START = 4, STOP_MS = 90;
  let pan = null, stopTimer = 0;
  const camTarget = () => gameDoc().getElementById('GameCanvas') ?? gameDoc().getElementById('world') ?? gameDoc().querySelector('canvas');
  function camKey(dir, down, target) {
    const k = CAM_KEYS[dir];
    if (!k || !target) return;
    target.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { code: k[0], key: k[1], bubbles: true, cancelable: true }));
  }
  function setHeld(dirs) {
    for (const [d, target] of [...held]) {
      if (dirs.has(d)) continue;
      held.delete(d);
      camKey(d, false, target.isConnected ? target : window);
    }
    const target = camTarget();
    if (!target) return;
    for (const d of dirs) if (!held.has(d)) { held.set(d, target); camKey(d, true, target); }
  }
  const releaseAll = () => setHeld(new Set());
  function endPan() { pan = null; clearTimeout(stopTimer); releaseAll(); }
  const swallow = e => { e.stopImmediatePropagation(); e.preventDefault(); };
  const onMouseDown = e => {
    if (!camTarget() || e.target !== camTarget()) return;
    const alt = e.button === 0 && e.altKey;
    if (e.button !== 1 && !alt) return;
    if (alt) swallow(e); else e.preventDefault();
    pan = { btn: e.button, alt, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
  };
  const onMouseMove = e => {
    if (!pan) return;
    if (pan.alt) swallow(e);
    if (!(e.buttons & (pan.btn === 0 ? 1 : 4))) { endPan(); return; }
    if (!pan.moved && Math.hypot(e.clientX - pan.x, e.clientY - pan.y) < DRAG_START) return;
    pan.moved = true;
    const dx = e.clientX - pan.lx, dy = e.clientY - pan.ly;
    pan.lx = e.clientX; pan.ly = e.clientY;
    const dirs = new Set();
    if (dx < -1) dirs.add('right'); if (dx > 1) dirs.add('left');
    if (dy < -1) dirs.add('down'); if (dy > 1) dirs.add('up');
    if (dirs.size) setHeld(dirs);
    clearTimeout(stopTimer);
    stopTimer = setTimeout(releaseAll, STOP_MS);
  };
  let swallowClick = false;
  const onMouseUp = e => {
    if (!pan || e.button !== pan.btn) return;
    if (pan.alt) { swallow(e); swallowClick = true; setTimeout(() => { swallowClick = false; }, 0); }
    endPan();
  };
  const onClickAfterPan = e => { if (swallowClick) { swallow(e); swallowClick = false; } };
  const onBlur = () => endPan();

  const onHotkey = e => {
    if (!e.isTrusted || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.code !== 'KeyF') return;
    if (e.target?.isContentEditable || e.target?.closest?.('input,textarea,select,[contenteditable]')) return;
    if (!web.primaryReady()) return;
    e.preventDefault();
    web.clickPrimary();
  };

  function viewTrade() {
    const list = tradeOptions(state, db);
    if (!list.length) return empty('Chưa có trade offer (trade tắt hoặc đang chờ dữ liệu).');
    return list.map(o => {
      const status = o.ready.length ? act('Trade', 'trade', `u${o.ready[0].id}`, o.slot, { stage: o.give, get: o.get }, 'ok', `Đổi ${nameOf(o.give)} lấy ${nameOf(o.get)}`)
        : o.evolve ? pill(`+${short(o.evolve.cost)}g`, state.gold >= o.evolve.cost ? 'warn' : 'bad',
          `Nâng ${nameOf(o.evolve.unit.stage)} → ${o.evolve.steps.map(nameOf).join(' → ')}: ${fmt(o.evolve.cost)} vàng`)
        : pill('Chưa có', 'mute');
      const side = id => h('div', { class: 'side', title: statsTip(id) }, img(id, 28),
        h('div', { class: 'mid' }, title(id, { noLevel: true }), h('div', { class: 'sub' }, U(id)?.l ? `Lv${U(id).l}` : '', tierPill(id, true))));
      return pickable(h('div', { class: `trade ${o.ready.length ? 'is-ok' : o.evolve ? 'is-warn' : ''}`, title: 'Bấm để chọn slot này trong game' },
        h('span', { class: 'slot', text: `S${o.slot}` }), side(o.give), h('span', { class: 'arrow', text: '→' }), side(o.get), status), `t${o.slot}`);
    });
  }

  const TIER_CLASS = { 'S+': 't-sp', S: 't-s', A: 't-a', B: 't-b', C: 't-c' };
  const powerOf = stage => U(stage)?.pw ?? -1;
  const levelOf = id => (U(id)?.l ? `Lv${U(id).l}` : nameOf(id));
  const legend = () => h('div', { class: 'legend', title: 'Huy hiệu cạnh nút = hạng HIỆN TẠI (so với các con cùng tầm cấp). Dải ô màu = hạng từng cấp tiến hóa từ bây giờ tới đỉnh — ô cuối là dạng mạnh nhất.' },
    h('span', { text: 'Hạng từng cấp →' }),
    ['S+', 'S', 'A', 'B', 'C'].map(t => h('span', null, h('span', { class: 'strip' }, h('i', { class: TIER_CLASS[t] })), t)));
  const KIT = {
    atk: ['ATK', 'Gây sát thương là chính'], tank: ['TANK', 'Máu / giáp dày, chịu đòn'], buff: ['BUFF', 'Hào quang tăng sát thương / tốc đánh cả đội'],
    cc: ['CC', 'Làm chậm / giảm tốc đánh quái'], heal: ['HEAL', 'Hồi máu'], evade: ['NÉ', 'Né đòn'], taunt: ['TAUNT', 'Kéo quái đánh mình'],
    boss: ['BOSS', 'Sát thương theo % máu / giá trị — diệt boss'], aoe: ['AOE', 'Sát thương lan'],
  };
  const SUPPORT = new Set(['buff', 'cc', 'heal', 'taunt']);
  const kitOf = stage => (Array.isArray(U(stage)?.kt) ? U(stage).kt : []).filter(k => typeof k === 'string' && Object.hasOwn(KIT, k));
  const kitChips = stage => {
    const kit = kitOf(stage);
    if (!kit.length) return null;
    const when = k => {
      const role = { buff: 'aura', cc: 'cc', heal: 'sustain', evade: 'evade', taunt: 'taunt', boss: 'boss', aoe: 'aoe' }[k];
      const at = (U(stage)?.ul ?? []).find(([r]) => r === role);
      return at ? ` — mở ở ${nameOf(at[1])} (${fmt(at[2])} vàng)` : '';
    };
    return h('span', { class: 'kit' }, kit.map(k => h('b', { class: `k-${k}`, text: KIT[k][0], title: `${KIT[k][1]}${when(k)}` })));
  };
  function strip(stage) {
    const steps = [stage, ...(U(stage)?.pg ?? []).slice(1)].filter(id => U(id)?.st);
    if (steps.length < 2) return null;
    return h('span', { class: 'strip', title: `Hạng từng cấp (so với con cùng tầm cấp):\n${steps.map(id => `${levelOf(id)} ${U(id).st}`).join(' › ')}` },
      steps.map(id => h('i', { class: TIER_CLASS[U(id).st] })));
  }

  const tierPill = (stage, small = false) => {
    const u = U(stage);
    if (!u?.st) return null;
    const lines = [`Hạng hiện tại ${u.st} — ${nameOf(stage)} so với các con cùng tầm cấp · ${fmt(Math.round(u.ed ?? u.dps ?? 0))} DPS thật`];
    if (u.pk && Number.isFinite(u.pw)) {
      const [peakId, cost, eff] = u.pk;
      lines.push(peakId === stage ? 'Đây đã là dạng mạnh nhất của dòng'
        : `Đỉnh dòng: ${nameOf(peakId)} · hạng ${powerTier(u.pw)} · ${fmt(Math.round(eff))} DPS thật · cần ${fmt(cost)} vàng tiến hóa`);
    }
    for (const [r, to, c] of u.ul ?? []) lines.push(`Lên ${nameOf(to)} (${fmt(c)} vàng) mở ${db.rn?.[r] ?? r}`);
    return h('span', { class: `tier ${TIER_CLASS[u.st]}${small ? ' sm' : ''}`, text: u.st, title: lines.join('\n') });
  };


  let wildRole = 'all';
  const ROLE_FILTER = { all: ['Tất cả', () => true], atk: ['ATK', k => k[0] === 'atk'], tank: ['TANK', k => k[0] === 'tank'], sup: ['Hỗ trợ', k => k.some(x => SUPPORT.has(x))] };
  function viewWild() {
    const groups = new Map();
    for (const w of state.wilds.values()) {
      if (!ROLE_FILTER[wildRole][1](kitOf(w.stage))) continue;
      if (!groups.has(w.stage)) groups.set(w.stage, []);
      groups.get(w.stage).push(w.id);
    }
    const wilds = [...groups].map(([stage, idList]) => {
      const u = U(stage) ?? {};
      return { stage, idList, count: idList.length, u, peak: u.pk?.[2] ?? u.ed ?? u.dps ?? 0, trades: offersForFamily(state, db, stage) };
    });
    const sorters = {
      value: (a, b) => powerOf(b.stage) - powerOf(a.stage) || (a.u.b ?? 0) - (b.u.b ?? 0),
      cheap: (a, b) => (a.u.b ?? 0) - (b.u.b ?? 0),
      catch: (a, b) => (b.u.c ?? 0) - (a.u.c ?? 0),
    };
    wilds.sort(sorters[wildSort]);
    const sortBtn = (k, t) => h('button', { class: `chip sm ${wildSort === k ? 'on' : ''}`, text: t, onClick: () => { wildSort = k; dirty = true; render(true); } });
    return [
      h('div', { class: 'bar-row' }, sortBtn('value', 'Đáng bắt'), sortBtn('cheap', 'Rẻ'), sortBtn('catch', 'Dễ bắt'),
        h('span', { class: 'muted', text: `${state.wilds.size} con` })),
      h('div', { class: 'bar-row' }, Object.entries(ROLE_FILTER).map(([k, [text]]) => h('button', { class: `chip sm ${wildRole === k ? 'on' : ''}`, text,
        title: k === 'sup' ? 'BUFF / CC / HEAL / TAUNT' : null, onClick: () => { wildRole = k; dirty = true; render(true); } }))),
      wilds.length ? legend() : null,
      wilds.length ? wilds.map(({ stage, idList, count, u, peak, trades }) => pickable(row(stage,
        h('div', { class: 'line2' }, strip(stage), kitChips(stage), (u.c ?? 1) < 0.5 ? h('span', { class: 'rare', text: `${Math.round((u.c ?? 0) * 100)}%`, title: 'Tỉ lệ bắt thấp' }) : null),
        [tierPill(stage), count > 1 ? pill(`×${count}`, 'mute') : null,
          trades.length ? pill('Trade', 'warn', trades.map(t => `S${t.slot}: cần ${nameOf(t.give)} → nhận ${nameOf(t.get)}`).join('\n')) : null,
          act(`Bắt ${short(u.b ?? 0)}g`, 'catch', `w${idList[0]}`, null, { stage }, (u.b ?? 0) <= state.gold ? 'ok' : 'bad', `Bắt 1 con ${nameOf(stage)}`)],
        { tip: `Bắt ${Math.round((u.c ?? 0) * 100)}% · đỉnh ${short(peak)} DPS thật\n${statsTip(stage)}\nBấm để chọn trong game${count > 1 ? ' (bấm tiếp để đổi con)' : ''}` }), cycle(`w:${stage}`, idList.map(id => `w${id}`))))
        : empty(state.wilds.size ? 'Không có con nào đúng vai trò này.' : 'Bãi đang trống.'),
    ];
  }

  function viewTeam() {
    const mine = myUnits(state);
    if (!mine.length) return empty('Chưa có lính (hoặc đang chờ dữ liệu).');
    const wanted = new Map();
    for (const o of state.offers.values()) wanted.set(o.give, [...(wanted.get(o.give) ?? []), o]);
    return [arrangeBar(), legend(), ...mine.sort((a, b) => powerOf(b.stage) - powerOf(a.stage) || (U(b.stage)?.ed ?? 0) - (U(a.stage)?.ed ?? 0)).map(u => {
      const evo = U(u.stage)?.e ?? [];
      const trades = wanted.get(u.stage) ?? [];
      return pickable(row(u.stage,
        h('div', { class: 'line2' }, hpBar(u), strip(u.stage), kitChips(u.stage)),
        [tierPill(u.stage),
          trades.length ? act(`⇄S${trades[0].slot}`, 'trade', `u${u.id}`, trades[0].slot, { stage: u.stage, get: trades[0].get }, 'ok', `Trade slot ${trades[0].slot}: đổi lấy ${nameOf(trades[0].get)}`) : null,
          evo.length ? evo.map(([to, cost]) => {
            const trap = U(u.stage)?.tp?.[to];
            const drop = `${fmt(U(u.stage)?.ed ?? U(u.stage)?.dps)} → ${fmt(U(to)?.ed ?? U(to)?.dps)} DPS thật`;
            const warn = trap === 2 ? `\n⚠ BẪY: ${drop}, lên tiếp cũng không hồi lại — nên dừng ở đây` : trap === 1 ? `\n⚠ Tạm tụt: ${drop}, các cấp sau mới mạnh hơn` : '';
            return act(`↑${evo.length > 1 ? `${U(to)?.n ?? ''} ` : ''}${short(cost)}g${trap ? ' ⚠' : ''}`, 'evolve', `u${u.id}`, to, { stage: u.stage },
              trap === 2 || cost > state.gold ? 'bad' : 'ok', `Tiến hóa lên ${nameOf(to)}: ${fmt(cost)} vàng${warn}`);
          }) : pill('Max', 'mute', 'Dạng cuối')],
        { portrait: unitPortrait(u), tip: `${statsTip(u.stage)}\nBán: ${fmt(Math.floor(u.book * (db.sell ?? 0)))} vàng\nBấm để chọn trong game` }), `u${u.id}`);
    })];
  }

  function viewWave() {
    const groups = nextWaveForBase(state);
    const mine = myUnits(state);
    if (!groups.length) return empty(state.summary ? 'Server chưa công bố đợt tới.' : 'Đang chờ dữ liệu phòng…');
    return groups.map(g => {
      const u = U(g.stage) ?? {};
      const best = bestAttacks(db, u.at);
      const counters = mine.filter(x => (db.dmg?.[U(x.stage)?.a]?.[u.at] ?? 1) > 1).length;
      return row(g.stage, `${short((u.hp ?? 0) * g.count)} HP · −${(u.lk ?? 0) * g.count} mạng`,
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

  const resources = [];
  const observers = [];
  function observe(type, fn) {
    try {
      const o = new PerformanceObserver(list => list.getEntries().forEach(fn));
      o.observe({ type, buffered: true });
      observers.push(o);
    } catch { }
  }
  observe('resource', e => { if (resources.length < 2000) resources.push(e); });
  observe('longtask', e => { diag.longTaskMs += e.duration; diag.longTasks++; });

  function diagReport() {
    const base = diag.hello ?? diag.firstMsg;
    if (!base) return null;
    const sec = v => (v == null ? null : Math.max(0, (v - base) / 1000));
    const after = resources.filter(r => r.startTime >= base - 50 && !String(r.name).startsWith(DATA_URL));
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
    const firstWild = state.wilds.values().next().value;
    const p = probe(firstWild ? `w${firstWild.id}` : null);
    const probeRows = [
      h('div', { class: 'sec', text: 'Kiểm tra nút' }),
      h('div', { class: 'kv' }, h('span', { text: 'Trang / bản game' }), h('b', { text: `${p.host} · ${p.client === 'web' ? 'bản web' : 'Cocos'}` })),
      h('div', { class: 'kv' }, h('span', { text: 'Dữ liệu' }), h('b', { text: !live ? 'chỉ từ wiki' : wikiBehind() ? 'wiki cũ hơn game → đã tự tính từ /catalog của game' : 'khớp bản game (tính từ /catalog)' })),
      p.client === 'web' ? h('div', { class: 'kv' }, h('span', { text: 'Móc hàm game' }), h('b', { text: p.webHooked ? 'có (gọi thẳng)' : `chưa — đang chờ: ${p.webArmed.join(', ') || 'không (dán giữa trận → bấm Móc)'}` })) : null,
      h('div', { class: 'kv' }, h('span', { text: 'Tìm thấy game' }), h('b', { text: p.found ? 'có' : p.hasEngine ? 'không (chưa vào trận?)' : 'không thấy engine' })),
      p.found ? h('div', { class: 'kv' }, h('span', { text: 'Hàm có sẵn' }), h('b', { text: p.fns.join(', ') || 'không có' })) : null,
      p.found ? h('div', { class: 'kv' }, h('span', { text: 'Entity trong game' }), h('b', { text: `${p.entities} · ${p.keys.join(' ')}` })) : null,
      p.found && p.toolWild ? h('div', { class: 'kv' }, h('span', { text: `Pet ${p.toolWild}` }), h('b', { text: p.toolWildFound ? 'khớp' : `không khớp (game: ${p.sampleWild ?? '—'})` })) : null,
      h('div', { class: 'bar-row' }, h('button', { class: 'chip', text: 'Chép kết quả kiểm tra', onClick: e => {
        navigator.clipboard?.writeText(JSON.stringify({ v: VERSION, ...p }, null, 1)).then(() => { e.target.textContent = 'Đã chép'; }, () => { e.target.textContent = 'Không chép được'; });
      } })),
    ];
    if (!r) return [empty('Bấm bookmark ở SẢNH trước khi vào phòng, tool sẽ đo từ lúc vào trận tới lúc có pet.'), probeRows];
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
      probeRows,
      h('div', { class: 'bar-row' }, h('button', { class: 'chip', text: 'Chép báo cáo', onClick: e => {
        const text = JSON.stringify({ v: VERSION, ...r }, null, 1);
        navigator.clipboard?.writeText(text).then(() => { e.target.textContent = 'Đã chép'; }, () => { e.target.textContent = 'Không chép được'; });
      } })),
    ];
  }

  const host = h('div', { style: 'position:fixed;top:12px;left:12px;z-index:2147483646;' });
  const root = host.attachShadow({ mode: 'closed' });
  root.append(h('style', { text: CSS }));
  const panel = h('div', { class: 'panel' });
  root.append(panel);
  document.documentElement.append(host);

  let drag = null;
  const TABS = [['trade', 'Trade'], ['wild', 'Wild'], ['team', 'Đội'], ['wave', 'Đợt'], ['players', 'Phòng'], ['diag', 'Đo tải']];
  let layout = 'v';
  function setLayout(next) {
    layout = next;
    Object.assign(host.style, layout === 'h' ? { top: 'auto', bottom: '12px', left: '12px' } : { top: '12px', bottom: 'auto', left: '12px' });
    dirty = true; render(true);
  }

  let bodyEl = null;
  function render(force = false) {
    if (!dirty || panel.hidden) return;
    if (!force && performance.now() - lastRender < 1000) { invalidate(); return; }
    lastRender = performance.now();
    dirty = false;
    const scroll = bodyEl?.scrollTop ?? 0;
    const status = !db ? 'Đang tải dữ liệu wiki…'
      : !socket && !state.messages ? 'Đang chờ dữ liệu trận… (vào phòng chơi)'
      : !state.haveKeyframe ? 'Đã kết nối — chờ ảnh chụp đầy đủ của căn cứ…' : null;
    const kind = clientKind();
    const header = h('div', { class: 'top', title: `CUTD Helper v${VERSION} — chỉ gửi lệnh khi mày bấm nút Bắt/Tiến hóa/Trade` },
      h('b', { text: 'CUTD Helper' }),
      kind === 'web' && !webCaptured() && !frame ? h('button', { class: 'chip on', text: 'Móc', title: 'Tool tự móc sau khi vào trận vài giây; bấm để móc ngay. Mở lại đúng trận này trong khung (game tự vào lại) → chọn đúng con theo id, Bắt / Tiến hóa / Trade gọi thẳng hàm game.', onClick: hookViaFrame }) : null,
      kind === 'web' && !webCaptured() && !frame ? null : h('span', { class: 'pill mute', text: kind === 'web' ? (webCaptured() ? 'm. · móc' : 'm. · đang móc…') : kind === 'cocos' ? 'Cocos' : 'đang tải', title: kind === 'web'
        ? (webCaptured() ? 'Bản web: đã móc được hàm của game (dán tool từ sảnh) → bấm dòng/nút gọi thẳng hàm game như bản Cocos.'
          : 'Bản web: đang mở lại trận trong khung để móc hàm game.')
        : 'Bản Cocos (cutd.site): bấm dòng/nút → tool gọi thẳng hàm của game.' }),
      h('span', { class: 'grow' }),
      h('button', { class: 'x', text: layout === 'h' ? '▯' : '▭', title: layout === 'h' ? 'Chuyển sang dọc' : 'Chuyển sang ngang', onClick: () => setLayout(layout === 'h' ? 'v' : 'h') }),
      h('button', { class: 'x', text: '–', title: 'Thu nhỏ', onClick: () => toggle() }),
      h('button', { class: 'x', text: '×', title: 'Tắt tool', onClick: () => destroy() }));
    header.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'BUTTON') return;
      const r = host.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    });
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
    const body = bodyEl = h('div', { class: 'body' }, toast ? h('p', { class: 'toast', text: toast }) : null, content);
    panel.className = `panel ${layout}`;
    panel.replaceChildren(header, tabs, body);
    body.scrollTop = scroll;
  }

  const onMove = e => { if (drag) { host.style.bottom = 'auto'; host.style.left = `${Math.max(0, e.clientX - drag.dx)}px`; host.style.top = `${Math.max(0, e.clientY - drag.dy)}px`; } };
  const onUp = () => { drag = null; };
  window.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);
  const GAME_LISTENERS = [['mousedown', onMouseDown, true], ['mousemove', onMouseMove, true], ['mouseup', onMouseUp, true],
    ['click', onClickAfterPan, true], ['blur', onBlur, false], ['keydown', onHotkey, true]];
  const listen = win => GAME_LISTENERS.forEach(([type, fn, capture]) => win.addEventListener(type, fn, capture));
  const unlisten = win => GAME_LISTENERS.forEach(([type, fn, capture]) => win.removeEventListener(type, fn, capture));
  listen(window);

  let frame = null;
  function switchRealm(win) {
    if (dead) return;
    acks.clear();
    unpatch();
    socket?.removeEventListener('message', onMessage);
    socket?.removeEventListener('close', onClose);
    socket = null;
    endPan();
    realm.win = win;
    forgetWebCapture();
    armWebCapture(win);
    patch();
    listen(win);
    dirty = true; render(true);
  }
  let autoTimer = 0;
  function autoHook() {
    if (autoTimer || !isWeb() || realm.win !== window) return;
    autoTimer = setTimeout(() => { if (!webTouched()) openFrame(); }, 2500);
  }
  function hookViaFrame(e) { if (realClick(e)) openFrame(); }
  function openFrame() {
    if (frame || !isWeb() || realm.win !== window || findGame()) return;
    frame = document.createElement('iframe');
    frame.id = 'cutd-frame';
    frame.src = location.href;
    frame.allow = 'fullscreen; autoplay';
    frame.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;border:0;z-index:2147483645;background:#08161a';
    document.documentElement.append(frame);
    toast = '';
    let tries = 0;
    const arm = () => {
      if (!frame || dead) return;
      let win = null;
      try {
        win = frame.contentWindow;
        if (!win || win.location.href === 'about:blank' || win.document.readyState === 'uninitialized') win = null;
      } catch { win = null; }
      if (win) { switchRealm(win); return; }
      if (++tries < 20000) setTimeout(arm, 0);
    };
    arm();
    dirty = true; render(true);
  }

  function toggle() { panel.hidden = !panel.hidden; mini.hidden = !panel.hidden; dirty = true; render(true); }
  const mini = h('button', { class: 'mini', text: 'CUTD Helper', onClick: () => toggle() });
  mini.hidden = true;
  root.append(mini);

  function destroy() {
    dead = true;
    if (arranging) arranging.stop = true;
    const quiet = fn => { try { fn(); } catch { } };
    quiet(unpatch);
    socket?.removeEventListener('message', onMessage);
    socket?.removeEventListener('close', onClose);
    clearTimeout(pending);
    clearTimeout(autoTimer);
    observers.forEach(o => o.disconnect());
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    quiet(() => unlisten(window));
    if (realm.win !== window) quiet(() => unlisten(realm.win));
    quiet(disarmWebCapture);
    quiet(endPan);
    if (frame && realm.win === window) frame.remove();
    frame = null;
    host.remove();
    delete window[NS];
  }

  window[NS] = { toggle, destroy, version: VERSION };
  const oldFrame = isWeb() ? document.getElementById('cutd-frame') : null;
  if (oldFrame) { oldFrame.remove(); openFrame(); }
  if (isWeb()) armWebCapture();
  patch();
  render(true);

  const getJSON = (url, maxBytes) => fetch(url, { credentials: 'omit', cache: 'no-cache', signal: AbortSignal.timeout(20000) })
    .then(r => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      if (Number(r.headers?.get('content-length')) > maxBytes) throw new Error('dữ liệu quá lớn');
      return r.text();
    })
    .then(t => { if (t.length > maxBytes) throw new Error('dữ liệu quá lớn'); return JSON.parse(t); });

  let live = null, liveHash = null;
  function mergeGameCatalog() {
    if (!db || !gameCatReady) return;
    for (const [id, a] of live ?? []) db.u[id] = { ...(db.u[id] ?? {}), ...a.stats, ...overlayFields(a) };
    for (const [id, g] of gameCat) db.u[id] = { ...(db.u[id] ?? {}), n: g.n, l: g.l, b: g.b, c: g.c, e: g.e };
    dirty = true; render(true);
  }
  const wikiBehind = () => !!(db?.v && liveHash && !liveHash.startsWith(db.v));
  getJSON(`${DATA_URL}overlay.json`, 4 * 1024 * 1024)
    .then(d => {
      if (!d || typeof d.u !== 'object' || Array.isArray(d.u)) throw new Error('dữ liệu sai định dạng');
      const arr = (v, max = 64) => (Array.isArray(v) ? v.slice(0, max) : undefined);
      const u = Object.create(null);
      for (const [id, x] of Object.entries(d.u)) {
        if (!SAFE_ID.test(id) || !x || typeof x !== 'object' || Array.isArray(x)) continue;
        u[id] = { ...x, r: arr(x.r), s: arr(x.s), kt: arr(x.kt), pk: arr(x.pk, 3), ul: arr(x.ul), pg: arr(x.pg),
          e: arr(x.e, 8)?.filter(v => Array.isArray(v) && typeof v[0] === 'string' && Number.isFinite(v[1])) };
      }
      db = { ...d, u };
      mergeGameCatalog();
      dirty = true; render(true);
    })
    .catch(err => { panel.replaceChildren(h('p', { class: 'empty bad', text: `CUTD Helper: không tải được dữ liệu wiki (${err.message}).` })); });
  getJSON('/catalog', 32 * 1024 * 1024)
    .then(raw => {
      gameCat = buildGameCatalog(raw);
      try { live = analyzeCatalog(raw.catalog); } catch { live = null; }
      liveHash = typeof raw.catalog_hash === 'string' && /^[0-9a-f]{12,64}$/.test(raw.catalog_hash) ? raw.catalog_hash : null;
      gameCatReady = true; mergeGameCatalog();
    })
    .catch(() => { toast = 'Không tải được catalog của game — nút Bắt/Tiến hóa/Trade tạm khoá.'; dirty = true; render(true); });
})();
