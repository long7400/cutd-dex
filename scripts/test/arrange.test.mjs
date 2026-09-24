import { test as nodeTest } from 'node:test';
import assert from 'node:assert/strict';
import { makeFrame, rowSlots, inBand, planMoves, createMemory, observe, onSent, onAck, minCostAssign as hungarian, BANDS } from '../../tool/logic.js';

const plan = (...a) => { const r = planMoves(...a); return { ...r, status: Object.fromEntries(r.status) }; };

const arena = { originX: 1000, originY: 2384, width: 1216, height: 1312 };
const down = { arena, path: [{ x: 1608, y: 2192 }, { x: 1608, y: 3552 }] };
const test = (name, fn) => nodeTest(`xếp đội: ${name}`, fn);

const U = (key, row, x, y, extra = {}) => ({ key, stage: `s_${key}`, level: 10, row, score: 100, active: true, pos: x == null ? null : { x, y }, ...extra });
function planning(mem, units, now = 5000) { observe(mem, { phase: 'planning', units }, now); return plan(mem, units, down); }
function freshMem(units) { const m = createMemory(); observe(m, { phase: 'wave', units }, 0); return m; } // boot: units present at boot are established

test('T1 straight path: slots identical to current formation (608-centred lines at y 2800/2920/3040/3180)', () => {
  const f = makeFrame(down);
  assert.deepEqual([0, 1, 2, 3].map(r => rowSlots(f, r)[0]).map(s => [s.x, s.y]), [[1608, 2800], [1608, 2920], [1608, 3040], [1608, 3180]]);
  assert.deepEqual(rowSlots(f, 0).slice(1, 3).map(s => [s.x, s.y]), [[1528, 2800], [1688, 2800]]);
});

test('T2 every generated slot passes the strict acceptance test of its own row (no self-oscillation) — straight, diagonal, L-shaped', () => {
  const grounds = [down,
    { arena, path: [{ x: 1000, y: 2384 }, { x: 2216, y: 3696 }] },
    { arena, path: [{ x: 1300, y: 2200 }, { x: 1300, y: 3000 }, { x: 2000, y: 3000 }, { x: 2000, y: 3800 }] },
    { arena, path: [{ x: 1608, y: 3552 }, { x: 1608, y: 2192 }] }];
  for (const g of grounds) {
    const f = makeFrame(g);
    for (let r = 0; r < 4; r++) {
      const s = rowSlots(f, r);
      assert.ok(s.length >= 5, `row ${r} has slots`);
      for (const x of s) { assert.ok(inBand(f, r, x, false)); for (let o = 0; o < 4; o++) if (o !== r) assert.ok(!inBand(f, o, x, false)); }
      assert.equal(new Set(s.map(x => `${x.x},${x.y}`)).size, s.length, 'no duplicate slots');
    }
  }
});

test('T3 team already in rows → 0 moves; cyclic swap inside a row → 0 moves; lateral drift 150 px → 0 moves', () => {
  const units = [U('u2', 0, 1608, 2800, { score: 900 }), U('u3', 0, 1528, 2800), U('u6', 0, 1688, 2800), U('u4', 1, 1608, 2920), U('u5', 2, 1608, 3040), U('u1', 3, 1608, 3180)];
  assert.deepEqual(planning(freshMem(units), units).moves, []);
  const swapped = units.map(u => u.key === 'u2' ? { ...u, pos: { x: 1688, y: 2800 } } : u.key === 'u6' ? { ...u, pos: { x: 1528, y: 2800 } } : u.key === 'u3' ? { ...u, pos: { x: 1608, y: 2800 } } : u);
  assert.deepEqual(planning(freshMem(swapped), swapped).moves, []);
  const drift = units.map(u => u.key === 'u4' ? { ...u, pos: { x: 1758, y: 2950 } } : u);
  assert.deepEqual(planning(freshMem(drift), drift).moves, []);
});

test('T4 hysteresis: unconfirmed unit needs the inner band, a confirmed one keeps the outer band', () => {

  const a = [U('m', 1, 1608, 2870)];                       // along -170: outside inner → misplaced
  assert.equal(planning(freshMem(a), a).moves.length, 1);
  const b = [U('m', 1, 1608, 2880)];                       // along -160: inner → accepted + confirmed
  const mem = freshMem(b);
  assert.deepEqual(planning(mem, b).moves, []);

  observe(mem, { phase: 'wave', units: b }, 6000);
  const c = [U('m', 1, 1608, 2850)];
  assert.deepEqual(planning(mem, c, 9000).moves, [], 'confirmed + outer band → stays');
  const d = [U('m', 1, 1608, 2840)];                       // along -200: beyond outer → move
  observe(mem, { phase: 'wave', units: d }, 10000);
  assert.equal(planning(mem, d, 13000).moves.length, 1);
});

