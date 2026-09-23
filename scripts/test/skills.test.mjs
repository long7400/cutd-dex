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
  const slow = { id: 's', status: 'executable', trigger: { kind: 'on_hit' }, effects: [{ kind: 'apply_modifier', modifier_id: 'sl' }] };
  assert.deepEqual(skillValue(species([slow]), ctx([slow], [{ id: 'sl', move_speed_multiplier: 0.7 }])).roles, ['cc']);
});

const db = build({ raw: readJSON(PATHS.catalog), client: readJSON(PATHS.client) });
const U = db.units;
const find = (name, level) => Object.values(U).find(u => u.name === name && u.level === level);

test('dữ liệu thật: DPS thật cộng kỹ năng', () => {
  assert.equal(find('Hitmonlee', 60).eff, find('Hitmonlee', 60).dps * 2, 'chí mạng 50% ×2');
  assert.equal(find('Hitmonchan', 60).eff, find('Hitmonchan', 60).dps, 'Hitmonchan không có kỹ năng cộng DPS');
  assert.ok(find('Primeape', 60).eff > find('Primeape', 60).dps * 2, 'nổi điên +125% tốc đánh gần như luôn bật');
  assert.ok(find('Raichu', 100).eff > find('Raichu', 100).dps);
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
  assert.ok(machop.strategic >= 0.35, 'hào quang tương lai tính vào giá trị chiến lược');
  assert.ok(find('Onix', 1).roles.includes('taunt'));
  assert.ok(find('Kyogre', 1).roles.includes('sustain'));
  assert.ok(find('Arbok', 26).roles.includes('cc'));
  assert.ok(find('Darkrai', 1).roles.includes('boss') && find('Darkrai', 1).pctHit > 0);
});
