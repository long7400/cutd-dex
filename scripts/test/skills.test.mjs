import { test } from 'node:test';
import assert from 'node:assert/strict';
import { skillValue } from '../../tool/skillvalue.js';
import { build, buildOverlay, PATHS } from '../build.mjs';
import { readJSON } from '../lib/fsx.mjs';

const ctx = (abilities, modifiers = []) => ({ abilityById: new Map(abilities.map(a => [a.id, a])), modifierById: new Map(modifiers.map(m => [m.id, m])) });
const species = abilities => ({ id: 'u', attack_damage: 100, attack_cooldown_ticks: 32, max_health: 1000, abilities: abilities.map(a => a.id) });

test('skillValue: chí mạng / sát thương cố định theo xác suất / % máu bản thân', () => {
  const crit = { id: 'c', status: 'executable', trigger: { kind: 'on_hit' }, conditions: [{ kind: 'chance', chance: 0.5 }], effects: [{ kind: 'damage', magnitude: { basis: 'attack_damage', multiplier: 2 } }] };
  assert.equal(skillValue(species([crit]), ctx([crit])).eff, 200);
  const flat = { id: 'f', status: 'executable', trigger: { kind: 'on_attack' }, conditions: [{ kind: 'chance', chance: 0.2 }], effects: [{ kind: 'damage', magnitude: { base: 500 }, target: 'trigger_unit' }] };
  assert.equal(skillValue(species([flat]), ctx([flat])).eff, 200);
  const selfPct = { id: 'p', status: 'executable', trigger: { kind: 'on_attack' }, effects: [{ kind: 'damage', magnitude: { basis: 'max_health', of: 'attacker', percent: 10 }, target: 'trigger_unit' }, { kind: 'damage', magnitude: { basis: 'max_health', of: 'trigger_unit', percent: 10 }, target: 'attacker' }] };
  assert.equal(skillValue(species([selfPct]), ctx([selfPct])).eff, 200, '10% máu bản thân mỗi đòn; phần tự chịu không tính');
});

test('skillValue: kỹ năng bị khoá / có điều kiện lạ không cộng số; vai trò được gắn', () => {
  const locked = { id: 'l', status: 'not_ported', trigger: { kind: 'on_hit' }, effects: [{ kind: 'damage', magnitude: { base: 9999 } }] };
  assert.equal(skillValue(species([locked]), ctx([locked])).eff, 100);
  const cond = { id: 'w', status: 'executable', trigger: { kind: 'on_attack' }, conditions: [{ kind: 'caster_has_modifier', modifier_id: 'x' }], effects: [{ kind: 'apply_modifier', modifier_id: 'm', target: 'attacker' }] };
  const r = skillValue(species([cond]), ctx([cond], [{ id: 'm', attack_speed_multiplier: 2, duration_ticks: 6000 }]));
  assert.equal(r.eff, 100);
  assert.deepEqual(r.uncertain, ['w']);
  const slow = { id: 's', status: 'executable', trigger: { kind: 'on_hit' }, targeting: { kind: 'unit', filter: 'enemy_creep' }, effects: [{ kind: 'apply_modifier', modifier_id: 'sl' }] };
  const sv = skillValue(species([slow]), ctx([slow], [{ id: 'sl', move_speed_multiplier: 0.7, duration_ticks: 64 }]));
  assert.deepEqual(sv.roles, ['cc']);
  assert.ok(sv.debuff > 0, 'làm chậm quái thật → có điểm DEBUFF');
});

