import { skillValue } from './skillvalue.js';

const MID_GOLD = 1500;
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function teamAuras(s, abilityById, modifierById) {
  return (s.abilities ?? []).flatMap(id => {
    const a = abilityById.get(id);
    if (a?.status !== 'executable' || a?.trigger?.kind !== 'aura' || a.targeting?.kind !== 'all_in_base' || a.targeting?.filter !== 'ally') return [];
    let dmg = 1, spd = 1;
    for (const e of a.effects ?? []) {
      const m = e.kind === 'apply_modifier' ? modifierById.get(e.modifier_id) : null;
      if (!m) continue;
      dmg = Math.max(dmg, m.attack_damage_multiplier ?? 1);
      spd = Math.max(spd, m.attack_speed_multiplier ?? 1);
    }
    return dmg > 1 || spd > 1 ? [[id.split('_')[1], round(dmg, 3), round(spd, 3)]] : [];
  });
}

export function analyzeCatalog(catalog) {
  const species = Array.isArray(catalog?.species) ? catalog.species : [];
  const abilityById = new Map((catalog.abilities ?? []).map(a => [a.id, a]));
  const modifierById = new Map((catalog.modifiers ?? []).map(m => [m.id, m]));
  const names = new Map((catalog.display_names ?? []).map(d => [d.id, typeof d.value === 'string' ? d.value : '']));
  const levelOf = s => {
    const m = /level\s+(\d+)\s*$/i.exec((names.get(s.display_name_id) ?? '').replace(/\|c[0-9a-f]{8}|\|r/gi, '').trim());
    return m ? Number(m[1]) : null;
  };

  const parent = new Map();
  const find = x => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r);
    return r;
  };
  for (const s of species) {
    for (const e of s.evolutions ?? []) {
      const a = find(s.id), b = find(e.stage_id);
      if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
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
    const level = levelOf(s) ?? 0;
    if (level >= 20 && ((s.armor ?? 0) >= 15 || (s.max_health ?? 0) / Math.max(1, sv.eff) >= 18)) roles.add('tank');
    out.set(s.id, {
      eff: sv.eff, pct: sv.pct, roles: [...roles].sort(), unsure: sv.uncertain, auras,
      splash: !!(s.attack_splash || s.attack_bounce),
      evo: (s.evolutions ?? []).filter(e => typeof e?.stage_id === 'string' && Number.isFinite(e.cost) && e.cost >= 0).map(e => [e.stage_id, e.cost]),
      traps: {}, unlocks: [], mid: 0, strategic: 0,
      stats: {
        hp: s.max_health ?? 0, dps: round(((s.attack_damage ?? 0) * 32) / Math.max(1, s.attack_cooldown_ticks ?? 32), 1),
        a: s.attack_type ?? 'normal', at: s.armor_type ?? 'normal', ar: s.armor || undefined, ms: s.move_speed || undefined,
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
  const queue = (catalog.wild?.pools ?? []).flatMap(p => (p.entries ?? []).map(e => e.stage_id)).filter(id => out.has(id));
  for (const s of species) if (s.catchable && out.has(s.id)) queue.push(s.id);
  while (queue.length) {
    const id = queue.pop();
    if (inPool.has(id)) continue;
    inPool.add(id);
    for (const [to] of out.get(id).evo) if (out.has(to)) queue.push(to);
  }
  const midOf = id => {
    const cost = new Map([[id, 0]]), list = [id];
    let top = out.get(id).eff;
    const unlocks = new Map();
    while (list.length) {
      const cur = list.shift();
      for (const [to, c0] of out.get(cur).evo) {
        const c = cost.get(cur) + c0;
        if (!out.has(to) || c > MID_GOLD || cost.get(to) <= c) continue;
        cost.set(to, c); list.push(to); top = Math.max(top, out.get(to).eff);
        for (const r of out.get(to).roles) if (!out.get(id).roles.includes(r) && !(unlocks.get(r)?.[1] <= c)) unlocks.set(r, [to, c]);
      }
    }
    return { top, unlocks };
  };
  const mids = [...inPool].map(id => [id, midOf(id)]);
  const ref = mids.map(([, v]) => v.top).sort((a, b) => a - b)[Math.floor(mids.length * 0.95)] || 1;
  for (const [id, { top, unlocks }] of mids) {
    const u = out.get(id);
    const roles = new Set([...u.roles, ...unlocks.keys()]);
    const roleBonus = (roles.has('aura') ? 0.35 : 0) + Math.min(0.2, 0.1 * [...roles].filter(r => ['cc', 'sustain', 'taunt', 'boss'].includes(r)).length);
    u.mid = Math.round(top);
    u.strategic = round(Math.min(1, top / ref + roleBonus));
    u.unlocks = [...unlocks].map(([r, [to, c]]) => [r, to, c]);
  }
  return out;
}

export function overlayFields(a) {
  return {
    ed: a.eff, pt: a.pct || undefined, r: a.roles.length ? a.roles : undefined, sv: a.strategic || undefined, md: a.mid || undefined,
    ul: a.unlocks.length ? a.unlocks : undefined, au: a.auras.length ? a.auras : undefined, sp: a.splash ? 1 : undefined,
    tp: Object.keys(a.traps).length ? Object.fromEntries(Object.entries(a.traps).map(([to, k]) => [to, k === 'trap' ? 2 : 1])) : undefined,
  };
}
