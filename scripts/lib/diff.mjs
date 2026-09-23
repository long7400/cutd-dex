// So sánh 2 phiên bản catalog → 1 entry changelog gọn (thêm/xoá/đổi chỉ số), để wiki có trang lịch sử cập nhật.

const STAT_FIELDS = [
  'max_health', 'attack_damage', 'attack_cooldown_ticks', 'attack_range', 'armor', 'armor_type', 'attack_type',
  'move_speed', 'catch_chance', 'book_value', 'kill_gold', 'leak_lives', 'catchable', 'legendary',
];
const MAX_ITEMS = 300;

const stable = v => JSON.stringify(v, (k, x) => (k === 'source_ids' || k === 'confidence' ? undefined : x));

function byId(list = []) { return new Map(list.map(x => [x.id, x])); }

export function diffCatalog(oldRaw, newRaw) {
  const a = oldRaw.catalog, b = newRaw.catalog;
  const nameIn = cat => { const n = new Map(cat.display_names.map(d => [d.id, d.value])); return s => n.get(s.display_name_id) ?? s.id; };
  const nameA = nameIn(a), nameB = nameIn(b);
  const items = [];
  const push = item => { if (items.length < MAX_ITEMS) items.push(item); };

  const A = byId(a.species), B = byId(b.species);
  const added = [...B.values()].filter(s => !A.has(s.id));
  const removed = [...A.values()].filter(s => !B.has(s.id));
  for (const s of added) push({ kind: 'unit+', id: s.id, name: nameB(s) });
  for (const s of removed) push({ kind: 'unit-', id: s.id, name: nameA(s) });

  let statChanges = 0;
  for (const [id, sb] of B) {
    const sa = A.get(id);
    if (!sa) continue;
    for (const f of STAT_FIELDS) {
      if (stable(sa[f]) !== stable(sb[f])) { statChanges++; push({ kind: 'stat', id, name: nameB(sb), field: f, from: sa[f] ?? null, to: sb[f] ?? null }); }
    }
    if (stable(sa.evolutions) !== stable(sb.evolutions)) { statChanges++; push({ kind: 'evo', id, name: nameB(sb) }); }
    if (stable(sa.abilities) !== stable(sb.abilities)) { statChanges++; push({ kind: 'skills', id, name: nameB(sb) }); }
    if (nameA(sa) !== nameB(sb)) push({ kind: 'rename', id, from: nameA(sa), to: nameB(sb) });
  }

  const Aa = byId(a.abilities), Ba = byId(b.abilities);
  let abilityChanges = 0;
  for (const [id, x] of Ba) if (!Aa.has(id) || stable(Aa.get(id)) !== stable(x)) abilityChanges++;
  for (const id of Aa.keys()) if (!Ba.has(id)) abilityChanges++;
  const Am = byId(a.modifiers), Bm = byId(b.modifiers);
  let modifierChanges = 0;
  for (const [id, x] of Bm) if (!Am.has(id) || stable(Am.get(id)) !== stable(x)) modifierChanges++;

  const sections = {};
  for (const k of ['waves', 'duel_waves', 'trade', 'wild', 'research', 'rules', 'modes', 'damage', 'speed_options', 'income_options', 'survival_roster']) {
    if (stable(a[k]) !== stable(b[k])) sections[k] = true;
  }

  return {
    at: new Date().toISOString(),
    hash: newRaw.catalog_hash,
    prevHash: oldRaw.catalog_hash,
    ruleset: newRaw.ruleset_version,
    prevRuleset: oldRaw.ruleset_version !== newRaw.ruleset_version ? oldRaw.ruleset_version : undefined,
    summary: {
      unitsAdded: added.length, unitsRemoved: removed.length, statChanges, abilityChanges, modifierChanges,
      sections: Object.keys(sections),
    },
    items,
    truncated: items.length >= MAX_ITEMS || undefined,
  };
}