test('issue #1: chí mạng / choáng dạng self dội vào chính con pet — không cộng DPS, tính tự hại', () => {
  const selfCrit = { id: 'sc', status: 'executable', trigger: { kind: 'on_hit' }, targeting: { kind: 'self', filter: 'ally' }, conditions: [{ kind: 'chance', chance: 0.5 }], effects: [{ kind: 'damage', magnitude: { basis: 'attack_damage', multiplier: 2 } }] };
  const r = skillValue(species([selfCrit]), ctx([selfCrit]));
  assert.equal(r.eff, 100, 'không cộng vào DPS');
  assert.equal(r.selfDps, 100, '50% × 1 đòn/giây × 2 × 100 sát thương dội vào chính nó');
  assert.ok(r.roles.includes('selfharm'));
  const selfSlow = { id: 'ss', status: 'executable', trigger: { kind: 'on_hit' }, targeting: { kind: 'self', filter: 'ally' }, effects: [{ kind: 'apply_modifier', modifier_id: 'st' }] };
  const r2 = skillValue(species([selfSlow]), ctx([selfSlow], [{ id: 'st', attack_speed_multiplier: 0.5, duration_ticks: 64 }]));
  assert.ok(!r2.roles.includes('cc'), 'debuff self không phải khống chế');
  assert.ok(r2.eff < 100 && r2.roles.includes('selfharm'), 'tự làm chậm → DPS tụt');
  const drain = { id: 'd', status: 'executable', trigger: { kind: 'on_hit' }, targeting: { kind: 'self', filter: 'ally' }, effects: [{ kind: 'heal', magnitude: { basis: 'attack_damage', multiplier: 1 } }] };
  const r3 = skillValue(species([selfCrit, drain]), ctx([selfCrit, drain]));
  assert.equal(r3.selfDps, 0, 'hút máu bù lại phần tự hại');
});

const db = build({ raw: readJSON(PATHS.catalog), client: readJSON(PATHS.client) });
const U = db.units;
const find = (name, level) => Object.values(U).find(u => u.name === name && u.level === level);

test('dữ liệu thật: DPS thật cộng kỹ năng', () => {
  assert.equal(find('Hitmonlee', 60).eff, find('Hitmonlee', 60).dps, 'chí mạng self (issue #1) không cộng DPS');
  assert.ok(find('Hitmonlee', 60).hp / find('Hitmonlee', 60).selfDps < 10, 'Hitmonlee tự chết trong vài giây');
  assert.equal(find('Hitmonchan', 60).eff, find('Hitmonchan', 60).dps, 'Hitmonchan không có kỹ năng cộng DPS');
  assert.ok(find('Primeape', 60).eff > find('Primeape', 60).dps * 2, 'nổi điên +125% tốc đánh gần như luôn bật');
  assert.equal(find('Raichu', 100).eff, find('Raichu', 100).dps, 'chí mạng của Raichu là dạng self → không cộng');
  assert.ok(find('Raichu', 100).selfDps > 0);
});

test('dữ liệu thật: bẫy tiến hóa (tụt mãi) vs tụt tạm', () => {
  const magneton = find('Magneton', 30), wig60 = find('Wigglytuff', 60);
  assert.equal(magneton.evo.find(e => U[e.to].name === 'Iron-Crown').trap, 'trap');
  assert.equal(wig60.evo[0].trap, 'dip');
  const overlay = buildOverlay(db);
  assert.equal(Object.values(overlay.u[magneton.id].tp)[0], 2);
  assert.ok(!('trap' in (find('Pikachu', 15).evo[0] ?? {})));
});

test('dữ liệu thật: vai trò + kỹ năng mở sau khi lên cấp', () => {
  const machop = find('Machop', 1);
  assert.ok(machop.unlocks.some(([r, to]) => r === 'aura' && U[to].name === 'Machoke'), 'Machop → Machoke mở hào quang');
  assert.ok(find('Onix', 1).roles.includes('taunt'));
  assert.ok(find('Kyogre', 1).roles.includes('sustain'));
  assert.ok(!find('Arbok', 26).roles.includes('cc'), 'Slow Poison dạng self không làm chậm quái (issue #1)');
  assert.ok(find('Darkrai', 1).roles.includes('boss') && find('Darkrai', 1).pctHit > 0);
});

import { analyzeCatalog, powerTier } from '../../tool/analyze.js';

