const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = v => (Array.isArray(v) ? v : []);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = v => (typeof v === 'string' ? v : null);

export function createState() {
  return {
    tick: 0, baseId: null, haveKeyframe: false,
    lives: 0, gold: 0, lumber: 0, alive: true,
    research: new Map(), units: new Map(), wilds: new Map(), offers: new Map(),
    summary: null, messages: 0,
  };
}

const unitOf = u => ({
  id: num(u.id), stage: str(u.stage_id), owner: u.owner_id ?? null,
  hp: num(u.health), maxHp: num(u.max_health), active: u.active !== false, book: num(u.book_value),
});
const wildOf = w => ({ id: num(w.id), stage: str(w.stage_id) });
const offerOf = o => ({ slot: num(o.slot), get: str(o.offered_stage_id), give: str(o.required_stage_id) });

function applyBase(s, b) {
  if (!isObj(b)) return;
  s.lives = num(b.lives); s.gold = num(b.gold); s.lumber = num(b.lumber); s.alive = b.alive !== false;
  s.research = new Map(arr(b.research).filter(isObj).map(r => [str(r.research_id), num(r.level)]));
}

const fill = (map, list, make) => { for (const x of arr(list)) if (isObj(x)) { const v = make(x); map.set(v.id ?? v.slot, v); } };

export function applyMessage(s, msg) {
  if (!isObj(msg)) return false;
  s.messages++;
  switch (msg.type) {
    case 'base_keyframe': {
      if (!isObj(msg.base)) return false;
      s.tick = num(msg.tick); s.baseId = msg.base.base_id ?? null; s.haveKeyframe = true;
      applyBase(s, msg.base);
      s.units = new Map(); s.wilds = new Map(); s.offers = new Map();
      fill(s.units, msg.units, unitOf);
      fill(s.wilds, msg.wilds, wildOf); fill(s.offers, msg.trade_offers, offerOf);
      return true;
    }
    case 'base_delta': {
      if (!isObj(msg.base)) return false;
      if (s.haveKeyframe && msg.base.base_id !== s.baseId) return false;
      if (!s.haveKeyframe) s.baseId = msg.base.base_id ?? null;
      s.tick = num(msg.tick);
      applyBase(s, msg.base);
      fill(s.units, msg.units_upserted, unitOf);
      fill(s.wilds, msg.wilds_upserted, wildOf); fill(s.offers, msg.trade_offers, offerOf);
      for (const id of arr(msg.unit_ids_removed)) s.units.delete(id);
      for (const id of arr(msg.wild_ids_removed)) s.wilds.delete(id);
      return true;
    }
    case 'room_summary': {
      s.summary = {
        tick: num(msg.tick), phase: str(msg.phase), endsTick: num(msg.phase_ends_tick), wave: num(msg.wave_index),
        terminal: !!msg.terminal,
        nextWave: arr(msg.next_wave).filter(isObj).map(g => ({
          stage: str(g.stage_id), count: num(g.count), target: g.target_base_id ?? null, source: g.source_player_id ?? null,
        })),
        bases: arr(msg.bases).filter(isObj).map(b => ({
          baseId: b.base_id, playerId: b.player_id, name: str(b.player_name) ?? '?', lives: num(b.lives),
          gold: num(b.gold), lumber: num(b.lumber), income: num(b.income), alive: b.alive !== false,
          creeps: num(b.creep_count), wilds: num(b.wild_count),
        })),
      };
      return true;
    }
    default:
      return false;
  }
}

export const isGameMessage = m => isObj(m) && ['base_keyframe', 'base_delta', 'room_summary'].includes(m.type);

const ownerOf = s => s.summary?.bases.find(b => b.baseId === s.baseId) ?? null;

export function myUnits(s) {
  const owner = ownerOf(s)?.playerId;
  return [...s.units.values()].filter(u => owner == null || u.owner === owner);
}

