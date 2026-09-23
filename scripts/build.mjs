// data/*.json (dữ liệu thô từ game) → src/data/db.json (DB chuẩn hoá cho wiki).
// Chạy: node scripts/build.mjs
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readJSON, writeJSON } from './lib/fsx.mjs';
import { createResolver } from './lib/game.mjs';
import { createDescriber, TICKS_PER_SECOND } from './lib/describe.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
export const PATHS = {
  catalog: join(ROOT, 'data/catalog.json'),
  client: join(ROOT, 'data/client.json'),
  changelog: join(ROOT, 'data/changelog.json'),
  db: join(ROOT, 'src/data/db.json'),
};

const ELEMENT_ORDER = ['normal', 'fire', 'water', 'grass', 'lightning', 'psychic', 'fighter'];
const MODE_NAME = {
  mode_duel: 'Đối kháng', mode_fast_duel: 'Đối kháng nhanh', mode_survival: 'Sinh tồn',
  mode_survival_easy: 'Sinh tồn · Dễ', mode_survival_hard: 'Sinh tồn · Khó', mode_survival_old: 'Sinh tồn · Cổ điển',
};
const SPEED_NAME = { speed_slow: 'Chậm', speed_average: 'Trung bình', speed_fast: 'Nhanh', speed_super_fast: 'Siêu nhanh' };
const RESEARCH_KIND = { armor: 'Giáp', move_speed: 'Tốc độ di chuyển', max_health: 'Máu tối đa', attack_speed: 'Tốc độ đánh' };

export const slugify = s => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const round = (n, d = 2) => Math.round(n * 10 ** d) / 10 ** d;
const shortId = id => id.replace(/^unit_/, '');