test('hạng theo vai trò: mỗi dòng chỉ so với dòng cùng vai trò, đỉnh tính theo chỉ số vai trò', () => {
  const a = analyzeCatalog(readJSON(PATHS.catalog).catalog);
  const at = (name, level) => a.get(find(name, level).id);
  const tierOf = (name, level) => powerTier(at(name, level).power);
  assert.equal(at('Machop', 1).role, 'buff', 'Machoke mở hào quang cả đội → BUFF');
  assert.equal(at('Bramblin', 1).role, 'tank');
  assert.equal(at('Abra', 1).role, 'atk');
  assert.equal(tierOf('Abra', 1), 'S+');
  assert.equal(tierOf('Treecko', 1), 'S+');
  assert.equal(at('Abra', 1).kit[0], 'atk');
  assert.ok(['C', 'B'].includes(tierOf('Hitmonlee', 60)), 'tự chết vài giây → tụt hạng ATK');
  assert.ok(at('Eevee', 1).kit.includes('selfharm'));
  assert.equal(at('Magnemite', 1).role, 'tank');
  assert.ok(['C', 'B'].includes(tierOf('Kyogre', 1)), 'huyền thoại không tiến hóa, chỉ số thấp');
  for (const role of ['atk', 'tank', 'buff']) assert.ok([...a.values()].some(u => u.role === role && u.power >= 0.9), `${role} có nhóm đầu S+`);
});

test('hạng từng dạng theo tầm cấp: thấy được dòng yếu giữa đường nhưng mạnh cuối (vd Staryu)', () => {
  const a = analyzeCatalog(readJSON(PATHS.catalog).catalog);
  const st = (name, level) => a.get(find(name, level).id).stageTier;
  assert.equal(st('Staryu', 30), 'C');
  assert.equal(powerTier(a.get(find('Staryu', 1).id).power), 'S+');
  assert.ok(['S', 'S+'].includes(st('Mankey', 1)));
  assert.ok(a.get(find('Staryu', 1).id).path.length >= 5, 'có đường tiến hóa tới đỉnh');
  assert.equal(st('Kyogre', 1), 'S+', 'huyền thoại vẫn được chấm (không làm mốc so sánh)');
});

import { snapshot, reconcile, validOverrides } from '../lib/registry.mjs';

test('sổ định danh kỹ năng: kỹ năng đổi → đánh dấu xem lại, ghi đè của dòng đó hết hiệu lực; không đổi → giữ nguyên', () => {
  const raw = readJSON(PATHS.catalog);
  const registry = readJSON(PATHS.registry);
  assert.ok(registry && Object.keys(registry.lines).length >= 80, 'có sổ định danh trong repo');
  const snap = snapshot(raw.catalog, db.pets);
  const same = reconcile(registry, snap);
  assert.deepEqual([same.report.newAbilities.length, same.report.changedAbilities.length, same.report.changedLines.length], [0, 0, 0], 'sổ khớp catalog hiện tại');
  assert.equal(validOverrides(registry, snap).dratini, 'atk');
  const changed = structuredClone(raw.catalog);
  const drat = db.pets.find(p => p.slug === 'dratini');
  const stage = changed.species.find(s => s.id === drat.stages.at(-1));
  stage.attack_damage += 1;
  const snap2 = snapshot(changed, db.pets);
  const r = reconcile(registry, snap2);
  assert.ok(r.report.changedLines.includes('dratini'));
  assert.ok(r.report.droppedOverrides.some(x => x.startsWith('dratini')));
  assert.equal(validOverrides(registry, snap2).dratini, undefined, 'đổi chỉ số → không áp ghi đè cũ');
  assert.equal(r.registry.lines.dratini.reviewed, false);
  const ab = changed.abilities.find(a => a.id === Object.keys(registry.abilities)[0]);
  ab.effects = [...(ab.effects ?? []), { kind: 'damage', magnitude: { base: 1 } }];
  assert.ok(reconcile(registry, snapshot(changed, db.pets)).report.changedAbilities.includes(ab.id));
});
