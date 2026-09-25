import {
  createState, applyMessage, isGameMessage, myUnits, tradeOptions, offersForFamily,
  bestAttacks, nextWaveForBase, buildGameCatalog, formationRow, acceptRows, createMemory, observe, onSent, onAck, planMoves,
} from './logic.js';
import * as web from './web-input.js';
import { findGame, findEntity, selectEntity, catchWild, evolveCreature, tradePet, moveCreature, groundOf, posOf, clientKind, armWebCapture, disarmWebCapture, webCaptured, webTouched, forgetWebCapture } from './game-bridge.js';
import { realm, gameDoc } from './realm.js';
import { analyzeCatalog, overlayFields, powerTier } from './analyze.js';
import { TICKS_PER_SECOND, AOE_TARGETS } from './skillvalue.js';
import { FPS_CAPS, capFrames, readLite, writeLite } from './lite.js';

const DATA_URL = __CUTD_DATA_URL__;
const VERSION = '__CUTD_VERSION__';
const NS = '__cutdHelper';

const CSS = `
:host{all:initial}
*{box-sizing:border-box;margin:0;font:12.5px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif}
.panel{position:relative;width:min(380px,calc((100vw - 24px) / var(--z,1)));max-height:calc((100vh - 24px) / var(--z,1));display:flex;flex-direction:column;background:#0f1a2df5;color:#e6f2ff;border:1px solid #33496b;border-radius:12px;box-shadow:0 10px 30px #000a;overflow:hidden}
.top{display:flex;align-items:center;gap:6px;padding:6px 6px 6px 12px;cursor:move;user-select:none}
.top b{color:#ffde8f;font-weight:700;letter-spacing:.2px}
.grow{flex:1}
.x{all:unset;cursor:pointer;width:22px;height:22px;display:grid;place-items:center;border-radius:6px;color:#8fb7e8;font-size:15px}
.x:hover{background:#243552;color:#fff}
.tabs{display:flex;border-bottom:1px solid #243552}
.tab{all:unset;cursor:pointer;flex:1;text-align:center;padding:7px 0;color:#8fb7e8;font-weight:600;border-bottom:2px solid transparent;white-space:nowrap}
.tab:hover{color:#fff}.tab.on{color:#ffde8f;border-bottom-color:#ffde8f}.tab.on small{color:#ffde8f}
.body{overflow:auto;padding:4px 0 6px}
.bar-row{display:flex;flex-wrap:wrap;align-items:center;gap:5px;padding:6px 10px 4px}
.sep{width:1px;height:14px;background:#33496b;margin:0 2px}
.chip{white-space:nowrap}
.chip{all:unset;cursor:pointer;padding:2px 9px;border-radius:99px;border:1px solid #33496b;color:#8fb7e8;font-weight:600;font-size:11.5px}
.chip.on{background:#ffde8f;color:#0b1526;border-color:transparent}
.chip.sm{padding:1px 8px;font-size:11px}.chip:disabled{opacity:.35;cursor:default}
.wrap{display:flex;gap:8px;align-items:flex-start}
.drawer{width:270px;max-height:calc((100vh - 24px) / var(--z,1));overflow-y:auto;background:#0f1a2df5;color:#e6f2ff;border:1px solid #33496b;border-radius:12px;box-shadow:0 10px 30px #000a;padding:12px;scrollbar-width:thin}
.dh{display:grid;grid-template-columns:64px 1fr;gap:10px;align-items:center}.dh .pt{width:64px;height:64px;border:0;background:transparent;object-fit:contain}
.dh b{font-size:16px;font-weight:800}.dl{display:flex;align-items:center;gap:6px;margin-top:5px}
.role{font-size:10px;font-weight:800;padding:1px 5px;border-radius:4px}.k-atk.role{background:#3d2226;color:#ff9c9c}.k-tank.role{background:#1b2d4a;color:#9fe3ff}.k-buff.role{background:#3a2f10;color:#ffde8f}.k-debuff.role{background:#2a2148;color:#cbb3ff}
.harm{color:#ff9c9c;font-weight:800}
.stats{display:grid;grid-template-columns:repeat(4,1fr);gap:4px;margin:10px 0}.stats span{background:#101c30;border-radius:6px;padding:4px 0;text-align:center;font-weight:800;font-size:11.5px}
.evo{display:flex;flex-direction:column;gap:6px;margin-bottom:10px}.path{display:flex;align-items:flex-start;gap:1px;flex-wrap:wrap}
.node{display:flex;flex-direction:column;align-items:center;width:38px;gap:1px}.node .pt{width:32px;height:32px}
.node.now .pt{border-color:#ffde8f}.node.ready .pt{border-color:#ffde8f}.node.off{opacity:.38;filter:grayscale(1)}.path.tr .ar{color:#ffde8f;font-size:13px;margin:8px 3px 0 0}.node.trap .pt{border-color:#ff9c9c}.node small{font-size:9.5px;color:#8fb7e8;font-weight:700}.node small.gold{color:#ffde8f}
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
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(80px,1fr));gap:5px;padding:4px 10px 6px}
.tile{position:relative;display:flex;flex-direction:column;background:#132238;border:1px solid #22375a;border-top:2px solid var(--ro,#33496b);border-radius:9px;overflow:hidden}
.tile:hover{background:#182c49;border-color:#3a5480;border-top-color:var(--ro,#33496b)}
.tile.wish{border-color:#b69c62;border-top-color:var(--ro,#33496b);box-shadow:0 0 0 1px #b69c6255,0 0 10px #ffde8f22}
.tile.sel{outline:2px solid #ffde8f;outline-offset:-1px}
.pic{position:relative;height:58px;display:grid;place-items:center;background:radial-gradient(circle at 50% 64%,var(--el,#6488b86b) 0,transparent 66%)}
.pic .pt{width:50px;height:50px;border:0;border-radius:0;background:transparent;object-fit:contain}
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
.acts .act.ok{background:#1d3a2a;color:#9fd6a8}.acts .act.bad,.acts .b.bad{background:#2c1d24;color:#ff9c9c}
.acts .b.warn{background:#2b2616;color:#e8cf8a}.acts .b.tr{background:#3a3016;color:#ffde8f;flex:1.4;letter-spacing:.3px}.acts .b{font-size:10px}.acts .b.max{background:transparent;color:#4a6fa5}
.acts.split .act{font-size:10px;letter-spacing:-.3px}.acts .act .pt{width:13px;height:13px;border:0;border-radius:0;background:transparent}
.sect{display:flex;align-items:center;gap:6px;padding:8px 10px 1px;font-size:10.5px;font-weight:800;letter-spacing:.6px;color:#c7d8ea}
.sect i{width:3px;height:12px;border-radius:2px;background:var(--c,#33496b)}
.sect .n{margin-left:auto;font-size:10.5px;font-weight:700;color:#6f8fb8}
.dsum b{color:#ffde8f;font-weight:800}.dsum .dv{font-size:11px;font-weight:800;color:#8fb7e8}.dsum .dv.real{color:#ffde8f}
.drow{display:grid;grid-template-columns:28px minmax(0,1fr) auto;align-items:center;gap:8px;padding:4px 10px}
.drow .pt{width:28px;height:28px}.drow.down .pt{filter:grayscale(1) brightness(.6)}
.dnm{display:flex;align-items:center;gap:4px;white-space:nowrap;overflow:hidden}.dnm b{font-size:11.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis}.dnm small{font-size:10.5px;color:#6f8fb8}
.dnm .role{font-size:9px;padding:0 4px;line-height:13px}.dnm .tier{margin:0;min-width:0;font-size:9.5px;line-height:13px;padding:0 4px}
.dbar{position:relative;height:6px;margin-top:3px;border-radius:3px;background:#0b1526;overflow:hidden}
.dbar i{position:absolute;left:0;top:0;bottom:0;border-radius:3px}.dbar .real{background:#c98a8a}.dbar .real.tank{background:#6fb3d6}.dbar .real.heal{background:#7fbf8b}
.dst{display:flex;gap:9px;margin-top:2px;white-space:nowrap;overflow:hidden}.st{font-size:10.5px;color:#aec4d3}.st .g{font-size:10.5px;font-weight:800;margin-right:2px}
.g-dps{color:#ff9c9c}.g-tank{color:#9fe3ff}.g-ally{color:#9fd6a8}.g-self{color:#e8b4b8}.dsum .st{font-size:11px;font-weight:700}
.dval{text-align:right;line-height:1.15;min-width:54px}.dval b{display:block;font-size:12px;font-weight:800;color:#ffde8f}.dval small{font-size:10px;color:#6f8fb8;white-space:nowrap}
.hint{padding:2px 10px 6px;color:#6f8fb8;font-size:11px;line-height:1.45}.hint.now{color:#dbe8f7;font-size:11.5px}.hint b{font-size:11.5px;font-weight:800;color:#ffde8f}
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
.msgs{position:sticky;bottom:6px;z-index:3;display:grid;gap:4px;margin:6px 10px 0}
.toast{padding:6px 10px;border-radius:8px;background:#3d2226;color:#ff9c9c;font-size:12px;box-shadow:0 4px 14px #000b}.toast.info{background:#15243b;color:#aec4d3;font-size:11.5px}
.tab .ws{margin-left:3px;color:#ffde8f;font-size:12px;font-weight:900}
.tile.wide{grid-column:span 2}
.pic.wide{height:auto;min-height:64px;display:grid;grid-template-columns:52px minmax(0,1fr);align-items:center;gap:7px;padding:5px 8px 7px 6px;place-items:initial}
.pic.wide>.pt{width:50px;height:50px;justify-self:center}
.wi{min-width:0;display:flex;flex-direction:column;gap:1px;padding-right:14px}
.wi .tn{padding:0;text-align:left;font-size:11.5px;letter-spacing:0}
.wi small{font-size:10px;color:#aec4d3;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wi small.go{color:#ffde8f;font-weight:700}.wi small .rare{color:#ff9c9c;font-weight:800}
.acts .act.up{background:#ffde8f;color:#0b1526}
.acts .act.up.run{background:repeating-linear-gradient(-45deg,#ffde8f 0 6px,#e9c878 6px 12px);opacity:1;cursor:wait}
.acts .act.up.off{background:#2b2616;color:#8a7a52;opacity:1}
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
  let db = null, socket = null, dirty = true, tab = 'trade', lastRender = 0, layoutAt = 0, lastLayout = '';
  const sig = [];
  let gameCat = new Map(), gameCatReady = false, ownBase = null;

  let savedDesc = null, patchedWin = null;
  const seen = new WeakSet();

  const acks = new Map();
  const cmdLog = [];
  let dead = false;
  const WANTED = new Set(['server_hello', 'command_ack', 'base_keyframe', 'base_delta', 'room_summary']);
  const HEAD = '{"type":"';

  function handle(text) {
    if (typeof text !== 'string' || text.charCodeAt(0) !== 123) return false;
    if (text.startsWith(HEAD) && !WANTED.has(text.slice(HEAD.length, text.indexOf('"', HEAD.length)))) return false;
    let msg;
    try { msg = JSON.parse(text); } catch { return false; }
    if (msg?.type === 'server_hello') {
      if (Number.isInteger(msg.base_id)) ownBase = msg.base_id;
      const rate = msg.simulation_ticks_per_second;
      if (Number.isFinite(rate) && rate >= 1 && rate <= 240) tps = rate;
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
    if (msg.type === 'base_keyframe') autoHook();
    const was = state.summary?.phase;
    if (applyMessage(state, msg)) {
      if (msg.type === 'room_summary') meterPhase(was);
      else if (Array.isArray(msg.effects) && (ownBase == null || state.baseId === ownBase)) meterHits(msg);
      watchRoster();
      invalidate();
    }
    return true;
  }
  let tps = TICKS_PER_SECOND;
  const SHOTS = 1024;
  const meter = { wave: null, start: 0, last: 0, done: true, total: 0, dmg: new Map(), skill: new Map(), taken: new Map(), healSelf: new Map(), healAlly: new Map(), shots: new Map() };
  let heals = new Map();
  const bump = (map, id, v) => map.set(id, (map.get(id) ?? 0) + v);
  const meterSecs = () => (meter.start && meter.last > meter.start ? (meter.last - meter.start) / tps : 0);
  function meterPhase(was) {
    const now = state.summary?.phase;
    if (now === 'wave' && was !== 'wave') {
      meter.wave = state.summary.wave;
      meter.start = meter.last = state.summary.tick;
      meter.done = false;
      meter.total = 0;
      meter.dmg.clear(); meter.skill.clear(); meter.taken.clear(); meter.healSelf.clear(); meter.healAlly.clear(); meter.shots.clear();
    } else if (now !== 'wave' && was === 'wave' && !meter.done) {
      meter.done = true;
      meter.wave = null;
      meter.start = meter.last = meter.total = 0;
      meter.dmg.clear(); meter.skill.clear(); meter.taken.clear(); meter.healSelf.clear(); meter.healAlly.clear(); meter.shots.clear();
    }
  }
  function meterHits(msg) {
    if (meter.done) return;
    const hitAt = new Map();
    for (const e of msg.effects) {
      if (e?.kind === 'unit_damaged' && Number.isFinite(e.amount) && e.amount > 0) {
        const who = Number.isInteger(e.entity_id) ? e.entity_id : e.target_id;
        const ownHit = (e.source_collection === 'unit' || e.source_collection == null) && e.source_id === who;
        if (Number.isInteger(who) && state.units.has(who) && !ownHit) bump(meter.taken, who, e.amount);
        continue;
      }
      if (e?.kind === 'projectile_fired' && e.source_collection === 'unit' && Number.isInteger(e.entity_id) && Number.isInteger(e.source_id)) {
        meter.shots.set(e.entity_id, e.source_id);
        if (meter.shots.size > SHOTS) meter.shots.delete(meter.shots.keys().next().value);
        continue;
      }
      if (e?.kind !== 'damage' || !(Number.isFinite(e.amount) && e.amount > 0)) continue;
      if ((e.target_collection ?? e.entity_collection ?? 'creep') !== 'creep') continue;
      const from = e.source_collection === 'projectile' ? meter.shots.get(e.source_id) : e.source_collection === 'unit' || e.source_collection == null ? e.source_id : null;
      if (!Number.isInteger(from) || !state.units.has(from)) continue;
      bump(meter.dmg, from, e.amount);
      bump(hitAt, from, e.amount);
      if (e.content_id) bump(meter.skill, from, e.amount);
      meter.total += e.amount;
    }
    for (const e of msg.effects) {
      if (e?.kind !== 'ability_triggered' || typeof e.content_id !== 'string') continue;
      const parts = heals.get(e.content_id);
      const by = Number.isInteger(e.source_id) ? e.source_id : e.entity_id;
      const u = parts && state.units.get(by);
      if (!u) continue;
      for (const p of parts) {
        const amount = p.base + p.perWave * (meter.wave ?? 0) + p.mult * (hitAt.get(by) ?? 0) + p.pct * (u.maxHp ?? 0);
        if (amount > 0) bump(p.own ? meter.healSelf : meter.healAlly, by, amount);
      }
    }
    if (Number.isFinite(msg.tick) && msg.tick > meter.last) meter.last = msg.tick;
  }
  let pending = 0;
  function invalidate() {
    dirty = true;
    if (pending) return;
    pending = setTimeout(() => { pending = 0; render(); }, Math.max(0, 1000 - (performance.now() - lastRender)));
  }
  const onMessage = e => handle(e.data);
  const onClose = () => { socket?.removeEventListener('message', onMessage); socket = null; patch(); invalidate(); };

  let slowed = false;
  function slowTop() {
    if (slowed || realm.win === window) return;
    slowed = true;
    window.requestAnimationFrame = fn => setTimeout(() => fn(performance.now()), 1000);
    window.cancelAnimationFrame = id => clearTimeout(id);
    try {
      const canvas = document.getElementById('world');
      const gl = canvas?.getContext?.('webgl2') ?? canvas?.getContext?.('webgl');
      gl?.getExtension?.('WEBGL_lose_context')?.loseContext();
    } catch { }
    notice('Tool đã mở lại trận trong khung để móc hàm game (bấm bookmark khi đang trong trận). Bản game cũ phía sau được giảm còn 1 khung/giây cho đỡ nặng máy. Lần sau bấm bookmark ở sảnh trước khi vào trận thì không cần khung.');
  }
  function attach(ws) {
    if (socket || dead) return;
    socket = ws;
    acks.clear();
    ws.addEventListener('message', onMessage);
    ws.addEventListener('close', onClose);
    unpatch();
    slowTop();
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

  let toast = '', note = '', noteTimer = 0, shownToast = '', toastTimer = 0;
  const TOAST_MS = 8000;
  function notice(text) {
    note = text;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { note = ''; dirty = true; render(true); }, 15000);
    dirty = true; render(true);
  }
  const cycles = new Map();
  const picks = [];
  const cycle = (group, keys) => {
    picks.push(`${group}=${keys.join(',')}`);
    return () => {
      const i = ((cycles.get(group) ?? -1) + 1) % Math.max(1, keys.length);
      cycles.set(group, i);
      return keys[i];
    };
  };
  const FAIL = {
    game: 'Không thấy game — vào trận rồi thử lại.',
    entity: 'Không thấy con này trong game (có thể vừa bị bắt/biến mất).',
    fn: 'Bản game này không có hàm cho nút đó.',
    rule: 'Không hợp lệ (sai nhánh / sai slot / con đã đổi / chưa đủ vàng / đang trong đợt) — thử lại sau khi panel cập nhật.',
    data: 'Chưa tải xong dữ liệu của game — đợi 1–2 giây.',
    other: 'Đang xem căn cứ của người khác — về nhà mình để thao tác.',
    gold: 'Chưa đủ vàng.',
    locked: 'Game khoá lệnh trong đợt — chờ lúc chuẩn bị.',
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
    if (!realClick(e) || boosting) return;
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
      if (kind === 'catch' && key[0] === 'w') fail = catchWild(g, ent).fail ?? null;
      else if (kind === 'evolve' && key[0] === 'u' && typeof arg === 'string' && (gameCat.get(ent.contentId)?.e ?? []).some(([to]) => to === arg)) fail = evolveCreature(g, ent, arg).fail ?? null;
      else if (kind === 'trade' && key[0] === 'u' && Number.isInteger(arg) && state.offers.get(arg)?.give === ent.contentId && state.offers.get(arg)?.get === expect.get) fail = tradePet(g, ent, arg);
      else fail = 'rule';
    }
    toast = fail ? FAIL[fail] : '';
  }
  const act = (text, kind, key, arg, expect, cls = '', tip) => {
    const blocked = blockReason();
    sig.push(`${kind}:${key}:${arg ?? ''}`);
    return h('button', {
      class: `act do-${kind} ${cls}`, tabindex: '-1', disabled: !!blocked || !!boosting, title: blocked ? FAIL[blocked] : tip,
      onClick: e => runAction(e, kind, key, arg, expect),
    }, text);
  };

  const ROWS = [['TANK', '#7fd4ff', 'Hàng đầu: máu / giáp dày'], ['CẬN', '#ff8f8f', 'Hàng 2: đấu sĩ cận chiến / phép tầm ngắn'], ['XA', '#9fd6a8', 'Hàng 3: sát thương tay dài (tầm > 300)'], ['HỖ TRỢ', '#ffd36b', 'Hàng cuối: hồi máu / hào quang — đứng sau cùng cho an toàn']];
  const ACK_WAIT = 1500, PER_CLICK = 2, PAIR_GAP = 500;
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
    return { key, stage: u.stage, level: d?.l ?? 1, row, accept: acceptRows(d), score: row === 0 ? (d?.hp ?? 0) : (d?.ed ?? d?.dps ?? 0), active: u.active, pos: g ? posOf(findEntity(g, key)?.ent) : null };
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
    observe(mem, { phase, ready, units: ready ? snapUnits(g) : [] }, t);
  }
  let arranging = false;
  async function arrange(e) {
    e.stopPropagation();
    e.currentTarget.blur();
    if (!realClick(e) || arranging || boosting) return;
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
    if (fail || !plan.moves.length) { toast = fail ? FAIL[fail] : 'Đội đã đúng hàng — không cần dời con nào.'; dirty = true; render(true); return; }
    arranging = true;
    const done = [];
    let why = '';
    for (const m of plan.moves.slice(0, PER_CLICK)) {
      if (done.length) {
        await wait(Math.max(0, lastAction + PAIR_GAP - performance.now()));
        if (dead || state.summary?.phase !== 'planning' || recentCmds() >= RATE_MAX) break;
      }
      const found = findEntity(g, m.key);
      const stage = myUnits(state).find(u => `u${u.id}` === m.key)?.stage;
      if (!found || found.ent.contentId !== stage) { why = FAIL.entity; break; }
      lastAction = performance.now();
      onSent(mem, m.key, m.row, m, lastAction);
      dirty = true; render(true);
      const r = moveCreature(g, found.ent, m);
      const ack = r.fail ? null : await waitAck(r.seq);
      onAck(mem, m.key, !!ack?.ok);
      if (!ack?.ok) { why = r.fail ? FAIL[r.fail] : !ack ? 'Game chưa xác nhận lệnh.' : `Game từ chối: ${ack.reason.replace(/_/g, ' ') || 'không rõ'}.`; break; }
      done.push(`${nameOf(stage)} ${m.from} → ${m.to} (${ROWS[m.row][0]})`);
    }
    arranging = false;
    const left = plan.moves.length - done.length;
    toast = [done.length ? `Đã dời ${done.join(', ')}.` : '', why, done.length && !why ? (left > 0 ? `Còn ${left} con lệch — bấm tiếp.` : 'Đội đã đúng hàng.') : ''].filter(Boolean).join(' ');
    dirty = true; render(true);
  }
  let boosting = null;
  const until = async (test, ms) => {
    for (let t = 0; t < ms && !dead; t += 50) { if (test()) return true; await wait(50); }
    return !dead && !!test();
  };
  const paced = async () => {
    for (let n = 0; n < 200 && !dead; n++) { const hold = rateWait(); if (hold <= 0) return true; await wait(Math.min(hold, 400)); }
    return false;
  };
  const refused = ack => (!ack ? 'Game chưa xác nhận lệnh.' : `Game từ chối: ${ack.reason.replace(/_/g, ' ') || 'không rõ'}.`);
  async function catchFirst(g, key, stage) {
    const ent = findEntity(g, key)?.ent;
    if (!ent || ent.contentId !== stage) return { why: FAIL.entity };
    const before = new Set(myUnits(state).map(x => x.id)), wid = Number(key.slice(1));
    lastAction = performance.now();
    const r = catchWild(g, ent);
    if (r.fail || !Number.isInteger(r.seq)) return { why: FAIL[r.fail ?? 'rule'] };
    const ack = await waitAck(r.seq);
    if (!ack?.ok) return { why: refused(ack) };
    let got = null;
    const fresh = () => (got = myUnits(state).find(x => !before.has(x.id) && x.stage === stage) ?? null);
    await until(() => fresh() || !state.wilds.has(wid), 4000);
    if (!got) await until(fresh, 1000);
    return got ? { key: `u${got.id}` } : { why: 'Bắt trượt — pet chạy mất, game không trừ vàng.' };
  }
  async function boost(e, kind, key, stage) {
    e.stopPropagation();
    e.currentTarget.blur();
    if (!realClick(e) || boosting || arranging || !wished(stage)) return;
    let fail = blockReason();
    const g = fail ? null : findGame();
    if (!fail && !g) fail = 'game';
    if (!fail && state.summary?.phase !== 'planning') fail = 'locked';
    const price = kind === 'catch' ? (U(stage)?.b ?? 0) : 0;
    const plan = fail ? null : maxPlan(stage, state.gold - price);
    if (!fail && (!plan?.steps.length || state.gold < price)) fail = 'gold';
    if (fail) { toast = FAIL[fail]; dirty = true; render(true); return; }
    boosting = { key, stage, done: 0, total: plan.steps.length + (kind === 'catch' ? 1 : 0) };
    dirty = true; render(true);
    let cur = stage, spent = 0, why = '';
    try {
      if (kind === 'catch') {
        if (!(await paced())) return;
        const got = await catchFirst(g, key, stage);
        if (got.why) { why = got.why; return; }
        boosting.key = got.key; boosting.done++; spent += price;
        dirty = true; render(true);
      }
      for (const [to, cost] of plan.steps) {
        if (!(await paced())) return;
        if (state.summary?.phase !== 'planning') { why = FAIL.locked; break; }
        if (!wished(cur)) { why = 'Đã bỏ ★ — dừng.'; break; }
        if (cost > state.gold) { why = 'Hết vàng — dừng.'; break; }
        const ent = findEntity(g, boosting.key)?.ent;
        if (!ent || ent.contentId !== cur) { why = FAIL.entity; break; }
        if (!(gameCat.get(cur)?.e ?? []).some(([next]) => next === to)) { why = FAIL.rule; break; }
        lastAction = performance.now();
        const r = evolveCreature(g, ent, to);
        if (r.fail || !Number.isInteger(r.seq)) { why = FAIL[r.fail ?? 'rule']; break; }
        const ack = await waitAck(r.seq);
        if (!ack?.ok) { why = refused(ack); break; }
        await until(() => findEntity(g, boosting.key)?.ent?.contentId === to, 2000);
        cur = to; spent += cost; boosting.stage = to; boosting.done++;
        dirty = true; render(true);
      }
    } finally {
      boosting = null;
      if (!dead) {
        const done = cur !== stage ? `⇑ ${nameOf(stage)} → ${nameOf(cur)} · ${fmt(spent)} vàng.` : spent ? `Đã bắt ${nameOf(stage)}.` : '';
        toast = [done, why].filter(Boolean).join(' ');
        dirty = true; render(true);
      }
    }
  }
  function teamBar(mine, plan, blocked) {
    const next = plan?.moves[0];
    const held = plan ? [...plan.status.values()].filter(v => v === 'new').length : 0;
    const lost = plan ? [...plan.status.values()].filter(v => v === 'unknown').length : 0;
    const nextStage = next ? mine.find(u => `u${u.id}` === next.key)?.stage : null;
    return h('div', { class: 'bar-row' },
      h('button', {
        class: `chip sm ${next ? 'on' : ''}`, tabindex: '-1', disabled: arranging || !!boosting || !!blocked || !mine.some(u => u.active) || (plan && !next),
        text: arranging ? 'Đang dời…' : next ? `Xếp đội ↕${plan.moves.length}` : lost ? 'Xếp đội ?' : plan ? '✓ Đúng hàng' : 'Xếp đội',
        title: blocked ? FAIL[blocked] : !next && lost ? `Chưa đọc được vị trí ${lost} con trong game — đợi 1–2 giây rồi xem lại.` : next ? `Bấm để dời ${nameOf(nextStage)} ${next.from} → ${next.to} (hàng ${ROWS[next.row][0]})${plan.moves.length > 1 ? ' và 1 con nữa' : ''}. Mỗi lần bấm dời tối đa ${PER_CLICK} con (ô có dấu ↕); con đứng đúng hàng không bị đụng tới, con đứng chồng lên con khác thì được tách ra.\nÔ theo lưới hiện trên sân lúc chuẩn bị: cột A–G từ trái sang, hàng 1–8 từ phía quái vào.`
          : 'Hàng từ phía quái vào: TANK → CẬN → XA → HỖ TRỢ sau cùng. Ô theo lưới hiện trên sân lúc chuẩn bị: cột A–G từ trái sang, hàng 1–8 từ phía quái vào.',
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
  const wish = new Set();
  const famOf = stage => { const f = U(stage)?.f; return typeof f === 'string' && SAFE_ID.test(f) ? f : stage; };
  const wished = stage => wish.has(famOf(stage));
  const byWish = (a, b) => Number(wished(b.stage)) - Number(wished(a.stage));
  let info = null;
  const isOpen = (stage, ids) => !!info && (ids && info.id != null ? ids.includes(info.id) : info.id == null && info.stage === stage);
  const starBtn = stage => {
    const on = wished(stage);
    return h('button', { class: `star ${on ? 'on' : ''}`, text: on ? '★' : '☆', tabindex: '-1',
      title: on ? 'Bỏ khỏi wishlist' : 'Thêm vào wishlist: dòng này nằm đầu tab Wild, Đội, Trade và có nút ⇑ nâng max; ra ở bãi hay có kèo trade thì tab hiện ★',
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
        : `Đỉnh dòng: ${nameOf(peakId)} · hạng ${ROLE_NAME[u.lr ?? u.ro] ?? ''} ${powerTier(u.pw)} · ${fmt(Math.round(eff))} DPS thật · cần ${fmt(cost)} vàng tiến hóa`);
    }
    for (const [r, to, c] of u.ul ?? []) lines.push(`Lên ${nameOf(to)} (${fmt(c)} vàng) mở ${db.rn?.[r] ?? r}`);
    return h('span', { class: `tier ${TIER_CLASS[u.st]}${small ? ' sm' : ''}`, text: u.st, title: lines.join('\n') });
  };


  const ROLE_COLOR = { atk: '#ff8f8f', tank: '#7fd4ff', buff: '#ffd36b', debuff: '#b89cff' };
  const roleColor = stage => ROLE_COLOR[U(stage)?.ro ?? kitOf(stage)[0]] ?? '#33496b';
  const harm = stage => (U(stage)?.sd ? h('b', { class: 'harm', text: '⚠', title: `Tự hại (issue #1): mất ${fmt(Math.round(U(stage).sd))} máu/giây` }) : null);
  const pic = (stage, tip, ...extra) => h('div', { class: 'pic', style: `--el:${tint(U(stage)?.el)}`, title: tip }, img(stage, 50), ...extra);
  const lvTag = stage => (U(stage)?.l ? h('span', { class: 'lv', text: `Lv${U(stage).l}` }) : null);
  const widePic = (stage, tip, lines, ...extra) => h('div', { class: 'pic wide', style: `--el:${tint(U(stage)?.el)}`, title: tip }, img(stage, 50), h('div', { class: 'wi' }, lines), ...extra);
  function maxPlan(stage, budget) {
    const path = U(stage)?.pg;
    if (!Array.isArray(path) || path.length < 2 || path[0] !== stage) return null;
    const steps = [];
    let spent = 0, need = 0;
    for (let i = 1; i < path.length && steps.length < 12; i++) {
      const cost = (U(path[i - 1])?.e ?? []).find(([to]) => to === path[i])?.[1];
      if (!Number.isFinite(cost) || cost < 0) break;
      if (spent + cost > budget) { need = cost; break; }
      spent += cost;
      steps.push([path[i], cost]);
    }
    return { steps, spent, need, peak: path.at(-1) };
  }
  const goLine = plan => {
    const last = plan?.steps.at(-1)?.[0];
    if (last) return `⇑ ${U(last)?.n ?? nameOf(last)}${last === plan.peak ? ' (đỉnh)' : ''}`;
    return plan?.need ? `Cần ${short(plan.need)} vàng` : 'Đã là dạng mạnh nhất';
  };
  function boostBtn(kind, key, stage, plan, price, running) {
    sig.push(`up:${key}:${plan.steps.length}`);
    if (running) return h('button', { class: 'act up run', tabindex: '-1', disabled: true, text: `⇑ ${boosting.done}/${boosting.total}`, title: 'Đang nâng — chờ game xác nhận từng bước' });
    const last = plan.steps.at(-1)?.[0];
    if (!last || state.gold < price) {
      return h('button', { class: 'act up off', tabindex: '-1', disabled: true, text: `⇑ ${levelOf(plan.peak)}`,
        title: `Chưa đủ vàng: cần ${fmt(state.gold < price ? price : plan.need)} vàng cho ${state.gold < price ? 'lệnh bắt' : 'bước đầu'}` });
    }
    const blocked = blockReason();
    const total = price + plan.spent;
    return h('button', {
      class: 'act up', tabindex: '-1', disabled: !!blocked || !!boosting || arranging, text: `⇑ ${levelOf(last)} · ${short(total)}`,
      title: blocked ? FAIL[blocked] : `${kind === 'catch' ? 'Bắt rồi nâng' : 'Nâng'} ${nameOf(stage)} → ${nameOf(last)}: ${kind === 'catch' ? '1 lệnh bắt + ' : ''}${plan.steps.length} lệnh nâng · ${fmt(total)} vàng`
        + `${last === plan.peak ? '' : `\nĐỉnh dòng là ${nameOf(plan.peak)} — thiếu vàng cho phần còn lại`}`
        + `\n1 cú bấm gửi nhiều lệnh: mỗi lệnh cách 0,8 giây, chờ game xác nhận từng bước, lỗi là dừng${kind === 'catch' ? '; bắt trượt thì dừng (game không trừ vàng)' : ''}.`,
      onClick: e => boost(e, kind, key, stage),
    });
  }

  function viewTrade() {
    const list = tradeOptions(state, db);
    if (!list.length) return empty('Chưa có trade offer (trade tắt hoặc đang chờ dữ liệu).');
    const side = (id, slot, star) => openable(pic(id, statsTip(id), h('span', { class: 'tl' }, tierPill(id)), lvTag(id), star ? starBtn(id) : null), `t${slot}`, id);
    return h('div', { class: 'tgrid' }, [...list].sort((a, b) => Number(wished(b.get)) - Number(wished(a.get))).map(o => {
      const status = o.ready.length ? act('⇄ Trade', 'trade', `u${o.ready[0].id}`, o.slot, { stage: o.give, get: o.get }, 'ok',
        `Đổi ${nameOf(o.give)} lấy ${nameOf(o.get)}${o.ready.length > 1 ? ` · có ${o.ready.length} con` : ''}`)
        : o.evolve ? h('span', { class: `b ${state.gold >= o.evolve.cost ? 'warn' : 'bad'}`, text: `cần ${levelOf(o.give)}`,
          title: `Nâng ${nameOf(o.evolve.unit.stage)} → ${o.evolve.steps.map(nameOf).join(' → ')}: ${fmt(o.evolve.cost)} vàng` })
        : h('span', { class: 'b max', text: '—', title: 'Chưa có con nào thuộc dòng này' });
      return h('div', { class: `tcard${o.ready.length ? ' is-ok' : o.evolve ? ' is-warn' : ''}${wished(o.get) ? ' wish' : ''}` },
        h('div', { class: 'th', text: `S${o.slot}` }),
        h('div', { class: 'pair' }, side(o.give, o.slot), h('span', { class: 'ar', text: '→' }), side(o.get, o.slot, true)),
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
    wilds.sort((a, b) => byWish(a, b) || powerOf(b.stage) - powerOf(a.stage) || (a.u.b ?? 0) - (b.u.b ?? 0));
    const tile = ({ stage, idList, count, u, peak, trades }) => {
      const price = u.b ?? 0, key = `w${idList[0]}`, wide = wished(stage);
      const tip = `Bắt ${Math.round((u.c ?? 0) * 100)}% · đỉnh ${short(peak)} DPS thật\n${statsTip(stage)}${count > 1 ? `\n${count} con — bấm tiếp để chọn con khác` : ''}`;
      const buttons = [act(`${short(price)}g`, 'catch', key, null, { stage }, price <= state.gold ? 'ok' : 'bad', `Bắt 1 con ${nameOf(stage)}: ${fmt(price)} vàng`)];
      const up = wide ? maxPlan(stage, state.gold - price) : null;
      if (up) buttons.push(boostBtn('catch', key, stage, up, price, boosting?.key === key));
      const cnt = count > 1 ? h('span', { class: 'cnt', text: `×${count}` }) : null;
      const name = h('div', { class: 'tn', title: trades.length ? trades.map(t => `S${t.slot}: cần ${nameOf(t.give)} → nhận ${nameOf(t.get)}`).join('\n') : null },
        trades.length ? h('b', { class: 'trf', text: '⇄' }) : null, u.n ?? stage);
      const rate = `${Math.round((u.c ?? 0) * 100)}%`;
      const face = wide
        ? widePic(stage, tip, [name, h('small', null, `${levelOf(stage)} · bắt `, h('b', { class: (u.c ?? 1) < 0.5 ? 'rare' : null, text: rate })), h('small', { class: 'go', text: goLine(up) })],
          h('span', { class: 'tl' }, tierPill(stage), harm(stage)), starBtn(stage), cnt)
        : pic(stage, tip, h('span', { class: 'tl' }, tierPill(stage), harm(stage)), starBtn(stage),
          (u.c ?? 1) < 0.5 ? h('span', { class: 'lv rare', text: rate, title: 'Tỉ lệ bắt thấp' }) : null, cnt);
      return openable(h('div', { class: `tile${wide ? ' wish wide' : ''}${isOpen(stage) ? ' sel' : ''}`, style: `--ro:${roleColor(stage)}` },
        face, strip(stage), wide ? null : name, h('div', { class: 'acts' }, buttons)),
      cycle(`w:${stage}`, idList.map(id => `w${id}`)), stage);
    };
    return [
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
    const ready = alive.length ? (wanted.get(stage) ?? []) : [];
    const needs = offersForFamily(state, db, stage);
    const going = plan?.moves.filter(m => list.some(x => `u${x.id}` === m.key)) ?? [];
    const cells = list.map(x => plan?.cells.get(`u${x.id}`)).filter(Boolean);
    const wide = wished(stage), up = wide && alive.length ? maxPlan(stage, state.gold) : null;
    const buttons = [
      ...evo.map(([to, cost]) => {
        const trap = u.tp?.[to];
        const drop = `${fmt(u.ed ?? u.dps)} → ${fmt(U(to)?.ed ?? U(to)?.dps)} DPS thật${U(to)?.sd && U(to)?.hp ? ` nhưng tự hại, chết sau ~${Math.round(U(to).hp / U(to).sd)}s` : ''}`;
        const warn = trap === 2 ? `\n⚠ BẪY: ${drop}, lên tiếp cũng không hồi lại — nên dừng ở đây` : trap === 1 ? `\n⚠ Tạm tụt: ${drop}, các cấp sau mới mạnh hơn` : '';
        return act([evo.length > 1 ? img(to, 13) : '↑', short(cost), trap ? '⚠' : ''], 'evolve', `u${lead.id}`, to, { stage },
          trap === 2 || cost > state.gold ? 'bad' : 'ok', `Tiến hóa ${list.length > 1 ? '1 con ' : ''}lên ${nameOf(to)}: ${fmt(cost)} vàng${warn}`);
      }),
    ];
    if (ready.length) buttons.unshift(h('span', { class: 'b tr', text: 'TRADE', title: `${ready.map(o => `S${o.slot}: đổi lấy ${nameOf(o.get)}`).join('\n')}\nBấm Trade ở tab Trade` }));
    else if (!evo.length) buttons.push(h('span', { class: 'b max', text: 'MAX', title: 'Dạng cuối' }));
    if (up) buttons.push(boostBtn('evolve', `u${lead.id}`, stage, up, 0, !!boosting && list.some(x => `u${x.id}` === boosting.key)));
    const hp = h('div', { class: 'hps' }, list.map(x => {
      const pct = x.maxHp ? Math.max(0, Math.min(100, Math.round((x.hp / x.maxHp) * 10) * 10)) : 100;
      return h('i', { class: !x.active ? 'down' : pct < 35 ? 'low' : pct < 70 ? 'mid' : null, style: x.active ? `--p:${pct}%` : null });
    }));
    const down = list.length - alive.length;
    const tip = `${statsTip(stage)}${cells.length ? `\nĐứng ô ${cells.join(' · ')}` : ''}${down ? `\n${down} con gục — trở lại đợt sau` : ''}${list.length > 1 ? `\n${list.length} con — bấm tiếp để chọn con khác` : ''}`;
    const mark = h('span', { class: 'tl' }, tierPill(stage), harm(stage), going.length ? h('b', { class: 'mv', text: '↕', title: `Xếp đội sẽ dời ${going.map(m => `${m.from} → ${m.to}`).join(', ')}` }) : null);
    const cnt = list.length > 1 ? h('span', { class: 'cnt', text: `×${list.length}` }) : null;
    const name = h('div', { class: 'tn', title: needs.length ? needs.map(o => `S${o.slot}: cần ${nameOf(o.give)} → nhận ${nameOf(o.get)}`).join('\n') : null },
      needs.length ? h('b', { class: 'trf', text: '⇄' }) : null, u.n ?? stage);
    const face = wide
      ? widePic(stage, tip, [name, h('small', { text: u.pg ? `${levelOf(stage)} · đỉnh ${levelOf(u.pg.at(-1))}` : `${levelOf(stage)} · dạng mạnh nhất` }),
        h('small', { class: 'go', text: alive.length ? goLine(up) : 'Gục — đợt sau mới nâng' })], mark, starBtn(stage), cnt, hp)
      : pic(stage, tip, mark, starBtn(stage), lvTag(stage), cnt, hp);
    return openable(h('div', { class: `tile${wide ? ' wish wide' : ''}${alive.length ? '' : ' down'}${isOpen(stage, ids) ? ' sel' : ''}`, style: `--ro:${roleColor(stage)}` },
      face, strip(stage), wide ? null : name,
      h('div', { class: `acts${buttons.length > 1 && !wide ? ' split' : ''}` }, buttons)),
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
    const have = new Set(myUnits(state).filter(x => x.active).map(x => x.stage));
    const offers = [...state.offers.values()].filter(o => famOf(o.give) === famOf(stage)).sort((a, b) => a.slot - b.slot);
    const offerNode = o => {
      const on = have.has(o.give), d = U(o.get) ?? {};
      return h('div', { class: `node ${on ? 'ready' : 'off'}`, title: `S${o.slot}: đưa ${nameOf(o.give)} → nhận ${nameOf(o.get)}\n${on ? 'Có sẵn — bấm Trade ở tab Trade' : `Chưa có ${nameOf(o.give)}`}` },
        img(o.get, 34), d.st ? h('span', { class: `tier ${TIER_CLASS[d.st]}`, text: d.st }) : null, h('small', { class: on ? 'gold' : '', text: on ? `S${o.slot}` : levelOf(o.give) }));
    };
    const seen = new Set(), skills = [];
    for (const list of paths) for (const [id] of list) for (const sk of U(id)?.sk ?? []) {
      const a = db.ab?.[sk];
      if (!a || seen.has(a.n)) continue;
      seen.add(a.n);
      skills.push([sk, id]);
    }
    const where = id => `${nameOf(id)}${U(id)?.l ? ` Lv${U(id).l}` : ''}`;
    const tier = u.st;
    const dp = Array.isArray(u.dp) ? u.dp : [];
    const parts = [['đòn thường', dp[0]], ['chí mạng / proc', dp[1]], ['kỹ năng', dp[2]], ['độc', dp[3]], [`lan (giả định ${AOE_TARGETS} quái đứng gần)`, dp[4]]].filter(([, v]) => v > 0);
    return [
      h('div', { class: 'dh' }, img(stage, 64),
        h('div', null,
          h('div', { class: 'nm' }, h('i', { class: 'dot', style: `background:${rgbOf(u.el)}` }), h('b', { text: u.n ?? '?' }), u.l ? h('small', { text: ` Lv${u.l}` }) : null),
          h('div', { class: 'dl' },
            tier ? h('span', { class: `tier ${TIER_CLASS[tier]}`, text: tier, title: `Hạng ${ROLE_NAME[u.ro] ?? ''} của dạng này — so với các con cùng vai trò, cùng tầm cấp` }) : null,
            u.ro ? h('span', { class: `k-${u.ro} role`, text: ROLE_NAME[u.ro] }) : null,
            u.sd ? h('span', { class: 'harm', text: '⚠', title: `Tự hại (issue #1): mất ${fmt(Math.round(u.sd))} máu/giây` }) : null))),
      h('div', { class: 'stats' },
        h('span', { text: `❤ ${short(u.hp ?? 0)}`, title: 'Máu' }), h('span', { text: `⚔ ${short(Math.round(u.ed ?? u.dps ?? 0))}`, title: `DPS (chưa tính buff đồng đội): ${parts.map(([k, v]) => `${k} ${fmt(Math.round(v))}`).join(' · ') || '—'}` }),
        h('span', { text: `↔ ${u.rg ?? '?'}`, title: 'Tầm đánh' }), h('span', { text: `⛨ ${u.ar ?? 0}`, title: 'Giáp' })),
      paths.length && paths[0].length > 1 ? h('div', { class: 'evo' }, paths.map(list => h('div', { class: 'path' }, list.map((x, i) => [i ? h('span', { class: 'ar', text: '›' }) : null, node(x, i, list)])))) : null,
      offers.length ? h('div', { class: 'evo' }, h('div', { class: 'path tr', title: 'Trade được ra: sáng = có sẵn con để đổi, xám = chưa' }, h('span', { class: 'ar', text: '⇄' }), offers.map(offerNode))) : null,
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

  let combatSort = 'dps';
  const G = { dps: '⚔︎', tank: '⛨', ally: '✚', self: '♥︎' };
  const SORTS = [['dps', `${G.dps} DPS`], ['tank', `${G.tank} Gánh`], ['heal', `${G.ally} Hồi`]];
  function viewCombat() {
    const mine = myUnits(state);
    if (!mine.length) return empty('Chưa có lính (hoặc đang chờ dữ liệu).');
    const secs = meterSecs();
    const scale = tps / TICKS_PER_SECOND;
    const rows = mine.map(u => {
      const dmg = meter.dmg.get(u.id) ?? 0;
      return { u, dmg, calc: (U(u.stage)?.ed ?? U(u.stage)?.dps ?? 0) * scale, real: secs ? dmg / secs : null, skill: meter.skill.get(u.id) ?? 0,
        taken: meter.taken.get(u.id) ?? 0, hs: meter.healSelf.get(u.id) ?? 0, ha: meter.healAlly.get(u.id) ?? 0 };
    });
    const metric = { dps: r => r.real ?? r.calc, tank: r => r.taken, heal: r => r.ha + r.hs }[combatSort];
    rows.sort((a, b) => metric(b) - metric(a) || b.calc - a.calc || a.u.id - b.u.id);
    const most = Math.max(1, ...rows.map(metric));
    const sum = key => rows.reduce((n, r) => n + (r[key] ?? 0), 0);
    const head = meter.wave == null ? 'Chưa đo — đợt tới bắt đầu đo' : `Đợt ${meter.wave} · ${Math.round(secs)}s${meter.done ? '' : ' · đang đo'}`;
    const stat = (g, cls, text) => h('span', { class: 'st' }, h('b', { class: `g ${cls}`, text: g }), text);
    const line = r => h('div', { class: 'dst' },
      stat(G.dps, 'g-dps', r.real != null ? `${short(r.real)}/s` : '—'),
      r.taken ? stat(G.tank, 'g-tank', short(r.taken)) : null,
      r.ha ? stat(G.ally, 'g-ally', short(r.ha)) : null,
      r.hs ? stat(G.self, 'g-self', short(r.hs)) : null);
    const big = r => (combatSort === 'dps' ? [r.real != null ? short(r.real) : '—', `≈${short(r.calc)}/s`]
      : combatSort === 'tank' ? [short(r.taken), secs ? `${short(r.taken / secs)}/s` : '']
      : [short(r.ha + r.hs), secs ? `${short((r.ha + r.hs) / secs)}/s` : '']);
    return [
      h('div', { class: 'bar-row dsum', title: `Đo từ sự kiện trận của server trong đợt này:\n${G.dps} DPS = sát thương lên quái / giây (không tính đòn dội vào chính pet)\n${G.tank} Gánh = sát thương nhận vào từ quái\n${G.ally} Hồi đồng đội · ${G.self} Tự hồi = theo kỹ năng hồi máu mỗi lần kích hoạt (ước tính, hồi vùng tính 1 lần)` },
        h('b', { text: head }), h('span', { class: 'grow' }),
        stat(G.dps, 'g-dps', secs ? `${short(meter.total / secs)}/s` : '—'), stat(G.tank, 'g-tank', short(sum('taken'))), stat(G.ally, 'g-ally', short(sum('ha'))), stat(G.self, 'g-self', short(sum('hs')))),
      h('div', { class: 'bar-row' }, SORTS.map(([key, text]) => h('button', { class: `chip sm ${combatSort === key ? 'on' : ''}`, tabindex: '-1', text,
        onClick: () => { combatSort = key; dirty = true; render(true); } }))),
      rows.map(r => {
        const d = U(r.u.stage) ?? {}, [v, sub] = big(r);
        return h('div', { class: `drow${r.u.active ? '' : ' down'}`, title: `${nameOf(r.u.stage)}\nSát thương đợt này: ${fmt(Math.round(r.dmg))}${r.dmg ? ` (đòn thường ${fmt(Math.round(r.dmg - r.skill))} · kỹ năng ${fmt(Math.round(r.skill))})` : ''}\nGánh: ${fmt(Math.round(r.taken))} · hồi đồng đội ${fmt(Math.round(r.ha))} · tự hồi ${fmt(Math.round(r.hs))}\nDPS theo công thức: ${fmt(Math.round(r.calc))}/s` },
          img(r.u.stage, 28),
          h('div', { class: 'dmid' },
            h('div', { class: 'dnm' }, h('b', { text: d.n ?? r.u.stage }), d.l ? h('small', { text: ` Lv${d.l}` }) : null, tierPill(r.u.stage, true), d.ro ? h('span', { class: `k-${d.ro} role`, text: ROLE_NAME[d.ro] }) : null),
            line(r),
            h('div', { class: 'dbar' }, h('i', { class: `real ${combatSort}`, style: `width:${Math.max(0, Math.min(100, Math.round((metric(r) / most) * 100)))}%` }))),
          h('div', { class: 'dval' }, h('b', { text: v }), sub ? h('small', { text: sub }) : null));
      }),
    ];
  }

  let fpsCap = 0, rafSaved = {};
  const SIZES = [['Nhỏ', 1], ['Vừa', 1.25], ['Lớn', 1.45]];
  let uiScale = 1.25;
  function applyScale() { wrap.style.zoom = String(uiScale); wrap.style.setProperty('--z', String(uiScale)); }
  function setCap(fps) {
    if (rafSaved.win && rafSaved.win !== realm.win) { capFrames(rafSaved.win, 0, rafSaved); rafSaved = {}; }
    fpsCap = fps;
    capFrames(realm.win, fps, rafSaved);
  }
  function liteClick(e, on) {
    if (!realClick(e)) return;
    if (!writeLite(realm.win, on)) { toast = 'Trình duyệt chặn ghi cài đặt của game.'; dirty = true; render(true); return; }
    notice(on ? 'Đã lưu đồ hoạ nhẹ vào cài đặt của game — nhấn F5 để áp dụng (trận tự vào lại), rồi bấm lại bookmark.' : 'Đã trả đồ hoạ về mặc định — nhấn F5 để áp dụng.');
  }
  const QUALITY = { auto: 'Tự động', low: 'Thấp', medium: 'Vừa', high: 'Cao' };
  function viewLite() {
    const cur = readLite(realm.win);
    return [
      h('div', { class: 'sect', style: '--c:#8fb7e8' }, h('i'), 'CỠ TOOL', h('span', { class: 'n', text: 'áp dụng ngay' })),
      h('div', { class: 'bar-row' }, SIZES.map(([t, z]) => h('button', {
        class: `chip sm ${uiScale === z ? 'on' : ''}`, tabindex: '-1', text: t,
        onClick: () => { uiScale = z; applyScale(); dirty = true; render(true); },
      }))),
      h('div', { class: 'sect', style: '--c:#9fd6a8' }, h('i'), 'KHUNG HÌNH', h('span', { class: 'n', text: 'áp dụng ngay' })),
      h('div', { class: 'bar-row' }, FPS_CAPS.map(fps => h('button', {
        class: `chip sm ${fpsCap === fps ? 'on' : ''}`, tabindex: '-1', text: fps ? `${fps} FPS` : 'Không giới hạn',
        onClick: e => { if (!realClick(e)) return; setCap(fps); dirty = true; render(true); },
      }))),
      h('p', { class: 'hint', text: 'Giới hạn số khung hình game vẽ mỗi giây. 20–30 vẫn đủ mượt cho game thủ thành; càng thấp máy càng mát. Tắt tool là bỏ giới hạn.' }),
      h('div', { class: 'sect', style: '--c:#ffde8f' }, h('i'), 'ĐỒ HOẠ CỦA GAME', h('span', { class: 'n', text: 'nhấn F5 để áp dụng' })),
      cur ? h('p', { class: 'hint now' }, h('b', { text: 'Đang dùng: ' }),
        `${QUALITY[cur.quality] ?? cur.quality} · ${cur.fps} FPS · VFX ${cur.vfx ? 'tối ưu' : 'đủ'} · trang trí ${cur.greenery ? 'bật' : 'tắt'} · quầng sáng ${cur.bloom ? 'bật' : 'tắt'}`)
        : empty('Trình duyệt chặn đọc cài đặt của game.'),
      h('div', { class: 'bar-row' },
        h('button', { class: 'chip sm on', tabindex: '-1', text: 'Bật đồ hoạ nhẹ', onClick: e => liteClick(e, true) }),
        h('button', { class: 'chip sm', tabindex: '-1', text: 'Khôi phục', onClick: e => liteClick(e, false) })),
      h('p', { class: 'hint', text: 'Nhẹ = chất lượng Thấp (vẽ 0,75× độ phân giải, tắt bóng và khử răng cưa) · 30 FPS · tối ưu VFX · tắt trang trí sân · tắt quầng sáng. Ghi vào đúng cài đặt của game (như chỉnh trong menu Đồ họa), game tự nhớ cho các lần sau.' }),
    ];
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

  const host = h('div', { style: 'position:fixed;top:12px;left:12px;z-index:2147483646;' });
  const root = host.attachShadow({ mode: 'closed' });
  root.append(h('style', { text: CSS }));
  const panel = h('div', { class: 'panel' });
  const drawer = h('div', { class: 'drawer' });
  drawer.hidden = true;
  const wrap = h('div', { class: 'wrap' }, panel, drawer);
  applyScale();
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
  const TABS = [['trade', 'Trade'], ['wild', 'Wild'], ['team', 'Đội'], ['combat', 'Chiến'], ['wave', 'Đợt'], ['players', 'Phòng'], ['lite', '⚙︎']];

  let bodyEl = null, lastBind = '';
  function render(force = false) {
    if (dead || !dirty || panel.hidden) return;
    if (!force && performance.now() - lastRender < 1000) { invalidate(); return; }
    lastRender = performance.now();
    dirty = false;
    const scroll = bodyEl?.scrollTop ?? 0;
    sig.length = 0;
    picks.length = 0;
    if (toast !== shownToast) {
      shownToast = toast;
      clearTimeout(toastTimer);
      if (toast) toastTimer = setTimeout(() => { toast = ''; dirty = true; render(true); }, TOAST_MS);
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
      state.haveKeyframe ? h('span', { class: 'gold', text: `${fmt(state.gold)}g`, title: 'Vàng hiện có' }) : null,
      h('button', { class: 'x', text: '–', title: 'Thu nhỏ', onClick: () => toggle() }),
      h('button', { class: 'x', text: '×', title: 'Tắt tool', onClick: () => destroy() }));
    header.addEventListener('pointerdown', e => {
      if (e.target.tagName === 'BUTTON') return;
      const r = host.getBoundingClientRect();
      drag = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    });
    const starred = { trade: [...state.offers.values()].filter(o => wished(o.get)).length, wild: [...state.wilds.values()].filter(x => wished(x.stage)).length };
    const tabs = h('div', { class: 'tabs' }, TABS.map(([k, t]) => h('button', { class: `tab ${tab === k ? 'on' : ''}`, onClick: () => { tab = k; dirty = true; render(true); if (bodyEl) bodyEl.scrollTop = 0; } },
      t, starred[k] ? h('span', { class: 'ws', text: '★', title: `${k === 'wild' ? 'Pet ★ đang ở bãi' : 'Kèo trade ra pet ★'}: ${starred[k]}` }) : null)));
    let content;
    try {
      content = status && tab !== 'lite' ? empty(status) : ({
        trade: viewTrade, wild: viewWild, team: viewTeam, combat: viewCombat, wave: viewWave, players: viewPlayers, lite: viewLite,
      })[tab]();
    } catch (err) {
      content = h('p', { class: 'empty bad', text: `Lỗi hiển thị: ${err?.message ?? err}` });
    }
    const msgs = toast || note ? h('div', { class: 'msgs' }, toast ? h('p', { class: 'toast', text: toast }) : null, note ? h('p', { class: 'toast info', text: note }) : null) : null;
    const body = h('div', { class: 'body' }, content, msgs);
    const shape = `${tab}|${wildRole}|${teamFilter}|${status ?? ''}|${sig.join(',')}`;
    if (shape !== lastLayout) { lastLayout = shape; layoutAt = performance.now(); }
    const bind = `${shape}|${picks.join(';')}`;
    const [oldHead, oldTabs, oldBody] = [0, 1, 2].map(i => panel.children.item(i));
    if (!oldHead || !oldTabs || !oldBody) { panel.replaceChildren(header, tabs, body); bodyEl = body; }
    else {
      if (!oldHead.isEqualNode(header)) oldHead.replaceWith(header);
      if (!oldTabs.isEqualNode(tabs)) oldTabs.replaceWith(tabs);
      if (bind !== lastBind || !oldBody.isEqualNode(body)) { oldBody.replaceWith(body); bodyEl = body; body.scrollTop = scroll; }
    }
    lastBind = bind;
    let infoView = [];
    try { infoView = info ? viewInfo() : []; } catch { infoView = []; }
    drawer.hidden = panel.hidden || !infoView.length;
    const kids = drawer.children;
    if (infoView.length !== kids.length || infoView.some((n, i) => !n.isEqualNode(kids.item(i)))) drawer.replaceChildren(...infoView);
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
    if (fpsCap) setCap(fpsCap);
    forgetWebCapture();
    armWebCapture(win);
    patch();
    listen(win);
    dirty = true; render(true);
  }
  let autoTimer = 0;
  function autoHook() {
    if (autoTimer || !isWeb() || realm.win !== window) return;
    autoTimer = setTimeout(() => { if (!webTouched() && !frame) notice('Đang xem được mọi số liệu. Muốn dùng nút Bắt / Tiến hóa / Trade / Xếp đội thì bấm Móc: tool mở lại trận trong khung (thêm 1 bản game, tốn RAM). Lần sau bấm bookmark ở sảnh trước khi vào trận thì không cần khung.'); }, 2500);
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
      if (++tries < 4000) setTimeout(arm, 0);
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
    quiet(() => { if (rafSaved.win) capFrames(rafSaved.win, 0, rafSaved); });
    quiet(unpatch);
    socket?.removeEventListener('message', onMessage);
    socket?.removeEventListener('close', onClose);
    clearTimeout(pending);
    clearTimeout(autoTimer);
    clearTimeout(noteTimer);
    clearTimeout(toastTimer);
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

  let live = null, rawCat = null;
  function mergeGameCatalog() {
    if (!db || !gameCatReady) return;
    if (rawCat && !live) { try { live = analyzeCatalog(rawCat, { overrides: db.ov }); } catch { live = null; } rawCat = null; }
    for (const [id, a] of live ?? []) db.u[id] = { ...(db.u[id] ?? {}), ...a.stats, ...overlayFields(a) };
    live = null;
    for (const [id, g] of gameCat) db.u[id] = { ...(db.u[id] ?? {}), n: g.n, l: g.l, b: g.b, c: g.c, e: g.e };
    for (const r of mem.units.values()) r.row = formationRow(U(r.stage));
    dirty = true; render(true);
  }
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
  function healTable(abilities) {
    const out = new Map();
    for (const a of Array.isArray(abilities) ? abilities.slice(0, 5000) : []) {
      if (a?.status !== 'executable' || !ID(a.id)) continue;
      const hitting = a.trigger?.kind === 'on_hit' || a.trigger?.kind === 'on_attack';
      const parts = [];
      for (const e of Array.isArray(a.effects) ? a.effects.slice(0, 16) : []) {
        if (e?.kind !== 'heal') continue;
        const aim = e.targeting ?? a.targeting, m = e.magnitude ?? {};
        const own = (hitting && e.target === 'attacker') || e.target === 'killing_unit' || (!e.target && aim?.kind === 'self');
        const ally = !own && aim?.filter === 'ally' && aim?.kind !== 'self';
        if (!own && !ally) continue;
        parts.push({ own, base: N(m.base) ?? 0, perWave: N(m.per_wave) ?? 0, mult: m.basis === 'attack_damage' ? N(m.multiplier) ?? 0 : 0,
          pct: m.basis === 'max_health' && ['attacker', 'enum_unit', undefined].includes(m.of) ? (N(m.percent) ?? 0) / 100 : 0 });
      }
      if (parts.length) out.set(a.id, parts);
    }
    return out;
  }
  const cleanUnit = x => ({
    n: S(x.n), m: ID(x.m), hp: N(x.hp), dps: N(x.dps), a: ID(x.a), at: ID(x.at), ar: N(x.ar), rg: N(x.rg), b: N(x.b), lk: N(x.lk),
    f: ID(x.f), ed: N(x.ed), l: N(x.l), el: ID(x.el), c: N(x.c), k: N(x.k), p: ID(x.p), pw: N(x.pw), st: TIER(x.st), L: N(x.L),
    e: list(x.e, v => tuple(v, [ID, N]), 8), pk: tuple(x.pk, [ID, N, N]), ul: list(x.ul, v => tuple(v, [ID, ID, N])),
    pg: list(x.pg, ID), kt: list(x.kt, ID), r: list(x.r, ID), ro: ['atk', 'tank', 'buff', 'debuff'].includes(x.ro) ? x.ro : undefined, lr: ['atk', 'tank', 'buff', 'debuff'].includes(x.lr) ? x.lr : undefined, dp: list(x.dp, N, 5), sd: N(x.sd), pc: Number.isInteger(x.pc) && x.pc >= 0 && x.pc < 8 ? x.pc : undefined, sk: list(x.sk, ID, 12), s: list(x.s, v => S(v, 60)), tp: dict(x.tp, v => (v === 1 || v === 2 ? v : undefined), 16),
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
      rawCat = raw.catalog;
      heals = healTable(raw.catalog?.abilities);
      gameCatReady = true; mergeGameCatalog();
    })
    .catch(() => { if (dead) return; toast = 'Không tải được catalog của game — nút Bắt/Tiến hóa/Trade tạm khoá.'; dirty = true; try { render(true); } catch { } });
})();
