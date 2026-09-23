import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseLiteral, literalsMatching, enclosingObject } from '../lib/literal.mjs';
import { extractClient, validateClient, bundlePathFrom } from '../lib/client.mjs';
import { createResolver, fnv1a } from '../lib/game.mjs';
import { createDescriber } from '../lib/describe.mjs';
import { diffCatalog } from '../lib/diff.mjs';

test('parseLiteral: dữ liệu minified hợp lệ', () => {
  const src = 'x={a:`b`,"c d":[1,.5,-2e3,!0,!1,null,void 0],e:{f:\'g\\n\'},}';
  const { value } = parseLiteral(src, 2);
  assert.deepEqual(value, { a: 'b', 'c d': [1, 0.5, -2000, true, false, null, undefined], e: { f: 'g\n' } });
});

test('parseLiteral: từ chối code (không eval)', () => {
  assert.throws(() => parseLiteral('{a:foo()}'));
  assert.throws(() => parseLiteral('{a:`${alert(1)}`}'));
  assert.throws(() => parseLiteral('{a:1'));
});

test('literalsMatching + enclosingObject', () => {
  const js = 'var q=5,v={unit_h001:`m1`,unit_h002:`m2`},t={"Deal {0} damage{1}":`Gây {0}{1}`,Hi:`Chào`};f(v)';
  assert.deepEqual(literalsMatching(js, /\{unit_h[0-9a-z]{3}:`/), [{ unit_h001: 'm1', unit_h002: 'm2' }]);
  assert.equal(enclosingObject(js, '"Deal {0} damage{1}":').Hi, 'Chào');
});

test('extractClient + validateClient + bundlePathFrom', () => {
  const units = Array.from({ length: 120 }, (_, i) => `unit_h${i.toString(36).padStart(3, '0')}:\`m${i % 60}\``).join(',');
  const models = Array.from({ length: 60 }, (_, i) => `{key:\`m${i}\`,affinity:\`fire\`,sourceScale:1}`).join(',');
  const i18n = Array.from({ length: 120 }, (_, i) => `"k${i}":\`v${i}\``).join(',');
  const js = `var _=[${models}],v={${units}},mn={normal:[[1,2,3],[4,5,6],[7,8,9]],fire:[[1,1,1],[2,2,2],[3,3,3]]},t={"Deal {0} damage{1}":\`x\`,${i18n}};`;
  const c = extractClient(js);
  assert.equal(c.models.length, 60);
  assert.equal(Object.keys(c.unitModel).length, 120);
  assert.deepEqual(c.elementColors.fire[2], [3, 3, 3]);
  assert.deepEqual(validateClient(c), []);
  assert.equal(bundlePathFrom('<script type="module" crossorigin src="/assets/index-AbC_1.js"></script>'), '/assets/index-AbC_1.js');
});

const fixture = {
  species: [
    { id: 'unit_a', evolutions: [{ stage_id: 'unit_b', cost: 10 }] },
    { id: 'unit_b', evolutions: [{ stage_id: 'unit_c', cost: 20 }, { stage_id: 'unit_d', cost: 30 }] },
    { id: 'unit_c', evolutions: [] },
    { id: 'unit_d', evolutions: [] },
    { id: 'unit_x', evolutions: [] },
  ],
  wild: { pools: [{ affinity: 'water', entries: [{ stage_id: 'unit_a', weight: 1 }] }] },
};

test('resolver: gia phả, hệ, model giống client', () => {
  const client = {
    unitModel: { unit_b: 'mb' },
    models: [{ key: 'w1', affinity: 'water' }, { key: 'w2', affinity: 'water' }, { key: 'f1', affinity: 'fire' }],
  };
  const r = createResolver(fixture, client);
  assert.equal(r.rootOf('unit_d'), 'unit_a');
  assert.equal(r.elementOf('unit_c'), 'water');
  assert.equal(r.elementOf('unit_x'), null);
  assert.equal(r.modelOf('unit_b'), 'mb');
  assert.equal(r.modelOf('unit_a'), 'mb'); // thành viên nông nhất có map
  assert.equal(r.modelOf('unit_x'), ['w1', 'w2', 'f1'][fnv1a('unit_x') % 3]);
  assert.equal(r.depthOf('unit_c'), 2);
  assert.equal(fnv1a(''), 2166136261);
});

test('describer: dịch theo bảng của game + mô tả điều kiện/modifier', () => {
  const catalog = {
    display_names: [{ id: 'n1', value: 'Flame |cffff0000Strike|r' }],
    species: [],
    modifiers: [{ id: 'm1', attack_speed_multiplier: 1.25, armor_delta: -3, duration_ticks: 64, flags: ['invulnerable'] }],
    abilities: [{
      id: 'a1', display_name_id: 'n1', status: 'executable', trigger: { kind: 'on_hit' }, conditions: [{ kind: 'chance', chance: 0.33 }],
      targeting: { kind: 'unit', filter: 'enemy_creep', max_targets: 3 }, delivery: { kind: 'instant' },
      effects: [{ kind: 'damage', magnitude: { base: 50, basis: 'attack_damage', multiplier: 1.5 } }, { kind: 'apply_modifier', modifier_id: 'm1' }],
    }],
  };
  const d = createDescriber(catalog, { 'On hit': 'Khi đánh trúng', '{0} chance{1}': 'Xác suất {0}{1}', 'Deal {0} damage{1}': 'Gây {0} sát thương{1}', 'for {0}': 'trong {0}' });
  const a = d.ability('a1');
  assert.equal(a.name, 'Flame Strike');
  assert.equal(a.summary, 'Khi đánh trúng · Xác suất 33%');
  assert.match(a.targeting, /up to 3 targets/);
  assert.equal(a.effects[0].t, 'Gây 50 + 1,5 × triggering attack damage sát thương');
  assert.equal(a.effects[1].t, '+25% attack speed · −3 Armor · Bất tử (miễn sát thương) · trong 2s');
});

test('diffCatalog: phát hiện thêm/xoá/đổi chỉ số', () => {
  const mk = (species, hash) => ({ catalog_hash: hash, ruleset_version: 'r1', catalog: { display_names: [], species, abilities: [], modifiers: [] } });
  const e = diffCatalog(
    mk([{ id: 'u1', max_health: 100 }, { id: 'u2' }], 'h1'),
    mk([{ id: 'u1', max_health: 150 }, { id: 'u3' }], 'h2'),
  );
  assert.equal(e.summary.unitsAdded, 1);
  assert.equal(e.summary.unitsRemoved, 1);
  assert.deepEqual(e.items.find(i => i.kind === 'stat'), { kind: 'stat', id: 'u1', name: 'u1', field: 'max_health', from: 100, to: 150 });
});
