import { skillValue } from './skillvalue.js';

const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;
const POWER_TIERS = [[0.9, 'S+'], [0.65, 'S'], [0.45, 'A'], [0.28, 'B'], [0, 'C']];
export const powerTier = score => POWER_TIERS.find(([min]) => score >= min)[1];
const LEVEL_BANDS = [2, 20, 40, 70, Infinity];
const KIT_OF_ROLE = { aura: 'buff', cc: 'cc', shred: 'cc', sustain: 'heal', evade: 'evade', taunt: 'taunt', boss: 'boss', aoe: 'aoe', selfharm: 'selfharm' };
const KIT_ORDER = ['atk', 'tank', 'buff', 'debuff', 'cc', 'heal', 'evade', 'taunt', 'boss', 'aoe', 'selfharm'];
export const ROLE_KEYS = ['atk', 'tank', 'buff', 'debuff'];
const BUFF_MIN = 0.05, DEBUFF_MIN = 0.05, SELF_WINDOW = 40, ARMOR_K = 0.06, TEAM_DPS = 24000;
export const ROLE_RULES = { BUFF_MIN, DEBUFF_MIN, SELF_WINDOW, ARMOR_K, TEAM_DPS, PRESSURE: 6000, HOLD_CAP: 60 };
const p90 = list => [...list].sort((x, y) => x - y)[Math.floor(list.length * 0.9)] || 1;
const bandOf = level => LEVEL_BANDS.findIndex(max => (level || 1) < max);

function teamAuras(s, abilityById, modifierById) {
  return (s.abilities ?? []).flatMap(id => {
    const a = abilityById.get(id);
    if (a?.status !== 'executable' || a?.trigger?.kind !== 'aura' || a.targeting?.kind !== 'all_in_base' || a.targeting?.filter !== 'ally') return [];
    let dmg = 1, spd = 1, armor = 0, taken = 1;
    for (const e of a.effects ?? []) {
      const m = e.kind === 'apply_modifier' ? modifierById.get(e.modifier_id) : null;
      if (!m) continue;
      dmg = Math.max(dmg, m.attack_damage_multiplier ?? 1);
      spd = Math.max(spd, m.attack_speed_multiplier ?? 1);
      armor += m.armor_delta ?? 0;
      taken = Math.min(taken, m.damage_taken_multiplier ?? 1);
    }
    return dmg > 1 || spd > 1 || armor > 0 || taken < 1 ? [[id.split('_')[1], round(dmg, 3), round(spd, 3), armor, round(taken, 3)]] : [];
  });
}

function allyHeals(s, abilityById) {
  let perSec = 0;
  for (const id of s.abilities ?? []) {
    const a = abilityById.get(id);
    if (a?.status !== 'executable' || a.targeting?.filter !== 'ally' || a.targeting?.kind === 'self') continue;
    const every = Math.max(1, (a.trigger?.cooldown_ticks ?? a.cooldown_ticks ?? 160) / 32);
    for (const e of a.effects ?? []) if (e.kind === 'heal') perSec += (e.magnitude?.base ?? 0) / every;
  }
  return perSec;
}

const PRESSURE = 6000, HOLD_CAP = 60;
function roleValues(u) {
  const survive = u.selfDps > 0 ? Math.max(0.1, Math.min(1, u.hp / u.selfDps / SELF_WINDOW)) : 1;
  const buff = u.auras.reduce((v, [, dmg, spd, armor, taken]) => v + (dmg - 1) + (spd - 1) + 0.5 * ARMOR_K * armor + 0.5 * (1 - taken), 0) + u.teamBuff + u.heals / 20000;
  const taken = PRESSURE / (1 + ARMOR_K * (u.armor + u.armorPlus)) * (1 - u.evade) * Math.max(0.2, u.dtm) * (u.roles.includes('taunt') ? 1 : 0.9);
  const net = taken + u.selfDps - u.selfHeal - u.heals;
  const hold = net <= 0 ? HOLD_CAP : Math.min(HOLD_CAP, u.hp / net);
  return { atk: round((u.eff + u.aoeDot * 2) * survive, 1), tank: round(PRESSURE * hold, 0), buff: round(buff, 3), debuff: round(u.debuff, 3), ccv: round(u.ccv, 3) };
}

