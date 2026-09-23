import { powerTier } from '../../tool/analyze.js';

const MODES = [['mode_survival', 'Sinh tồn'], ['mode_survival_hard', 'Sinh tồn · Khó'], ['mode_survival_old', 'Sinh tồn · Cũ'], ['duel', 'Đối kháng (quái bổ sung)']];
const ROLE_WEIGHT = { aura: 0.5, cc: 0.1, sustain: 0.1, taunt: 0.1, boss: 0.1 };
const TIERS = [[0.85, 'S+'], [0.65, 'S'], [0.45, 'A'], [0.28, 'B'], [0, 'C']];
const tierOf = v => TIERS.find(([min]) => v >= min)[1];
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
    const bestWithin = limit => {
      let best = null;
      for (const [id, c] of cost) if (c <= Math.max(0, limit - catchCost) && (!best || units[id].eff > units[best[0]].eff)) best = [id, c];
      return best ? { id: best[0], cost: best[1], eff: units[best[0]].eff } : { id: p.id, cost: 0, eff: first.eff };
    };
    const e500 = bestWithin(500), e1500 = bestWithin(1500);
    const emax = [...cost.keys()].reduce((a, id) => (units[id].eff > units[a].eff ? id : a), p.id);
    const roles = {};
    for (const [id, c] of [...cost].sort((a, b) => a[1] - b[1])) for (const r of units[id].roles ?? []) roles[r] ??= [id, c];
    const traps = [];
    const unsure = new Set();
    for (const id of cost.keys()) {
      for (const e of units[id].evo ?? []) if (e.trap) traps.push([id, e.to, e.trap]);
      if (units[id].unsure?.length) unsure.add(id);
    }
    const mid = units[e1500.id];
    const survive = (mid.roles?.includes('evade') ? 2 : 1) * (mid.roles?.includes('sustain') ? 1.3 : 1) * (mid.roles?.includes('tank') ? 1.2 : 1);
    const offense = mid.hp * (1 + (damage.armorCoefficient ?? 0.06) * Math.max(0, mid.armor ?? 0)) * survive;
    const roleBonus = Math.min(0.6, Object.keys(roles).reduce((sum, r) => sum + (ROLE_WEIGHT[r] ?? 0), 0));
    return {
      id: p.id, slug: p.slug, name: p.name, el: p.el, atk: first.atk, legendary: !!first.legendary, catch: first.catch,
      e500, e1500, emax: { id: emax, cost: cost.get(emax), eff: units[emax].eff },
      roles: Object.entries(roles).map(([r, [id, c]]) => [r, id, c]), traps, unsure: [...unsure],
      solo: { score: first.power ?? 0, tier: powerTier(first.power ?? 0) },
      pveRaw: e1500.eff * (survival[first.atk] ?? 1), offense, roleBonus,
    };
  });
  const p90 = values => values.sort((a, b) => a - b)[Math.floor(values.length * 0.9)] || 1;
  const maxPve = p90(lines.map(l => l.pveRaw));
  const maxDps = p90(lines.map(l => l.e1500.eff));
  const maxOff = p90(lines.map(l => l.offense));
  for (const l of lines) {
    const pve = Math.min(1, 0.85 * Math.min(1.2, l.pveRaw / maxPve) + l.roleBonus);
    const pvp = Math.min(1, 0.85 * (0.7 * Math.min(1.2, l.e1500.eff / maxDps) + 0.3 * Math.min(1.2, l.offense / maxOff)) + l.roleBonus);
    l.pve = { score: round(pve), tier: tierOf(pve) };
    l.pvp = { score: round(pvp), tier: tierOf(pvp) };
    delete l.pveRaw; delete l.offense; delete l.roleBonus;
  }
  return { modes, lines: lines.sort((a, b) => b.solo.score - a.solo.score), budget: [500, 1500] };
}
