const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = v => (Array.isArray(v) ? v : []);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = v => (typeof v === 'string' ? v : null);

export function createState() {
  return {
    tick: 0, baseId: null, haveKeyframe: false,
    lives: 0, gold: 0, lumber: 0, alive: true,
    research: new Map(), units: new Map(), creeps: new Map(), wilds: new Map(), offers: new Map(),
    summary: null, messages: 0,
  };
}

const unitOf = u => ({
  id: num(u.id), stage: str(u.stage_id), owner: u.owner_id ?? null,
  hp: num(u.health), maxHp: num(u.max_health), active: u.active !== false, book: num(u.book_value),
});
const creepOf = c => ({ id: num(c.id), stage: str(c.stage_id), hp: num(c.health), maxHp: num(c.max_health) });
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
      s.units = new Map(); s.creeps = new Map(); s.wilds = new Map(); s.offers = new Map();
      fill(s.units, msg.units, unitOf); fill(s.creeps, msg.creeps, creepOf);
      fill(s.wilds, msg.wilds, wildOf); fill(s.offers, msg.trade_offers, offerOf);
      return true;
    }
    case 'base_delta': {
      if (!isObj(msg.base)) return false;
      if (s.haveKeyframe && msg.base.base_id !== s.baseId) return false;
      if (!s.haveKeyframe) s.baseId = msg.base.base_id ?? null;
      s.tick = num(msg.tick);
      applyBase(s, msg.base);
      fill(s.units, msg.units_upserted, unitOf); fill(s.creeps, msg.creeps_upserted, creepOf);
      fill(s.wilds, msg.wilds_upserted, wildOf); fill(s.offers, msg.trade_offers, offerOf);
      for (const id of arr(msg.unit_ids_removed)) s.units.delete(id);
      for (const id of arr(msg.creep_ids_removed)) s.creeps.delete(id);
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

const ROW_AT = [-240, -120, 0, 140];

export function formationRow(u) {
  if (!u) return 1;
  const far = (u.rg ?? 0) > 300;
  if ((u.ar ?? 0) >= 15 || (u.r ?? []).includes('tank') || (!far && (u.kt ? u.kt[0] === 'tank' : (u.hp ?? 0) / Math.max(1, u.ed ?? u.dps ?? 0) >= 18))) return 0;
  if ((u.r ?? []).some(r => r === 'aura' || r === 'sustain')) return 3;
  return far ? 2 : 1;
}

export function formation(members, ground, { gap = 80, lineGap = 60, margin = 48 } = {}) {
  const a = ground?.arena;
  if (!a || !(a.width > 0) || !(a.height > 0)) return [];
  let dx = 0, dy = 1;
  const p = ground.path;
  if (p?.length >= 2) {
    const len = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
    if (len > 0) { dx = (p[1].x - p[0].x) / len; dy = (p[1].y - p[0].y) / len; }
  }
  const cx = a.originX + a.width / 2, cy = a.originY + a.height / 2;
  const across = Math.abs(dy) * a.width + Math.abs(dx) * a.height - 2 * margin;
  const perLine = Math.max(1, Math.floor(across / gap) + 1);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const out = [];
  for (let row = 0; row < ROW_AT.length; row++) {
    const list = members.filter(m => m.row === row).sort((x, y) => y.score - x.score);
    list.forEach((m, i) => {
      const idx = i % perLine;
      const slot = idx % 2 ? (idx + 1) / 2 : -idx / 2;
      const along = ROW_AT[row] + Math.floor(i / perLine) * lineGap;
      out.push({
        key: m.key, row,
        x: Math.round(clamp(cx + dx * along - dy * slot * gap, a.originX + margin, a.originX + a.width - margin)),
        y: Math.round(clamp(cy + dy * along + dx * slot * gap, a.originY + margin, a.originY + a.height - margin)),
      });
    });
  }
  return out;
}

const BAND = 55;

function frame(ground, margin) {
  const a = ground?.arena;
  if (!a || !(a.width > 0) || !(a.height > 0)) return null;
  let dx = 0, dy = 1;
  const p = ground.path;
  if (p?.length >= 2) {
    const len = Math.hypot(p[1].x - p[0].x, p[1].y - p[0].y);
    if (len > 0) { dx = (p[1].x - p[0].x) / len; dy = (p[1].y - p[0].y) / len; }
  }
  const cx = a.originX + a.width / 2, cy = a.originY + a.height / 2;
  const inside = q => q.x >= a.originX + margin / 2 && q.x <= a.originX + a.width - margin / 2 && q.y >= a.originY + margin / 2 && q.y <= a.originY + a.height - margin / 2;
  return { a, dx, dy, cx, cy, inside, along: q => (q.x - cx) * dx + (q.y - cy) * dy };
}

export function arrangeMoves(members, ground, { gap = 80, lineGap = 60, margin = 48 } = {}) {
  const f = frame(ground, margin);
  if (!f) return [];
  const slots = formation(members.map(m => ({ key: m.key, row: m.row, score: m.score })), ground, { gap, lineGap, margin });
  const lines = new Map();
  for (const sl of slots) {
    const at = f.along(sl);
    const r = lines.get(sl.row) ?? [Infinity, -Infinity];
    lines.set(sl.row, [Math.min(r[0], at), Math.max(r[1], at)]);
  }
  const inRow = m => {
    const r = lines.get(m.row);
    if (!r || !m.pos || !f.inside(m.pos)) return false;
    const at = f.along(m.pos);
    return at >= r[0] - BAND && at <= r[1] + BAND;
  };
  const stay = members.filter(inRow);
  const free = slots.map(sl => ({ ...sl, taken: false }));
  for (const m of stay) {
    const near = free.filter(sl => sl.row === m.row && !sl.taken && Math.hypot(m.pos.x - sl.x, m.pos.y - sl.y) < gap);
    if (near.length) near.reduce((b, sl) => (Math.hypot(m.pos.x - sl.x, m.pos.y - sl.y) < Math.hypot(m.pos.x - b.x, m.pos.y - b.y) ? sl : b)).taken = true;
  }
  const order = members.filter(m => !inRow(m)).sort((x, y) => x.row - y.row || y.score - x.score);
  const moves = [];
  for (const m of order) {
    const options = free.filter(sl => sl.row === m.row && !sl.taken);
    if (!options.length) continue;
    const from = m.pos ?? { x: f.cx, y: f.cy };
    const best = options.reduce((b, sl) => (Math.hypot(sl.x - from.x, sl.y - from.y) < Math.hypot(b.x - from.x, b.y - from.y) ? sl : b));
    best.taken = true;
    moves.push({ key: m.key, row: m.row, x: best.x, y: best.y });
  }
  return moves;
}

