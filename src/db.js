// DB được tách thành chunk riêng (dynamic import) → shell trang hiện ngay, data tải song song,
// file có hash nên cache vĩnh viễn trên CDN/browser.
let promise = null;
export let db = null;

export function loadDB() {
  return (promise ??= import('./data/db.json').then(m => {
    db = m.default;
    index(db);
    return db;
  }));
}

export const ix = {};

function index(d) {
  ix.petBySlug = new Map(d.pets.map(p => [p.slug, p]));
  ix.petById = new Map(d.pets.map(p => [p.id, p]));
  ix.unitList = Object.values(d.units);
  ix.researchById = new Map(d.research.map(r => [r.id, r]));

  // unit → recipe trade liên quan.
  ix.tradesOf = new Map();
  for (const slot of d.trade) for (const r of slot.recipes) for (const id of [r.give, r.get]) {
    if (!ix.tradesOf.has(id)) ix.tradesOf.set(id, []);
    ix.tradesOf.get(id).push({ slot: slot.slot, ...r });
  }
}

export const unit = id => db.units[id];
export const unitUrl = id => `#/unit/${id.replace(/^unit_/, '')}`;
export const unitFromParam = p => db.units[`unit_${p}`] ?? db.units[p];
export const portrait = model => `portraits/${model ?? 'pet_xiaohuolong'}.webp`;
export const label = k => db.labels[k] ?? k;
export const elementName = el => db.elements[el]?.name ?? '—';

// Đường dẫn cho 1 unit: nếu thuộc cây của 1 pet → trang pet (kèm anchor stage), ngược lại → trang unit.
export function linkFor(id) {
  const u = db.units[id];
  const pet = u?.pet && ix.petById.get(u.pet);
  return pet ? `#/pet/${pet.slug}/${id.replace(/^unit_/, '')}` : unitUrl(id);
}
