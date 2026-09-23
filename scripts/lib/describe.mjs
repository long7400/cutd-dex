export const TICKS_PER_SECOND = 32;

const GLOSSARY = {
  Chaos: 'Hỗn mang', Hero: 'Anh hùng', Siege: 'Công thành', Magic: 'Phép', Pierce: 'Xuyên',
  Spells: 'Phép thuật', Small: 'Nhẹ', Large: 'Nặng', Divine: 'Thần thánh', None: 'Không giáp',
  Fortified: 'Công sự', Invulnerable: 'Bất tử (miễn sát thương)', Unit: 'Đơn mục tiêu', Circle: 'Vùng tròn',
  ally: 'đồng minh', 'most progress': 'địch đi xa nhất', closest: 'gần nhất', random: 'ngẫu nhiên',
  Foot: 'Mặt đất', Hover: 'Lơ lửng', Instant: 'Tức thì', Projectile: 'Đạn bay', Delayed: 'Trễ',
};

const TRIGGER = {
  aura: 'Aura', periodic: 'Periodic', on_attack: 'On attack', on_attacked: 'When attacked', on_cast: 'Activated',
  on_cooldown: 'Automatic', on_damaged: 'When damaged', on_death: 'On death', on_enter_range: 'When a unit enters range',
  on_hit: 'On hit', on_kill: 'On kill', on_wave_start: 'At wave start',
};
const REF = {
  attacker: 'the attacker', caster: 'the caster', dying_unit: 'the dying unit', entering_unit: 'the entering unit',
  enum_unit: 'each unit', filter_unit: 'the matching unit', killing_unit: 'the killer', last_summoned: 'the summoned unit',
  selected: 'the target', sold_unit: 'the sold unit', spell_target: 'the spell target', trigger_unit: 'the triggering unit',
};
const BASIS = {
  attack_damage: 'triggering attack damage', current_health: 'current HP', max_health: 'maximum HP',
  point_value: 'unit value', point_value_difference: 'unit value difference',
};

