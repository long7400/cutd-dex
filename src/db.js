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
  ix.lineById = new Map((d.strategy?.lines ?? []).map(l => [l.id, l]));

  ix.tradesOf = new Map();
  for (const slot of d.trade) for (const r of slot.recipes) for (const id of [r.give, r.get]) {
    if (!ix.tradesOf.has(id)) ix.tradesOf.set(id, []);
    ix.tradesOf.get(id).push({ slot: slot.slot, ...r });
  }
}

export const unitUrl = id => `#/unit/${id.replace(/^unit_/, '')}`;
const own = (o, k) => (typeof k === 'string' && Object.hasOwn(o, k) ? o[k] : undefined);
export const unitFromParam = p => own(db.units, `unit_${p}`) ?? own(db.units, p);
export const portrait = model => `portraits/${model ?? 'pet_xiaohuolong'}.webp`;
export const label = k => db.labels[k] ?? k;

export function linkFor(id) {
  const u = db.units[id];
  const pet = u?.pet && ix.petById.get(u.pet);
  return pet ? `#/pet/${pet.slug}/${id.replace(/^unit_/, '')}` : unitUrl(id);
}
