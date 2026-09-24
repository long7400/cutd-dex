import { createHash } from 'node:crypto';
import { interpretAbility } from '../../tool/skillvalue.js';

export const REGISTRY_VERSION = 1;
const hash = v => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const MOD_KEYS = ['duration_ticks', 'move_speed_multiplier', 'attack_speed_multiplier', 'attack_damage_multiplier', 'damage_taken_multiplier',
  'evade_chance', 'armor_delta', 'miss_chance', 'flat_damage_reduction', 'tick_interval_ticks', 'tick_effects'];

export function abilityHash(a, modifierById) {
  const mods = (a.effects ?? []).filter(e => e.modifier_id).map(e => {
    const m = modifierById.get(e.modifier_id) ?? {};
    return Object.fromEntries(MOD_KEYS.filter(k => m[k] !== undefined).map(k => [k, m[k]]));
  });
  return hash({ s: a.status, t: a.trigger, g: a.targeting, c: a.conditions ?? [], e: a.effects ?? [], m: mods });
}

const STAT_KEYS = ['max_health', 'armor', 'attack_damage', 'attack_cooldown_ticks', 'attack_range', 'attack_type', 'armor_type', 'health_regen_per_tick'];

export function lineHash(stageIds, speciesById, abilityHashes) {
  return hash([...stageIds].sort().map(id => {
    const s = speciesById.get(id) ?? {};
    return [id, STAT_KEYS.map(k => s[k] ?? null), (s.abilities ?? []).map(x => abilityHashes.get(x) ?? x).sort()];
  }));
}

export function snapshot(catalog, pets) {
  const modifierById = new Map((catalog.modifiers ?? []).map(m => [m.id, m]));
  const speciesById = new Map((catalog.species ?? []).map(s => [s.id, s]));
  const names = new Map((catalog.display_names ?? []).map(d => [d.id, String(d.value ?? '').replace(/\|c[0-9a-f]{8}|\|r/gi, '')]));
  const used = new Set(pets.flatMap(p => p.stages.flatMap(id => speciesById.get(id)?.abilities ?? [])));
  const abilities = {}, abilityHashes = new Map();
  for (const a of catalog.abilities ?? []) {
    if (!used.has(a.id)) continue;
    const h = abilityHash(a, modifierById);
    abilityHashes.set(a.id, h);
    abilities[a.id] = { hash: h, name: names.get(a.display_name_id) ?? a.id, tags: interpretAbility(a, modifierById) };
  }
  const lines = {};
  for (const p of pets) lines[p.slug] = { hash: lineHash(p.stages, speciesById, abilityHashes), root: p.id };
  return { abilities, lines };
}

export function reconcile(registry, snap) {
  const out = { version: REGISTRY_VERSION, abilities: {}, lines: {} };
  const report = { newAbilities: [], changedAbilities: [], goneAbilities: [], changedLines: [], droppedOverrides: [] };
  for (const [id, cur] of Object.entries(snap.abilities)) {
    const old = registry?.abilities?.[id];
    if (!old) { report.newAbilities.push(id); out.abilities[id] = { ...cur, reviewed: false }; continue; }
    if (old.hash !== cur.hash) { report.changedAbilities.push(id); out.abilities[id] = { ...cur, reviewed: false, note: old.note }; continue; }
    out.abilities[id] = { ...old, name: cur.name, tags: cur.tags };
  }
  for (const id of Object.keys(registry?.abilities ?? {})) if (!snap.abilities[id]) report.goneAbilities.push(id);
  for (const [slug, cur] of Object.entries(snap.lines)) {
    const old = registry?.lines?.[slug];
    if (old && old.hash === cur.hash) { out.lines[slug] = { ...old, root: cur.root }; continue; }
    if (old) report.changedLines.push(slug);
    if (old?.override) report.droppedOverrides.push(`${slug}:${old.override}`);
    out.lines[slug] = { ...cur, reviewed: false, ...(old?.note ? { note: old.note } : {}) };
  }
  return { registry: out, report };
}

export function validOverrides(registry, snap) {
  const map = {};
  for (const [slug, e] of Object.entries(registry?.lines ?? {})) {
    if (e.override && snap.lines[slug]?.hash === e.hash) map[slug] = e.override;
  }
  return map;
}
