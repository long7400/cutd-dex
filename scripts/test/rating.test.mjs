import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, applyMessage, rateStages, tierOf } from '../../tool/logic.js';

const unit = (over = {}) => ({ n: 'X', l: 1, el: 'fire', hp: 100, dps: 100, a: 'normal', at: 'normal', f: 'fam', ...over });
const baseDb = over => ({
  ac: 0.06, lc: 1, el: { fire: { n: 'Lửa' }, water: { n: 'Nước' } },
  dmg: { normal: { normal: 1, large: 1 }, pierce: { normal: 1, large: 1.5 }, magic: { normal: 1, large: 0.5 } },
  rs: { r_fire_as: ['fire', 'attack_speed', 0.1] }, wv: {}, u: {}, ...over,
});

function state(db, { team = [], wilds = [], next = [], gold = 500, research = [], offers = [] }) {
  const s = createState();
  applyMessage(s, { type: 'room_summary', tick: 1, phase: 'planning', phase_ends_tick: 900, wave_index: 0, next_wave: next,
    bases: [{ base_id: 7, player_id: 11, player_name: 'me', lives: 40, gold, lumber: 0, income: 0, alive: true }] });
  applyMessage(s, { type: 'base_keyframe', tick: 1, base: { base_id: 7, lives: 40, gold, lumber: 0, alive: true, research },
    units: team.map((stage_id, i) => ({ id: i + 1, stage_id, owner_id: 11, health: 1, max_health: 1, active: true })),
    creeps: [], wilds: wilds.map((stage_id, i) => ({ id: i + 1, stage_id })), trade_offers: offers });
  return s;
}
const rate = (db, opts, stages) => rateStages(state(db, opts), db, stages);

test('rating: hạng theo tỉ lệ so với con mạnh nhất', () => {
  assert.equal(tierOf(1), 'S+');
  assert.equal(tierOf(0.8), 'S');
  assert.equal(tierOf(0.6), 'A');
  assert.equal(tierOf(0.4), 'B');
  assert.equal(tierOf(0.1), 'C');
});

test('rating: khắc giáp đợt tới (PvE) được điểm cao hơn, có lý do', () => {
  const db = baseDb({ u: { p: unit({ a: 'pierce', f: 'p' }), m: unit({ a: 'magic', f: 'm' }), creep: unit({ at: 'large', f: 'c' }) } });
  const r = rate(db, { wilds: ['p', 'm'], next: [{ stage_id: 'creep', count: 5, target_base_id: 7 }] }, ['p', 'm']);
  assert.equal(r.pvp, false);
  assert.ok(r.ratings.get('p').score > r.ratings.get('m').score);
  assert.match(r.ratings.get('p').reasons.join(), /Khắc giáp/);
  assert.match(r.ratings.get('m').reasons.join(), /Bị giáp/);
});

test('rating: hào quang cả đội có giá trị theo DPS đội; trùng hào quang thì không cộng', () => {
  const db = baseDb({ u: {
    big: unit({ dps: 1000, f: 'b' }), aura: unit({ dps: 10, au: [['a00w', 1.2, 1]], f: 'a' }), aura2: unit({ dps: 10, au: [['a00w', 1.2, 1]], f: 'a2' }), plain: unit({ dps: 50, f: 'p' }),
  } });
  const r = rate(db, { team: ['big'], wilds: ['aura', 'plain'] }, ['aura', 'plain']);
  assert.ok(r.ratings.get('aura').score > r.ratings.get('plain').score, 'aura +20% × 1000 DPS > 50 DPS');
  assert.match(r.ratings.get('aura').reasons.join(), /\+20% sát thương cho 1 con/);
  const dup = rate(db, { team: ['big', 'aura'], wilds: ['aura2', 'plain'] }, ['aura2', 'plain']);
  assert.match(dup.ratings.get('aura2').reasons.join(), /trùng/);
  assert.ok(dup.ratings.get('aura2').score < dup.ratings.get('plain').score);
  const self = rate(db, { team: ['big', 'aura'] }, ['aura']);
  assert.doesNotMatch(self.ratings.get('aura').reasons.join(), /trùng/, 'không tự tính trùng với chính nó');
});

