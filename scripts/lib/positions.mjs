export const POSITION_RULES_VERSION = 1;
export const T = {
  MELEE_MAX: 170,
  SHORT_MAX: 300,
  ARMOR_K: 0.06,
  TANK_RATIO: 12,          // enter FRONT (line role tank): EHP/atk >= 12 (~2x the game's default 6.25 hp-per-dps)
  TANK_RATIO_OTHER: 15,
  STAY_RATIO: 9,
  TANK_FLOOR: 1.0,
  STAY_FLOOR: 0.6,
  LEVEL_WINDOW: 10,
  ARMOR_TANK: 15,
  SELF_WAVE_SEC: 75,
  BUFF_MIN: 0.05,
  HEAL_TOUCH: 100,
  LEVEL_BANDS: [2, 20, 40, 70, Infinity],
};

export const CLASS_ROW = {
  FRONT_TAUNT: 0, FRONT_TANK: 0,
  MELEE: 1, MELEE_SELFHARM: 1, RANGED_SHORT: 1, HEALER_NEAR: 1,
  RANGED: 2,
  SUPPORT_BACK: 3,
};
export const ACCEPT = {
  FRONT_TAUNT: [0], FRONT_TANK: [0],
  HEALER_NEAR: [1, 0],
  MELEE: [1], MELEE_SELFHARM: [1], RANGED_SHORT: [1],
  RANGED: [2, 3],
  SUPPORT_BACK: [3, 2],
};
export const CLASS_PRIO = { FRONT_TAUNT: 0, FRONT_TANK: 1, HEALER_NEAR: 0, MELEE: 1, RANGED_SHORT: 2, MELEE_SELFHARM: 3, RANGED: 0, SUPPORT_BACK: 0 };


export const POSITION_CLASSES = Object.keys(CLASS_ROW);

