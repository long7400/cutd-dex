// Logic thuần của CUTD Helper (không đụng DOM) — test được bằng node:test.
// Mô hình state dựng lại từ đúng các message server gửi cho client:
//   base_keyframe  → thay toàn bộ state căn cứ đang xem
//   base_delta     → upsert/xoá theo id
//   room_summary   → pha, đợt, đợt sắp tới, bảng người chơi
// Tool chỉ ĐỌC các message này, không bao giờ gửi gì lên server.

export const TICKS_PER_SECOND = 32;

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

// Trả true nếu message làm state đổi (để UI biết mà vẽ lại).
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
      // Delta của căn cứ khác (vừa chuyển sang xem nhà khác) → bỏ, chờ keyframe mới như client.
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

// Chủ của căn cứ đang xem (player_id) — lấy từ room_summary.
export const ownerOf = s => s.summary?.bases.find(b => b.baseId === s.baseId) ?? null;

// Lính thuộc chủ căn cứ đang xem (khi xem nhà mình = lính của mình).
export function myUnits(s) {
  const owner = ownerOf(s)?.playerId;
  return [...s.units.values()].filter(u => owner == null || u.owner === owner);
}

// Đường tiến hóa ngắn nhất (theo tổng vàng) từ stage `from` tới stage `to`; null nếu không tới được.
export function evolvePath(db, from, to) {
  if (from === to) return { cost: 0, steps: [] };
  const best = new Map([[from, 0]]);
  const prev = new Map();
  const queue = [from];
  while (queue.length) {
    const id = queue.shift();
    for (const [next, cost] of db.u[id]?.e ?? []) {
      const c = best.get(id) + cost;
      if (!best.has(next) || c < best.get(next)) { best.set(next, c); prev.set(next, id); queue.push(next); }
    }
  }
  if (!best.has(to)) return null;
  const steps = [];
  for (let id = to; id !== from; id = prev.get(id)) steps.unshift(id);
  return { cost: best.get(to), steps };
}

// Mỗi trade offer: có sẵn lính đúng stage không, nếu không thì lính nào tiến hóa tới được rẻ nhất.
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

// Các offer đang cần 1 stage thuộc cùng gia phả với `stage` (để gợi ý khi xem wild).
export function offersForFamily(s, db, stage) {
  const fam = db.u[stage]?.f;
  return fam ? [...s.offers.values()].filter(o => db.u[o.give]?.f === fam) : [];
}

// Hệ số sát thương tốt nhất theo loại giáp (bảng damage của game).
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