export function evolvePath(db, from, to) {
  if (from === to) return { cost: 0, steps: [] };
  const best = new Map([[from, 0]]), prev = new Map(), done = new Set();
  for (let guard = 0; guard < 5000; guard++) {
    let cur = null, curCost = Infinity;
    for (const [id, c] of best) if (!done.has(id) && c < curCost) { cur = id; curCost = c; }
    if (cur === null || cur === to) break;
    done.add(cur);
    for (const edge of db.u[cur]?.e ?? []) {
      const [next, cost] = Array.isArray(edge) ? edge : [];
      if (typeof next !== 'string' || !Number.isFinite(cost) || cost < 0) continue;
      const c = curCost + cost;
      if (!best.has(next) || c < best.get(next)) { best.set(next, c); prev.set(next, cur); }
    }
  }
  if (!best.has(to)) return null;
  const steps = [];
  for (let id = to, n = 0; id !== from && n < 100; id = prev.get(id), n++) steps.unshift(id);
  return { cost: best.get(to), steps };
}

export function buildGameCatalog(raw) {
  const cat = raw?.catalog;
  if (!isObj(cat) || !Array.isArray(cat.species)) throw new Error('catalog game sai định dạng');
  const names = new Map(arr(cat.display_names).filter(isObj).map(d => [d.id, typeof d.value === 'string' ? d.value : '']));
  const out = new Map();
  for (const sp of cat.species) {
    if (!isObj(sp) || typeof sp.id !== 'string') continue;
    const full = (names.get(sp.display_name_id) || sp.id).replace(/\|c[0-9a-f]{8}|\|r/gi, '').trim();
    const m = /^(.*?)\s+level\s+(\d+)$/i.exec(full);
    out.set(sp.id, {
      n: (m ? m[1] : full).slice(0, 60), l: m ? +m[2] : undefined,
      b: num(sp.book_value), c: num(sp.catch_chance),
      e: arr(sp.evolutions).filter(e => isObj(e) && typeof e.stage_id === 'string' && Number.isFinite(e.cost) && e.cost >= 0)
        .map(e => [e.stage_id, e.cost]),
    });
  }
  return out;
}

export function tradeOptions(s, db) {
  const mine = myUnits(s).filter(u => u.active);
  return [...s.offers.values()].sort((a, b) => a.slot - b.slot).map(o => {
    const ready = mine.filter(u => u.stage === o.give);
    let evolve = null;
    if (!ready.length) {
      for (const u of mine) {
        const p = evolvePath(db, u.stage, o.give);
        if (p && (!evolve || p.cost < evolve.cost)) evolve = { unit: u, ...p };
      }
    }
    return { ...o, ready, evolve };
  });
}

export function offersForFamily(s, db, stage) {
  const fam = db.u[stage]?.f;
  return fam ? [...s.offers.values()].filter(o => db.u[o.give]?.f === fam) : [];
}

export function bestAttacks(db, armorType) {
  return Object.entries(db.dmg ?? {})
    .map(([atk, row]) => [atk, row?.[armorType] ?? 1])
    .sort((a, b) => b[1] - a[1]);
}

export function nextWaveForBase(s) {
  return (s.summary?.nextWave ?? []).filter(g => g.target == null || g.target === s.baseId);
}

export const ROW_AT = [-240, -120, 0, 140];
export const BANDS = [[-400, -180], [-180, -60], [-60, 70], [70, 300]];
const LINE_OFF = [[0, -60, -120], [0, -35, 35], [0, -35, 35], [0, 60, 120]];
const HYST = 15, SAME_POS = 24, SETTLE_MS = 1000, GAP = 80, MARGIN = 48, CLUMP = GAP / 2;
export const LAT_MAX = [220, 220, 380, 380];
const LAT_HYST = 20, DEPTH_W = 0.5, Q_W = 3;
export const GRID = { top: -525, row: 101.6, col: 147.5, cols: 'ABCDEFG', rows: 8 };
export const POS_ROW = [0, 0, 1, 1, 1, 1, 2, 3];
export const POS_ACCEPT = [[0], [0], [1], [1], [1], [1, 0], [2, 3], [3, 2]];

export function formationRow(u) {
  if (!u) return 1;
  if (Number.isInteger(u.pc) && u.pc >= 0 && u.pc < POS_ROW.length) return POS_ROW[u.pc];
  const main = u.ro ?? u.kt?.[0];
  if (main === 'buff') return 3;
  if (main === 'tank') return 0;
  return (u.rg ?? 0) > 300 ? 2 : 1;
}
export const acceptRows = u => (Number.isInteger(u?.pc) && POS_ACCEPT[u.pc] ? POS_ACCEPT[u.pc] : [formationRow(u)]);