test('T5 heal standing in the tank band → exactly 1 move to the heal line centre (1608,3180)', () => {
  const units = [U('t', 0, 1608, 2800), U('h', 3, 1528, 2800)];
  const r = planning(freshMem(units), units);
  assert.deepEqual(r.moves.map(m => [m.key, m.x, m.y]), [['h', 1608, 3180]]);
});

test('T6 bought this round (new id, Lv1) → excluded until next planning phase', () => {
  const units = [U('t', 0, 1608, 2800)];
  const mem = freshMem(units);
  observe(mem, { phase: 'planning', units }, 1000);
  const bought = [...units, U('n', 1, 1300, 3500, { level: 1 })];
  let r = plan(mem, bought, down); observe(mem, { phase: 'planning', units: bought }, 2000); r = plan(mem, bought, down);
  assert.deepEqual(r.moves, []); assert.equal(r.status.n, 'new');
  observe(mem, { phase: 'wave', units: bought }, 20000);
  r = planning(mem, bought, 40000);
  assert.deepEqual(r.moves.map(m => [m.key, m.x, m.y]), [['n', 1608, 2920]], 'next round → positioned');
});

test('T7 evolution that changes the row → included immediately (same round), evolution that keeps the row → untouched', () => {
  const units = [U('a', 1, 1608, 2920, { level: 1 })];
  const mem = freshMem([]);                                   // tool booted before purchase
  observe(mem, { phase: 'planning', units }, 1000);           // bought this round
  assert.equal(plan(mem, units, down).status.a, 'new');
  const evolvedSameRow = [{ ...units[0], stage: 's_a2', level: 10 }];
  observe(mem, { phase: 'planning', units: evolvedSameRow }, 2000);
  assert.deepEqual(plan(mem, evolvedSameRow, down).moves, [], 'still new-this-round / same row → nothing');
  const evolvedRanged = [{ ...units[0], stage: 's_a3', level: 16, row: 2 }];   // e.g. Abra L10 → L16 (range 90 → 600)
  observe(mem, { phase: 'planning', units: evolvedRanged }, 3000);
  const r = plan(mem, evolvedRanged, down);
  assert.deepEqual(r.moves.map(m => [m.key, m.row, m.x, m.y]), [['a', 2, 1608, 3040]]);
});

test('T8 down (inactive) and unknown-position units never enter the plan and never block the head', () => {
  const units = [U('d', 3, 1608, 2800, { active: false }), U('x', 0, null, null), U('h', 3, 1608, 2800)];
  const r = planning(freshMem(units), units);
  assert.deepEqual(r.moves.map(m => m.key), ['h']);
  assert.equal(r.status.d, 'down'); assert.equal(r.status.x, 'unknown');
});

test('T9 pending move (sent, store not updated yet) is never re-issued; reject blocks the slot', () => {
  const units = [U('h', 3, 1608, 2800), U('t', 0, 1608, 3180)];
  const mem = freshMem(units);
  let r = planning(mem, units, 5000);
  assert.deepEqual(r.moves.map(m => m.key), ['h', 't']);
  const first = r.moves[0];
  onSent(mem, first.key, first.row, first, 5000);
  observe(mem, { phase: 'planning', units }, 5500);           // store still shows old position
  r = plan(mem, units, down);
  assert.deepEqual(r.moves.map(m => m.key), ['t'], 'h is pending → not planned again');
  onAck(mem, 'h', false);                                     // server rejected (e.g. outside_arena)
  r = plan(mem, units, down);
  assert.equal(r.moves[0].key, 'h'); assert.notEqual(r.moves[0].slot, first.slot, 'rejected slot is not retried');
});

test('T10 priority: squishy in front first (HEAL > XA > CẬN), then misplaced tanks by HP, then the rest (most forward first)', () => {
  const units = [
    U('melee_front', 1, 1300, 2700), U('heal_front', 3, 1400, 2700), U('tank_back', 0, 1608, 3300, { score: 5000 }),
    U('tank_back2', 0, 1700, 3300, { score: 9000 }), U('ranged_mid', 2, 1608, 2920), U('heal_mid', 3, 1800, 3040)];
  const r = planning(freshMem(units), units);
  assert.deepEqual(r.moves.map(m => m.key), ['heal_front', 'melee_front', 'tank_back2', 'tank_back', 'heal_mid', 'ranged_mid']);
});

