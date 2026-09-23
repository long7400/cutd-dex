import { resolve, sep } from 'node:path';

export const SAFE_NAME = /^(?!(?:__proto__|constructor|prototype)$)[A-Za-z0-9_-]{1,80}$/;

export const SAFE_TEXT = v => typeof v === 'string' && v.length <= 200 && !/[<>\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v);

export function validateCatalog(raw, previous = null) {
  const cat = raw?.catalog;
  const bad = [];
  if (typeof raw?.catalog_hash !== 'string' || !/^[0-9a-f]{16,128}$/.test(raw.catalog_hash)) bad.push('catalog_hash');
  for (const k of ['species', 'abilities', 'modifiers', 'display_names']) if (!Array.isArray(cat?.[k]) || !cat[k].length) bad.push(k);
  if (cat?.species?.some(s => typeof s?.id !== 'string' || !SAFE_NAME.test(s.id))) bad.push('species.id lạ');
  if (cat?.research?.some(r => typeof r?.id !== 'string' || !SAFE_NAME.test(r.id))) bad.push('research.id lạ');
  const name = v => v == null || (typeof v === 'string' && SAFE_NAME.test(v));
  if (cat?.species?.some(s => !name(s?.attack_type) || !name(s?.armor_type))) bad.push('attack_type / armor_type lạ');
  if ((cat?.wild?.pools ?? []).some(p => !name(p?.affinity) || (p?.entries ?? []).some(e => !name(e?.stage_id)))) bad.push('wild.affinity / stage_id lạ');
  if ((cat?.species?.filter(s => s.catchable).length ?? 0) < 10) bad.push('catchable<10');
  if (cat?.species?.some(s => (s?.evolutions ?? []).some(e => typeof e?.stage_id !== 'string' || !Number.isFinite(e.cost) || e.cost < 0))) bad.push('evolutions.cost lạ');
  const ids = new Set((cat?.species ?? []).map(s => s?.id));
  if (cat?.species?.some(s => (s?.evolutions ?? []).some(e => !ids.has(e.stage_id)))) bad.push('evolutions trỏ tới loài không có');
  if (cat?.display_names?.some(d => !name(d?.id) || !SAFE_TEXT(d?.value))) bad.push('display_names có ký tự lạ');
  const stage = v => typeof v === 'string' && SAFE_NAME.test(v) && ids.has(v);
  if ((cat?.trade?.slots ?? []).some(sl => !Number.isInteger(sl?.slot) || sl.slot < 0 || sl.slot > 99 || !Array.isArray(sl.recipes)
    || sl.recipes.some(r => !stage(r?.required_stage_id) || !stage(r?.offered_stage_id)))) bad.push('trade lạ');
  const waveOk = w => (w?.groups ?? w?.spawns ?? []).every?.(g => g?.stage_id == null || stage(g.stage_id)) ?? true;
  if ([...(cat?.waves ?? []), ...(cat?.duel_waves ?? []), ...(cat?.modes ?? []).flatMap(m => m?.survival?.waves ?? [])].some(w => !waveOk(w))) bad.push('waves.stage_id lạ');
  if ((cat?.survival_roster ?? []).some(list => !Array.isArray(list) || list.some(e => !stage(e?.stage_id)))) bad.push('survival_roster lạ');
  if ((cat?.modes ?? []).some(m => !name(m?.id))) bad.push('modes.id lạ');
  const before = previous?.catalog?.species?.length ?? 0;
  if (before && (cat?.species?.length ?? 0) < before * 0.8) bad.push(`species tụt ${before} → ${cat?.species?.length ?? 0} (>20%)`);
  return bad;
}

export function containedPath(base, dirs, key) {
  const p = resolve(base, key);
  if (!dirs.some(d => p.startsWith(resolve(d) + sep))) throw new Error(`Đường dẫn bất thường: ${key}`);
  return p;
}
