import { literalsMatching, enclosingObject } from './literal.mjs';

// Bóc dữ liệu tĩnh mà client web (m.cutd.site) nhúng trong bundle:
//  - models:  [{key, affinity, sourceScale}]  danh sách model 3D + hệ
//  - unitModel: {unit_hXXX: modelKey}          map unit → model (portrait)
//  - elementColors: {normal: [[r,g,b] light, mid, dark], …}
//  - i18n: {"English template": "Bản dịch tiếng Việt"} — bảng dịch chính thức của game
//  - abilityIcon: {ability_id: 'skill-001'} — icon skill trên dock (art/ui/monster-dock/)
export function extractClient(js) {
  const largest = arr => arr.reduce((a, b) => (sizeOf(b) > sizeOf(a) ? b : a), null);

  const models = largest(
    literalsMatching(js, /\[\{key:`[a-z0-9_]+`,affinity:`/).filter(Array.isArray),
  );
  const unitModel = largest(
    literalsMatching(js, /\{unit_h[0-9a-z]{3}:`/).filter(o => o && typeof o === 'object'),
  );
  const elementColors = literalsMatching(js, /\{normal:\[\[\d/)
    .find(o => o && Array.isArray(o.fire) && o.fire.length === 3) ?? null;
  const i18n = enclosingObject(js, '"Deal {0} damage{1}":');
  const abilityIcon = largest(
    literalsMatching(js, /\{ability_a[0-9a-z]{3}_unit_h[0-9a-z]{3}:`/).filter(o => o && typeof o === 'object'),
  );

  return {
    models: models?.map(m => ({ key: m.key, affinity: m.affinity, scale: m.sourceScale })) ?? [],
    unitModel: unitModel ?? {},
    elementColors,
    i18n: i18n ?? {},
    abilityIcon: Object.fromEntries(Object.entries(abilityIcon ?? {})
      .map(([id, path]) => [id, String(path).split('/').pop()])
      .filter(([, name]) => /^[\w-]+$/.test(name))),
  };
}

const sizeOf = v => (v == null ? -1 : Array.isArray(v) ? v.length : Object.keys(v).length);

export function validateClient(c) {
  const problems = [];
  if (c.models.length < 50) problems.push(`models=${c.models.length} (<50)`);
  if (Object.keys(c.unitModel).length < 100) problems.push(`unitModel=${Object.keys(c.unitModel).length} (<100)`);
  if (!c.elementColors) problems.push('elementColors thiếu');
  if (Object.keys(c.i18n).length < 100) problems.push(`i18n=${Object.keys(c.i18n).length} (<100)`);
  return problems;
}

export function bundlePathFrom(html) {
  return html.match(/<script[^>]+src="(\/assets\/index-[\w-]+\.js)"/)?.[1] ?? null;
}