test('T11 strongest misplaced unit gets the centre slot; equal scores → shortest move', () => {
  const units = [U('weak', 1, 1100, 3500, { score: 10 }), U('strong', 1, 2100, 3500, { score: 999 })];
  const r = planning(freshMem(units), units);
  const at = Object.fromEntries(r.moves.map(m => [m.key, [m.x, m.y]]));
  assert.deepEqual(at.strong, [1608, 2920]);
  assert.deepEqual(at.weak, [1528, 2920]);
  const eq = [U('left', 1, 1100, 3500), U('right', 1, 2100, 3500), U('c', 1, 1608, 2920)];
  const r2 = planning(freshMem(eq), eq);
  const at2 = Object.fromEntries(r2.moves.map(m => [m.key, m.x]));
  assert.ok(at2.left < 1608 && at2.right > 1608, 'each goes to the side it is on (x-80 is +lateral)');
});

test('T12 accepted units keep their slots; a newcomer never displaces them', () => {
  const units = [U('a', 1, 1608, 2920, { score: 1 }), U('b', 1, 1300, 3500, { score: 999 })];
  const r = planning(freshMem(units), units);
  assert.deepEqual(r.moves.map(m => [m.key, m.x, m.y]), [['b', 1528, 2920]], 'strong newcomer takes next best free slot; weak accepted unit is not moved');
});

test('T13 overflow: 20 melee to place → 15 on the main line + 5 on the staggered second line, all distinct, then plan is empty', () => {
  const units = Array.from({ length: 20 }, (_, i) => U(`m${i}`, 1, 1050 + i * 50, 3600, { score: i }));
  const mem = freshMem(units);
  let r = planning(mem, units, 5000);
  assert.equal(r.moves.length, 20);
  assert.equal(new Set(r.moves.map(m => `${m.x},${m.y}`)).size, 20);
  assert.equal(r.moves.filter(m => m.y === 2920).length, 15);
  const placed = units.map(u => { const m = r.moves.find(x => x.key === u.key); return { ...u, pos: { x: m.x, y: m.y } }; });
  observe(mem, { phase: 'wave', units: placed }, 6000);
  assert.deepEqual(planning(mem, placed, 9000).moves, []);
});

test('T14 unknown / broken ground → no moves', () => {
  const mem = freshMem([]);
  assert.deepEqual(plan(mem, [U('a', 0, 1, 1)], null).moves, []);
  assert.deepEqual(plan(mem, [U('a', 0, 1, 1)], { arena: { originX: 0, originY: 0, width: 0, height: 10 } }).moves, []);
  assert.ok(plan(mem, [U('a', 0, 1, 1)], { arena, path: null }).moves.length <= 1, 'no path → default +y direction');
});

test('T15 manual drag during planning is respected this round, re-evaluated next round', () => {
  const units = [U('t', 0, 1608, 2800)];
  const mem = freshMem(units);
  observe(mem, { phase: 'planning', units }, 1000);
  observe(mem, { phase: 'planning', units }, 3000);
  const dragged = [U('t', 0, 1608, 3180)];
  observe(mem, { phase: 'planning', units: dragged }, 4000);
  assert.equal(plan(mem, dragged, down).status.t, 'manual');
  assert.deepEqual(plan(mem, dragged, down).moves, []);
  observe(mem, { phase: 'wave', units: dragged }, 20000);
  assert.deepEqual(planning(mem, dragged, 40000).moves.map(m => m.key), ['t']);
});

