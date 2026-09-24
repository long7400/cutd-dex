const TICKS_PER_SECOND = 32;
const CONDITIONAL = new Set(['caster_has_modifier', 'caster_has_ability', 'point_value', 'target_health_below', 'target_is_boss', 'target_has_modifier']);

export const ROLE_NAMES = {
  aura: 'Hào quang đội', tank: 'Chống chịu', cc: 'Khống chế', sustain: 'Hồi máu', evade: 'Né tránh', taunt: 'Khiêu khích',
  aoe: 'Sát thương lan', boss: 'Diệt boss', summon: 'Triệu hồi', execute: 'Xoá sổ quái', thorns: 'Phản sát thương', shred: 'Phá giáp',
  selfharm: 'Tự gây hại',
};

const chanceOf = a => (a.conditions ?? []).filter(c => c.kind === 'chance').reduce((p, c) => p * (c.chance ?? 1), 1);
const conditional = a => (a.conditions ?? []).some(c => CONDITIONAL.has(c.kind));

export function skillValue(species, { abilityById, modifierById }) {
  const aps = TICKS_PER_SECOND / Math.max(1, species.attack_cooldown_ticks ?? TICKS_PER_SECOND);
  const hp = species.max_health ?? 0;
  const base = species.attack_damage ?? 0;
  const roles = new Set();
  const uncertain = [];
  let ccv = 0, mult = 0, flat = 0, pct = 0, speed = 0, selfDmg = 0, selfHeal = 0, selfSlow = 0, evade = 0, armorPlus = 0, dtm = 1, debuff = 0, dot = 0, aoeDot = 0, teamBuff = 0;
  const regen = (species.health_regen_per_tick ?? 0) * TICKS_PER_SECOND;
  const dotOf = mod => (mod?.tick_effects ?? []).filter(t => t.kind === 'damage').reduce((v, t) => v + (t.magnitude?.base ?? 0), 0) * TICKS_PER_SECOND / Math.max(1, mod?.tick_interval_ticks ?? 1);

  for (const id of species.abilities ?? []) {
    const a = abilityById.get(id);
    if (!a || a.status !== 'executable') continue;
    const trig = a.trigger?.kind;
    if ((a.effects ?? []).some(e => e.kind === 'destroy')) { roles.add('execute'); uncertain.push(a.id); continue; }
    const chance = chanceOf(a);
    const cond = conditional(a);
    const hitting = trig === 'on_hit' || trig === 'on_attack';
    const perSec = hitting ? chance * aps : 0;
    for (const e of a.effects ?? []) {
      const m = e.magnitude ?? {};
      const aim = e.targeting ?? a.targeting;
      const onSelf = !e.target && aim?.kind === 'self';
      const toSelf = onSelf || (e.target === 'attacker' && hitting);
      const toEnemy = !toSelf && ((e.target === 'trigger_unit' && hitting) || (e.target === 'attacker' && (trig === 'on_attacked' || trig === 'on_damaged'))
        || (!e.target && aim?.filter === 'enemy_creep'));
      const mod = e.kind === 'apply_modifier' ? modifierById.get(e.modifier_id) : null;
      if (e.kind === 'damage' && toSelf) {
        const amount = m.basis === 'attack_damage' ? (m.multiplier ?? 0) * base : m.basis === 'max_health' ? ((m.percent ?? 0) / 100) * hp : (m.base ?? 0);
        if (amount > 0 && perSec) selfDmg += perSec * amount;
      } else if (e.kind === 'damage') {
        if (m.basis === 'point_value_difference' || cond) { roles.add('boss'); continue; }
        if (e.targeting?.kind === 'circle' || e.targeting?.kind === 'chain') roles.add('aoe');
        if (trig === 'on_death') { roles.add('aoe'); continue; }
        if (trig === 'on_attacked' || trig === 'on_damaged') { roles.add('thorns'); continue; }
        if (!hitting) continue;
        if (m.basis === 'attack_damage') mult += chance * (m.multiplier ?? 0);
        else if (m.basis === 'max_health' && m.of === 'attacker') flat += chance * ((m.percent ?? 0) / 100) * hp;
        else if (m.basis === 'max_health' || m.basis === 'current_health') { pct += chance * ((m.percent ?? 0) / 100) * aps; roles.add('boss'); }
        else if (m.base > 0) flat += chance * m.base;
      } else if (e.kind === 'set_health' || e.kind === 'health_loss') roles.add('boss');
      else if (e.kind === 'heal') {
        roles.add('sustain');
        if (toSelf && perSec) selfHeal += perSec * (m.basis === 'attack_damage' ? (m.multiplier ?? 0) * base : (m.base ?? 0));
      } else if (e.kind === 'summon') { roles.add(e.species_id === species.id || !e.species_id ? 'sustain' : 'summon'); }
      else if (e.kind === 'force_attack_target') roles.add('taunt');
      else if (mod) {
        const asm = mod.attack_speed_multiplier ?? 1, msm = mod.move_speed_multiplier ?? 1;
        const buff = asm > 1 || (mod.attack_damage_multiplier ?? 1) > 1 || (mod.evade_chance ?? 0) > 0 || (mod.armor_delta ?? 0) > 0
          || (mod.damage_taken_multiplier ?? 1) < 1 || (mod.flat_damage_reduction ?? 0) > 0;
        const harm = msm < 1 || asm < 1 || (mod.miss_chance ?? 0) > 0 || (mod.armor_delta ?? 0) < 0 || (mod.damage_taken_multiplier ?? 1) > 1;
        const secs = (mod.duration_ticks ?? 0) / TICKS_PER_SECOND;
        const tick = dotOf(mod);
        const every = (a.trigger?.interval_ticks ?? 0) / TICKS_PER_SECOND;
        const up = trig === 'aura' ? 1 : trig === 'periodic' ? (every > 0 ? Math.min(1, secs / every) : 1) : Math.min(1, (perSec || chance * 0.5) * secs);
        if (tick > 0 && toSelf) selfDmg += tick * up;
        else if (tick > 0 && toEnemy && !cond) {
          dot += tick * up;
          debuff += (tick * up) / 1000;
          if (aim?.kind === 'circle' || aim?.kind === 'all_in_base') { aoeDot += tick * up; roles.add('aoe'); }
          roles.add('dot');
        }
        if (buff && cond) { uncertain.push(a.id); continue; }
        if (trig === 'aura' && aim?.kind === 'all_in_base') continue;
        if (toSelf && harm) {
          selfSlow = Math.max(selfSlow, Math.min(1, (perSec || chance) * secs) * (1 - Math.min(1, asm)));
          continue;
        }
        if (onSelf && buff && !hitting) {
          evade = Math.max(evade, mod.evade_chance ?? 0);
          armorPlus += Math.max(0, mod.armor_delta ?? 0);
          dtm = Math.min(dtm, mod.damage_taken_multiplier ?? 1);
        }
        if ((mod.evade_chance ?? 0) > 0) roles.add('evade');
        if ((mod.armor_delta ?? 0) > 0 || (mod.damage_taken_multiplier ?? 1) < 1 || (mod.flat_damage_reduction ?? 0) > 0) roles.add('tank');
        if (buff && hitting && !onSelf && e.target !== 'attacker' && aim?.filter === 'ally') {
          teamBuff += (Math.min(1, chance * aps * secs) / 8) * (Math.max(0, asm - 1) + Math.max(0, (mod.attack_damage_multiplier ?? 1) - 1));
          roles.add('aura');
        } else if (buff && asm > 1 && hitting) {
          speed = Math.max(speed, (asm - 1) * Math.min(1, chance * aps * secs));
        }
        if (harm && toEnemy && !cond) {
          ccv += up * ((1 - Math.min(1, asm)) + 0.5 * (1 - Math.min(1, msm)) + 0.06 * Math.max(0, -(mod.armor_delta ?? 0)) + (mod.miss_chance ?? 0) + Math.max(0, (mod.damage_taken_multiplier ?? 1) - 1));
          debuff += up * ((1 - Math.min(1, asm)) + 0.5 * (1 - Math.min(1, msm)) + 0.06 * Math.max(0, -(mod.armor_delta ?? 0)) + (mod.miss_chance ?? 0) + Math.max(0, (mod.damage_taken_multiplier ?? 1) - 1));
          roles.add((mod.armor_delta ?? 0) < 0 ? 'shred' : 'cc');
        }
      }
    }
  }
  const dps = base * aps;
  const eff = (dps * (1 + mult) * (1 + speed) + flat * aps * (1 + speed)) * (1 - Math.min(0.9, selfSlow)) + dot;
  const selfDps = Math.max(0, selfDmg - selfHeal - regen);
  if (selfDps > hp * 0.002 || selfSlow >= 0.02) roles.add('selfharm');
  const r1 = v => Math.round(v * 10) / 10;
  return {
    eff: r1(eff), pct: Math.round(pct * 1e5) / 1e5, roles: [...roles].sort(), uncertain,
    selfDps: r1(selfDps), selfSlow: Math.round(selfSlow * 1000) / 1000, evade, armorPlus, dtm, debuff: Math.round(debuff * 1000) / 1000,
    selfHeal: r1(selfHeal + regen), aoeDot: r1(aoeDot), teamBuff: Math.round(teamBuff * 1000) / 1000, ccv: Math.round(ccv * 1000) / 1000,
  };
}