export function buildPositions({ catalog, units, pets }) {
  const U = units;
  const sp = new Map(catalog.species.map(s => [s.id, s]));
  const ab = new Map(catalog.abilities.map(a => [a.id, a]));
  const md = new Map(catalog.modifiers.map(m => [m.id, m]));
  const nameOfAb = new Map(catalog.display_names.map(d => [d.id, String(d.value).replace(/\|c[0-9a-f]{8}|\|r/gi, '')]));
  function features(id) {
    const s = sp.get(id);
    const f = {
      selfTaunt: [], decoyTaunt: [], allyHealTouch: 0, allyHealAoe: 0, allyBuffOnAttack: 0, teamAura: [], teamAuraNeg: [],
      evade: 0, flatDR: 0, retaliate: [], pbAoe: [], fieldAoe: [], deathBlast: 0, summon: 0, execute: 0,
      selfHitAbility: [], allyHealRange: null,
    };
    for (const aid of s.abilities ?? []) {
      const a = ab.get(aid);
      if (!a || a.status !== 'executable') continue;
      const nm = nameOfAb.get(a.display_name_id) ?? aid;
      const trig = a.trigger?.kind;
      const tg = a.targeting ?? {};
      for (const e of a.effects ?? []) {
        const et = e.targeting;
        const mod = e.modifier_id ? md.get(e.modifier_id) : null;
        if (e.kind === 'force_attack_target') {
          if (e.target === 'last_summoned') f.decoyTaunt.push(nm);
          else f.selfTaunt.push(`${nm}${et?.radius ? `(r${et.radius})` : '(1)'}`);
        }
        if (e.kind === 'heal' && ((tg.filter === 'ally' && tg.kind === 'unit') || et?.filter === 'ally')) {
          const r = tg.kind === 'unit' && tg.filter === 'ally' ? (tg.range ?? 0) : (et?.radius ?? 0);
          if (tg.kind === 'unit' && tg.filter === 'ally' && r <= T.HEAL_TOUCH) f.allyHealTouch = Math.max(f.allyHealTouch, (e.magnitude?.base ?? 0) * 32 / Math.max(1, a.cooldown_ticks ?? a.trigger?.cooldown_ticks ?? 32));
          else if (trig === 'on_attack' || trig === 'on_hit') f.allyHealAoe = Math.max(f.allyHealAoe, r);
          f.allyHealRange = f.allyHealRange == null ? r : Math.min(f.allyHealRange, r);
        }
        if (e.kind === 'apply_modifier' && mod && et?.filter === 'ally' && et?.kind === 'circle' && (trig === 'on_attack' || trig === 'on_hit')) f.allyBuffOnAttack = Math.max(f.allyBuffOnAttack, et.radius ?? 0);
        if (trig === 'aura' && tg.kind === 'all_in_base' && mod) {
          const pos = (mod.attack_damage_multiplier ?? 1) > 1 || (mod.attack_speed_multiplier ?? 1) > 1 || (mod.armor_delta ?? 0) > 0 || (mod.damage_taken_multiplier ?? 1) < 1 || (mod.evade_chance ?? 0) > 0;
          const neg = (mod.attack_damage_multiplier ?? 1) < 1 || (mod.attack_speed_multiplier ?? 1) < 1 || (mod.armor_delta ?? 0) < 0 || (mod.move_speed_multiplier ?? 1) < 1;
          if (pos && !f.teamAura.includes(nm)) f.teamAura.push(nm);
          if (neg && !f.teamAuraNeg.includes(nm)) f.teamAuraNeg.push(nm);
        }
        if (trig === 'aura' && tg.kind === 'self' && mod?.evade_chance) f.evade = Math.max(f.evade, mod.evade_chance);
        if (trig === 'on_damaged' && tg.kind === 'self' && mod?.flat_damage_reduction) {
          const ch = (a.conditions ?? []).filter(c => c.kind === 'chance').reduce((p, c) => p * c.chance, 1);
          f.flatDR = Math.max(f.flatDR, ch * mod.flat_damage_reduction);
        }
        if ((trig === 'on_attacked' || trig === 'on_damaged') && !f.retaliate.includes(nm)) f.retaliate.push(nm);
        if (e.kind === 'damage' && et?.kind === 'circle' && et.center === 'attacker' && et.filter === 'enemy_creep') f.pbAoe.push(`${nm}(r${et.radius})`);
        if (e.kind === 'damage' && trig === 'on_death' && et?.center === 'dying_unit') f.deathBlast = Math.max(f.deathBlast, et.radius ?? 0);
        if (trig === 'periodic' && tg.kind === 'circle' && tg.filter === 'enemy_creep') f.fieldAoe.push(`${nm}(r${tg.radius})`);
        if (trig === 'periodic' && tg.kind === 'unit' && tg.radius) f.pbAoe.push(`${nm}(r${tg.radius})`);
        if (trig === 'on_cooldown' && tg.radius) f.fieldAoe.push(`${nm}(r${tg.radius})`);
        if (e.kind === 'summon') f.summon++;
        if (e.kind === 'destroy') f.execute++;
        if ((e.kind === 'damage' || e.kind === 'health_loss') && (e.target === 'attacker') && (trig === 'on_attack' || trig === 'on_hit')) f.selfHitAbility.push(nm);
      }
    }
    for (const k of ['selfTaunt', 'decoyTaunt', 'retaliate', 'pbAoe', 'fieldAoe', 'selfHitAbility']) f[k] = [...new Set(f[k])];
    return f;
  }


  const pool = Object.values(U).filter(u => u.role && sp.has(u.id));
  const petStage = new Map();
  for (const p of pets) for (const s of p.stages) petStage.set(s, p);
  const rows = pool.map(u => {
    const s = sp.get(u.id);
    const f = features(u.id);
    const armor = s.armor ?? 0;
    const hp = s.max_health ?? u.hp;
    const ehp = Math.round(hp * (1 + T.ARMOR_K * armor) / Math.max(0.1, 1 - f.evade));
    const atk = Math.max(u.eff ?? 0, u.dps ?? 0, u.rv?.atk ?? 0);
    const selfDps = u.selfDps ?? 0;
    return {
      id: u.id, name: u.name, level: u.level ?? 1, legendary: !!s.legendary, range: s.attack_range ?? 0, hp, armor, evade: f.evade, ehp,
      atk: Math.round(atk * 10) / 10, ratio: Math.round(ehp / Math.max(1, atk) * 10) / 10, selfDps, selfDeath: selfDps > 0 ? Math.round(hp / selfDps) : null,
      lineRole: u.role, buff: u.rv?.buff ?? 0, f, evo: (u.evo ?? []).map(e => e.to),
    };
  });
  const byId = new Map(rows.map(r => [r.id, r]));
  const MODE = 'role', SMOOTH = true;

  const med = list => { const a = [...list].sort((x, y) => x - y); return a[Math.floor(a.length / 2)] ?? 1; };
  const lvMedCache = new Map();
  const levelMed = lv => { if (!lvMedCache.has(lv)) lvMedCache.set(lv, med(rows.filter(r => !r.legendary && Math.abs(r.level - lv) <= T.LEVEL_WINDOW).map(r => r.ehp))); return lvMedCache.get(lv); };

  function classify(r, parentCls) {
    const melee = r.range <= T.MELEE_MAX, short = !melee && r.range <= T.SHORT_MAX;
    const lm = levelMed(r.level);
    const selfFragile = r.selfDeath != null && r.selfDeath < T.SELF_WAVE_SEC;
    const wasFront = parentCls === 'FRONT_TANK' || parentCls === 'FRONT_TAUNT';
    const enterRatio = MODE === 'uniform' || r.lineRole === 'tank' ? T.TANK_RATIO : T.TANK_RATIO_OTHER;
    const enter = r.ehp >= lm * T.TANK_FLOOR && (r.ratio >= enterRatio || r.armor >= T.ARMOR_TANK);
    const stay = wasFront && (r.armor >= T.ARMOR_TANK || (r.ratio >= T.STAY_RATIO && r.ehp >= lm * T.STAY_FLOOR));
    if (r.f.selfTaunt.length) return ['FRONT_TAUNT', 'R1 self-taunt ' + r.f.selfTaunt.join('+')];
    if (r.f.teamAura.length && r.buff >= T.BUFF_MIN) return ['SUPPORT_BACK', `R2 team aura ${r.f.teamAura.join('+')} buff=${r.buff}`];
    if (r.f.allyHealTouch > 0) return ['HEALER_NEAR', `R3 ally heal range<=${T.HEAL_TOUCH} (${Math.round(r.f.allyHealTouch)} hp/s)` + (selfFragile ? `, self-harm dies in ${r.selfDeath}s` : '')];
    if (selfFragile) return [melee || short ? 'MELEE_SELFHARM' : 'RANGED', `R4 self-harm ${r.selfDps}/s -> dies in ${r.selfDeath}s < ${T.SELF_WAVE_SEC}s`];
    if (enter || stay) return ['FRONT_TANK', `R5 ${enter ? 'enter' : 'stay'} ehp=${r.ehp} ratio=${r.ratio} armor=${r.armor}${r.evade ? ` evade=${r.evade}` : ''} lvMedian=${lm}`];
    if (melee) return ['MELEE', `R6 range ${r.range} <= ${T.MELEE_MAX}`];
    if (short) return ['RANGED_SHORT', `R6 range ${r.range} (250..300) shoots from row 1`];
    return ['RANGED', `R6 range ${r.range} > ${T.SHORT_MAX}`];
  }

  const parentOf = new Map();
  for (const r of rows) for (const to of r.evo) parentOf.set(to, r.id);
  const done = new Set();
  const visit = r => {
    if (done.has(r.id)) return;
    const p = parentOf.get(r.id) && byId.get(parentOf.get(r.id));
    if (p) visit(p);
    const [cls, why] = classify(r, p?.cls);
    r.cls = cls; r.why = why; done.add(r.id);
  };
  rows.forEach(visit);
  const STAT = new Set(['FRONT_TANK', 'MELEE', 'RANGED_SHORT', 'RANGED']);
  const statFor = (row, r) => row === 0 ? 'FRONT_TANK' : row === 2 ? 'RANGED' : r.range <= T.MELEE_MAX ? 'MELEE' : 'RANGED_SHORT';
  const kids = r => r.evo.map(id => byId.get(id)).filter(Boolean);
  if (SMOOTH) {
    const orig = new Map(rows.map(r => [r.id, r.cls]));
    const smooth = (r, target, why) => {
      const cls = statFor(target, r);
      r.why = `S smoothed ${r.cls}->${cls} (${why}); was: ${r.why}`;
      r.cls = cls;
    };
    for (const r of rows) {
      const p = parentOf.get(r.id) && byId.get(parentOf.get(r.id));
      const ch = kids(r);
      if (!p || !ch.length || !STAT.has(orig.get(r.id)) || !ch.every(c => STAT.has(orig.get(c.id)))) continue;
      const target = CLASS_ROW[orig.get(p.id)];
      if (CLASS_ROW[orig.get(r.id)] !== target && ch.every(c => CLASS_ROW[orig.get(c.id)] === target)) smooth(r, target, `single-stage blip between parent ${p.id} and children on row ${target}`);
    }
    for (const r of rows) {
      if (parentOf.has(r.id)) continue;
      const ch = kids(r);
      if (!ch.length || !STAT.has(r.cls) || !ch.every(c => STAT.has(c.cls))) continue;
      const target = CLASS_ROW[ch[0].cls];
      if (CLASS_ROW[r.cls] !== target && ch.every(c => CLASS_ROW[c.cls] === target)) smooth(r, target, `root adopts the row of its children (${target})`);
    }
  }

  const transitions = [];
  for (const r of rows) {
    r.row = CLASS_ROW[r.cls];
    for (const to of r.evo) {
      const n = byId.get(to);
      if (n && n.cls && (n.cls !== r.cls)) transitions.push({ from: r.id, to, fromCls: r.cls, toCls: n.cls, move: !ACCEPT[n.cls].includes(ACCEPT[r.cls][0]), name: `${r.name} Lv${r.level} → ${n.name} Lv${n.level}` });
    }
  }
  return { rows, transitions };
}
