export function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619) >>> 0;
  return h;
}

export function createResolver(catalog, client) {
  const { species } = catalog;
  const pools = catalog.wild?.pools ?? [];
  const unitModel = client.unitModel;
  const allModels = client.models.map(m => m.key);
  const modelsByAffinity = {};
  for (const m of client.models) (modelsByAffinity[m.affinity] ??= []).push(m.key);

  const parent = new Map();
  const find = x => {
    let r = x;
    while (parent.has(r) && parent.get(r) !== r) r = parent.get(r);
    while (x !== r) { const n = parent.get(x); parent.set(x, r); x = n; }
    return r;
  };
  const prevOf = new Map();
  for (const s of species) {
    for (const e of s.evolutions ?? []) {
      const a = find(s.id), b = find(e.stage_id);
      if (a !== b) parent.set(a < b ? b : a, a < b ? a : b);
      const p = prevOf.get(e.stage_id);
      if (p === undefined || s.id < p) prevOf.set(e.stage_id, s.id);
    }
  }

  const root = new Map(), depth = new Map();
  for (const s of species) {
    let id = s.id, d = 0;
    const seen = new Set();
    while (prevOf.has(id) && !seen.has(id)) { seen.add(id); id = prevOf.get(id); d++; }
    root.set(s.id, find(s.id));
    depth.set(s.id, d);
  }

  const familyAffinity = new Map();
  for (const p of pools) for (const e of p.entries) {
    const r = root.get(e.stage_id) ?? e.stage_id;
    if (!familyAffinity.has(r)) familyAffinity.set(r, p.affinity);
  }

  const familyModel = new Map();
  const byDepth = [...species].sort((a, b) => depth.get(a.id) - depth.get(b.id) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  for (const s of byDepth) {
    const m = unitModel[s.id], r = root.get(s.id);
    if (m && !familyModel.has(r)) familyModel.set(r, m);
  }

  const rootOf = id => root.get(id) ?? id;
  const elementOf = id => familyAffinity.get(rootOf(id)) ?? null;
  const modelOf = id => {
    const r = rootOf(id);
    if (unitModel[id]) return unitModel[id];
    if (familyModel.has(r)) return familyModel.get(r);
    const list = modelsByAffinity[familyAffinity.get(r)] ?? allModels;
    return list.length ? list[fnv1a(r) % list.length] : null;
  };

  return { rootOf, elementOf, modelOf, depthOf: id => depth.get(id) ?? 0, prevOf: id => prevOf.get(id) ?? null };
}