const hyp = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

export function makeFrame(ground) {
  const a = ground?.arena;
  if (!a || !(a.width > 0) || !(a.height > 0) || ![a.originX, a.originY].every(Number.isFinite)) return null;
  const cx = a.originX + a.width / 2, cy = a.originY + a.height / 2;
  let pts = (Array.isArray(ground.path) ? ground.path : []).filter(q => Number.isFinite(q?.x) && Number.isFinite(q?.y)).slice(0, 64);
  pts = pts.filter((q, i) => i === 0 || hyp(q.x, q.y, pts.at(i - 1).x, pts.at(i - 1).y) > 1e-6);
  if (pts.length < 2) pts = [{ x: cx, y: a.originY }, { x: cx, y: a.originY + a.height }];
  const segs = [];
  let cum = 0;
  pts.forEach((B, i) => {
    if (!i) return;
    const A = pts.at(i - 1), len = hyp(A.x, A.y, B.x, B.y);
    const dx = (B.x - A.x) / len, dy = (B.y - A.y) / len;
    segs.push({ A, len, dx, dy, nx: -dy, ny: dx, s0: cum });
    cum += len;
  });
  const lastSeg = segs.length - 1;
  const project = q => {
    let found = null;
    segs.forEach((g, i) => {
      let t = (q.x - g.A.x) * g.dx + (q.y - g.A.y) * g.dy;
      if (i > 0) t = Math.max(0, t);
      if (i < lastSeg) t = Math.min(g.len, t);
      const fx = g.A.x + g.dx * t, fy = g.A.y + g.dy * t, d = hyp(q.x, q.y, fx, fy);
      if (!found || d < found.d - 1e-9) found = { d, s: g.s0 + t, side: (q.x - fx) * g.nx + (q.y - fy) * g.ny };
    });
    return found;
  };
  const sRef = project({ x: cx, y: cy }).s;
  const pointAt = (along, lat) => {
    const at = sRef + along;
    let g = segs[0];
    for (const x of segs) if (at >= x.s0) g = x;
    const t = at - g.s0;
    return { x: g.A.x + g.dx * t + g.nx * lat, y: g.A.y + g.dy * t + g.ny * lat };
  };
  const inside = (q, m = MARGIN / 2) => q.x >= a.originX + m && q.x <= a.originX + a.width - m && q.y >= a.originY + m && q.y <= a.originY + a.height - m;
  const cell = q => {
    const p = project(q);
    const r = Math.floor((p.s - sRef - GRID.top) / GRID.row) + 1, c = 3 - Math.round(p.side / GRID.col);
    return `${GRID.cols[Math.max(0, Math.min(6, c))]}${Math.max(0, Math.min(GRID.rows + 1, r))}`;
  };
  return { a, cx, cy, pointAt, inside, cell, along: q => project(q).s - sRef, lat: q => project(q).d };
}

export function inBand(f, row, pos, confirmed) {
  if (!pos || !f.inside(pos)) return false;
  const [lo, hi] = BANDS[row];
  const h = confirmed ? -HYST : HYST;
  const at = f.along(pos);
  return at >= lo + h && at <= hi - h && f.lat(pos) <= LAT_MAX[row] + (confirmed ? LAT_HYST : -LAT_HYST);
}

export function rowSlots(f, row) {
  const out = [];
  const reach = Math.hypot(f.a.width, f.a.height);
  LINE_OFF[row].forEach((off, line) => {
    const along = ROW_AT[row] + off;
    const base = line ? GAP / 2 : 0;
    const K = Math.ceil(reach / GAP), lats = base ? [] : [0];
    for (let step = base ? 0 : 1; step <= K; step++) lats.push(base + step * GAP, -(base + step * GAP));
    for (const lat of lats) {
      const q = f.pointAt(along, lat);
      const slot = { id: `${row}:${line}:${Math.round(lat / (GAP / 2))}`, row, line, q: Math.round(Math.abs(lat) + DEPTH_W * Math.abs(off)), x: Math.round(q.x), y: Math.round(q.y) };
      if (f.inside(slot, MARGIN) && inBand(f, row, slot, false)) out.push(slot);
    }
  });
  return out.sort((x, y) => x.q - y.q || x.line - y.line);
}

