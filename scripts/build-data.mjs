import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const raw = JSON.parse(readFileSync(join(dir, 'catalog.json'), 'utf8'));
const catalog = raw.catalog;
const u2m = JSON.parse(readFileSync(join(dir, 'unit2model.json'), 'utf8'));
const modelAffinity = JSON.parse(readFileSync(join(dir, 'model_affinity.json'), 'utf8'));
const elementColors = JSON.parse(readFileSync(join(dir, 'element_colors.json'), 'utf8'));

const spById = new Map(catalog.species.map(s => [s.id, s]));
const abById = new Map(catalog.abilities.map(a => [a.id, a]));
const modById = new Map(catalog.modifiers.map(m => [m.id, m]));
const nameById = new Map(catalog.display_names.map(d => [d.id, d.value]));

const TICK = 1 / 32; // giây / tick

const EL_VN = {
  normal: 'Thường', fire: 'Lửa', water: 'Nước', grass: 'Cỏ',
  lightning: 'Điện', psychic: 'Siêu', fighter: 'Đấu',
};
const TRIGGER_VN = {
  on_hit: 'khi đánh trúng', on_attack: 'khi tấn công', on_cast: 'kích hoạt',
  on_death: 'khi bị tiêu diệt', on_attacked: 'khi bị đánh', on_damaged: 'khi nhận sát thương',
  aura: 'hào quang (aura)', periodic: 'theo chu kỳ', on_kill: 'khi tiêu diệt địch',
  on_cooldown: 'hết cooldown',
};
const BASIS_VN = {
  attack_damage: 'sát thương tấn công', max_health: 'máu tối đa',
  current_health: 'máu hiện tại', missing_health: 'máu đã mất', base_damage: 'sát thương gốc',
};
const ATK_VN = {
  normal: 'Thường', pierce: 'Xuyên', siege: 'Công thành', magic: 'Phép',
  chaos: 'Hỗn mang', hero: 'Anh hùng',
};

const fmtMag = m => {
  if (!m || typeof m !== 'object') return '';
  const p = [];
  if (m.base) p.push(String(m.base));
  if (m.basis) p.push(`${Math.round((m.multiplier ?? 1) * 100)}% ${BASIS_VN[m.basis] ?? m.basis}`);
  return p.join(' + ');
};

const fmtModifier = id => {
  const m = modById.get(id);
  if (!m) return null;
  const parts = [];
  const mult = [
    ['move_speed_multiplier', 'tốc chạy'],
    ['attack_speed_multiplier', 'tốc đánh'],
    ['attack_damage_multiplier', 'sát thương'],
    ['damage_taken_multiplier', 'dmg nhận vào'],
  ];
  for (const [k, vn] of mult) {
    if (m[k] !== undefined && m[k] !== 1) {
      const pct = Math.round((m[k] - 1) * 100);
      parts.push(`${vn} ${pct >= 0 ? '+' : ''}${pct}%`);
    }
  }
  if (m.flags?.includes('invulnerable')) parts.push('miễn nhiễm sát thương');
  const dur = m.duration_ticks > 0 ? ` trong ${(m.duration_ticks * TICK).toFixed(2)}s (${m.duration_ticks} tick)` : ' vĩnh viễn';
  return parts.length ? `Áp sửa trạng thái: ${parts.join(', ')}${dur}` : `Áp trạng thái${dur}`;
};