export function analyzeCatalog(catalog, { overrides = null } = {}) {
  const species = Array.isArray(catalog?.species) ? catalog.species : [];
  const abilityById = new Map((catalog.abilities ?? []).map(a => [a.id, a]));
  const modifierById = new Map((catalog.modifiers ?? []).map(m => [m.id, m]));
  const names = new Map((catalog.display_names ?? []).map(d => [d.id, typeof d.value === 'string' ? d.value : '']));
  const levelOf = s => {
    const m = /level\s+(\d+)\s*$/i.exec((names.get(s.display_name_id) ?? '').replace(/\|c[0-9a-f]{8}|\|r/gi, '').trim());
    return m ? Number(m[1]) : null;
  };

  const link = new Map();
  const find = x => {
    let r = x;
    while (link.has(r) && link.get(r) !== r) r = link.get(r);
    return r;
  };
  for (const s of species) {
    for (const e of s.evolutions ?? []) {
      const a = find(s.id), b = find(e.stage_id);
      if (a !== b) link.set(a < b ? b : a, a < b ? a : b);
    }
  }
  const affinity = new Map();
  for (const p of catalog.wild?.pools ?? []) {
    for (const e of p.entries ?? []) if (!affinity.has(find(e.stage_id))) affinity.set(find(e.stage_id), p.affinity);
  }

  const out = new Map();
  for (const s of species) {
    if (typeof s?.id !== 'string') continue;
    const sv = skillValue(s, { abilityById, modifierById });
    const auras = teamAuras(s, abilityById, modifierById);
    const roles = new Set(sv.roles);
    if (auras.length) roles.add('aura');
    const heals = allyHeals(s, abilityById);
    if (heals > 0) roles.add('sustain');
    const level = levelOf(s) ?? 0;
    if (level >= 20 && ((s.armor ?? 0) >= 15 || (s.max_health ?? 0) / Math.max(1, sv.eff) >= 18)) roles.add('tank');
    out.set(s.id, {
      eff: sv.eff, pct: sv.pct, roles: [...roles].sort(), unsure: sv.uncertain, auras, heals,
      selfDps: sv.selfDps, selfSlow: sv.selfSlow, evade: sv.evade, armorPlus: sv.armorPlus, dtm: sv.dtm, debuff: sv.debuff,
      selfHeal: sv.selfHeal, aoeDot: sv.aoeDot, teamBuff: sv.teamBuff, ccv: sv.ccv,
      role: null, rv: null, lineRole: null,
      splash: !!(s.attack_splash || s.attack_bounce),
      evo: (s.evolutions ?? []).filter(e => typeof e?.stage_id === 'string' && Number.isFinite(e.cost) && e.cost >= 0).map(e => [e.stage_id, e.cost]),
      level, legendary: !!s.legendary, hp: s.max_health ?? 0, armor: s.armor ?? 0,
      traps: {}, unlocks: [], peak: null, power: 0, stageTier: null, path: [], kit: [],
      stats: {
        hp: s.max_health ?? 0, dps: round(((s.attack_damage ?? 0) * 32) / Math.max(1, s.attack_cooldown_ticks ?? 32), 1),
        a: s.attack_type ?? 'normal', at: s.armor_type ?? 'normal', ar: s.armor || undefined, ms: s.move_speed || undefined, rg: s.attack_range || undefined,
        lk: s.leak_free ? undefined : s.leak_lives || undefined, L: s.legendary ? 1 : undefined, k: s.catchable ? 1 : undefined,
        f: find(s.id), el: affinity.get(find(s.id)) ?? undefined,
      },
    });
  }

  const best = new Map();
  const ahead = (id, depth = 0) => {
    if (best.has(id)) return best.get(id);
    best.set(id, out.get(id).eff);
    const v = Math.max(out.get(id).eff, ...(depth < 50 ? out.get(id).evo.filter(([to]) => out.has(to)).map(([to]) => ahead(to, depth + 1)) : []));
    best.set(id, v);
    return v;
  };
  for (const u of out.values()) {
    for (const [to] of u.evo) {
      const next = out.get(to);
      if (next && next.eff < u.eff * 0.98) u.traps[to] = ahead(to) <= u.eff * 1.02 ? 'trap' : 'dip';
    }
  }

  const inPool = new Set();
  const roots = new Set((catalog.wild?.pools ?? []).flatMap(p => (p.entries ?? []).map(e => e.stage_id)).filter(id => out.has(id)));
  for (const s of species) if (s.catchable && out.has(s.id)) roots.add(s.id);
  const traded = (catalog.trade?.slots ?? []).flatMap(s => (s?.recipes ?? []).map(r => r?.offered_stage_id)).filter(id => out.has(id));
  const queue = [...roots, ...traded];
  while (queue.length) {
    const id = queue.pop();
    if (inPool.has(id)) continue;
    inPool.add(id);
    for (const [to] of out.get(id).evo) if (out.has(to)) queue.push(to);
  }
  const climb = (id, score = x => out.get(x).eff) => {
    const cost = new Map([[id, 0]]), list = [id];
    let peak = [id, 0];
    const unlocks = new Map();
    const prev = new Map();
    while (list.length) {
      const cur = list.shift();
      for (const [to, c0] of out.get(cur).evo) {
        const c = cost.get(cur) + c0;
        if (!out.has(to) || cost.get(to) <= c) continue;
        cost.set(to, c); list.push(to); prev.set(to, cur);
        const [pid, pc] = peak;
        if (score(to) > score(pid) || (score(to) === score(pid) && c < pc)) peak = [to, c];
        for (const r of out.get(to).roles) if (!out.get(id).roles.includes(r) && !(unlocks.get(r)?.[1] <= c)) unlocks.set(r, [to, c]);
      }
    }
    const path = [];
    for (let at = peak[0], n = 0; at !== undefined && n < 30; at = prev.get(at), n++) path.unshift(at);
    return { peak, unlocks, path };
  };
  for (const id of inPool) {
    const { peak, unlocks, path } = climb(id);
    const u = out.get(id);
    u.peak = [peak[0], peak[1], out.get(peak[0]).eff];
    u.path = path;
    u.unlocks = [...unlocks].map(([r, [to, c]]) => [r, to, c]);
  }
  for (const u of out.values()) u.rv = roleValues(u);
  const reachOf = id => {
    const seen = new Set([id]), list = [id];
    while (list.length) for (const [to] of out.get(list.pop()).evo) if (out.has(to) && !seen.has(to)) { seen.add(to); list.push(to); }
    return seen;
  };
  const topOf = (ids, key) => Math.max(0, ...[...ids].map(x => out.get(x).rv[key]));
  const families = new Map();
  for (const id of inPool) {
    const f = find(id);
    if (!families.has(f)) families.set(f, new Set());
    families.get(f).add(id);
  }
  const forced = new Map(Object.entries(overrides ?? {}).filter(([id, r]) => out.has(id) && ROLE_KEYS.includes(r)).map(([id, r]) => [find(id), r]));
  const lineRole = new Map();
  for (const [f, ids] of families) {
    const peakIds = new Set([...ids].map(id => out.get(id).peak?.[0]).filter(Boolean));
    const peakList = peakIds.size ? [...peakIds] : [...ids];
    const tanky = peakList.some(id => { const p = out.get(id); return p.armor >= 15 || p.hp / Math.max(1, p.eff + p.aoeDot * 2) >= 12; });
    const atkEq = topOf(ids, 'atk'), buff = topOf(ids, 'buff'), ccv = topOf(ids, 'ccv');
    lineRole.set(f, forced.get(f) ?? (buff >= BUFF_MIN && buff * TEAM_DPS >= atkEq ? 'buff' : ccv >= DEBUFF_MIN && ccv * TEAM_DPS >= atkEq ? 'debuff' : tanky ? 'tank' : 'atk'));
  }
  for (const id of inPool) {
    const u = out.get(id);
    const role = lineRole.get(find(id));
    const { peak, path } = climb(id, x => out.get(x).rv[role]);
    u.peak = [peak[0], peak[1], out.get(peak[0]).eff];
    u.path = path;
  }
  const lineScore = new Map();
  for (const id of inPool) {
    const u = out.get(id);
    u.lineRole = lineRole.get(find(id));
    lineScore.set(id, topOf(reachOf(id), u.lineRole));
  }
  const refs = Object.fromEntries(ROLE_KEYS.map(r => [r, p90([...roots].filter(id => out.get(id).lineRole === r).map(id => lineScore.get(id)))]));
  for (const id of inPool) {
    const u = out.get(id);
    u.power = round(Math.min(1, lineScore.get(id) / refs[u.lineRole]));
  }
  for (const id of inPool) {
    const u = out.get(id);
    const extra = new Set(u.path.flatMap(st => out.get(st)?.roles ?? []).map(r => KIT_OF_ROLE[r]).filter(Boolean));
    extra.delete(u.lineRole);
    u.kit = [u.lineRole, ...KIT_ORDER.filter(k => extra.has(k))];
    u.role = u.lineRole;
  }
  const bands = new Map();
  for (const id of inPool) {
    const u = out.get(id);
    if (u.legendary) continue;
    const key = `${u.lineRole}:${bandOf(u.level)}`;
    if (!bands.has(key)) bands.set(key, []);
    bands.get(key).push(u.rv[u.lineRole]);
  }
  const roleRef = Object.fromEntries(ROLE_KEYS.map(r => [r, p90([...inPool].filter(id => out.get(id).lineRole === r).map(id => out.get(id).rv[r]))]));
  for (const id of inPool) {
    const u = out.get(id);
    const list = bands.get(`${u.lineRole}:${bandOf(u.level)}`);
    const ref = list && list.length >= 5 ? p90(list) : roleRef[u.lineRole];
    u.stageTier = powerTier(Math.min(1, u.rv[u.lineRole] / (ref || 1)));
  }
  return out;
}

export function overlayFields(a) {
  return {
    ed: a.eff, r: a.roles.length ? a.roles : undefined, pk: a.peak ?? undefined, pw: a.peak ? a.power : undefined,
    ro: a.role ?? undefined, sd: a.selfDps > 0 ? a.selfDps : undefined,
    ul: a.unlocks.length ? a.unlocks : undefined, st: a.stageTier ?? undefined,
    pg: a.path?.length > 1 ? a.path : undefined, kt: a.kit?.length ? a.kit : undefined,
    tp: Object.keys(a.traps).length ? Object.fromEntries(Object.entries(a.traps).map(([to, k]) => [to, k === 'trap' ? 2 : 1])) : undefined,
  };
}
