export const TICKS_PER_SECOND = 32;

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const arr = v => (Array.isArray(v) ? v : []);
const num = v => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const str = v => (typeof v === 'string' ? v : null);

export function createState() {
  return {
    tick: 0, baseId: null, haveKeyframe: false, origin: null,
    lives: 0, gold: 0, lumber: 0, alive: true,
    research: new Map(), units: new Map(), creeps: new Map(), wilds: new Map(), offers: new Map(),
    summary: null, messages: 0,
  };
}

const posOf = p => (isObj(p) && Number.isFinite(p.x) && Number.isFinite(p.y) ? { x: p.x, y: p.y } : null);
const unitOf = u => ({
  id: num(u.id), stage: str(u.stage_id), owner: u.owner_id ?? null, pos: posOf(u.position),
  hp: num(u.health), maxHp: num(u.max_health), active: u.active !== false, book: num(u.book_value),
});
const creepOf = c => ({ id: num(c.id), stage: str(c.stage_id), hp: num(c.health), maxHp: num(c.max_health) });
const wildOf = w => ({ id: num(w.id), stage: str(w.stage_id), pos: posOf(w.position) });
const offerOf = o => ({ slot: num(o.slot), get: str(o.offered_stage_id), give: str(o.required_stage_id) });

function applyBase(s, b) {
  if (!isObj(b)) return;
  s.lives = num(b.lives); s.gold = num(b.gold); s.lumber = num(b.lumber); s.alive = b.alive !== false;
  if (b.origin !== undefined) s.origin = posOf(b.origin);
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

export const ownerOf = s => s.summary?.bases.find(b => b.baseId === s.baseId) ?? null;

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
  const shown = v => v.replace(/\|c[0-9a-f]{8}/gi, '').replace(/\|r/gi, '').replace(/\|n/gi, ' ').trim();
  const out = new Map();
  for (const sp of cat.species) {
    if (!isObj(sp) || typeof sp.id !== 'string') continue;
    const raw = names.get(sp.display_name_id);
    const full = shown(raw || sp.id);
    const m = /^(.*?)\s+level\s+(\d+)$/i.exec(full);
    out.set(sp.id, {
      n: (m ? m[1] : full).slice(0, 60), l: m ? +m[2] : undefined,
      b: num(sp.book_value), c: num(sp.catch_chance), shown: raw ? shown(raw).slice(0, 120) : null,
      ev: arr(sp.evolutions).map(e => (isObj(e) && typeof e.stage_id === 'string' ? e.stage_id : null)),
      e: arr(sp.evolutions).filter(e => isObj(e) && typeof e.stage_id === 'string' && Number.isFinite(e.cost) && e.cost >= 0)
        .map(e => [e.stage_id, e.cost]),
    });
  }
  return out;
}

export function baseRulesOf(raw) {
  const b = raw?.catalog?.base;
  const r = k => {
    const v = b?.[k];
    const ok = isObj(v) && ['min', 'max'].every(m => isObj(v[m]) && Number.isFinite(v[m].x) && Number.isFinite(v[m].y));
    return ok ? { min: { x: v.min.x, y: v.min.y }, max: { x: v.max.x, y: v.max.y } } : null;
  };
  const out = { arena: r('arena'), wild_area: r('wild_area'), spawn_area: r('spawn_area'), exit_area: r('exit_area') };
  return Object.values(out).every(Boolean) ? out : null;
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

export function secondsLeft(s) {
  if (!s.summary) return null;
  return Math.max(0, (s.summary.endsTick - Math.max(s.tick, s.summary.tick)) / TICKS_PER_SECOND);
}

export function nextWaveForBase(s) {
  return (s.summary?.nextWave ?? []).filter(g => g.target == null || g.target === s.baseId);
}