test('T16 fuzz: executing the plan one click at a time moves each unit at most once and ends with an empty plan', () => {
  let seed = 7;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  const grounds = [down, { arena, path: [{ x: 1000, y: 2384 }, { x: 2216, y: 3696 }] },
    { arena, path: [{ x: 1300, y: 2200 }, { x: 1300, y: 3000 }, { x: 2000, y: 3000 }, { x: 2000, y: 3800 }] }];
  for (let trial = 0; trial < 300; trial++) {
    const g = grounds[trial % grounds.length];
    const n = 1 + Math.floor(rnd() * 30);
    let units = Array.from({ length: n }, (_, i) => U(`u${i}`, Math.floor(rnd() * 4), 1030 + rnd() * 1156, 2414 + rnd() * 1252, { score: Math.floor(rnd() * 5) }));
    const mem = freshMem(units);
    const moved = new Map();
    let t = 5000, clicks = 0;
    observe(mem, { phase: 'planning', units }, t);
    const initial = plan(mem, units, g).moves.length;
    for (;;) {
      t += 900;
      observe(mem, { phase: 'planning', units }, t);
      const r = plan(mem, units, g);
      if (!r.moves.length) break;
      const m = r.moves[0];
      moved.set(m.key, (moved.get(m.key) ?? 0) + 1);
      assert.ok(moved.get(m.key) === 1, `trial ${trial}: ${m.key} moved twice`);
      onSent(mem, m.key, m.row, m, t); onAck(mem, m.key, true);
      units = units.map(u => (u.key === m.key ? { ...u, pos: { x: m.x, y: m.y } } : u));
      assert.ok(++clicks <= n);
    }
    assert.equal(clicks, initial, 'commands == units misplaced at the start (lower bound)');
  }
});

test('T17 hungarian sanity (3x4)', () => {
  assert.deepEqual(hungarian([[4, 1, 3, 9], [2, 0, 5, 9], [3, 2, 2, 9]]), [1, 0, 2]);
});

test('T18 room_summary before keyframe / watching another base (ready=false) never marks own units as new', () => {
  const mem = createMemory();
  observe(mem, { phase: 'planning', units: [], ready: false }, 0);          // summary arrives before keyframe
  const units = [U('a', 0, 1608, 3300, { level: 1 })];
  observe(mem, { phase: 'planning', units }, 100);                           // first keyframe → established
  assert.equal(plan(mem, units, down).status.a, 'move');
  observe(mem, { phase: 'planning', units: [], ready: false }, 200);         // user watches another base
  observe(mem, { phase: 'planning', units }, 300);                           // back home
  assert.equal(plan(mem, units, down).status.a, 'move', 'record kept, not re-marked as new');
});

test('T19 fuzz with events over 6 rounds (buy Lv1, evolve w/ row change, sell, go down, reject, manual drag): a unit is re-moved only after an event touched it', () => {
  let seed = 99;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
  for (let trial = 0; trial < 150; trial++) {
    let units = Array.from({ length: 8 + Math.floor(rnd() * 12) }, (_, i) => U(`u${i}`, Math.floor(rnd() * 4), 1030 + rnd() * 1156, 2414 + rnd() * 1252, { score: Math.floor(rnd() * 9) }));
    const mem = freshMem(units);
    let t = 1000, next = units.length;
    const touched = new Set(), movedSinceTouch = new Set();
    for (let round = 0; round < 6; round++) {
      t += 20000; observe(mem, { phase: 'planning', units }, t);
      for (let click = 0; click < 25; click++) {
        t += 900;
        const ev = rnd();
        if (ev < 0.05) { units.push(U(`u${next++}`, Math.floor(rnd() * 4), 1030 + rnd() * 1156, 2414 + rnd() * 1252, { level: 1 })); }
        else if (ev < 0.08 && units.length) { const i = Math.floor(rnd() * units.length); units[i] = { ...units[i], row: (units[i].row + 1) % 4, stage: units[i].stage + '+' }; touched.add(units[i].key); }
        else if (ev < 0.10 && units.length > 1) { units.splice(Math.floor(rnd() * units.length), 1); }
        else if (ev < 0.12 && units.length) { const i = Math.floor(rnd() * units.length); units[i] = { ...units[i], pos: { x: 1030 + rnd() * 1156, y: 2414 + rnd() * 1252 } }; touched.add(units[i].key); }
        observe(mem, { phase: 'planning', units }, t);
        const r = plan(mem, units, down);
        if (!r.moves.length) continue;
        const m = r.moves[0];
        if (movedSinceTouch.has(m.key) && !touched.has(m.key)) assert.fail(`trial ${trial}: ${m.key} re-moved without an event`);
        touched.delete(m.key); movedSinceTouch.add(m.key);
        onSent(mem, m.key, m.row, m, t);
        const rejected = rnd() < 0.05;
        onAck(mem, m.key, !rejected);
        if (rejected) { touched.add(m.key); continue; }
        units = units.map(u => (u.key === m.key ? { ...u, pos: { x: m.x, y: m.y } } : u));
      }
      t += 1000; observe(mem, { phase: 'wave', units: units.map(u => ({ ...u, active: rnd() > 0.1 })) }, t);   // some go down mid-wave; positions restored
    }
  }
});