test('rating: giới hạn 1 huyền thoại → con huyền thoại hoang dã bị khoá', () => {
  const db = baseDb({ u: { leg1: unit({ L: 1, f: 'l1' }), leg2: unit({ L: 1, f: 'l2' }), x: unit({ f: 'x' }) } });
  const r = rate(db, { team: ['leg1'], wilds: ['leg2', 'x'] }, ['leg1', 'leg2', 'x']);
  assert.equal(r.ratings.get('leg2').tier, '—');
  assert.match(r.ratings.get('leg2').reasons[0], /huyền thoại/);
  assert.notEqual(r.ratings.get('leg1').tier, '—', 'con đang có thì không khoá');
});

test('rating: nghiên cứu tốc đánh đúng hệ làm tăng điểm', () => {
  const db = baseDb({ u: { f1: unit({ el: 'fire', f: 'f1' }), w1: unit({ el: 'water', f: 'w1' }) } });
  const r = rate(db, { wilds: ['f1', 'w1'], research: [{ research_id: 'r_fire_as', level: 3 }] }, ['f1', 'w1']);
  assert.ok(r.ratings.get('f1').score > r.ratings.get('w1').score);
  assert.match(r.ratings.get('f1').reasons.join(), /nghiên cứu hệ Lửa \(3 cấp\)/);
});

test('rating: tiến hóa đủ vàng tính vào điểm, không đủ vàng thì không', () => {
  const db = baseDb({ u: { a: unit({ dps: 50, e: [['a2', 300]], f: 'A' }), a2: unit({ dps: 1000, f: 'A', l: 30 }), b: unit({ dps: 200, f: 'B' }) } });
  const rich = rate(db, { team: ['a', 'b'], gold: 400 }, ['a', 'b']);
  assert.ok(rich.ratings.get('a').score > rich.ratings.get('b').score);
  assert.match(rich.ratings.get('a').reasons.join(), /Nâng được ngay: X Lv30 \(300 vàng\)/);
  const poor = rate(db, { team: ['a', 'b'], gold: 100 }, ['a', 'b']);
  assert.ok(poor.ratings.get('a').score < poor.ratings.get('b').score);
});

test('rating: PvP (đợt đến từ đối thủ) cộng điểm con trâu khi làm quái', () => {
  const db = baseDb({ u: { tank: unit({ dps: 60, hp: 5000, ar: 10, f: 't' }), dps: unit({ dps: 100, hp: 100, f: 'd' }), foe: unit({ f: 'z' }) } });
  const next = [{ stage_id: 'foe', count: 3, target_base_id: 7, source_player_id: 5 }];
  const pve = rate(db, { wilds: ['tank', 'dps'], next: next.map(({ source_player_id, ...g }) => g) }, ['tank', 'dps']);
  const pvp = rate(db, { wilds: ['tank', 'dps'], next }, ['tank', 'dps']);
  assert.equal(pvp.pvp, true);
  assert.ok(pve.ratings.get('dps').score > pve.ratings.get('tank').score);
  assert.ok(pvp.ratings.get('tank').score > pvp.ratings.get('dps').score);
  assert.match(pvp.ratings.get('tank').reasons.join(), /Làm quái trâu/);
});

test('rating: trade — con đáp ứng hàng trade được cộng giá trị con nhận về', () => {
  const db = baseDb({ u: { give: unit({ dps: 10, f: 'g' }), get: unit({ dps: 2000, f: 'h' }), other: unit({ dps: 100, f: 'o' }) } });
  const r = rate(db, { team: ['give', 'other'], offers: [{ slot: 2, offered_stage_id: 'get', required_stage_id: 'give' }] }, ['give', 'other']);
  assert.ok(r.ratings.get('give').score > r.ratings.get('other').score);
  assert.match(r.ratings.get('give').reasons.join(), /Trade S2/);
});