export function createDescriber(catalog, i18n = {}) {
  const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
  const names = new Map(catalog.display_names.map(d => [d.id, d.value]));
  const abilities = new Map(catalog.abilities.map(a => [a.id, a]));
  const modifiers = new Map(catalog.modifiers.map(m => [m.id, m]));
  const species = new Map(catalog.species.map(s => [s.id, s]));

  const has = k => Object.prototype.hasOwnProperty.call(i18n, k);
  const u = (tpl, ...args) => (has(tpl) ? i18n[tpl] : tpl).replace(/\{(\d+)\}/g, (m, n) => String(args[+n] ?? m));
  const d = k => (k == null ? '' : has(k) ? i18n[k] : GLOSSARY[k] ?? k);
  const M = n => (Number.isFinite(n) ? nf.format(n) : '—');
  const P = n => `${M(n * 100)}%`;
  const clean = s => String(s ?? '').replace(/\|c[0-9a-f]{8}/gi, '').replace(/\|r/gi, '').replace(/\|n/gi, ' ').trim();
  const title = e => d(String(e).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()));
  const secs = ticks => `${M(ticks / TICKS_PER_SECOND)}s`;
  const nameOf = id => clean(names.get(species.get(id)?.display_name_id) ?? names.get(id) ?? id);

  function magnitude(m) {
    if (!m) return '0';
    const p = [];
    if (m.base) p.push(M(m.base));
    if (m.per_wave) p.push(u('{0} × wave index', M(m.per_wave)));
    if (m.random_min || m.random_max) p.push(`${M(m.random_min ?? 0)}–${M(m.random_max ?? 0)}`);
    if (m.basis) {
      const k = m.percent ? `${M(m.percent)}%` : `${M(m.multiplier ?? 0)} ×`;
      const of = m.of && m.basis !== 'attack_damage' ? u(' of {0}', d(REF[m.of])) : '';
      p.push(`${k} ${d(BASIS[m.basis])}${of}`);
    }
    if (m.per_attack_power) p.push(u('{0} × attack power', M(m.per_attack_power)));
    if (m.per_target_current_health) p.push(u('{0} of target current HP', P(m.per_target_current_health)));
    if (m.per_target_max_health) p.push(u('{0} of target maximum HP', P(m.per_target_max_health)));
    if (m.per_caster_max_health) p.push(u('{0} of caster maximum HP', P(m.per_caster_max_health)));
    let s = p.join(' + ') || '0';
    if (m.minus) s += ` − ${M(m.minus)}`;
    return m.falloff ? u('{0}; {1} less per successive target', s, P(m.falloff)) : s;
  }

  function condition(c) {
    switch (c.kind) {
      case 'chance': return u('{0} chance{1}', P(c.chance ?? 0), c.wave_divisor ? u(' + 1% per {0} waves', c.wave_divisor) : '');
      case 'not_legendary': return u('excludes Legendary targets');
      case 'target_health_below': return u('target below {0} HP', P(c.threshold ?? 0));
      case 'target_is_boss': return u('boss targets only');
      case 'caster_has_ability': return u('requires the caster’s matching ability');
      case 'caster_has_modifier': return u('while the caster has the required effect');
      case 'target_has_modifier': return u('while the target has the required effect');
      case 'point_value': return u('unit value {0} {1}', c.comparison === 'at_most' ? '≤' : c.comparison === 'greater_than' ? '>' : '≥', M(c.threshold ?? 0));
      case 'unit_type_not': return u('excludes the specified unit type');
      default: return c.kind;
    }
  }

  function modifier(m, depth = 0) {
    const out = [];
    for (const [v, label] of [
      [m.move_speed_multiplier, 'move speed'], [m.attack_speed_multiplier, 'attack speed'],
      [m.attack_damage_multiplier, 'attack damage'], [m.damage_taken_multiplier, 'damage taken'],
    ]) if (v !== undefined && v !== 1) out.push(`${v >= 1 ? '+' : '−'}${P(Math.abs(v - 1))} ${u(label)}`);
    for (const [v, label] of [[m.armor_delta, 'Armor'], [m.max_health_delta, 'max HP']]) {
      if (v) out.push(`${v > 0 ? '+' : '−'}${M(Math.abs(v))} ${u(label)}`);
    }
    if (m.flat_damage_reduction) out.push(u('{0} damage blocked', M(m.flat_damage_reduction)));
    if (m.evade_chance) out.push(u('{0} evasion', P(m.evade_chance)));
    if (m.miss_chance) out.push(u('{0} miss chance', P(m.miss_chance)));
    if (m.health_regen_per_tick) out.push(u('{0} HP/s', M(m.health_regen_per_tick * TICKS_PER_SECOND)));
    out.push(...(m.flags ?? []).map(title));
    if (m.until_wave_end) out.push(u('until wave end'));
    else if (m.duration_ticks > 0) out.push(u('for {0}', secs(m.duration_ticks)));
    if (m.stacking === 'stack_with_max') out.push(u('up to {0} stacks', m.max_stacks ?? 1));
    if (m.tick_effects?.length) {
      out.push(u('periodic effect every {0}', secs(m.tick_interval_ticks ?? 0))
        + (depth < 2 ? `: ${m.tick_effects.map(e => effect(e, depth + 1)).join('; ')}` : ''));
    }
    if (depth < 2) for (const p of m.procs ?? []) {
      out.push(`${d(TRIGGER[p.trigger?.kind]) || p.trigger?.kind}: ${(p.effects ?? []).map(e => effect(e, depth + 1)).join('; ')}`);
    }
    return out.join(' · ') || u('Status effect');
  }

  function targeting(t) {
    if (!t) return '';
    if (t.kind === 'self') return u('Self');
    const filters = (t.filters?.length ? t.filters : [t.filter]).filter(Boolean)
      .map(f => (f === 'enemy_creep' ? u('enemy creeps') : d(f))).join(', ');
    return [
      t.kind === 'all_in_base' ? u('All in base') : title(t.kind), filters,
      t.max_targets ? u('up to {0} targets', t.max_targets) : '',
      t.range ? u('{0} range', M(t.range)) : '',
      t.radius ? u('{0} radius', M(t.radius)) : '',
      t.chain_radius ? u('{0} bounce range', M(t.chain_radius)) : '',
      t.pick ? u('prioritizes {0}', d(t.pick.replace(/_/g, ' '))) : '',
    ].filter(Boolean).join(' · ');
  }

  function effect(e, depth = 0) {
    const mag = magnitude(e.magnitude);
    const to = e.target ? u(' to {0}', d(REF[e.target])) : '';
    let o;
    switch (e.kind) {
      case 'damage': o = u('Deal {0} damage{1}', mag, to); break;
      case 'health_loss': o = u('Remove {0} HP directly{1}', mag, to); break;
      case 'heal': o = u('Restore {0} HP{1}', mag, to); break;
      case 'set_health': o = u('Set HP to {0}{1}', mag, to); break;
      case 'apply_modifier': {
        const m = e.modifier_id ? modifiers.get(e.modifier_id) : undefined;
        o = m ? modifier(m, depth) : u('Apply a status effect');
        break;
      }
      case 'remove_modifier': o = u('Remove the specified status effect'); break;
      case 'modify_resource': o = u('Change {0} by {1}', e.resource === 'lumber' ? u('Crystal') : u('Gold'), mag); break;
      case 'summon': {
        const who = e.species_id ? nameOf(e.species_id) : null;
        o = e.summon_role === 'effect_carrier'
          ? u('Create an area effect')
          : u('Summon {0} {1}', e.count ?? 1, who ?? (e.species_from ? u('copy of the source unit') : 'unit'));
        if (e.duration_ticks) o += u(' for {0}', secs(e.duration_ticks));
        if (depth < 3) for (const p of e.payloads ?? []) o += `: ${p.effects.map(x => effect(x, depth + 1)).join('; ')}`;
        break;
      }
      case 'spawn_projectile': o = u('Launch a projectile'); break;
      case 'displace': o = e.destination ? u('Move to the nearest base arena') : u('Displace {0} units', M(e.distance ?? 0)); break;
      case 'force_attack_target': o = u('Force the affected unit to change its attack target'); break;
      case 'transform': o = u('Transform into {0}', e.species_id ? nameOf(e.species_id) : u('another form')); break;
      case 'destroy': o = u('Remove the affected unit'); break;
      case 'destroy_self': o = u('Remove the caster'); break;
      default: o = e.kind;
    }
    const conds = (e.conditions ?? []).map(condition);
    return conds.length ? `${conds.join(', ')}: ${o}` : o;
  }

  const MAG_KEYS = ['base', 'per_wave', 'random_min', 'random_max', 'multiplier', 'percent', 'per_attack_power',
    'per_target_current_health', 'per_target_max_health', 'per_caster_max_health'];
  const zeroMagnitude = m => !m || MAG_KEYS.every(k => !m[k]);
  const inertModifier = m => m
    && ['move_speed_multiplier', 'attack_speed_multiplier', 'attack_damage_multiplier', 'damage_taken_multiplier'].every(k => m[k] === undefined || m[k] === 1)
    && !m.armor_delta && !m.max_health_delta && !m.flat_damage_reduction && !m.evade_chance && !m.miss_chance
    && !m.health_regen_per_tick && !m.flags?.length && !m.tick_effects?.length && !m.procs?.length;
  const isNoise = e => (['damage', 'heal', 'health_loss'].includes(e.kind) && zeroMagnitude(e.magnitude))
    || (e.kind === 'apply_modifier' && inertModifier(modifiers.get(e.modifier_id)));

  function ability(id) {
    const a = abilities.get(id);
    const name = clean(names.get(a?.display_name_id) ?? 'Ability');
    if (!a) return { name, summary: u('No details available'), targeting: '', effects: [], available: false };
    if (a.status === 'not_ported') return { name, summary: u('Unavailable in this ruleset'), targeting: '', effects: [], available: false, reason: a.not_ported_reason ?? '' };
    if (a.status === 'system') return { name, summary: u('Managed through the match controls'), targeting: '', effects: [], available: false };
    const kinds = a.trigger?.kinds?.length ? a.trigger.kinds : [a.trigger?.kind];
    const live = (a.effects ?? []).filter(e => !isNoise(e));
    return {
      inert: (a.effects?.length ?? 0) > 0 && !live.length,
      name,
      trigger: kinds.filter(Boolean),
      summary: [
        ...kinds.map(k => d(TRIGGER[k]) || k),
        a.autocast ? u('Autocast') : '',
        a.trigger?.interval_ticks ? u('every {0}', secs(a.trigger.interval_ticks)) : '',
        ...(a.conditions ?? []).map(condition),
        a.delivery?.delay_ticks ? u('{0} delay', secs(a.delivery.delay_ticks)) : '',
      ].filter(Boolean).join(' · '),
      targeting: targeting(a.targeting),
      cd: a.cooldown_ticks ? a.cooldown_ticks / TICKS_PER_SECOND : undefined,
      effects: live.map(e => ({ k: e.kind, t: effect(e) })),
      available: true,
    };
  }

  function visibleAbilities(sp) {
    const seen = new Set();
    return (sp.abilities ?? []).filter(id => {
      const a = abilities.get(id);
      if (!a || a.status === 'system') return false;
      const key = a.shared_execution_id || id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  return { u, d, M, P, title, secs, clean, nameOf, ability, modifier, visibleAbilities };
}
