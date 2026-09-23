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

const TIERS = [[0.9, 'S+'], [0.75, 'S'], [0.55, 'A'], [0.35, 'B'], [0, 'C']];
export const tierOf = rel => TIERS.find(([min]) => rel >= min)[1];

const armorFactor = (db, armor) => (armor >= 0 ? 1 / (1 + (db.ac ?? 0.06) * armor) : 2 - 0.94 ** -armor);

function threatsOf(s, db) {
  const next = nextWaveForBase(s).filter(g => g.stage && db.u[g.stage]);
  const pvp = next.some(g => g.source != null);
  const list = next.map(g => ({ stage: g.stage, weight: g.count * (db.u[g.stage].hp ?? 1), wave: 0 }));
  if (!pvp && next.length) {
    const want = next.map(g => g.stage).sort().join();
    let hit = null;
    for (const [set, waves] of Object.entries(db.wv ?? {})) {
      for (const [n, groups] of Object.entries(waves)) {
        if (groups.map(([id]) => id).sort().join() !== want) continue;
        const d = Math.abs(Number(n) - (s.summary?.wave ?? 0) - 1);
        if (!hit || d < hit.d) hit = { set, n: Number(n), d };
      }
    }
    if (hit) {
      [[1, 0.6], [2, 0.4]].forEach(([ahead, w]) => {
        for (const [id, count] of db.wv[hit.set][hit.n + ahead] ?? []) {
          if (db.u[id]) list.push({ stage: id, weight: w * count * (db.u[id].hp ?? 1), wave: ahead });
        }
      });
    }
  }
  return { pvp, list };
}

function researchBonus(s, db, el) {
  let speed = 0, levels = 0;
  for (const [id, level] of s.research) {
    const r = db.rs?.[id];
    if (!r || r[0] !== el || !(level > 0)) continue;
    levels += level;
    if (r[1] === 'attack_speed') speed += level * r[2];
  }
  return { speed, levels };
}