export function build({ raw, client, changelog = [] }) {
  const catalog = raw.catalog;
  const R = createResolver(catalog, client);
  const D = createDescriber(catalog, client.i18n);
  const names = new Map(catalog.display_names.map(d => [d.id, d.value]));
  const spById = new Map(catalog.species.map(s => [s.id, s]));

  const splitName = id => {
    const full = D.clean(names.get(spById.get(id)?.display_name_id) ?? id);
    const m = full.match(/^(.*?)\s+level\s+(\d+)$/i);
    return m ? { name: m[1], level: +m[2] } : { name: full, level: null };
  };

  // Cạnh ngược (from) của đồ thị tiến hóa — một stage có thể có nhiều nguồn.
  const fromOf = new Map();
  for (const s of catalog.species) for (const e of s.evolutions ?? []) {
    if (!fromOf.has(e.stage_id)) fromOf.set(e.stage_id, []);
    fromOf.get(e.stage_id).push(s.id);
  }

  // Tag nguồn gốc cho từng unit.
  const tags = new Map();
  const tag = (id, t) => { if (!tags.has(id)) tags.set(id, new Set()); tags.get(id).add(t); };

  // Cây tiến hóa bắt đầu từ mỗi pet bắt được: BFS 1 lần, O(V+E).
  const pets = [];
  const petOfStage = new Map();
  const usedSlugs = new Set();
  for (const s of catalog.species.filter(x => x.catchable)) {
    const { name } = splitName(s.id);
    let slug = slugify(name) || shortId(s.id);
    while (usedSlugs.has(slug)) slug += `-${shortId(s.id)}`;
    usedSlugs.add(slug);

    const order = [];
    const seen = new Set([s.id]);
    const queue = [s.id];
    while (queue.length) {
      const id = queue.shift();
      order.push(id);
      if (!petOfStage.has(id)) petOfStage.set(id, s.id);
      tag(id, 'pet');
      for (const e of spById.get(id)?.evolutions ?? []) {
        if (!seen.has(e.stage_id)) { seen.add(e.stage_id); queue.push(e.stage_id); }
      }
    }
    pets.push({ id: s.id, slug, name, stages: order, branching: order.some(id => (spById.get(id)?.evolutions?.length ?? 0) > 1) });
  }

  // Waves: chuẩn, duel bổ sung, và từng mode sinh tồn.
  const waveList = (list, setId) => list.map(w => {
    let count = 0, hp = 0, lives = 0;
    const groups = w.groups.map(g => {
      const sp = spById.get(g.stage_id);
      tag(g.stage_id, 'wave');
      count += g.count;
      hp += (sp?.max_health ?? 0) * g.count;
      lives += (sp?.leak_free ? 0 : sp?.leak_lives ?? 0) * g.count;
      return { unit: g.stage_id, count: g.count, start: g.start_tick, interval: g.interval_ticks };
    });
    return { set: setId, n: w.number, gold: w.gold_reward, lumber: w.lumber_reward, groups, count, hp, lives };
  });
  const waveSets = [
    { id: 'standard', name: 'Đợt chuẩn', note: 'Danh sách đợt mặc định (catalog.waves)', waves: waveList(catalog.waves ?? [], 'standard') },
    { id: 'duel', name: 'Đối kháng · bổ sung', note: 'Quái bổ sung trong chế độ Đối kháng (catalog.duel_waves)', waves: waveList(catalog.duel_waves ?? [], 'duel') },
    ...(catalog.modes ?? []).filter(m => m.survival?.waves?.length).map(m => ({
      id: m.id, name: MODE_NAME[m.id] ?? m.id, note: `Kịch bản đợt của chế độ ${MODE_NAME[m.id] ?? m.id}`,
      waves: waveList(m.survival.waves, m.id),
    })),
  ];
  const roster = (catalog.survival_roster ?? []).map((entries, i) => ({
    n: i, entries: entries.map(e => { tag(e.stage_id, 'wave'); return { unit: e.stage_id, weight: e.weight }; }),
  }));

  // Trade.
  const trade = (catalog.trade?.slots ?? []).map(slot => ({
    slot: slot.slot,
    recipes: slot.recipes.map(r => {
      tag(r.required_stage_id, 'trade-give');
      tag(r.offered_stage_id, 'trade');
      return { give: r.required_stage_id, get: r.offered_stage_id };
    }),
  }));

  // Wild pools.
  const pools = (catalog.wild?.pools ?? []).map((p, index) => {
    const total = p.entries.reduce((s, e) => s + e.weight, 0);
    return {
      index, element: p.affinity, total,
      entries: p.entries.map(e => { tag(e.stage_id, 'wild'); return { unit: e.stage_id, weight: e.weight }; }),
    };
  });
  const poolOf = new Map();
  for (const p of pools) for (const e of p.entries) if (!poolOf.has(e.unit)) poolOf.set(e.unit, { index: p.index, weight: e.weight, total: p.total });

  // Summon targets.
  for (const a of catalog.abilities) for (const e of a.effects ?? []) if (e.kind === 'summon' && e.species_id) tag(e.species_id, 'summon');

  // Abilities: chỉ những skill hiển thị của species (bỏ system, gộp shared).
  const abilities = {};
  const units = {};
  for (const s of catalog.species) {
    const { name, level } = splitName(s.id);
    const skills = D.visibleAbilities(s);
    for (const id of skills) abilities[id] ??= D.ability(id);
    const dice = s.attack_damage_dice ?? 0, sides = s.attack_damage_sides ?? 0, base = s.attack_damage_base ?? 0;
    units[s.id] = {
      id: s.id,
      name, level,
      model: R.modelOf(s.id),
      el: R.elementOf(s.id),
      family: R.rootOf(s.id),
      pet: petOfStage.get(s.id) ?? null,
      tags: [...(tags.get(s.id) ?? [])].sort(),
      catchable: !!s.catchable,
      legendary: !!s.legendary,
      catch: s.catch_chance ?? 0,
      book: s.book_value ?? 0,
      hp: s.max_health,
      regen: round((s.health_regen_per_tick ?? 0) * TICKS_PER_SECOND),
      dmg: s.attack_damage,
      dmgMin: dice && sides ? base + dice : s.attack_damage,
      dmgMax: dice && sides ? base + dice * sides : s.attack_damage,
      range: s.attack_range,
      cd: s.attack_cooldown_ticks,
      aps: round(TICKS_PER_SECOND / s.attack_cooldown_ticks),
      dps: round((s.attack_damage * TICKS_PER_SECOND) / s.attack_cooldown_ticks, 1),
      atk: s.attack_type ?? 'normal',
      delivery: s.attack_delivery ?? 'instant',
      projSpeed: s.attack_projectile_speed ?? null,
      groundOnly: !!s.attack_ground_only,
      splash: s.attack_splash ?? null,
      bounce: s.attack_bounce ?? null,
      armor: s.armor ?? 0,
      armorType: s.armor_type ?? 'normal',
      move: s.move_speed,
      movement: s.movement_type ?? 'foot',
      acquire: s.acquire_range ?? null,
      killGold: s.kill_gold ?? 0,
      leak: s.leak_free ? 0 : s.leak_lives ?? 0,
      skills,
      research: s.research_ids ?? [],
      evo: (s.evolutions ?? []).map(e => ({ to: e.stage_id, cost: e.cost })),
      from: fromOf.get(s.id) ?? [],
      pool: poolOf.get(s.id) ?? null,
      notes: s.notes ?? [],
    };
  }

  // Bỏ field mang giá trị mặc định (null/false/[]/0 ở field tuỳ chọn) — client tự điền mặc định.
  const OPTIONAL_ZERO = new Set(['regen', 'armor', 'catch', 'killGold', 'leak', 'book']);
  const compact = u => {
    for (const [k, v] of Object.entries(u)) {
      if (v === null || v === false || (Array.isArray(v) && !v.length) || (v === 0 && OPTIONAL_ZERO.has(k))) delete u[k];
    }
    if (u.dmgMin === u.dmg && u.dmgMax === u.dmg) { delete u.dmgMin; delete u.dmgMax; }
    return u;
  };

  // Tổng kết cho card pet (sort key tiền tính: không phải duyệt cây lúc render).
  for (const p of pets) {
    const stages = p.stages.map(id => units[id]);
    const finals = stages.filter(u => !u.evo.length);
    const best = finals.reduce((a, b) => (b.dps > a.dps ? b : a), finals[0] ?? stages[stages.length - 1]);
    const root = units[p.id];
    Object.assign(p, {
      el: root.el, legendary: root.legendary, catch: root.catch, book: root.book, model: root.model,
      dpsMax: Math.max(...stages.map(u => u.dps)), hpMax: Math.max(...stages.map(u => u.hp)),
      finalId: best.id, depth: Math.max(...stages.map(u => R.depthOf(u.id) - R.depthOf(p.id))) + 1,
    });
  }

  const research = (catalog.research ?? []).map(r => {
    const en = D.clean(names.get(r.display_name_id) ?? r.id);
    const el = ELEMENT_ORDER.find(e => en.toLowerCase().startsWith(e)) ?? null;
    const perLevel = ['max_health', 'attack_speed', 'armor'].includes(r.kind) && r.magnitude < 1 ? D.P(r.magnitude) : D.M(r.magnitude);
    const affected = catalog.species.filter(s => s.research_ids?.includes(r.id)).map(s => s.id);
    return {
      id: r.id, en, el, kind: r.kind, kindVn: RESEARCH_KIND[r.kind] ?? r.kind,
      levels: r.levels, magnitude: r.magnitude, perLevel: `+${perLevel}`,
      costs: Array.from({ length: r.levels }, (_, i) => r.lumber_base + r.lumber_increment * i),
      pets: [...new Set(affected.map(id => petOfStage.get(id)).filter(Boolean))],
      units: affected.length,
      notes: r.notes ?? [],
    };
  });

  const secs = t => round(t / TICKS_PER_SECOND);
  const rules = catalog.rules ?? {};
  const game = {
    rules: {
      initialGold: rules.initial_gold, initialLumber: rules.initial_lumber, initialLives: rules.initial_lives,
      livesOptions: rules.lives_options, maxPlayers: rules.max_players, legendaryCap: rules.legendary_cap,
      creatureCap: rules.creature_cap, wildCap: rules.wild_cap, openingWild: rules.opening_wild_count,
      interest: rules.interest_rate, lateInterest: rules.late_interest_rate, waveGoldMultiplier: rules.wave_gold_multiplier,
      sellGold: rules.sell_gold_fraction, sellLumber: rules.sell_lumber_fraction, tradeEnabled: rules.trade_enabled,
      firstPlanningSec: secs(rules.first_planning_ticks ?? 0), planningSec: secs(rules.planning_ticks ?? 0),
      waveLimitSec: secs(rules.wave_time_limit_ticks ?? 0), creepAcquireRange: rules.creep_acquire_range,
      maxMoveSpeed: rules.max_move_speed, attackSpeedRange: [rules.min_attack_speed_multiplier, rules.max_attack_speed_multiplier],
      timeoutCostsLives: rules.timeout_costs_lives, inWaveOrders: rules.in_wave_orders,
      notes: rules.notes ?? [],
    },
    modes: (catalog.modes ?? []).map(m => ({
      id: m.id, name: MODE_NAME[m.id] ?? m.id, gold: m.initial_gold, lumber: m.initial_lumber,
      interest: m.interest_rate, lives: m.initial_lives ?? rules.initial_lives, waveLimitSec: secs(m.wave_time_limit_ticks ?? 0),
      source: m.wave_source, openingWild: m.opening_wild_count, duelFrom: m.duel_supplement_from_wave ?? null,
      flatGoldThrough: m.duel_flat_gold_through_wave ?? null, bountyThrough: m.survival?.bounty_through_wave ?? null,
      waves: m.survival?.waves?.length ?? null, isDefault: m.id === rules.default_mode_id,
    })),
    speeds: (catalog.speed_options ?? []).map(s => ({
      id: s.id, name: SPEED_NAME[s.id] ?? s.id, firstSec: secs(s.first_planning_ticks), planSec: secs(s.planning_ticks),
      tradeBonusSec: secs(s.trade_planning_bonus_ticks ?? 0), isDefault: s.id === rules.default_speed_option_id,
    })),
    incomes: (catalog.income_options ?? []).map(o => ({
      id: o.id, mode: o.economy_mode, multiplier: o.wave_gold_multiplier ?? null, isDefault: o.id === rules.default_income_option_id,
    })),
  };

  const bonuses = catalog.damage?.bonuses ?? [];
  const attackTypes = [...new Set(bonuses.map(b => b.attack_type))];
  const armorTypes = [...new Set(bonuses.map(b => b.armor_type))];
  const damage = {
    armorCoefficient: catalog.damage?.armor_coefficient ?? 0.06,
    attackTypes, armorTypes,
    table: Object.fromEntries(attackTypes.map(a => [a, Object.fromEntries(
      bonuses.filter(b => b.attack_type === a).map(b => [b.armor_type, b.multiplier]),
    )])),
  };

  const labels = {};
  for (const t of new Set([...attackTypes, ...armorTypes, ...Object.values(units).flatMap(u => [u.atk, u.armorType, u.movement, u.delivery])])) {
    labels[t] = D.title(t);
  }
  for (const e of ELEMENT_ORDER) labels[e] = D.title(e);

  const colors = client.elementColors ?? {};
  const elements = Object.fromEntries(ELEMENT_ORDER.filter(e => colors[e]).map(e => [e, {
    name: D.title(e), light: colors[e][0], mid: colors[e][1], dark: colors[e][2],
  }]));

  for (const u of Object.values(units)) compact(u);

  return {
    meta: {
      catalogHash: raw.catalog_hash, ruleset: raw.ruleset_version, protocol: raw.protocol_version,
      builtAt: new Date().toISOString(), tickRate: TICKS_PER_SECOND,
      counts: { units: catalog.species.length, pets: pets.length, abilities: Object.keys(abilities).length },
    },
    elements, labels, pets, units, abilities, trade, pools, waveSets, roster, research, game, damage,
    changelog: changelog.slice(0, 60),
  };
}

async function main() {
  const raw = readJSON(PATHS.catalog);
  const client = readJSON(PATHS.client);
  if (!raw || !client) {
    console.error('Thiếu data/catalog.json hoặc data/client.json → chạy `npm run sync` trước.');
    process.exit(1);
  }
  const t0 = performance.now();
  const db = build({ raw, client, changelog: readJSON(PATHS.changelog, []) });
  writeJSON(PATHS.db, db);
  const m = db.meta.counts;
  console.log(`db.json: ${m.pets} pet · ${m.units} unit · ${m.abilities} skill · ${db.waveSets.reduce((s, w) => s + w.waves.length, 0)} đợt · ${db.research.length} research — ${(performance.now() - t0).toFixed(0)}ms`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