const fmtEffect = e => {
  const mag = fmtMag(e.magnitude);
  switch (e.kind) {
    case 'damage':
      return `Gây sát thương ${mag}${e.attack_type ? ` (kiểu ${ATK_VN[e.attack_type] ?? e.attack_type})` : ''}`;
    case 'heal':
      return `Hồi máu ${mag || '—'}`;
    case 'health_loss':
      return `Tự mất máu ${mag || '—'}`;
    case 'apply_modifier': {
      const d = fmtModifier(e.modifier_id);
      return d ?? 'Áp trạng thái';
    }
    case 'summon': {
      const bits = [`Triệu hồi ${e.count ?? 1} đơn vị`];
      if (e.species_id) {
        const sp = spById.get(e.species_id);
        if (sp) bits.push(nameById.get(sp.display_name_id) ?? e.species_id);
      } else if (e.species_from) bits.push(`(${e.species_from})`);
      if (e.duration_ticks) bits.push(`trong ${(e.duration_ticks * TICK).toFixed(1)}s`);
      return bits.join(' ');
    }
    case 'force_attack_target':
      return 'Buộc địch phải tấn công pet này (Taunt)';
    case 'destroy':
      return `Tiêu diệt mục tiêu ngay lập tức ${mag}`;
    case 'displace':
      return 'Đẩy dời vị trí mục tiêu';
    case 'set_health':
      return `Đặt lại máu về ${mag || '—'}`;
    default:
      return e.kind + (mag ? ` ${mag}` : '');
  }
};

const imgOf = sid => u2m[sid] ? `${u2m[sid]}.png` : null;
const elOf = sid => modelAffinity[u2m[sid]] ?? 'normal';

const slugify = s => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

const skillsOf = sp => (sp.abilities ?? []).filter(aid => abById.has(aid)).map(aid => {
  const a = abById.get(aid);
  const effects = (a.effects ?? []).map(e => ({ raw: e, text: fmtEffect(e) }));
  return {
    id: aid,
    name: nameById.get(a.display_name_id) ?? aid,
    trigger: a.trigger?.kind ?? '',
    triggerVn: TRIGGER_VN[a.trigger?.kind] ?? a.trigger?.kind ?? '',
    cooldownTicks: a.cooldown_ticks ?? null,
    targeting: t(a),
    delivery: a.delivery?.kind ?? '',
    status: a.status ?? 'executable',
    desc: effects.map(e => e.text).join('; '),
    effects,
  };
  function t(x) {
    const tt = x.targeting ?? {};
    return tt.kind ? `${tt.kind}${tt.filter ? ` · ${tt.filter}` : ''}${tt.pick ? ` · ${tt.pick}` : ''}` : '';
  }
});

const stageOf = (sp, evolveCost) => {
  const rawName = nameById.get(sp.display_name_id) ?? sp.id;
  const lvlMatch = rawName.match(/level (\d+)/);
  return {
    id: sp.id,
    name: rawName.replace(/ level \d+/, ''),
    level: lvlMatch ? +lvlMatch[1] : null,
    image: imgOf(sp.id),
    hp: sp.max_health,
    dmg: sp.attack_damage,
    range: sp.attack_range,
    armor: sp.armor ?? 0,
    attackType: ATK_VN[sp.attack_type] ?? sp.attack_type,
    cooldownTicks: sp.attack_cooldown_ticks,
    aps: +(32 / sp.attack_cooldown_ticks).toFixed(2),
    dps: +((sp.attack_damage * 32) / sp.attack_cooldown_ticks).toFixed(1),
    moveSpeed: sp.move_speed,
    regen: sp.health_regen_per_tick || 0,
    evolveCost: evolveCost ?? null,
    skills: skillsOf(sp),
  };
};

const nextStage = new Map(); // adjacency list của rừng
for (const s of catalog.species) {
  if (s.evolutions?.length) nextStage.set(s.id, s.evolutions[0].stage_id);
}

const petByStage = new Map(); // stageId → root catchable pet (điền trong BFS)

const chainOf = root => {
  const chain = [];
  let cur = root, cost = null;
  const visited = new Set();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    petByStage.set(cur.id, root);
    chain.push(stageOf(cur, cost));
    const nxt = nextStage.get(cur.id);
    if (!nxt) break;
    cost = (spById.get(cur.id)?.evolutions?.[0]?.cost) ?? null;
    cur = spById.get(nxt);
  }
  return chain;
};

