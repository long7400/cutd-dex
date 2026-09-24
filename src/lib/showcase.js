export const EVO_LINES = ['Charmander', 'Larvitar', 'Abra', 'Gastly', 'Pichu', 'Treecko'];

export const HERO_TEAM = [
  { model: 'pet_banjilasi', row: 0, slot: -0.5, range: 3.5 },
  { model: 'pet_kuailong', row: 0, slot: 0.6, range: 3.5 },
  { model: 'pet_penhuolong', row: 1, slot: -0.3, range: 5 },
  { model: 'download_primeape', row: 1, slot: 0.8, range: 5 },
  { model: 'pet_michunjie', row: 2, slot: 0, range: 7 },
  { model: 'pet_hudi', row: 3, slot: -0.7, range: 10 },
  { model: 'pet_s_baolilong', row: 3, slot: 0.8, range: 10 },
  { model: 'pet_genggui', row: 3, slot: 2, range: 10 },
];

export const HERO_CREEPS = ['download_rattata', 'download_zubat', 'download_geodude', 'pet_xiaohuoma', 'download_krabby', 'download_rattata', 'download_zubat', 'download_geodude'];

export const COURT = 'MoonlitCourt';

export function evoLines(db) {
  return EVO_LINES.map(name => {
    const line = db.strategy?.lines.find(l => l.name === name);
    const first = line && db.units[line.id];
    if (!first) return null;
    let cost = 0;
    const path = first.path?.length ? first.path : [line.id];
    const stages = path.map((id, i) => {
      const u = db.units[id];
      if (i) cost += (db.units[path[i - 1]].evo ?? []).find(e => e.to === id)?.cost ?? 0;
      return { id, name: u.name, level: u.level, model: u.model, tier: u.stageTier ?? 'C', dps: Math.round(u.eff ?? u.dps ?? 0), hp: u.hp, cost };
    });
    return { line: name, el: first.el, atk: first.atk, tier: line.rank?.tier ?? '', stages };
  }).filter(Boolean);
}

export function showcaseModels(db) {
  const models = new Set([...HERO_TEAM.map(p => p.model), ...HERO_CREEPS]);
  for (const l of evoLines(db)) for (const s of l.stages) if (s.model) models.add(s.model);
  return [...models];
}