const put = (arr, i, val) => arr.fill(val, i, i + 1);

export function minCostAssign(cost) {
  const n = cost.length, m = n ? cost[0].length : 0;
  if (!n || m < n) return [];
  const INF = 1e18, pu = new Array(n + 1).fill(0), pv = new Array(m + 1).fill(0), owner = new Array(m + 1).fill(0), back = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    put(owner, 0, i);
    let j0 = 0;
    const best = new Array(m + 1).fill(INF), done = new Array(m + 1).fill(false);
    do {
      put(done, j0, true);
      const i0 = owner[j0];
      let delta = INF, j1 = 0;
      for (let j = 1; j <= m; j++) {
        if (done[j]) continue;
        const cur = cost[i0 - 1][j - 1] - pu[i0] - pv[j];
        if (cur < best[j]) { put(best, j, cur); put(back, j, j0); }
        if (best[j] < delta) { delta = best[j]; j1 = j; }
      }
      for (let j = 0; j <= m; j++) {
        if (done[j]) { put(pu, owner[j], pu[owner[j]] + delta); put(pv, j, pv[j] - delta); } else put(best, j, best[j] - delta);
      }
      j0 = j1;
    } while (owner[j0] !== 0);
    do { const j1 = back[j0]; put(owner, j0, owner[j1]); j0 = j1; } while (j0);
  }
  const result = new Array(n).fill(-1);
  for (let j = 1; j <= m; j++) if (owner[j]) put(result, owner[j] - 1, j - 1);
  return result;
}

export function createMemory() {
  return { planning: 0, phase: null, booted: false, planningAt: 0, units: new Map(), badSlots: new Set() };
}

export function observe(mem, snap, now = 0) {
  const planningNow = snap.phase === 'planning';
  if (planningNow && mem.phase !== 'planning') {
    mem.planning++;
    mem.planningAt = now;
    for (const r of mem.units.values()) { r.lastPos = null; r.rejects = 0; }
  }
  mem.phase = snap.phase;
  if (snap.ready === false) return [];
  const seen = new Set(), changed = [];
  for (const u of snap.units) {
    seen.add(u.key);
    let r = mem.units.get(u.key);
    if (!r) {
      r = { firstSeen: mem.booted ? mem.planning : -Infinity, row: u.row, stage: u.stage, rowChangedAt: null, conf: null, manualAt: null, lastPos: null, pending: null, rejects: 0, rejectAt: null, at: null, since: 0 };
      mem.units.set(u.key, r);
    }
    if (r.row !== u.row) { r.row = u.row; r.conf = null; r.rowChangedAt = mem.planning; changed.push(u); }
    r.stage = u.stage;
    if (r.pending && (now - r.pending.t > 3000 || (u.pos && hyp(u.pos.x, u.pos.y, r.pending.x, r.pending.y) <= SAME_POS))) r.pending = null;
    if (planningNow && u.active && u.pos) {
      if (r.lastPos && !r.pending && now - mem.planningAt > SETTLE_MS && hyp(u.pos.x, u.pos.y, r.lastPos.x, r.lastPos.y) > SAME_POS) { r.manualAt = mem.planning; r.conf = null; }
      r.lastPos = { x: u.pos.x, y: u.pos.y };
      if (!r.at || hyp(u.pos.x, u.pos.y, r.at.x, r.at.y) > SAME_POS) { r.at = { x: u.pos.x, y: u.pos.y }; r.since = now; }
    }
  }
  for (const id of [...mem.units.keys()]) if (!seen.has(id)) mem.units.delete(id);
  mem.booted = true;
  return changed;
}

export function onSent(mem, key, row, target, now = 0) {
  const r = mem.units.get(key);
  if (r) { r.pending = { x: target.x, y: target.y, t: now, row, slot: target.slot }; r.lastPos = { x: target.x, y: target.y }; }
}

export function onAck(mem, key, ok) {
  const r = mem.units.get(key);
  if (!r?.pending) return;
  if (ok) r.conf = r.pending.row;
  else { mem.badSlots.add(r.pending.slot); r.rejects++; r.rejectAt = mem.planning; r.pending = null; r.lastPos = null; }
}

