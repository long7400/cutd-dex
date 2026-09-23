import { resolve, sep } from 'node:path';

export const SAFE_NAME = /^[A-Za-z0-9_-]{1,80}$/;

export function validateCatalog(raw) {
  const cat = raw?.catalog;
  const bad = [];
  if (typeof raw?.catalog_hash !== 'string' || !/^[0-9a-f]{16,128}$/.test(raw.catalog_hash)) bad.push('catalog_hash');
  for (const k of ['species', 'abilities', 'modifiers', 'display_names']) if (!Array.isArray(cat?.[k]) || !cat[k].length) bad.push(k);
  if (cat?.species?.some(s => typeof s?.id !== 'string' || !SAFE_NAME.test(s.id))) bad.push('species.id lạ');
  if (cat?.research?.some(r => typeof r?.id !== 'string' || !SAFE_NAME.test(r.id))) bad.push('research.id lạ');
  if ((cat?.species?.filter(s => s.catchable).length ?? 0) < 10) bad.push('catchable<10');
  if (cat?.species?.some(s => (s?.evolutions ?? []).some(e => typeof e?.stage_id !== 'string' || !Number.isFinite(e.cost) || e.cost < 0))) bad.push('evolutions.cost lạ');
  return bad;
}

export function containedPath(base, dirs, key) {
  const p = resolve(base, key);
  if (!dirs.some(d => p.startsWith(resolve(d) + sep))) throw new Error(`Đường dẫn bất thường: ${key}`);
  return p;
}
