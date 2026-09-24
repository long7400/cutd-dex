import {
  createState, applyMessage, isGameMessage, myUnits, tradeOptions, offersForFamily,
  bestAttacks, nextWaveForBase, buildGameCatalog, formationRow, acceptRows, createMemory, observe, onSent, onAck, planMoves,
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
.panel{width:min(380px,calc(100vw - 24px));max-height:calc(100vh - 24px);display:flex;flex-direction:column;background:#0f1a2df5;color:#e6f2ff;border:1px solid #33496b;border-radius:12px;box-shadow:0 10px 30px #000a;overflow:hidden}
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
.bar-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:6px 10px 4px}
.sep{width:1px;height:14px;background:#33496b;margin:0 2px}
.chip{white-space:nowrap}
.chip{all:unset;cursor:pointer;padding:2px 9px;border-radius:99px;border:1px solid #33496b;color:#8fb7e8;font-weight:600;font-size:11.5px}
.chip.on{background:#ffde8f;color:#0b1526;border-color:transparent}
.chip.sm{padding:1px 8px;font-size:11px}.chip:disabled{opacity:.35;cursor:default}
.wrap{display:flex;gap:8px;align-items:flex-start}.wrap.h{flex-direction:column-reverse}
.drawer{width:270px;max-height:calc(100vh - 24px);overflow-y:auto;background:#0f1a2df5;color:#e6f2ff;border:1px solid #33496b;border-radius:12px;box-shadow:0 10px 30px #000a;padding:12px;scrollbar-width:thin}
.wrap.h .drawer{max-height:45vh}
.dh{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center}.dh .pt{width:64px;height:64px;border:0;background:transparent;object-fit:contain}
.dh b{font-size:16px;font-weight:800}.dl{display:flex;align-items:center;gap:6px;margin-top:5px}
.role{font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px}.k-atk.role{background:#3d2226;color:#ff9c9c}.k-tank.role{background:#1b2d4a;color:#9fe3ff}.k-buff.role{background:#3a2f10;color:#ffde8f}.k-debuff.role{background:#2a2148;color:#cbb3ff}
.harm{color:#ff9c9c;font-weight:800}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:10px 0}.stats span{background:#101c30;border-radius:6px;padding:4px 0;text-align:center;font-weight:800;font-size:11.5px}
.evo{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}.path{display:flex;align-items:flex-start;gap:1px;flex-wrap:wrap}
.node{display:flex;flex-direction:column;align-items:center;width:38px;gap:1px}.node .pt{width:32px;height:32px}
.node.now .pt{border-color:#ffde8f}.node.trap .pt{border-color:#ff9c9c}.node small{font-size:9.5px;color:#8fb7e8;font-weight:700}.node small.gold{color:#ffde8f}
.node .tier{font-size:9.5px;padding:0 3px;min-width:0;line-height:13px}.path .ar{color:#4a6fa5;font-size:11px;margin-top:9px}
.sks{display:grid;gap:7px;margin-bottom:10px}.sk{display:grid;grid-template-columns:26px 1fr;gap:8px;align-items:start}
.sk img{width:26px;height:26px;border-radius:6px;border:1px solid #33496b}.skn b{color:#9fd6a8;font-size:12px}.skn small{color:#6f8fb8;font-size:10.5px}
.skd{color:#c7d8ea;font-size:11px;line-height:1.35}.sk.self img{border-color:#ff9c9c}.sk.self .skn b,.sk.self .skd{color:#ff9c9c}
.sk.off{opacity:.45}.sk.off img{filter:grayscale(1)}
.star{all:unset;cursor:pointer;width:16px;text-align:center;color:#4a6fa5;font-size:14px;line-height:1}.star:hover{color:#ffde8f}.star.on{color:#ffde8f}
.kit .k-debuff{background:#2a2148;color:#cbb3ff}.kit .k-selfharm{background:#3d2226;color:#ff9c9c}
.muted{margin-left:auto;color:#6f8fb8;font-size:11.5px}
.row{display:grid;grid-template-columns:32px 1fr auto;align-items:center;gap:8px;padding:5px 10px}
.row:hover{background:#17263f}
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
.panel.h .body>.bar-row,.panel.h .body>.empty,.panel.h .body>table,.panel.h .body>.verdict,.panel.h .body>.sec,.panel.h .body>.sect,.panel.h .body>.grid,.panel.h .body>.tgrid,.panel.h .body>.toast{grid-column:1/-1}
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
.strip{display:flex;gap:1px;height:4px;margin:3px 5px 0}.strip i{flex:1;height:4px;border-radius:1px;background:#4a6fa5}
.strip i.t-sp{background:#ffde8f}.strip i.t-s{background:#f0a35e}.strip i.t-a{background:#5f9e6a}.strip i.t-c{background:transparent;box-shadow:inset 0 0 0 1px #3a5480}
.top .gold{color:#ffde8f;font-weight:800;font-size:12px;background:#3a3016;padding:1px 8px;border-radius:99px;white-space:nowrap}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(64px,1fr));gap:5px;padding:4px 10px 6px}
.tile{position:relative;display:flex;flex-direction:column;background:#132238;border:1px solid #22375a;border-top:2px solid var(--ro,#33496b);border-radius:9px;overflow:hidden}
.tile:hover{background:#182c49;border-color:#3a5480;border-top-color:var(--ro,#33496b)}
.tile.wish{border-color:#b69c62;border-top-color:var(--ro,#33496b);box-shadow:0 0 0 1px #b69c6255,0 0 10px #ffde8f22}
.tile.sel{outline:2px solid #ffde8f;outline-offset:-1px}
.pic{position:relative;height:54px;display:grid;place-items:center;background:radial-gradient(circle at 50% 64%,var(--el,#6488b86b) 0,transparent 66%)}
.pic .pt{width:46px;height:46px;border:0;border-radius:0;background:transparent;object-fit:contain;filter:drop-shadow(0 2px 2px #000a)}
.tile.down .pic .pt{filter:grayscale(1) brightness(.5)}
.pic .tl{position:absolute;top:3px;left:3px;display:flex;gap:2px;align-items:center}
.pic .tier{min-width:0;margin:0;padding:0 4px;font-size:10px;line-height:14px;border-radius:4px}
.pic .harm{color:#ff9c9c;font-size:11px;font-weight:900;line-height:14px;text-shadow:0 1px 2px #000}
.pic .mv{background:#f0a35e;color:#0b1526;font-size:10px;font-weight:900;line-height:14px;padding:0 3px;border-radius:4px}
.pic .star{position:absolute;top:1px;right:3px}
.pic .lv{position:absolute;bottom:4px;left:3px;font-size:9.5px;font-weight:800;line-height:13px;background:#0b1526d9;color:#e6f2ff;padding:0 4px;border-radius:4px}
.pic .lv.rare{color:#ff9c9c}
.pic .cnt{position:absolute;bottom:4px;right:3px;font-size:10px;font-weight:900;line-height:13px;background:#ffde8f;color:#0b1526;padding:0 4px;border-radius:4px}
.hps{position:absolute;left:4px;right:4px;bottom:0;display:flex;gap:1px;height:3px}
.hps i{flex:1;border-radius:2px;background:linear-gradient(90deg,#9fd6a8 var(--p,100%),#0b1526 var(--p,100%))}
.hps i.mid{background:linear-gradient(90deg,#ffde8f var(--p,100%),#0b1526 var(--p,100%))}.hps i.low{background:linear-gradient(90deg,#ff9c9c var(--p,100%),#0b1526 var(--p,100%))}
.hps i.down{background:#0b1526;box-shadow:inset 0 0 0 1px #5c2f35}
.tn{font-size:10px;font-weight:700;letter-spacing:-.35px;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;padding:2px 2px 3px;color:#dbe8f7}
.tn .trf{color:#ffde8f;font-size:10px;font-weight:900;margin-right:2px}
.acts{display:flex;border-top:1px solid #22375a;margin-top:auto}.acts>*+*{border-left:1px solid #22375a}
.acts .act,.acts .b{all:unset;box-sizing:border-box;flex:1;min-width:0;display:flex;align-items:center;justify-content:center;gap:1px;height:21px;padding:0 2px;font:800 11px/1 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;white-space:nowrap;overflow:hidden;background:#1b2a44;color:#8fb7e8}
.acts .act{cursor:pointer}.acts .act:hover{filter:brightness(1.25)}.acts .act:disabled{opacity:.5;cursor:default}
.acts .act.ok{background:#1d3a2a;color:#9fd6a8}.acts .act.bad,.acts .b.bad{background:#2c1d24;color:#ff9c9c}.acts .act.tr{background:#3a3016;color:#ffde8f}
.acts .b.warn{background:#2b2616;color:#e8cf8a}.acts .b{font-size:10px}.acts .b.max{background:transparent;color:#4a6fa5}
.acts.split .act{font-size:10px;letter-spacing:-.3px}.acts .act .pt{width:13px;height:13px;border:0;border-radius:0;background:transparent}
.sect{display:flex;align-items:center;gap:6px;padding:8px 10px 1px;font-size:10.5px;font-weight:800;letter-spacing:.6px;color:#c7d8ea}
.sect i{width:3px;height:12px;border-radius:2px;background:var(--c,#33496b)}
.sect .n{margin-left:auto;font-size:10.5px;font-weight:700;color:#6f8fb8}
.tgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:6px;padding:6px 10px}
.tcard{display:flex;flex-direction:column;background:#132238;border:1px solid #22375a;border-radius:10px;overflow:hidden}
.tcard.is-ok{border-color:#2f5c40}.tcard.wish{border-color:#b69c62}
.th{padding:3px 8px 0;font-size:10px;font-weight:800;letter-spacing:.5px;color:#6f8fb8}
.pair{display:grid;grid-template-columns:1fr 14px 1fr;align-items:center;padding:0 4px}
.pair .ar{color:#ffde8f;text-align:center;font-weight:900}
.pair .pic{height:50px;border-radius:8px}.pair .pic .pt{width:44px;height:44px}
.nm2{display:grid;grid-template-columns:1fr 1fr;gap:14px;text-align:center;padding:2px 4px 4px}
.nm2 span{font-size:10.5px;font-weight:700;color:#dbe8f7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.nm2 .get{color:#ffde8f}
.tier.sm{min-width:0;padding:0 4px;font-size:10px;line-height:14px;margin-left:4px;vertical-align:1px}
.kit{display:inline-flex;gap:3px;flex-shrink:0}.kit b{font-size:9.5px;font-weight:800;letter-spacing:.2px;padding:0 4px;border-radius:4px;line-height:14px;background:#1b2a44;color:#8fb7e8}
.kit .k-atk{background:#3d2226;color:#ff9c9c}.kit .k-tank{background:#1b2d4a;color:#9fe3ff}.kit .k-buff{background:#3a2f10;color:#ffde8f}
.kit .k-cc{background:#16324a;color:#9fe3ff}.kit .k-heal{background:#1d3a2a;color:#9fd6a8}.kit .k-evade{background:#2a2148;color:#cbb3ff}
.kit .k-taunt,.kit .k-boss{background:#3d2226;color:#ffb4aa}.kit .k-aoe{background:#3a3016;color:#f0a35e}
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
  let db = null, socket = null, dirty = true, tab = 'trade', wildSort = 'value', lastRender = 0, layoutAt = 0, lastLayout = '';
  const sig = [];
  let gameCat = new Map(), gameCatReady = false, ownBase = null;

  let savedDesc = null, patchedWin = null;
  const seen = new WeakSet();

  const acks = new Map();
  const cmdLog = [];
  let suspect = new Set();
  const skillProbe = { fired: 0, selfHit: 0, selfDmg: 0, otherHit: 0, otherDmg: 0, samples: [] };
  const cut = v => (typeof v === 'number' && Number.isFinite(v) ? v : typeof v === 'string' ? v.slice(0, 48) : undefined);
  function sampleEffect(e) {
    if (skillProbe.samples.length >= 40) return;
    const out = {};
    for (const field of ['kind', 'content_id', 'tick', 'entity_collection', 'entity_id', 'source_collection', 'source_id', 'target_collection', 'target_id', 'amount']) {
      const v = cut(e[field]);
      if (v !== undefined) out[field] = v;
    }
    skillProbe.samples.push(out);
  }
  function probeEffects(list) {
    if (!Array.isArray(list) || !suspect.size) return;
    const fired = new Set();
    for (const e of list) {
      if (e?.kind !== 'ability_triggered' || !suspect.has(e.content_id)) continue;
      skillProbe.fired++;
      fired.add(`${e.tick}:${e.source_id ?? e.entity_id}`);
      sampleEffect(e);
    }
    if (!fired.size) return;
    for (const e of list) {
      if ((e?.kind !== 'unit_damaged' && e?.kind !== 'damage') || !fired.has(`${e.tick}:${e.source_id}`)) continue;
      const amount = Number.isFinite(e.amount) ? e.amount : 0;
      if (e.target_id === e.source_id && e.target_collection === e.source_collection) { skillProbe.selfHit++; skillProbe.selfDmg += amount; }
      else { skillProbe.otherHit++; skillProbe.otherDmg += amount; }
      sampleEffect(e);
    }
  }
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
      cmdLog.push(performance.now());
      if (cmdLog.length > 200) cmdLog.splice(0, cmdLog.length - 200);
      acks.set(msg.sequence, { ok: msg.accepted === true, reason: typeof msg.reason === 'string' ? msg.reason.slice(0, 80) : '' });
      if (acks.size > 64) acks.delete(acks.keys().next().value);
      return true;
    }
    if (!isGameMessage(msg)) return false;
    diag.firstMsg ??= now();
    if (msg.type !== 'room_summary') { try { probeEffects(msg.effects); } catch { } }
    if (msg.type === 'base_keyframe') { diag.keyframe ??= now(); autoHook(); }
    if (applyMessage(state, msg)) {
      if (state.wilds.size) diag.firstWild ??= now();
      if (state.units.size) diag.firstUnit ??= now();
      watchRoster();
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
      else if (k === 'style') { if (!/url\s*\(|@import|expression|javascript:/i.test(String(v))) el.style.cssText = v; }
      else if (k === 'onClick') el.addEventListener('click', v);
      else if (k === 'href') { if (String(v).startsWith(DATA_URL)) { el.href = v; el.target = '_blank'; el.rel = 'noopener noreferrer'; } }
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
  const tint = el => {
    const c = db?.el[el]?.c;
    return Array.isArray(c) ? `rgb(${[0, 1, 2].map(i => Math.max(0, Math.min(255, c[i] | 0))).join(' ')} / .42)` : '#6488b86b';
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
  const openable = (el, key, stage, idOf = () => null) => {
    el.classList.add('pick');
    el.addEventListener('click', e => {
      if (e.target.closest('.act,.star')) return;
      const target = typeof key === 'function' ? key() : key;
      info = { stage, id: idOf(target) };
      if (realClick(e)) selectInGame(target, e);
      else { dirty = true; render(true); }
    });
    return el;
  };

  let lastAction = 0, downAt = 0;
  const SHIFT_MS = 350;
  const RATE_WINDOW = 30000, RATE_MAX = 36, RATE_GAP = 800;
  const recentCmds = () => {
    const t = performance.now();
    while (cmdLog.length && t - cmdLog[0] > RATE_WINDOW) cmdLog.shift();
    return cmdLog.length;
  };
  const rateWait = () => {
    const t = performance.now(), n = recentCmds();
    const gap = lastAction + RATE_GAP - t;
    const full = n >= RATE_MAX ? cmdLog[n - RATE_MAX] + RATE_WINDOW - t : 0;
    return Math.max(0, gap, full);
  };
  function runAction(e, kind, key, arg, expect) {
    e.stopPropagation();
    e.currentTarget.blur();
    if (!realClick(e)) return;
    const t = performance.now();
    const hold = rateWait();
    if (hold > 0) {
      if (hold > RATE_GAP) { toast = `Game giới hạn 2 lệnh/giây — chờ ${Math.ceil(hold / 1000)} giây rồi bấm tiếp.`; dirty = true; render(true); }
      return;
    }
    if (downAt > 0 && t - downAt < 1500 && downAt - layoutAt < SHIFT_MS) { toast = 'Danh sách vừa đổi chỗ — nhìn lại rồi bấm lần nữa.'; dirty = true; render(true); return; }
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
    sig.push(`${kind}:${key}:${arg ?? ''}`);
    return h('button', {
      class: `act do-${kind} ${cls}`, tabindex: '-1', disabled: !!blocked, title: blocked ? FAIL[blocked] : tip,
      onClick: e => runAction(e, kind, key, arg, expect),
    }, text);
  };

  const ROWS = [['TANK', '#7fd4ff', 'Hàng đầu: máu / giáp dày'], ['CẬN', '#ff8f8f', 'Hàng 2: đấu sĩ cận chiến / phép tầm ngắn'], ['XA', '#9fd6a8', 'Hàng 3: sát thương tay dài (tầm > 300)'], ['HỖ TRỢ', '#ffd36b', 'Hàng cuối: hồi máu / hào quang — đứng sau cùng cho an toàn']];
  const ACK_WAIT = 1500;
  const wait = ms => new Promise(r => setTimeout(r, ms));
  async function waitAck(seq) {
    for (let t = 0; t < ACK_WAIT; t += 50) {
      if (acks.has(seq)) return acks.get(seq);
      await wait(50);
    }
    return null;
  }
  const mem = createMemory();
  let lastWatch = 0;
  const snapUnits = g => myUnits(state).map(u => {
    const d = U(u.stage), key = `u${u.id}`, row = formationRow(d);
    return { key, stage: u.stage, level: d?.l ?? 1, row, accept: acceptRows(d), score: row === 0 ? (d?.hp ?? 0) : (d?.ed ?? d?.dps ?? 0), active: u.active, pos: g ? findEntity(g, key)?.ent?.pos ?? null : null };
  });
  const arrangePlan = g => { const ground = groundOf(g); return ground ? planMoves(mem, snapUnits(g), ground) : null; };
  function watchRoster(force = false) {
    if (!db || !gameCatReady) return;
    const t = performance.now();
    const phase = state.summary?.phase;
    if (!force && t - lastWatch < 250 && phase === mem.phase) return;
    lastWatch = t;
    const ready = !!state.haveKeyframe && (ownBase == null || state.baseId === ownBase);
    const g = ready ? findGame() : null;
    const before = mem.planning, booted = mem.booted;
    const changed = observe(mem, { phase, ready, units: ready ? snapUnits(g) : [] }, t);
    if (booted && changed.length) toast = `${changed.map(u => nameOf(u.stage)).join(', ')} đổi vai trò → hàng ${ROWS[changed[0].row][0]} — bấm Xếp đội để dời.`;
    if (mem.planning !== before && g && !blockReason()) {
      const n = arrangePlan(g)?.moves.length ?? 0;
      if (n) toast = `Round mới: ${n} con cần vào vị trí — bấm Xếp đội (mỗi lần bấm dời 1 con).`;
    }
  }
  let arranging = false;
  async function arrange(e) {
    e.stopPropagation();
    e.currentTarget.blur();
    if (!realClick(e) || arranging) return;
    const hold = rateWait();
    if (hold > 0) {
      if (hold > RATE_GAP) { toast = `Game giới hạn 2 lệnh/giây — chờ ${Math.ceil(hold / 1000)} giây rồi bấm tiếp.`; dirty = true; render(true); }
      return;
    }
    let fail = blockReason();
    const g = fail ? null : findGame();
    if (!fail && !g) fail = 'game';
    if (!fail && state.summary?.phase !== 'planning') fail = 'wave';
    if (!fail) watchRoster(true);
    const plan = fail ? null : arrangePlan(g);
    if (!fail && !plan) fail = 'fn';
    const m = plan?.moves[0];
    const found = m ? findEntity(g, m.key) : null;
    const stage = found ? myUnits(state).find(u => `u${u.id}` === m.key)?.stage : null;
    if (!fail && m && (!found || found.ent.contentId !== stage)) fail = 'entity';
    if (fail || !m) { toast = fail ? FAIL[fail] : 'Đội đã đúng hàng — không cần dời con nào.'; dirty = true; render(true); return; }
    arranging = true;
    lastAction = performance.now();
    onSent(mem, m.key, m.row, m, lastAction);
    dirty = true; render(true);
    const r = moveCreature(g, found.ent, m);
    const ack = r.fail ? null : await waitAck(r.seq);
    onAck(mem, m.key, !!ack?.ok);
    arranging = false;
    toast = r.fail ? FAIL[r.fail] : !ack ? 'Game chưa xác nhận lệnh.' : !ack.ok ? `Game từ chối: ${ack.reason.replace(/_/g, ' ') || 'không rõ'}.`
      : `Đã dời ${nameOf(stage)} → hàng ${ROWS[m.row][0]}.${plan.moves.length > 1 ? ` Còn ${plan.moves.length - 1} con lệch — bấm tiếp.` : ' Đội đã đúng hàng.'}`;
    dirty = true; render(true);
  }
  function teamBar(mine, plan, blocked) {
    const next = plan?.moves[0];
    const held = plan ? [...plan.status.values()].filter(v => v === 'new').length : 0;
    const nextStage = next ? mine.find(u => `u${u.id}` === next.key)?.stage : null;
    return h('div', { class: 'bar-row' },
      h('button', {
        class: `chip sm ${next ? 'on' : ''}`, tabindex: '-1', disabled: arranging || !!blocked || !mine.some(u => u.active) || (plan && !next),
        text: arranging ? 'Đang dời…' : next ? `Xếp đội ↕${plan.moves.length}` : plan ? '✓ Đúng hàng' : 'Xếp đội',
        title: blocked ? FAIL[blocked] : next ? `Bấm để dời ${nameOf(nextStage)} sang hàng ${ROWS[next.row][0]}. Mỗi lần bấm dời 1 con (ô có dấu ↕); con đã đứng đúng hàng không bị đụng tới.`
          : 'Hàng từ phía quái vào: TANK → CẬN → XA → HỖ TRỢ sau cùng.',
        onClick: arrange,
      }),
      held ? h('span', { class: 'pill mute', text: `+${held} mới`, title: 'Pet vừa mua trong round này được để yên; sang round sau mới tính vào Xếp đội (trừ khi nó tiến hóa đổi hàng).' }) : null,
      h('span', { class: 'sep' }),
      Object.entries(TEAM_FILTER).map(([key, [text, test]]) => h('button', {
        class: `chip sm ${teamFilter === key ? 'on' : ''}`, tabindex: '-1', disabled: key !== 'all' && !mine.some(test), text,
        title: key === 'all' ? null : KIT[key]?.[1], onClick: () => { teamFilter = key; dirty = true; render(true); },
      })));
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
      camKey(d, false, target.isConnected ? target : realm.win);
    }
    const target = camTarget();
    if (!target) return;
    for (const d of dirs) if (!held.has(d)) { held.set(d, target); camKey(d, true, target); }
  }
  const releaseAll = () => setHeld(new Set());
  function endPan() { pan = null; clearTimeout(stopTimer); releaseAll(); }
  const swallow = e => { e.stopImmediatePropagation(); e.preventDefault(); };
  const onMouseDown = e => {
    if (!e.isTrusted || !camTarget() || e.target !== camTarget()) return;
    const alt = e.button === 0 && e.altKey;
    if (e.button !== 1 && !alt) return;
    if (alt) swallow(e); else e.preventDefault();
    pan = { btn: e.button, alt, x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: false };
  };
  const onMouseMove = e => {
    if (!pan || !e.isTrusted) return;
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
    if (!pan || !e.isTrusted || e.button !== pan.btn) return;
    if (pan.alt) { swallow(e); swallowClick = true; setTimeout(() => { swallowClick = false; }, 0); }
    endPan();
  };
  const onClickAfterPan = e => { if (swallowClick) { swallow(e); swallowClick = false; } };
  const onBlur = () => endPan();

  const onHotkey = e => {
    if (!e.isTrusted || e.repeat || e.ctrlKey || e.metaKey || e.altKey || e.shiftKey || e.code !== 'KeyF') return;
    const typing = n => n?.isContentEditable || !!n?.closest?.('input,textarea,select,[contenteditable]');
    let active = document.activeElement;
    while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
    if (typing(e.composedPath?.()[0] ?? e.target) || typing(active)) return;
    if (!web.primaryReady()) return;
    e.preventDefault();
    web.clickPrimary();
  };

  const TIER_CLASS = { 'S+': 't-sp', S: 't-s', A: 't-a', B: 't-b', C: 't-c' };
  const powerOf = stage => U(stage)?.pw ?? -1;
  const levelOf = id => (U(id)?.l ? `Lv${U(id).l}` : nameOf(id));
  const KIT = {
    atk: ['ATK', 'Gây sát thương là chính'], tank: ['TANK', 'Máu / giáp dày, chịu đòn'], buff: ['BUFF', 'Hào quang tăng sát thương / tốc đánh cả đội'],
    debuff: ['DEBUFF', 'Làm yếu quái: chậm, giảm tốc đánh, phá giáp'], selfharm: ['⚠ TỰ HẠI', 'Chí mạng / choáng dạng self dội vào chính con pet (issue #1)'],
    cc: ['CC', 'Làm chậm / giảm tốc đánh quái'], heal: ['HEAL', 'Hồi máu'], evade: ['NÉ', 'Né đòn'], taunt: ['TAUNT', 'Kéo quái đánh mình'],
    boss: ['BOSS', 'Sát thương theo % máu / giá trị — diệt boss'], aoe: ['AOE', 'Sát thương lan'],
  };
  const ROLE_NAME = { atk: 'ATK', tank: 'TANK', buff: 'BUFF', debuff: 'DEBUFF' };
  const wish = new Set(), wishSeen = new Set();
  const famOf = stage => { const f = U(stage)?.f; return typeof f === 'string' && SAFE_ID.test(f) ? f : stage; };
  const wished = stage => wish.has(famOf(stage));
  const byWish = (a, b) => Number(wished(b.stage)) - Number(wished(a.stage));
  let info = null;
  const isOpen = (stage, ids) => !!info && (ids && info.id != null ? ids.includes(info.id) : info.id == null && info.stage === stage);
  const starBtn = stage => {
    const on = wished(stage);
    return h('button', { class: `star ${on ? 'on' : ''}`, text: on ? '★' : '☆', tabindex: '-1',
      title: on ? 'Bỏ khỏi wishlist' : 'Thêm vào wishlist: dòng này luôn nằm đầu tab Wild (ưu tiên mua) và tab Đội (ưu tiên nâng); ra ở bãi là báo',
      onClick: e => { e.stopPropagation(); if (on) wish.delete(famOf(stage)); else wish.add(famOf(stage)); dirty = true; render(true); } });
  };
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
    if (!steps.length) return h('div', { class: 'strip' });
    return h('div', { class: 'strip', title: `Hạng từng cấp (so với con cùng tầm cấp):\n${steps.map(id => `${levelOf(id)} ${U(id).st}`).join(' › ')}` },
      steps.map(id => h('i', { class: TIER_CLASS[U(id).st] })));
  }

  const tierPill = (stage, small = false) => {
    const u = U(stage);
    if (!u?.st) return null;
    const lines = [`Hạng hiện tại ${u.st} — ${nameOf(stage)} so với các con ${ROLE_NAME[u.ro] ?? ''} cùng tầm cấp · ${fmt(Math.round(u.ed ?? u.dps ?? 0))} DPS thật`];
    if (u.sd) lines.push(`⚠ Tự hại (issue #1): tự mất ${fmt(Math.round(u.sd))} máu/giây — chết sau ~${Math.round((u.hp ?? 0) / u.sd)} giây nếu không được hồi`);
    if (u.pk && Number.isFinite(u.pw)) {
      const [peakId, cost, eff] = u.pk;
      lines.push(peakId === stage ? 'Đây đã là dạng mạnh nhất của dòng'
        : `Đỉnh dòng: ${nameOf(peakId)} · hạng ${ROLE_NAME[u.ro] ?? ''} ${powerTier(u.pw)} · ${fmt(Math.round(eff))} DPS thật · cần ${fmt(cost)} vàng tiến hóa`);
    }
    for (const [r, to, c] of u.ul ?? []) lines.push(`Lên ${nameOf(to)} (${fmt(c)} vàng) mở ${db.rn?.[r] ?? r}`);
    return h('span', { class: `tier ${TIER_CLASS[u.st]}${small ? ' sm' : ''}`, text: u.st, title: lines.join('\n') });
  };


  const ROLE_COLOR = { atk: '#ff8f8f', tank: '#7fd4ff', buff: '#ffd36b', debuff: '#b89cff' };
  const roleColor = stage => ROLE_COLOR[U(stage)?.ro ?? kitOf(stage)[0]] ?? '#33496b';
  const harm = stage => (U(stage)?.sd ? h('b', { class: 'harm', text: '⚠', title: `Tự hại (issue #1): mất ${fmt(Math.round(U(stage).sd))} máu/giây` }) : null);
  const pic = (stage, tip, ...extra) => h('div', { class: 'pic', style: `--el:${tint(U(stage)?.el)}`, title: tip }, img(stage, 46), ...extra);
  const lvTag = stage => (U(stage)?.l ? h('span', { class: 'lv', text: `Lv${U(stage).l}` }) : null);

  function viewTrade() {
    const list = tradeOptions(state, db);
    if (!list.length) return empty('Chưa có trade offer (trade tắt hoặc đang chờ dữ liệu).');
    const side = (id, slot) => openable(pic(id, statsTip(id), h('span', { class: 'tl' }, tierPill(id)), lvTag(id)), `t${slot}`, id);
    return h('div', { class: 'tgrid' }, list.map(o => {
      const status = o.ready.length ? act('⇄ Trade', 'trade', `u${o.ready[0].id}`, o.slot, { stage: o.give, get: o.get }, 'ok',
        `Đổi ${nameOf(o.give)} lấy ${nameOf(o.get)}${o.ready.length > 1 ? ` · có ${o.ready.length} con` : ''}`)
        : o.evolve ? h('span', { class: `b ${state.gold >= o.evolve.cost ? 'warn' : 'bad'}`, text: `cần ${levelOf(o.give)}`,
          title: `Nâng ${nameOf(o.evolve.unit.stage)} → ${o.evolve.steps.map(nameOf).join(' → ')}: ${fmt(o.evolve.cost)} vàng` })
        : h('span', { class: 'b max', text: '—', title: 'Chưa có con nào thuộc dòng này' });
      return h('div', { class: `tcard${o.ready.length ? ' is-ok' : o.evolve ? ' is-warn' : ''}${wished(o.get) ? ' wish' : ''}` },
        h('div', { class: 'th', text: `S${o.slot}` }),
        h('div', { class: 'pair' }, side(o.give, o.slot), h('span', { class: 'ar', text: '→' }), side(o.get, o.slot)),
        h('div', { class: 'nm2' }, h('span', { text: U(o.give)?.n ?? o.give }), h('span', { class: 'get', text: U(o.get)?.n ?? o.get })),
        h('div', { class: 'acts' }, status));
    }));
  }

  let wildRole = 'all';
  const ROLE_FILTER = { all: ['Tất cả', () => true], atk: ['ATK', kit => kit[0] === 'atk'], tank: ['TANK', kit => kit[0] === 'tank'], buff: ['BUFF', kit => kit[0] === 'buff'], debuff: ['DEBUFF', kit => kit[0] === 'debuff'] };
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
    const order = sorters[wildSort];
    wilds.sort((a, b) => byWish(a, b) || order(a, b));
    const sortBtn = (key, t) => h('button', { class: `chip sm ${wildSort === key ? 'on' : ''}`, text: t, onClick: () => { wildSort = key; dirty = true; render(true); } });
    const tile = ({ stage, idList, count, u, peak, trades }) => openable(h('div', { class: `tile${wished(stage) ? ' wish' : ''}${isOpen(stage) ? ' sel' : ''}`, style: `--ro:${roleColor(stage)}` },
      pic(stage, `Bắt ${Math.round((u.c ?? 0) * 100)}% · đỉnh ${short(peak)} DPS thật\n${statsTip(stage)}${count > 1 ? `\n${count} con — bấm tiếp để chọn con khác` : ''}`,
        h('span', { class: 'tl' }, tierPill(stage), harm(stage)), starBtn(stage),
        (u.c ?? 1) < 0.5 ? h('span', { class: 'lv rare', text: `${Math.round((u.c ?? 0) * 100)}%`, title: 'Tỉ lệ bắt thấp' }) : null,
        count > 1 ? h('span', { class: 'cnt', text: `×${count}` }) : null),
      strip(stage),
      h('div', { class: 'tn', title: trades.length ? trades.map(t => `S${t.slot}: cần ${nameOf(t.give)} → nhận ${nameOf(t.get)}`).join('\n') : null },
        trades.length ? h('b', { class: 'trf', text: '⇄' }) : null, u.n ?? stage),
      h('div', { class: 'acts' }, act(`${short(u.b ?? 0)}g`, 'catch', `w${idList[0]}`, null, { stage }, (u.b ?? 0) <= state.gold ? 'ok' : 'bad', `Bắt 1 con ${nameOf(stage)}: ${fmt(u.b ?? 0)} vàng`))),
    cycle(`w:${stage}`, idList.map(id => `w${id}`)), stage);
    return [
      h('div', { class: 'bar-row' }, sortBtn('value', 'Đáng bắt'), sortBtn('cheap', 'Rẻ'), sortBtn('catch', 'Dễ bắt'),
        h('span', { class: 'muted', text: String(state.wilds.size) })),
      h('div', { class: 'bar-row' }, Object.entries(ROLE_FILTER).map(([key, [text]]) => h('button', { class: `chip sm ${wildRole === key ? 'on' : ''}`, text,
        onClick: () => { wildRole = key; dirty = true; render(true); } }))),
      wilds.length ? h('div', { class: 'grid' }, wilds.map(tile)) : empty(state.wilds.size ? 'Không có con nào đúng vai trò này.' : 'Bãi đang trống.'),
    ];
  }

  let teamFilter = 'all';
  const TEAM_FILTER = {
    all: ['Tất cả', () => true],
    atk: ['ATK', u => kitOf(u.stage)[0] === 'atk'],
    tank: ['TANK', u => kitOf(u.stage)[0] === 'tank'],
    buff: ['BUFF', u => kitOf(u.stage)[0] === 'buff'],
    debuff: ['DEBUFF', u => kitOf(u.stage)[0] === 'debuff'],
  };
  function teamTile(stage, list, plan, wanted) {
    const u = U(stage) ?? {};
    const alive = list.filter(x => x.active);
    const lead = alive[0] ?? list[0];
    const ids = list.map(x => x.id);
    const evo = u.e ?? [];
    const trades = alive.length ? (wanted.get(stage) ?? []).slice(0, 1) : [];
    const moving = !!plan?.moves.some(m => list.some(x => `u${x.id}` === m.key));
    const buttons = [
      ...trades.map(o => act(`⇄S${o.slot}`, 'trade', `u${lead.id}`, o.slot, { stage, get: o.get }, 'tr', `Trade slot ${o.slot}: đổi lấy ${nameOf(o.get)}`)),
      ...evo.map(([to, cost]) => {
        const trap = u.tp?.[to];
        const drop = `${fmt(u.ed ?? u.dps)} → ${fmt(U(to)?.ed ?? U(to)?.dps)} DPS thật`;
        const warn = trap === 2 ? `\n⚠ BẪY: ${drop}, lên tiếp cũng không hồi lại — nên dừng ở đây` : trap === 1 ? `\n⚠ Tạm tụt: ${drop}, các cấp sau mới mạnh hơn` : '';
        return act([evo.length > 1 ? img(to, 13) : '↑', short(cost), trap ? '⚠' : ''], 'evolve', `u${lead.id}`, to, { stage },
          trap === 2 || cost > state.gold ? 'bad' : 'ok', `Tiến hóa ${list.length > 1 ? '1 con ' : ''}lên ${nameOf(to)}: ${fmt(cost)} vàng${warn}`);
      }),
    ];
    if (!evo.length) buttons.push(h('span', { class: 'b max', text: 'MAX', title: 'Dạng cuối' }));
    const hp = h('div', { class: 'hps' }, list.map(x => {
      const pct = x.maxHp ? Math.max(0, Math.min(100, Math.round((x.hp / x.maxHp) * 100))) : 100;
      return h('i', { class: !x.active ? 'down' : pct < 35 ? 'low' : pct < 70 ? 'mid' : null, style: x.active ? `--p:${pct}%` : null });
    }));
    const down = list.length - alive.length;
    const tip = `${statsTip(stage)}${down ? `\n${down} con gục — trở lại đợt sau` : ''}${list.length > 1 ? `\n${list.length} con — bấm tiếp để chọn con khác` : ''}`;
    return openable(h('div', { class: `tile${wished(stage) ? ' wish' : ''}${alive.length ? '' : ' down'}${isOpen(stage, ids) ? ' sel' : ''}`, style: `--ro:${roleColor(stage)}` },
      pic(stage, tip, h('span', { class: 'tl' }, tierPill(stage), harm(stage), moving ? h('b', { class: 'mv', text: '↕', title: 'Xếp đội sẽ dời con này' }) : null),
        starBtn(stage), lvTag(stage), list.length > 1 ? h('span', { class: 'cnt', text: `×${list.length}` }) : null, hp),
      strip(stage),
      h('div', { class: 'tn', text: u.n ?? stage }),
      h('div', { class: `acts${buttons.length > 1 ? ' split' : ''}` }, buttons)),
    cycle(`u:${stage}`, list.map(x => `u${x.id}`)), stage, key => Number(key.slice(1)));
  }
  function viewTeam() {
    const mine = myUnits(state);
    if (!mine.length) return empty('Chưa có lính (hoặc đang chờ dữ liệu).');
    const wanted = new Map();
    for (const o of state.offers.values()) wanted.set(o.give, [...(wanted.get(o.give) ?? []), o]);
    const blocked = blockReason() ?? (state.summary?.phase !== 'planning' ? 'wave' : null);
    const g = blocked ? null : findGame();
    const plan = g ? arrangePlan(g) : null;
    const test = TEAM_FILTER[teamFilter][1];
    const first = new Map(), stacks = new Map();
    for (const u of [...mine].sort((a, b) => a.id - b.id)) {
      if (!first.has(famOf(u.stage))) first.set(famOf(u.stage), u.id);
      if (!test(u)) continue;
      if (!stacks.has(u.stage)) stacks.set(u.stage, []);
      stacks.get(u.stage).push(u);
    }
    const rank = stage => [first.get(famOf(stage)) ?? 0, U(stage)?.l ?? 0];
    const order = ([a], [b]) => { const x = rank(a), y = rank(b); return x[0] - y[0] || x[1] - y[1] || (a < b ? -1 : a > b ? 1 : 0); };
    const groups = [['★', '#ffde8f', 'Wishlist — ưu tiên nâng'], ...ROWS].map(([name, color, tip]) => ({ name, color, tip, list: [] }));
    for (const entry of stacks) groups.at(wished(entry[0]) ? 0 : formationRow(U(entry[0])) + 1).list.push(entry);
    return [teamBar(mine, plan, blocked),
      stacks.size ? groups.filter(gr => gr.list.length).map(gr => [
        h('div', { class: 'sect', style: `--c:${gr.color}`, title: gr.tip }, h('i'), gr.name, h('span', { class: 'n', text: String(gr.list.reduce((n, [, l]) => n + l.length, 0)) })),
        h('div', { class: 'grid' }, gr.list.sort(order).map(([stage, l]) => teamTile(stage, l, plan, wanted))),
      ]) : empty('Không có con nào thuộc nhóm này.')];
  }

  function viewInfo() {
    const live = info.id != null ? myUnits(state).find(x => x.id === info.id) : null;
    const stage = live?.stage ?? info.stage;
    const u = U(stage);
    if (!u) return [];
    const paths = [];
    const grow = (id, cost, trail, depth) => {
      const next = [...trail, [id, cost]];
      const kids = depth < 10 ? (U(id)?.e ?? []).slice(0, 3) : [];
      if (!kids.length || paths.length >= 3) { if (paths.length < 3) paths.push(next); return; }
      for (const [to, c] of kids) grow(to, cost + c, next, depth + 1);
    };
    grow(stage, 0, [], 0);
    const node = ([id, cost], i, list) => {
      const d = U(id) ?? {};
      const prev = i ? list[i - 1][0] : null;
      const trap = prev && U(prev)?.tp?.[id] === 2;
      return h('div', { class: `node ${i ? '' : 'now'} ${trap ? 'trap' : ''}`,
        title: `${nameOf(id)} · DPS ${fmt(Math.round(d.ed ?? d.dps ?? 0))} · máu ${fmt(d.hp)}${i ? ` · ${fmt(cost)} vàng từ bây giờ` : ' · đang ở đây'}${trap ? '\n⚠ Bẫy: lên dạng này bị tụt' : ''}${d.sd ? '\n⚠ Tự hại (issue #1)' : ''}` },
        img(id, 34), d.st ? h('span', { class: `tier ${TIER_CLASS[d.st]}`, text: d.st }) : null, h('small', { class: i ? 'gold' : '', text: i ? short(cost) : `Lv${d.l ?? '?'}` }));
    };
    const seen = new Set(), skills = [];
    for (const list of paths) for (const [id] of list) for (const sk of U(id)?.sk ?? []) {
      const a = db.ab?.[sk];
      if (!a || seen.has(a.n)) continue;
      seen.add(a.n);
      skills.push([sk, id]);
    }
    const where = id => `${nameOf(id)}${U(id)?.l ? ` Lv${U(id).l}` : ''}`;
    const tier = u.pw != null ? powerTier(u.pw) : u.st;
    return [
      h('div', { class: 'dh' }, img(stage, 64),
        h('div', null,
          h('div', { class: 'nm' }, h('i', { class: 'dot', style: `background:${rgbOf(u.el)}` }), h('b', { text: u.n ?? '?' }), u.l ? h('small', { text: ` Lv${u.l}` }) : null),
          h('div', { class: 'dl' },
            tier ? h('span', { class: `tier ${TIER_CLASS[tier]}`, text: tier, title: `Hạng ${ROLE_NAME[u.ro] ?? ''} của cả dòng` }) : null,
            u.ro ? h('span', { class: `k-${u.ro} role`, text: ROLE_NAME[u.ro] }) : null,
            u.sd ? h('span', { class: 'harm', text: '⚠', title: `Tự hại (issue #1): mất ${fmt(Math.round(u.sd))} máu/giây` }) : null))),
      h('div', { class: 'stats' },
        h('span', { text: `❤ ${short(u.hp ?? 0)}`, title: 'Máu' }), h('span', { text: `⚔ ${short(Math.round(u.ed ?? u.dps ?? 0))}`, title: 'DPS thật' }),
        h('span', { text: `↔ ${u.rg ?? '?'}`, title: 'Tầm đánh' }), h('span', { text: `⛨ ${u.ar ?? 0}`, title: 'Giáp' })),
      paths.length && paths[0].length > 1 ? h('div', { class: 'evo' }, paths.map(list => h('div', { class: 'path' }, list.map((x, i) => [i ? h('span', { class: 'ar', text: '›' }) : null, node(x, i, list)])))) : null,
      skills.length ? h('div', { class: 'sks' }, skills.map(([sk, id]) => {
        const a = db.ab[sk];
        return h('div', { class: `sk ${a.x ? 'self' : ''} ${a.off ? 'off' : ''}` },
          h('img', { width: 26, height: 26, alt: '', src: a.i && SAFE_ID.test(a.i) ? `${DATA_URL}skills/${a.i}.webp` : null }),
          h('div', null,
            h('div', { class: 'skn' }, h('b', { text: a.n }), id !== stage ? h('small', { text: ` từ Lv${U(id)?.l ?? '?'}`, title: where(id) }) : null),
            h('div', { class: 'skd', text: `${a.d ?? a.g ?? ''}${a.x ? ' — ⚠ dội vào chính nó' : ''}` })));
      })) : null,
      kitChips(stage),
    ].filter(Boolean);
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
      h('div', { class: 'sec', text: 'Kiểm kỹ năng chí mạng / choáng' }),
      h('div', { class: 'kv', title: 'Đánh 1 đợt có con Chí mạng / Choáng (Hitmonlee, Charmeleon, Pichu…). Đếm từ sự kiện trận server gửi: mỗi lần kỹ năng kích hoạt, sát thương đi vào chính con pet hay vào quái' },
        h('span', { text: 'Kích hoạt' }), h('b', { text: skillProbe.fired ? `${fmt(skillProbe.fired)} lần` : 'chưa thấy' })),
      skillProbe.fired ? h('div', { class: 'kv hl' }, h('span', { text: 'Sát thương cùng lúc' }),
        h('b', { text: `tự trúng ${fmt(skillProbe.selfHit)} (${short(skillProbe.selfDmg)}) · vào quái ${fmt(skillProbe.otherHit)} (${short(skillProbe.otherDmg)})` })) : null,
      h('div', { class: 'bar-row' }, h('button', { class: 'chip', text: 'Chép kết quả kiểm tra', onClick: e => {
        navigator.clipboard?.writeText(JSON.stringify({ v: VERSION, ...p, skillProbe: { ...skillProbe, suspect: suspect.size } }, null, 1)).then(() => { e.target.textContent = 'Đã chép'; }, () => { e.target.textContent = 'Không chép được'; });
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
  const drawer = h('div', { class: 'drawer' });
  drawer.hidden = true;
  const wrap = h('div', { class: 'wrap' }, panel, drawer);
  root.append(wrap);
  let keepInfo = false;
  root.addEventListener('pointerdown', e => {
    const path = e.composedPath();
    keepInfo = path.includes(drawer) || path.some(n => n?.classList?.contains?.('pick'));
    if (!keepInfo && info) { info = null; dirty = true; render(true); }
  });
  const outsideClose = e => { if (info && !e.composedPath().includes(host)) { info = null; dirty = true; render(true); } };
  window.addEventListener('pointerdown', outsideClose, true);
  panel.addEventListener('pointerdown', e => { if (e.isTrusted) downAt = performance.now(); }, true);
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
    sig.length = 0;
    for (const w of state.wilds.values()) {
      if (wishSeen.has(w.id) || !wished(w.stage)) continue;
      wishSeen.add(w.id);
      toast = `★ ${nameOf(w.stage)} (wishlist) vừa ra ở bãi — tab Wild để bắt.`;
    }
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
      state.haveKeyframe ? h('span', { class: 'gold', text: `${short(state.gold)}g`, title: 'Vàng hiện có' }) : null,
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
    const shape = `${tab}|${wildSort}|${wildRole}|${teamFilter}|${toast ? 1 : 0}|${status ?? ''}|${sig.join(',')}`;
    if (shape !== lastLayout) { lastLayout = shape; layoutAt = performance.now(); }
    panel.className = `panel ${layout}`;
    panel.replaceChildren(header, tabs, body);
    wrap.className = `wrap ${layout}`;
    let infoView = [];
    try { infoView = info ? viewInfo() : []; } catch { infoView = []; }
    drawer.hidden = panel.hidden || !infoView.length;
    drawer.replaceChildren(...infoView);
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
    const quiet = fn => { try { fn(); } catch { } };
    quiet(unpatch);
    socket?.removeEventListener('message', onMessage);
    socket?.removeEventListener('close', onClose);
    clearTimeout(pending);
    clearTimeout(autoTimer);
    observers.forEach(o => o.disconnect());
    window.removeEventListener('pointermove', onMove);
    window.removeEventListener('pointerup', onUp);
    window.removeEventListener('pointerdown', outsideClose, true);
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

  const SOURCES = new Set([`${DATA_URL}overlay.json`, '/catalog']);
  async function readCapped(r, maxBytes) {
    if (Number(r.headers?.get('content-length')) > maxBytes) throw new Error('dữ liệu quá lớn');
    if (!r.body?.getReader) { const t = await r.text(); if (t.length > maxBytes) throw new Error('dữ liệu quá lớn'); return t; }
    const reader = r.body.getReader(), parts = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { reader.cancel().catch(() => { }); throw new Error('dữ liệu quá lớn'); }
      parts.push(value);
    }
    const all = new Uint8Array(size);
    let at = 0;
    for (const p of parts) { all.set(p, at); at += p.byteLength; }
    return new TextDecoder().decode(all);
  }
  const getJSON = (url, maxBytes) => {
    if (!SOURCES.has(url)) return Promise.reject(new Error('nguồn dữ liệu không cho phép'));
    const target = url === '/catalog' ? `${location.origin}/catalog` : url;
    return fetch(target, { credentials: 'omit', cache: 'no-cache', redirect: 'error', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(20000) })
      .then(r => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        if (r.url && r.url !== target) throw new Error('bị chuyển hướng');
        const type = r.headers?.get('content-type');
        if (type && !/json|text\/plain/i.test(type)) throw new Error('không phải JSON');
        return readCapped(r, maxBytes);
      })
      .then(t => JSON.parse(t));
  };

  let live = null, liveHash = null, rawCat = null;
  function mergeGameCatalog() {
    if (!db || !gameCatReady) return;
    if (rawCat && !live) { try { live = analyzeCatalog(rawCat, { overrides: db.ov }); } catch { live = null; } rawCat = null; }
    for (const [id, a] of live ?? []) db.u[id] = { ...(db.u[id] ?? {}), ...a.stats, ...overlayFields(a) };
    for (const [id, g] of gameCat) db.u[id] = { ...(db.u[id] ?? {}), n: g.n, l: g.l, b: g.b, c: g.c, e: g.e };
    for (const r of mem.units.values()) r.row = formationRow(U(r.stage));
    dirty = true; render(true);
  }
  const wikiBehind = () => !!(db?.v && liveHash && !liveHash.startsWith(db.v));
  const S = (v, max = 80) => (typeof v === 'string' ? v.slice(0, max) : undefined);
  const N = v => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const ID = v => (typeof v === 'string' && v.length <= 64 && SAFE_ID.test(v) ? v : undefined);
  const TIER = v => (['S+', 'S', 'A', 'B', 'C'].includes(v) ? v : undefined);
  const list = (v, f, max = 64) => (Array.isArray(v) ? v.slice(0, max).map(f).filter(x => x !== undefined) : undefined);
  const tuple = (v, fs) => (Array.isArray(v) && fs.every((f, i) => f(v[i]) !== undefined) ? fs.map((f, i) => f(v[i])) : undefined);
  const dict = (v, f, max = 256) => {
    const o = Object.create(null);
    if (v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k, x] of Object.entries(v).slice(0, max)) {
        const y = ID(k) ? f(x) : undefined;
        if (y !== undefined) o[k] = y;
      }
    }
    return o;
  };
  const byte = v => (N(v) === undefined ? undefined : Math.max(0, Math.min(255, Math.round(v))));
  const cleanUnit = x => ({
    n: S(x.n), m: ID(x.m), hp: N(x.hp), dps: N(x.dps), a: ID(x.a), at: ID(x.at), ar: N(x.ar), rg: N(x.rg), b: N(x.b), lk: N(x.lk),
    f: ID(x.f), ed: N(x.ed), l: N(x.l), el: ID(x.el), c: N(x.c), k: N(x.k), p: ID(x.p), pw: N(x.pw), st: TIER(x.st), L: N(x.L),
    e: list(x.e, v => tuple(v, [ID, N]), 8), pk: tuple(x.pk, [ID, N, N]), ul: list(x.ul, v => tuple(v, [ID, ID, N])),
    pg: list(x.pg, ID), kt: list(x.kt, ID), r: list(x.r, ID), ro: ['atk', 'tank', 'buff', 'debuff'].includes(x.ro) ? x.ro : undefined, sd: N(x.sd), pc: Number.isInteger(x.pc) && x.pc >= 0 && x.pc < 8 ? x.pc : undefined, sk: list(x.sk, ID, 12), s: list(x.s, v => S(v, 60)), tp: dict(x.tp, v => (v === 1 || v === 2 ? v : undefined), 16),
  });
  getJSON(`${DATA_URL}overlay.json`, 4 * 1024 * 1024)
    .then(d => {
      if (!d || typeof d.u !== 'object' || Array.isArray(d.u)) throw new Error('dữ liệu sai định dạng');
      const u = Object.create(null);
      for (const [id, x] of Object.entries(d.u).slice(0, 5000)) {
        if (!ID(id) || !x || typeof x !== 'object' || Array.isArray(x)) continue;
        u[id] = cleanUnit(x);
      }
      db = {
        v: typeof d.v === 'string' && /^[\w-]{1,64}$/.test(d.v) ? d.v : null,
        sell: N(d.sell) !== undefined ? Math.max(0, Math.min(1, d.sell)) : 0,
        el: dict(d.el, x => (x && typeof x === 'object' ? { n: S(x.n, 24), c: tuple(x.c, [byte, byte, byte]) } : undefined), 16),
        lb: dict(d.lb, v => S(v, 40), 64),
        rn: dict(d.rn, v => S(v, 40), 64),
        dmg: dict(d.dmg, row => dict(row, v => (N(v) !== undefined ? Math.max(0, Math.min(10, v)) : undefined), 16), 16),
        ov: dict(d.ov, v => (['atk', 'tank', 'buff', 'debuff'].includes(v) ? v : undefined), 400),
        ab: dict(d.ab, x => (x && typeof x === 'object' ? { n: S(x.n, 60), g: S(x.g, 80), t: list(x.t, v => S(v, 160), 3), d: S(x.d, 160), i: ID(x.i), x: x.x === 1 ? 1 : undefined, off: x.off === 1 ? 1 : undefined } : undefined), 1000),
        u,
      };
      mergeGameCatalog();
      dirty = true; render(true);
    })
    .catch(err => { if (dead) return; try { panel.replaceChildren(h('p', { class: 'empty bad', text: `CUTD Helper: không tải được dữ liệu wiki (${err.message}).` })); } catch { } });
  getJSON('/catalog', 32 * 1024 * 1024)
    .then(raw => {
      gameCat = buildGameCatalog(raw);
      suspect = new Set((raw.catalog?.abilities ?? []).filter(a => a?.trigger?.kind === 'on_hit' && a.targeting?.kind === 'self'
        && (a.effects ?? []).some(e => e?.kind === 'damage' && !e.target && !e.targeting)).map(a => a.id).filter(id => typeof id === 'string'));
      rawCat = raw.catalog;
      liveHash = typeof raw.catalog_hash === 'string' && /^[0-9a-f]{12,64}$/.test(raw.catalog_hash) ? raw.catalog_hash : null;
      gameCatReady = true; mergeGameCatalog();
    })
    .catch(() => { if (dead) return; toast = 'Không tải được catalog của game — nút Bắt/Tiến hóa/Trade tạm khoá.'; dirty = true; try { render(true); } catch { } });
})();