const pools = catalog.wild.pools.map((p, i) => {
  const total = p.entries.reduce((s, e) => s + e.weight, 0);
  return {
    index: i,
    affinity: p.affinity,
    affinityVn: EL_VN[p.affinity] ?? p.affinity,
    totalWeight: total,
    entries: p.entries.map(e => {
      const sp = spById.get(e.stage_id);
      return {
        stageId: e.stage_id,
        name: sp ? (nameById.get(sp.display_name_id) ?? e.stage_id).replace(/ level \d+/, '') : e.stage_id,
        image: imgOf(e.stage_id),
        weight: e.weight,
        chance: +(e.weight / total * 100).toFixed(1),
        catch: sp?.catch_chance ?? 0,
        legendary: !!sp?.legendary,
        petId: sp?.catchable ? sp.id : null,
      };
    }),
  };
});

const poolByStage = new Map();
pools.forEach(p => p.entries.forEach(e => poolByStage.set(e.stageId, { pool: p, weight: e.weight })));

const pets = catalog.species.filter(s => s.catchable).map(s => {
  const chain = chainOf(s);
  const poolInfo = poolByStage.get(s.id) ?? null;
  const rawName = nameById.get(s.display_name_id) ?? s.id;
  const final = chain[chain.length - 1];
  const tokens = new Set([norm(rawName), ...chain.map(st => norm(st.name))]);
  for (const st of chain) for (const k of st.skills) tokens.add(norm(k.name));
  return {
    id: s.id,
    slug: slugify(rawName.replace(/ level \d+/, '')),
    name: rawName.replace(/ level \d+/, ''),
    element: elOf(s.id),
    elementVn: EL_VN[elOf(s.id)] ?? elOf(s.id),
    legendary: !!s.legendary,
    catch: s.catch_chance,
    book: s.book_value,
    killGold: s.kill_gold,
    image: imgOf(s.id),
    pool: poolInfo ? { index: poolInfo.pool.index, affinity: poolInfo.pool.affinity, affinityVn: poolInfo.pool.affinityVn, weight: poolInfo.weight, totalWeight: poolInfo.pool.totalWeight, chance: poolInfo.weight / poolInfo.pool.totalWeight } : null,
    dpsMax: final.dps,
    hpMax: final.hp,
    stages: chain.length,
    searchTokens: [...tokens].filter(Boolean),
    chain,
  };
});

const tradeSummary = sid => {
  const sp = spById.get(sid);
  if (!sp) return null;
  const rawName = nameById.get(sp.display_name_id) ?? sid;
  const lvl = rawName.match(/level (\d+)/);
  const root = petByStage.get(sid);
  return {
    stageId: sid,
    name: rawName.replace(/ level \d+/, ''),
    level: lvl ? +lvl[1] : null,
    image: imgOf(sid),
    hp: sp.max_health, dmg: sp.attack_damage, range: sp.attack_range,
    armor: sp.armor ?? 0, dps: +((sp.attack_damage * 32) / sp.attack_cooldown_ticks).toFixed(1),
    element: elOf(sid),
    elementVn: EL_VN[elOf(sid)] ?? elOf(sid),
    skills: skillsOf(sp),
    rootPet: root ? { id: root.id, slug: slugify((nameById.get(root.display_name_id) ?? root.id).replace(/ level \d+/, '')), name: (nameById.get(root.display_name_id) ?? root.id).replace(/ level \d+/, '') } : null,
    catchable: !!sp.catchable,
  };
};

const trade = catalog.trade.slots.map(slot => ({
  slot: slot.slot,
  recipes: slot.recipes.map(r => ({
    required: tradeSummary(r.required_stage_id),
    offered: tradeSummary(r.offered_stage_id),
  })),
}));

const data = {
  builtAt: new Date().toISOString(),
  tickRate: 32,
  catalogHash: raw.catalog_hash,
  rulesetVersion: raw.ruleset_version,
  protocolVersion: raw.protocol_version,
  elements: Object.fromEntries(Object.entries(elementColors).map(([k, v]) => [
    k, { vn: EL_VN[k] ?? k, light: v[0], mid: v[1], dark: v[2] },
  ])),
  pets, trade, pools,
};

writeFileSync(join(dir, '../src/data.json'), JSON.stringify(data));
console.log(`pets: ${pets.length} | trade slots: ${trade.length} | pools: ${pools.length}`);
console.log(`total stages: ${pets.reduce((s, p) => s + p.chain.length, 0)} (1-pass BFS)`);
