// Build src/data.json từ catalog gốc của game (m.cutd.site/catalog)
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const dir = dirname(fileURLToPath(import.meta.url));
const catalog = JSON.parse(readFileSync(join(dir, 'catalog.json'), 'utf8')).catalog;
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

// ---- skills của 1 stage ----
const skillsOf = sp => (sp.abilities ?? []).filter(aid => abById.has(aid)).map(aid => {
  const a = abById.get(aid);
  const effects = (a.effects ?? []).map(e => ({ raw: e, text: fmtEffect(e) }));
  const t = a.targeting ?? {};
  const desc = effects.map(e => e.text).join('; ');
  return {
    id: aid,
    name: nameById.get(a.display_name_id) ?? aid,
    trigger: a.trigger?.kind ?? '',
    triggerVn: TRIGGER_VN[a.trigger?.kind] ?? a.trigger?.kind ?? '',
    cooldownTicks: a.cooldown_ticks ?? null,
    targeting: t.kind ? `${t.kind}${t.filter ? ` · ${t.filter}` : ''}${t.pick ? ` · ${t.pick}` : ''}` : '',
    delivery: a.delivery?.kind ?? '',
    status: a.status ?? 'executable',
    notPortedReason: a.not_ported_reason ?? null,
    desc,
    effects,
  };
});

// ---- stage info ----
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

// ---- chuỗi tiến hóa ----
const chainOf = root => {
  const chain = [];
  let cur = root, seen = new Set(), cost = null;
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    chain.push(stageOf(cur, cost));
    const evos = cur.evolutions ?? [];
    if (!evos.length) break;
    cost = evos[0].cost ?? null;
    cur = spById.get(evos[0].stage_id);
  }
  return chain;
};

// ---- wild pools ----
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

// map root catchable -> pool
const poolByStage = new Map();
pools.forEach(p => p.entries.forEach(e => poolByStage.set(e.stageId, { pool: p, weight: e.weight, chance: e.chance })));

// ---- pets ----
const pets = catalog.species.filter(s => s.catchable).map(s => {
  const chain = chainOf(s);
  const poolInfo = poolByStage.get(s.id) ?? null;
  const rawName = nameById.get(s.display_name_id) ?? s.id;
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
    chain,
  };
});
const petByStage = new Map(); // stage id -> root pet
pets.forEach(p => p.chain.forEach(st => petByStage.set(st.id, p)));

// ---- trade ----
const tradeSummary = sid => {
  const sp = spById.get(sid);
  if (!sp) return null;
  const rawName = nameById.get(sp.display_name_id) ?? sid;
  const lvl = rawName.match(/level (\d+)/);
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
    rootPet: petByStage.get(sid) ? { id: petByStage.get(sid).id, slug: petByStage.get(sid).slug, name: petByStage.get(sid).name } : null,
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
  elements: Object.fromEntries(Object.entries(elementColors).map(([k, v]) => [
    k, { vn: EL_VN[k] ?? k, light: v[0], mid: v[1], dark: v[2] },
  ])),
  pets, trade, pools,
};

writeFileSync(join(dir, '../src/data.json'), JSON.stringify(data));
console.log(`pets: ${pets.length} | trade slots: ${trade.length} | pools: ${pools.length}`);
console.log(`total stages: ${pets.reduce((s, p) => s + p.chain.length, 0)}`);