export function rateStages(s, db, stages) {
  const { pvp, list: threats } = threatsOf(s, db);
  const total = threats.reduce((n, t) => n + t.weight, 0);
  const vsThreats = u => {
    if (!total) return { mult: 1, armor: 1 };
    let mult = 0, armor = 0;
    for (const t of threats) {
      const c = db.u[t.stage];
      mult += (t.weight / total) * (db.dmg?.[u.a]?.[c.at] ?? 1);
      armor += (t.weight / total) * armorFactor(db, c.ar ?? 0);
    }
    return { mult, armor };
  };
  const defense = id => {
    const u = db.u[id];
    if (!u) return 0;
    const v = vsThreats(u);
    return (u.dps ?? 0) * v.mult * v.armor * (1 + researchBonus(s, db, u.el).speed) * (u.sp ? 1.25 : 1);
  };
  const offense = id => {
    const u = db.u[id];
    return u ? (u.hp ?? 0) * (1 + (db.ac ?? 0.06) * Math.max(0, u.ar ?? 0)) * Math.max(1, u.lk ?? 1) * Math.min(1.5, (u.ms ?? 300) / 300) : 0;
  };

  const team = myUnits(s).filter(u => u.active && db.u[u.stage]);
  const teamDps = team.reduce((n, u) => n + defense(u.stage), 0);
  const hasLegend = team.some(u => db.u[u.stage].L);
  const budget = s.gold + 2 * (ownerOf(s)?.income ?? 0);
  const famBest = new Map();
  for (const [id, u] of Object.entries(db.u)) if (u.f && (!famBest.has(u.f) || defense(id) > defense(famBest.get(u.f)))) famBest.set(u.f, id);
  const reachable = (id, limit) => {
    const cost = new Map([[id, 0]]), queue = [id];
    while (queue.length) {
      const cur = queue.shift();
      for (const [next, c] of db.u[cur]?.e ?? []) {
        const spent = cost.get(cur) + c;
        if (Number.isFinite(spent) && spent <= limit && !(cost.get(next) <= spent)) { cost.set(next, spent); queue.push(next); }
      }
    }
    return [...cost].reduce((best, [st, c]) => (defense(st) > defense(best[0]) ? [st, c] : best), [id, 0]);
  };
  const label = id => `${db.u[id].n}${db.u[id].l ? ` Lv${db.u[id].l}` : ''}`;

  const out = new Map();
  for (const id of new Set(stages)) {
    const u = db.u[id];
    if (!u) continue;
    const reasons = [];
    const now = defense(id);
    const v = vsThreats(u);
    if (total && v.mult >= 1.15) reasons.push(`Khắc giáp đợt tới ×${v.mult.toFixed(2)}`);
    if (total && v.mult <= 0.8) reasons.push(`Bị giáp đợt tới khắc ×${v.mult.toFixed(2)}`);
    const owned = team.some(t => t.stage === id);
    const catchCost = owned ? 0 : (u.b ?? 0) / Math.max(u.c ?? 1, 0.05);
    const [reach, reachCost] = reachable(id, Math.max(0, budget - catchCost));
    const reachDef = defense(reach);
    let power = now + 0.8 * Math.max(0, reachDef - now);
    if (reach !== id && reachDef > now * 1.3) reasons.push(`Nâng được ngay: ${label(reach)} (${Math.round(reachCost)} vàng)`);
    const top = famBest.get(u.f);
    const topPath = top && top !== reach ? evolvePath(db, id, top) : null;
    if (topPath) {
      const base = Math.max(now, reachDef, 1e-9);
      const bonus = base * 0.15 * Math.log2(1 + defense(top) / base) * (budget / (budget + topPath.cost + 1));
      power += bonus;
      if (bonus > base * 0.2) reasons.push(`Đỉnh cây: ${label(top)} (${Math.round(topPath.cost)} vàng)`);
    }
    const mine = team.findIndex(t => t.stage === id);
    const others = team.filter((_, i) => i !== mine);
    const othersDps = teamDps - (mine >= 0 ? now : 0);
    let aura = 0;
    for (const [code, dmg, spd] of u.au ?? []) {
      const have = Math.max(1, ...others.flatMap(t => (db.u[t.stage].au ?? []).filter(a => a[0] === code).map(a => a[1] * a[2])));
      const gain = dmg * spd - have;
      if (gain > 0 && others.length) {
        aura += gain * othersDps;
        reasons.push(`+${Math.round((dmg * spd - 1) * 100)}% ${spd > 1 ? 'tốc đánh' : 'sát thương'} cho ${others.length} con`);
      } else if (gain <= 0) reasons.push('Hào quang trùng — đội đã có');
    }
    const rb = researchBonus(s, db, u.el);
    if (rb.levels) reasons.push(`Hợp nghiên cứu hệ ${db.el?.[u.el]?.n ?? u.el} (${rb.levels} cấp)`);
    let trade = 0, tradeReason = null;
    for (const o of s.offers.values()) {
      if (!o.give || !o.get || !db.u[o.get]) continue;
      const path = o.give === id ? { cost: 0 } : evolvePath(db, id, o.give);
      if (!path) continue;
      const gain = (defense(o.get) - defense(o.give)) * (s.gold / (s.gold + path.cost + 1));
      if (gain > trade) {
        trade = gain;
        tradeReason = `Trade S${o.slot} → ${db.u[o.get].n}${path.cost ? ` (tiến hóa ${Math.round(path.cost)} vàng)` : ''}`;
      }
    }
    if (tradeReason) reasons.push(tradeReason);
    const blocked = !!(u.L && hasLegend && (db.lc ?? 1) <= 1 && !owned);
    if (blocked) reasons.unshift('Đã có huyền thoại — không bắt thêm được');
    out.set(id, { def: power + aura + trade, off: offense(id), reasons: reasons.slice(0, 4), blocked });
  }
  const maxDef = Math.max(1e-9, ...[...out.values()].map(r => r.def));
  const maxOff = Math.max(1e-9, ...[...out.values()].map(r => r.off));
  for (const r of out.values()) {
    if (pvp && r.off / maxOff >= 0.6) r.reasons.push('Làm quái trâu (sang đánh đối thủ)');
    r.score = pvp ? 0.7 * (r.def / maxDef) + 0.3 * (r.off / maxOff) : r.def / maxDef;
    r.tier = r.blocked ? '—' : tierOf(r.score);
  }
  return { pvp, threats: threats.length, ratings: out };
}