export function interpretAbility(a, modifierById) {
  if (!a) return ['missing'];
  if (a.status !== 'executable') return ['inert'];
  const trig = a.trigger?.kind;
  const hitting = trig === 'on_hit' || trig === 'on_attack';
  const tags = new Set();
  for (const e of a.effects ?? []) {
    const aim = e.targeting ?? a.targeting;
    const toSelf = (!e.target && aim?.kind === 'self') || (e.target === 'attacker' && hitting) || (e.target === 'killing_unit');
    const toEnemy = !toSelf && ((e.target === 'trigger_unit' && hitting) || (e.target === 'attacker' && (trig === 'on_attacked' || trig === 'on_damaged'))
      || (!e.target && aim?.filter === 'enemy_creep') || (e.target === 'enum_unit' && aim?.filter === 'enemy_creep'));
    const who = toSelf ? 'self' : toEnemy ? 'enemy' : aim?.kind === 'all_in_base' ? 'team' : 'ally';
    const mod = e.kind === 'apply_modifier' ? modifierById.get(e.modifier_id) : null;
    if (e.kind === 'damage' || e.kind === 'health_loss' || e.kind === 'set_health') tags.add(`${who}_damage`);
    else if (e.kind === 'heal') tags.add(`${who}_heal`);
    else if (e.kind === 'force_attack_target') tags.add('taunt');
    else if (e.kind === 'summon') tags.add('summon');
    else if (e.kind === 'destroy') tags.add('execute');
    else if (mod) {
      const asm = mod.attack_speed_multiplier ?? 1, msm = mod.move_speed_multiplier ?? 1, adm = mod.attack_damage_multiplier ?? 1;
      const up = asm > 1 || adm > 1 || (mod.evade_chance ?? 0) > 0 || (mod.armor_delta ?? 0) > 0 || (mod.damage_taken_multiplier ?? 1) < 1 || (mod.flat_damage_reduction ?? 0) > 0;
      const down = asm < 1 || msm < 1 || (mod.miss_chance ?? 0) > 0 || (mod.armor_delta ?? 0) < 0 || (mod.damage_taken_multiplier ?? 1) > 1;
      if ((mod.tick_effects ?? []).some(t => t.kind === 'damage')) tags.add(`${who}_dot`);
      if (up) tags.add(`${who}_buff`);
      if (down) tags.add(`${who}_debuff`);
      if (!up && !down && !(mod.tick_effects ?? []).length) tags.add('inert_modifier');
    }
  }
  if ((a.conditions ?? []).some(c => CONDITIONAL.has(c.kind))) tags.add('conditional');
  return [...tags].sort();
}