export function planMoves(mem, members, ground) {
  const status = new Map();
  const f = makeFrame(ground);
  if (!f) return { moves: [], status, cells: new Map(), reason: 'ground' };
  const cells = new Map(members.filter(m => m.pos).map(m => [m.key, f.cell(m.pos)]));
  const cur = mem.planning;
  const eligible = [], fixed = [], placed = [], sleeping = [];
  for (const m of members) {
    const r = mem.units.get(m.key) ?? {};
    if (!m.active) { status.set(m.key, 'down'); if (m.pos) sleeping.push(m); continue; }
    if (!m.pos) { status.set(m.key, 'unknown'); continue; }
    if (r.pending) { status.set(m.key, 'pending'); fixed.push({ ...m, pos: { x: r.pending.x, y: r.pending.y } }); continue; }
    if (r.firstSeen === cur && (m.level ?? 1) <= 1 && r.rowChangedAt !== cur) { status.set(m.key, 'new'); fixed.push(m); continue; }
    if (r.manualAt === cur) { status.set(m.key, 'manual'); fixed.push(m); continue; }
    if (r.rejects >= 2 && r.rejectAt === cur) { status.set(m.key, 'rejected'); fixed.push(m); continue; }
    const accept = m.accept ?? [m.row];
    const hit = accept.find(row => inBand(f, row, m.pos, r.conf === row));
    if (hit !== undefined) placed.push({ m, hit, since: r.since ?? 0 });
    else eligible.push(m);
  }
  const heading = fixed.filter(m => status.get(m.key) === 'pending');
  placed.sort((x, y) => x.since - y.since || y.m.score - x.m.score || (x.m.key < y.m.key ? -1 : 1));
  const kept = [];
  for (const { m, hit } of placed) {
    if ([...heading, ...kept].some(u => hyp(u.pos.x, u.pos.y, m.pos.x, m.pos.y) < CLUMP)) { status.set(m.key, 'stack'); eligible.push(m); continue; }
    kept.push(m);
    status.set(m.key, 'ok');
    if (mem.phase === 'planning' && mem.units.has(m.key)) mem.units.get(m.key).conf = hit;
    fixed.push(m);
  }
  const moves = [];
  for (let row = 0; row < ROW_AT.length; row++) {
    const want = eligible.filter(m => m.row === row).sort((x, y) => y.score - x.score || (x.key < y.key ? -1 : 1));
    if (!want.length) continue;
    const slots = rowSlots(f, row).filter(sl => !mem.badSlots.has(sl.id) && ![...fixed, ...eligible, ...sleeping].some(u => hyp(u.pos.x, u.pos.y, sl.x, sl.y) < CLUMP));
    const n = Math.min(want.length, slots.length);
    for (const m of want.slice(n)) status.set(m.key, 'full');
    const take = want.slice(0, n);
    if (!n) continue;
    const levels = [...new Set(take.map(m => m.score))].sort((a, b) => a - b);
    const weight = m => levels.indexOf(m.score) + 1;
    const match = minCostAssign(take.map(m => slots.map(sl => Q_W * weight(m) * sl.q + hyp(m.pos.x, m.pos.y, sl.x, sl.y))));
    take.forEach((m, i) => { const sl = slots[match[i]]; if (!sl) return; status.set(m.key, 'move'); moves.push({ key: m.key, row, x: sl.x, y: sl.y, slot: sl.id, from: cells.get(m.key), to: f.cell(sl), unit: m }); });
  }
  const hi0 = BANDS[0][1];
  const tier = mv => (mv.row !== 0 && f.along(mv.unit.pos) < hi0 ? 0 : mv.row === 0 ? 1 : 2);
  const exposure = mv => Math.max(0, BANDS[mv.row][0] - f.along(mv.unit.pos));
  moves.sort((x, y) => tier(x) - tier(y)
    || (tier(x) === 0 ? y.row - x.row : 0)
    || (tier(x) === 2 ? exposure(y) - exposure(x) || x.row - y.row : 0)
    || y.unit.score - x.unit.score || (x.key < y.key ? -1 : 1));
  return { moves: moves.map(({ unit, ...mv }) => mv), status, cells };
}
