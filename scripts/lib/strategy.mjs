import { powerTier } from '../../tool/analyze.js';

const MODES = [['mode_survival', 'Sinh tồn'], ['mode_survival_hard', 'Sinh tồn · Khó'], ['mode_survival_old', 'Sinh tồn · Cũ'], ['duel', 'Đối kháng (quái bổ sung)']];
const round = v => Math.round(v * 100) / 100;

function armorMix(waveSet, units) {
  const hp = {};
  for (const w of waveSet?.waves ?? []) {
    for (const g of w.groups) {
      const u = units[g.unit];
      if (u) hp[u.armorType] = (hp[u.armorType] ?? 0) + g.count * u.hp;
    }
  }
  const total = Object.values(hp).reduce((a, b) => a + b, 0) || 1;
  return Object.fromEntries(Object.entries(hp).map(([k, v]) => [k, round(v / total)]).sort((a, b) => b[1] - a[1]));
}

function reach(units, from) {
  const cost = new Map([[from, 0]]), queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const e of units[cur]?.evo ?? []) {
      const c = cost.get(cur) + e.cost;
      if (units[e.to] && Number.isFinite(c) && !(cost.get(e.to) <= c)) { cost.set(e.to, c); queue.push(e.to); }
    }
  }
  return cost;
}

export function buildStrategy({ units, pets, waveSets, damage }) {
  const table = damage.table;
  const modes = MODES.map(([id, name]) => {
    const mix = armorMix(waveSets.find(w => w.id === id), units);
    const atk = Object.fromEntries(Object.keys(table).map(a => [a, round(Object.entries(mix).reduce((s, [ar, share]) => s + share * (table[a][ar] ?? 1), 0))]));
    return { id, name, mix, atk };
  }).filter(m => Object.keys(m.mix).length);
  const survival = modes.find(m => m.id === 'mode_survival')?.atk ?? {};

  const lines = pets.map(p => {
    const first = units[p.id];
    const cost = reach(units, p.id);
    const catchCost = (first.catch ?? 1) < 0.5 ? (first.book ?? 0) / Math.max(first.catch ?? 1, 0.05) : 0;
    const role = first.role ?? 'atk';
    const val = id => units[id].rv?.[role] ?? units[id].eff ?? 0;
    const bestWithin = limit => {
      let best = null;
      for (const [id, c] of cost) if (c <= Math.max(0, limit - catchCost) && (!best || val(id) > val(best[0]))) best = [id, c];
      return best ? { id: best[0], cost: best[1], eff: val(best[0]) } : { id: p.id, cost: 0, eff: val(p.id) };
    };
    const e500 = bestWithin(500), e1500 = bestWithin(1500);
    const emax = [...cost.keys()].reduce((a, id) => (val(id) > val(a) ? id : a), p.id);
    const roles = {};
    for (const [id, c] of [...cost].sort((a, b) => a[1] - b[1])) for (const r of units[id].roles ?? []) roles[r] ??= [id, c];
    const traps = [];
    const unsure = new Set();
    for (const id of cost.keys()) {
      for (const e of units[id].evo ?? []) if (e.trap) traps.push([id, e.to, e.trap]);
      if (units[id].unsure?.length) unsure.add(id);
    }
    const harm = [...cost.keys()].filter(id => units[id].selfDps > 0).map(id => [id, Math.round(units[id].hp / units[id].selfDps)]).sort((a, b) => a[1] - b[1])[0] ?? null;
    return {
      id: p.id, slug: p.slug, name: p.name, el: p.el, atk: first.atk, legendary: !!first.legendary, catch: first.catch,
      e500, e1500, emax: { id: emax, cost: cost.get(emax), eff: val(emax) }, v1: val(p.id),
      roles: Object.entries(roles).map(([r, [id, c]]) => [r, id, c]), traps, unsure: [...unsure],
      role, rank: { score: first.power ?? 0, tier: powerTier(first.power ?? 0) }, harm,
    };
  });
  const ROLE_MIN = { buff: 0.05, debuff: 0.05 };
  const lineMax = new Map(lines.map(l => [l.id, Object.fromEntries(['atk', 'tank', 'buff', 'debuff'].map(r => [r, Math.max(0, ...[...reach(units, l.id).keys()].map(id => units[id].rv?.[r] ?? 0))]))]));
  const median = list => [...list].sort((a, b) => a - b)[Math.floor(list.length / 2)] ?? Infinity;
  const floor = {
    atk: median(lines.filter(l => l.role === 'atk').map(l => lineMax.get(l.id).atk)),
    tank: median(lines.filter(l => l.role === 'tank').map(l => lineMax.get(l.id).tank)),
    ...ROLE_MIN,
  };
  const qualifies = (l, r) => l.role === r || lineMax.get(l.id)[r] >= floor[r];
  const ref = Object.fromEntries(['atk', 'tank', 'buff', 'debuff'].map(r => {
    const vals = lines.filter(l => qualifies(l, r)).map(l => lineMax.get(l.id)[r]).sort((a, b) => a - b);
    return [r, vals[Math.floor(vals.length * 0.9)] || 1];
  }));
  for (const l of lines) {
    l.also = ['atk', 'tank', 'buff', 'debuff'].filter(r => r !== l.role && qualifies(l, r)).map(r => {
      const score = Math.min(1, lineMax.get(l.id)[r] / ref[r]);
      return [r, Math.round(score * 100) / 100, powerTier(score), lineMax.get(l.id)[r]];
    });
  }
  const tradeOnly = Object.values(units).filter(u => u.tags?.includes('trade') && !u.pet && u.role && u.role !== 'atk')
    .map(u => ({ id: u.id, role: u.role, tier: u.stageTier, rv: u.rv?.[u.role] ?? 0 })).sort((a, b) => b.rv - a.rv);
  return { modes, lines: lines.sort((a, b) => b.rank.score - a.rank.score), tradeOnly, budget: [500, 1500] };
}
