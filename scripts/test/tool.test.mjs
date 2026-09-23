import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createState, applyMessage, tradeOptions, evolvePath, nextWaveForBase, myUnits, formation, formationRow } from '../../tool/logic.js';
import { buildTool } from '../build-tool.mjs';
import { build, buildOverlay, PATHS } from '../build.mjs';
import { readJSON } from '../lib/fsx.mjs';

const DATA_URL = 'https://long7400.github.io/cutd-dex/';
let tool, overlay, scenario;

before(async () => {
  tool = await buildTool();
  overlay = buildOverlay(build({ raw: readJSON(PATHS.catalog), client: readJSON(PATHS.client) }));
  const [a, b] = Object.entries(overlay.u).find(([, u]) => u.k && u.e?.length) ?? [];
  const bId = b.e[0][0], cId = overlay.u[bId].e?.[0]?.[0] ?? bId;
  scenario = { a, b: bId, c: cId, costAC: evolvePath(overlay, a, cId).cost };
});

const keyframe = (units, extra = {}) => ({
  type: 'base_keyframe', tick: 100,
  base: { base_id: 7, lives: 30, gold: 5000, lumber: 120, alive: true, research: [{ research_id: 'research_r000', level: 2 }] },
  units, creeps: [], wilds: [{ id: 1, stage_id: scenario.a, position: { x: 0, y: 0 } }],
  trade_offers: [
    { slot: 1, offered_stage_id: scenario.b, required_stage_id: scenario.c },
    { slot: 2, offered_stage_id: scenario.a, required_stage_id: 'unit_khong_co' },
  ],
  ...extra,
});
const summary = {
  type: 'room_summary', tick: 100, phase: 'planning', phase_ends_tick: 420, wave_index: 3, terminal: false,
  next_wave: [{ stage_id: 'unit_h00f', count: 3, target_base_id: 7 }, { stage_id: 'unit_h00f', count: 9, target_base_id: 99 }],
  bases: [{ base_id: 7, player_id: 11, player_name: 'Tao', lives: 30, gold: 5000, lumber: 120, income: 0, alive: true, creep_count: 0, wild_count: 1 }],
};

test('logic: keyframe + delta + trade + đợt tới', () => {
  const s = createState();
  applyMessage(s, summary);
  applyMessage(s, keyframe([
    { id: 1, stage_id: scenario.c, owner_id: 11, health: 50, max_health: 100, active: true, book_value: 100 },
    { id: 2, stage_id: scenario.a, owner_id: 11, health: 10, max_health: 10, active: true, book_value: 30 },
    { id: 3, stage_id: scenario.c, owner_id: 12, health: 10, max_health: 10, active: true, book_value: 30 },
  ]));
  assert.equal(myUnits(s).length, 2, 'chỉ tính lính của chủ căn cứ');
  const [o1, o2] = tradeOptions(s, overlay);
  assert.equal(o1.ready.length, 1);
  assert.equal(o2.ready.length, 0);
  assert.equal(o2.evolve, null);

  applyMessage(s, { type: 'base_delta', tick: 110, from_tick: 100, base: { base_id: 7, lives: 29, gold: 5000, lumber: 0 },
    unit_ids_removed: [1], creep_ids_removed: [], wild_ids_removed: [1] });
  const t = tradeOptions(s, overlay)[0];
  assert.equal(t.ready.length, 0);
  assert.equal(t.evolve.cost, scenario.costAC);
  assert.equal(s.wilds.size, 0);
  assert.equal(s.lives, 29);

  assert.equal(applyMessage(s, { type: 'base_delta', base: { base_id: 99 } }), false);
  assert.deepEqual(nextWaveForBase(s).map(g => g.count), [3]);
});

test('logic: dữ liệu rác không làm vỡ', () => {
  const s = createState();
  for (const m of [null, 1, 'x', [], { type: 'base_keyframe' }, { type: 'base_keyframe', base: 5 }, { type: 'room_summary', bases: 'x' }]) {
    assert.doesNotThrow(() => applyMessage(s, m));
  }
});

test('logic: xếp đội — TANK gần phía quái nhất, XA ở cuối, mạnh nhất ở giữa, luôn trong sân', () => {
  const arena = { originX: 1000, originY: 2384, width: 1216, height: 1312 };
  const down = { arena, path: [{ x: 1608, y: 2192 }, { x: 1608, y: 3552 }] };
  const members = [
    { key: 'u1', row: 3, score: 5 }, { key: 'u2', row: 0, score: 900 }, { key: 'u3', row: 0, score: 100 },
    { key: 'u4', row: 1, score: 50 }, { key: 'u5', row: 2, score: 1 }, { key: 'u6', row: 0, score: 500 },
  ];
  const at = f => Object.fromEntries(f.map(m => [m.key, m]));
  const p = at(formation(members, down));
  assert.ok(p.u2.y < p.u4.y && p.u4.y < p.u5.y && p.u5.y < p.u1.y, 'từ phía quái vào: TANK → CẬN → BUFF → XA');
  assert.equal(p.u2.x, 1608, 'tank máu nhất đứng giữa đường quái');
  assert.equal(p.u2.y, p.u3.y);
  assert.ok(p.u6.x !== p.u3.x && Math.abs(p.u6.x - 1608) === 80, 'tank thứ 2 đứng cạnh');
  for (const m of Object.values(p)) assert.ok(m.x >= arena.originX && m.x <= arena.originX + arena.width && m.y >= arena.originY && m.y <= arena.originY + arena.height);
  const up = at(formation(members, { arena, path: [...down.path].reverse() }));
  assert.ok(up.u2.y > up.u1.y, 'quái đi ngược → đội quay theo');
  const many = formation(Array.from({ length: 40 }, (_, i) => ({ key: `u${i}`, row: 0, score: i })), down);
  assert.equal(new Set(many.map(m => `${m.x},${m.y}`)).size, 40, 'đông quá thì xuống hàng, không chồng');
  assert.deepEqual(formation(members, null), []);
  assert.equal(formationRow({ hp: 5000, ed: 100 }), 0);
  assert.equal(formationRow({ hp: 100, ed: 50, r: ['aura'] }), 2);
  assert.equal(formationRow({ hp: 100, ed: 50, rg: 600 }), 3);
  assert.equal(formationRow({ hp: 100, ed: 50, rg: 90 }), 1);
});

function setupDom(url = 'https://cutd.site/?room=TEST') {
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body><canvas id="GameCanvas"></canvas></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  const log = { sent: 0, fetches: [], alerts: [], roots: [] };
  class FakeWS extends w.EventTarget { send() { log.sent++; } }
  w.WebSocket = FakeWS;
  w.alert = m => log.alerts.push(m);
  w.fetch = async (u, opts) => {
    log.fetches.push({ u, opts });
    const body = JSON.stringify(u === '/catalog' ? readJSON(PATHS.catalog) : overlay);
    return { ok: true, text: async () => body };
  };
  const attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function (o) { const r = attach.call(this, { ...o, mode: 'open' }); log.roots.push(r); return r; };
  const code = tool.code;
  return { w, log, code, FakeWS };
}

const tick = ms => new Promise(r => setTimeout(r, ms));

test('bookmarklet: chỉ đọc, bắt socket rồi trả getter, hiển thị trade/wild, tắt sạch', async t => {
  const { w, log, code, FakeWS } = setupDom();
  t.after(() => w.close());
  const original = Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data');

  const ws = new FakeWS();
  const gameGot = [];
  ws.addEventListener('message', e => gameGot.push(JSON.parse(e.data)));
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));

  w.eval(code);
  assert.deepEqual(log.fetches.map(f => f.u).sort(), ['/catalog', `${DATA_URL}overlay.json`]);
  assert.ok(log.fetches.every(f => f.opts.credentials === 'omit'));
  assert.notEqual(Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data').get, original.get, 'phải bọc getter để bắt socket');

  emit(summary);
  await tick(0);
  assert.equal(Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data').get, original.get, 'getter phải được trả lại ngay');
  emit(keyframe([{ id: 1, stage_id: scenario.c, owner_id: 11, health: 50, max_health: 100, active: true, book_value: 100 }]));
  assert.equal(gameGot.length, 2, 'game vẫn nhận đủ message');
  await tick(1200);

  const root = log.roots[0];
  const text = () => root.querySelector('.panel').textContent;
  assert.match(text(), /S1/);
  assert.equal(root.querySelectorAll('.trade').length ? root.querySelector('.trade').querySelectorAll('.tier').length : 0, 2, 'trade: hạng cho cả con đưa và con nhận');
  assert.ok(root.querySelector('.trade.is-ok button.act'), 'slot có sẵn lính phải có nút Trade');
  assert.doesNotMatch(text(), /Vàng/, 'không lặp lại chỉ số game đã hiện');
  assert.ok(root.querySelector('.trade.is-ok'), 'slot trade được phải được đánh dấu');

  const clickTab = name => [...root.querySelectorAll('button')].find(b => b.textContent.startsWith(name)).click();
  clickTab('Wild');
  assert.match(text(), new RegExp(overlay.u[scenario.a].n));
  const tier = root.querySelector('.tier');
  assert.ok(tier && /^(S\+|S|A|B|C|—)$/.test(tier.textContent), 'wild có huy hiệu hạng');
  assert.match(tier.title, /^Hạng hiện tại (S\+|S|A|B|C)/);
  const strip = root.querySelector('.row .strip');
  assert.ok(strip && strip.querySelectorAll('i').length >= 2, 'dải hạng theo cấp (không chữ)');
  assert.match(strip.title, /Lv\d+ (S\+|S|A|B|C)/);
  assert.doesNotMatch(tier.title, /đợt tới|đồng đội:/, 'không tính quái / đội');
  clickTab('Đội');
  assert.ok(root.querySelector('.row .tier'), 'đội có huy hiệu hạng');
  clickTab('Đợt');
  assert.match(text(), /×3/);
  assert.doesNotMatch(text(), /×9/, 'không hiện quái của nhà khác');
  clickTab('Phòng');
  assert.match(text(), /Tao/);

  assert.equal(root.querySelectorAll('script,iframe,[onerror],[onclick]').length, 0);
  assert.equal(log.sent, 0, 'tool KHÔNG BAO GIỜ gửi gì lên server');

  w.eval(code);
  assert.ok(root.querySelector('.panel').hidden);
  w.__cutdHelper.destroy();
  assert.equal(w.__cutdHelper, undefined);
  assert.equal(w.document.documentElement.querySelectorAll(':scope > div').length, 0);
  assert.equal(Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data').get, original.get);
});

test('bookmarklet: dữ liệu wiki độc hại không chạy được code', async () => {
  const { w, log, code, FakeWS } = setupDom();
  const evil = '<img src=x onerror="window.pwned=1">';
  overlay.u[scenario.c] = { ...overlay.u[scenario.c], n: evil, s: [evil], m: '../../evil"><script>', p: 'x"onclick="alert(1)' };
  try {
    const ws = new FakeWS();
    ws.addEventListener('message', e => e.data);
    w.eval(code);
    ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(summary) }));
    await tick(0);
    ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(keyframe([{ id: 1, stage_id: scenario.c, owner_id: 11, active: true }])) }));
    await tick(1200);
    const root = log.roots[0];
    assert.ok(root.querySelector('.panel').textContent.length > 0);
    assert.equal(w.pwned, undefined);
    assert.equal(root.querySelectorAll('script,[onerror],[onclick]').length, 0);
    for (const img of root.querySelectorAll('img')) assert.ok(!img.getAttribute('src') || img.getAttribute('src').startsWith(DATA_URL));
    for (const a of root.querySelectorAll('a')) assert.ok(a.href.startsWith(DATA_URL));
  } finally {
    overlay = buildOverlay(build({ raw: readJSON(PATHS.catalog), client: readJSON(PATHS.client) }));
    w.close();
  }
});

test('bookmarklet: không chạy ngoài trang game', t => {
  const { w, log, code } = setupDom('https://evil.example/');
  t.after(() => w.close());
  w.eval(code);
  assert.equal(log.alerts.length, 1);
  assert.equal(log.fetches.length, 0);
  assert.equal(w.__cutdHelper, undefined);
  assert.ok(tool.code.includes(JSON.stringify(DATA_URL)), 'địa chỉ dữ liệu phải khoá cứng trong code');
  assert.ok(!tool.code.includes('__CUTD_DATA_URL__'));
});

test('bookmarklet: bấm ở sảnh → bỏ qua socket sảnh, bám đúng socket trận; ngang/dọc; tab Đo tải', async t => {
  const { w, log, code, FakeWS } = setupDom();
  t.after(() => w.close());
  const original = Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data');
  w.eval(code);

  const lobby = new FakeWS();
  lobby.addEventListener('message', e => e.data);
  lobby.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify({ type: 'room_list', rooms: [] }) }));
  await tick(0);
  assert.notEqual(Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data').get, original.get, 'vẫn phải chờ socket trận');

  const game = new FakeWS();
  game.addEventListener('message', e => e.data);
  const emit = m => game.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit({ type: 'server_hello', protocol_version: '16' });
  await tick(0);
  assert.equal(Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data').get, original.get);
  emit(summary);
  emit(keyframe([{ id: 1, stage_id: scenario.c, owner_id: 11, health: 5, max_health: 10, active: true }]));
  await tick(1200);

  const root = log.roots[0];
  const btn = title => [...root.querySelectorAll('button')].find(b => b.title === title || b.textContent.startsWith(title));
  btn('Đo tải').click();
  assert.match(root.querySelector('.panel').textContent, /Có pet hoang dã/);
  assert.ok(root.querySelector('.verdict'));

  btn('Chuyển sang ngang').click();
  assert.ok(root.querySelector('.panel').classList.contains('h'));
  btn('Chuyển sang dọc').click();
  assert.ok(root.querySelector('.panel').classList.contains('v'));
  assert.equal(log.sent, 0);
});

import { createRequire } from 'node:module';
const jsdomUtils = createRequire(import.meta.url)('jsdom/lib/jsdom/living/generated/utils.js');
function trustedClick(w, el) {
  const ev = new w.MouseEvent('click', { bubbles: true, composed: true, cancelable: true, detail: 1 });
  jsdomUtils.implForWrapper(ev).isTrusted = true;
  jsdomUtils.implForWrapper(el)._dispatch(jsdomUtils.implForWrapper(ev));
}

test('bookmarklet: nút Bắt/Tiến hóa/Trade gọi đúng hàm game, chỉ khi người bấm, 1 cú = 1 lệnh', async t => {
  const { w, log, code, FakeWS } = setupDom();
  t.after(() => w.close());
  const calls = [], touched = new Set();
  const spy = name => (...args) => calls.push([name, ...args.map(a => (typeof a === 'object' ? a.key : a))]);
  const session = new Proxy({ catchWild: spy('catchWild'), evolveCreature: spy('evolveCreature'), tradePet: spy('tradePet'),
    sellCreature: spy('sellCreature'), dispatch: spy('dispatch') }, { get(o, k) { touched.add(k); return o[k]; } });
  const entities = new Map([
    ['w1', { key: 'w1', kind: 'wild', contentId: scenario.a }],
    ['u1', { key: 'u1', kind: 'creature', contentId: scenario.c }],
    ['u2', { key: 'u2', kind: 'creature', contentId: scenario.a }],
  ]);
  const interaction = { selectEntity: spy('selectEntity') };
  const game = { store: { entities }, session, interaction };
  w.cc = { director: { getScene: () => ({ components: [], children: [{ name: 'Game', components: [game], children: [] }] }) } };

  w.eval(code);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit(summary);
  await tick(0);
  emit(keyframe([
    { id: 1, stage_id: scenario.c, owner_id: 11, health: 5, max_health: 10, active: true },
    { id: 2, stage_id: scenario.a, owner_id: 11, health: 5, max_health: 10, active: true },
  ]));
  await tick(1200);
  const root = log.roots[0];
  const btn = text => [...root.querySelectorAll('button.act')].find(b => b.textContent.startsWith(text));
  const tab = name => [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith(name)).click();

  btn('Trade').click();
  assert.deepEqual(calls, []);
  trustedClick(w, btn('Trade'));
  assert.deepEqual(calls.at(-1), ['tradePet', 'u1', 1]);

  await tick(700);
  tab('Wild');
  trustedClick(w, btn('Bắt'));
  trustedClick(w, btn('Bắt'));
  assert.equal(calls.filter(c => c[0] === 'catchWild').length, 1);
  assert.deepEqual(calls.at(-1), ['catchWild', 'w1']);

  await tick(700);
  tab('Đội');
  const up = [...root.querySelectorAll('button.act')].find(b => b.textContent.startsWith('↑'));
  trustedClick(w, up);
  assert.equal(calls.at(-1)[0], 'evolveCreature');
  assert.ok(overlay.u[entities.get(calls.at(-1)[1]).contentId].e.some(([to]) => to === calls.at(-1)[2]), 'nhánh tiến hóa phải hợp lệ');

  await tick(700);
  trustedClick(w, root.querySelector('.row.pick .mid'));
  assert.equal(calls.at(-1)[0], 'selectEntity');

  assert.ok(!calls.some(c => ['sellCreature', 'dispatch'].includes(c[0])));
  assert.deepEqual([...touched].filter(k => !['catchWild', 'evolveCreature', 'tradePet'].includes(k)), []);
  assert.equal(log.sent, 0, 'không tự gửi gì qua socket');
});

test('bookmarklet: camera — Option/Alt+kéo trái (chặn trọn cú bấm) và kéo chuột giữa; kéo trái thường là của game', async t => {
  const { w, log, code } = setupDom();
  t.after(() => w.close());
  const canvas = w.document.getElementById('GameCanvas');
  const keys = new Set(), seen = [], gameGot = [];
  canvas.addEventListener('keydown', e => { keys.add(e.code); seen.push(e.code); });
  canvas.addEventListener('keyup', e => keys.delete(e.code));
  for (const type of ['mousedown', 'mousemove', 'mouseup', 'click']) canvas.addEventListener(type, () => gameGot.push(type));
  w.eval(code);
  const fire = (type, x, y, { button = 0, alt = false } = {}) => canvas.dispatchEvent(new w.MouseEvent(type, {
    clientX: x, clientY: y, button, altKey: alt, bubbles: true, cancelable: true,
    buttons: type === 'mouseup' || type === 'click' ? 0 : button === 1 ? 4 : 1,
  }));

  fire('mousedown', 500, 400); fire('mousemove', 460, 400); fire('mouseup', 460, 400); fire('click', 460, 400);
  assert.equal(keys.size, 0);
  assert.deepEqual(gameGot, ['mousedown', 'mousemove', 'mouseup', 'click']);

  gameGot.length = 0;
  fire('mousedown', 500, 400, { alt: true });
  fire('mousemove', 480, 400, { alt: true });
  assert.deepEqual([...keys], ['KeyD'], 'kéo tay sang trái → camera sang phải');
  fire('mousemove', 480, 370, { alt: true });
  assert.deepEqual([...keys], ['KeyS']);
  await tick(150);
  assert.equal(keys.size, 0, 'dừng tay → dừng camera');
  fire('mouseup', 480, 370, { alt: true }); fire('click', 480, 370, { alt: true });
  assert.deepEqual(gameGot, [], 'cú bấm Alt+kéo bị chặn trọn vẹn');

  fire('mousedown', 500, 400, { button: 1 });
  fire('mousemove', 500, 430, { button: 1 });
  assert.deepEqual([...keys], ['KeyW']);
  fire('mouseup', 500, 430, { button: 1 });
  assert.equal(keys.size, 0);
  assert.ok(gameGot.includes('mousedown') && gameGot.includes('mouseup'));

  fire('mousedown', 500, 400, { alt: true });
  fire('mousemove', 540, 400, { alt: true });
  assert.deepEqual([...keys], ['KeyA']);
  w.__cutdHelper.destroy();
  assert.equal(keys.size, 0, 'tắt tool phải nhả mọi phím');
  assert.ok(seen.every(k => ['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(k)), 'chỉ được giữ phím camera');
  assert.equal(log.sent, 0);
});

test('bookmarklet: dán bản mới khi bản cũ còn chạy → thay bản cũ, không chỉ ẩn/hiện', t => {
  const { w, log, code } = setupDom();
  t.after(() => w.close());
  let oldDestroyed = false;
  w.__cutdHelper = { toggle() { throw new Error('không được chỉ toggle bản cũ'); }, destroy() { oldDestroyed = true; } };
  w.eval(code);
  assert.ok(oldDestroyed, 'phải tắt bản cũ');
  assert.equal(w.__cutdHelper.version, tool.version);
  assert.equal(log.roots.length, 1, 'bản mới phải dựng panel');
  w.eval(code);
  assert.equal(log.roots.length, 1);
  assert.ok(log.roots[0].querySelector('.panel').hidden);
});

test('bookmarklet: nhãn + đích của nút lấy từ catalog GAME, overlay giả mạo không đổi được; không thao tác nhà người khác', async t => {
  const raw = readJSON(PATHS.catalog);
  const branchy = raw.catalog.species.find(s => s.evolutions?.length === 2);
  const [realA, realB] = branchy.evolutions.map(e => e.stage_id);
  const { w, log, code, FakeWS } = setupDom();
  t.after(() => { w.close(); overlay = buildOverlay(build({ raw, client: readJSON(PATHS.client) })); });
  overlay.u[branchy.id] = { ...overlay.u[branchy.id], e: [[realB, 1], [realA, 1]] };
  overlay.u[realA] = { ...overlay.u[realA], n: 'TÊN-GIẢ-B' };
  overlay.u[realB] = { ...overlay.u[realB], n: 'TÊN-GIẢ-A' };

  const calls = [];
  const entities = new Map([['u1', { kind: 'creature', contentId: branchy.id }]]);
  const session = { catchWild() {}, tradePet() {}, evolveCreature: (ent, to) => calls.push(to) };
  w.cc = { director: { getScene: () => ({ components: [{ store: { entities }, session, interaction: { selectEntity() {} } }], children: [] }) } };
  w.eval(code);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit({ type: 'server_hello', base_id: 7 });
  await tick(0);
  emit(summary);
  emit(keyframe([{ id: 1, stage_id: branchy.id, owner_id: 11, health: 5, max_health: 10, active: true }]));
  await tick(1200);
  const root = log.roots[0];
  [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith('Đội')).click();
  const ups = [...root.querySelectorAll('button.act')].filter(b => b.textContent.startsWith('↑'));
  assert.equal(ups.length, 2);
  assert.ok(!root.textContent.includes('TÊN-GIẢ'), 'tên hiển thị phải theo catalog của game');
  const cost = to => branchy.evolutions.find(e => e.stage_id === to).cost;
  for (const b of ups) {
    trustedClick(w, b);
    const sent = calls.at(-1);
    assert.ok(b.title.includes(`${cost(sent).toLocaleString('vi-VN')} vàng`), `nút "${b.textContent}" gửi ${sent} nhưng giá không khớp`);
    await tick(650);
  }

  emit({ ...keyframe([{ id: 1, stage_id: branchy.id, owner_id: 12, health: 5, max_health: 10, active: true }]), base: { base_id: 8, lives: 1, gold: 9, lumber: 0 } });
  await tick(1200);
  const n = calls.length;
  for (const b of root.querySelectorAll('button.act')) { assert.ok(b.disabled, 'đang xem nhà khác → nút phải khoá'); trustedClick(w, b); }
  assert.equal(calls.length, n);
});

test('bookmarklet: bản m.cutd.site dán giữa trận — nút khoá vài giây rồi tự Móc (mở lại trận trong khung)', async t => {
  const { w, log, code, FakeWS } = setupDom('https://m.cutd.site/?room=805A6070');
  t.after(() => w.close());
  w.document.getElementById('GameCanvas').remove();
  w.eval(code);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit(summary);
  await tick(0);
  emit(keyframe([{ id: 1, stage_id: scenario.c, owner_id: 11, health: 5, max_health: 10, active: true }]));
  await tick(1200);
  const root = log.roots[0];
  assert.ok([...root.querySelectorAll('.top button')].some(b => b.textContent === 'Móc'), 'chưa móc → hiện nút Móc');
  const acts = [...root.querySelectorAll('button.act')];
  assert.ok(acts.length && acts.every(b => b.disabled && /Móc/.test(b.title)), 'chưa móc → nút khoá, gợi ý bấm Móc');
  trustedClick(w, root.querySelector('.trade.pick .side'));
  assert.match(root.querySelector('.toast')?.textContent ?? '', /Móc/);
  assert.equal(w.document.querySelectorAll('iframe').length, 0, 'chưa đủ vài giây → chưa tự móc');
  await tick(1500);
  const frames = w.document.querySelectorAll('iframe');
  assert.equal(frames.length, 1, 'dán giữa trận → tự móc, không cần bấm');
  assert.equal(frames[0].src, 'https://m.cutd.site/?room=805A6070');
  assert.equal(log.sent, 0);
  w.__cutdHelper.destroy();
});

test('bookmarklet: bản web — dán từ sảnh → móc session/interaction lúc game tạo, gọi thẳng hàm game, gỡ bẫy sạch', async t => {
  const { w, log, code, FakeWS } = setupDom('https://m.cutd.site/?room=805A6070');
  t.after(() => w.close());
  w.document.getElementById('GameCanvas').remove();
  w.eval(code);
  assert.ok(Object.getOwnPropertyDescriptor(w.Object.prototype, 'nextSequence')?.set, 'đã đặt bẫy ở sảnh');
  w.eval(`
    window.__calls = [];
    window.Session = class { constructor(store) { this.pending = new Map(); this.nextSequence = 1; this.store = store; }
      dispatch(c) { this.nextSequence += 1; window.__calls.push(c); }
      catchWild(e) { this.dispatch(['catch', e.id]); } evolveCreature(e, to) { this.dispatch(['evolve', e.id, to]); }
      tradePet(e, slot) { this.dispatch(['trade', e.id, slot]); } sellCreature() { throw new Error('không được bán'); } }
    window.Interaction = class { constructor() { this._selectedEntityId = null; this._moveTargeting = false; }
      selectEntity(s, id) { this._selectedEntityId = id; window.__calls.push(['select', id]); } tapGround() {} clearSelection() {} }
    window.__notGame = {}; window.__notGame.nextSequence = 5;
  `);
  const stageA = JSON.stringify(scenario.a), stageC = JSON.stringify(scenario.c);
  w.eval(`
    const entities = new Map([['w1', { id: 'w1', kind: 'wild', contentId: ${stageA} }], ['u1', { id: 'u1', kind: 'creature', contentId: ${stageC} }], ['u2', { id: 'u2', kind: 'creature', contentId: ${stageA} }]]);
    window.__session = new Session({ entities }); window.__interaction = new Interaction();
  `);
  assert.equal(Object.getOwnPropertyDescriptor(w.Object.prototype, 'nextSequence'), undefined, 'gỡ bẫy sau khi móc');
  assert.equal(Object.getOwnPropertyDescriptor(w.Object.prototype, '_selectedEntityId'), undefined);
  assert.equal(w.__notGame.nextSequence, 5, 'object khác vẫn gán bình thường');
  assert.equal(w.__session.nextSequence, 1);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit(summary);
  await tick(0);
  emit(keyframe([
    { id: 1, stage_id: scenario.c, owner_id: 11, health: 5, max_health: 10, active: true },
    { id: 2, stage_id: scenario.a, owner_id: 11, health: 5, max_health: 10, active: true },
  ]));
  await tick(1200);
  const root = log.roots[0];
  assert.match(root.querySelector('.top').textContent, /m\. · móc/);
  const btn = text => [...root.querySelectorAll('button.act')].find(b => b.textContent.startsWith(text));
  trustedClick(w, btn('Trade'));
  assert.deepEqual([...w.__calls.at(-1)], ['trade', 'u1', 1]);
  await tick(700);
  [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith('Wild')).click();
  trustedClick(w, btn('Bắt'));
  assert.deepEqual([...w.__calls.at(-1)], ['catch', 'w1']);
  trustedClick(w, root.querySelector('.row.pick .mid'));
  assert.deepEqual([...w.__calls.at(-1)], ['select', 'w1']);
  assert.equal(w.__session.nextSequence, 3, 'số thứ tự do chính game tăng');
  await tick(1500);
  assert.equal(w.document.querySelectorAll('iframe').length, 0, 'đã móc từ sảnh → không mở khung');
  assert.equal(log.sent, 0);
});

test('bookmarklet: Xếp đội — 1 lệnh / lần, chờ game xác nhận, bỏ con đã đúng chỗ, từ chối thì dừng, chỉ lúc chuẩn bị', async t => {
  const { w, log, code, FakeWS } = setupDom('https://m.cutd.site/?room=805A6070');
  t.after(() => w.close());
  w.document.getElementById('GameCanvas').remove();
  w.eval(code);
  const byRow = r => Object.keys(overlay.u).find(id => overlay.u[id].l && formationRow(overlay.u[id]) === r);
  const [tank, melee, ranged] = [byRow(0), byRow(1), byRow(3)];
  w.eval(`
    window.__moves = [];
    window.Session = class { constructor(store) { this.nextSequence = 1; this.store = store; }
      dispatch(c) { const s = this.nextSequence; this.nextSequence += 1; window.__moves.push(c); return s; }
      moveCreature(e, to) { return this.dispatch(['move', e.id, to.x, to.y]); }
      catchWild() {} evolveCreature() {} tradePet() {} }
    window.Interaction = class { constructor() { this._selectedEntityId = null; } selectEntity() {} tapGround() {} clearSelection() {} }
    const arena = { originX: 0, originY: 384, width: 1216, height: 1312 };
    const entities = new Map([
      ['u1', { id: 'u1', kind: 'creature', wireId: 1, contentId: ${JSON.stringify(ranged)}, pos: { x: 608, y: 1040 } }],
      ['u2', { id: 'u2', kind: 'creature', wireId: 2, contentId: ${JSON.stringify(tank)}, pos: { x: 608, y: 1040 } }],
      ['u3', { id: 'u3', kind: 'creature', wireId: 3, contentId: ${JSON.stringify(melee)}, pos: { x: 608, y: 920 } }],
    ]);
    window.__session = new Session({ entities, ground: { arena, path: [{ x: 608, y: 192 }, { x: 608, y: 1552 }] } });
    window.__interaction = new Interaction();
  `);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit(summary);
  await tick(0);
  emit(keyframe([1, 2, 3].map(id => ({ id, stage_id: w.__session.store.entities.get(`u${id}`).contentId, owner_id: 11, health: 10, max_health: 10, active: true }))));
  await tick(1200);
  const root = log.roots[0];
  [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith('Đội')).click();
  const btn = () => [...root.querySelectorAll('.bar-row button')].find(b => /Xếp đội|Dừng/.test(b.textContent));
  assert.ok(btn() && !btn().disabled);
  assert.match(root.querySelector('.bar-row').textContent, /TANK 1.*CẬN 1.*XA 1/);
  btn().click();
  await tick(50);
  assert.equal(w.__moves.length, 0, 'click do script → bỏ qua');
  trustedClick(w, btn());
  await tick(50);
  assert.equal(w.__moves.length, 1, 'chỉ gửi 1 lệnh rồi chờ xác nhận');
  assert.deepEqual([...w.__moves[0]], ['move', 'u2', 608, 800], 'tank lên hàng đầu giữa đường quái');
  assert.match(btn().textContent, /Dừng/);
  await tick(500);
  assert.equal(w.__moves.length, 1, 'chưa có xác nhận → không gửi tiếp');
  emit({ type: 'command_ack', sequence: 1, accepted: true, tick: 101 });
  await tick(450);
  assert.equal(w.__moves.length, 2, 'u3 đã đúng chỗ → bỏ, sang u1');
  assert.deepEqual([...w.__moves[1]].slice(0, 2), ['move', 'u1']);
  assert.equal(w.__moves[1][3], 1180, 'tay dài ở cuối');
  emit({ type: 'command_ack', sequence: 2, accepted: false, reason: 'orders_closed', tick: 102 });
  await tick(200);
  assert.match(root.querySelector('.toast').textContent, /orders closed/);
  assert.ok(btn().disabled, 'vừa xếp → khoá vài giây chống spam');
  assert.equal(log.sent, 0, 'tool không tự gửi socket');
  emit({ ...summary, phase: 'wave' });
  await tick(4200);
  assert.ok(btn().disabled && /chuẩn bị/.test(btn().title), 'trong đợt → khoá');
  w.__cutdHelper.destroy();
});

test('bookmarklet: bản web — tắt tool trước khi vào trận thì gỡ bẫy', t => {
  const { w, code } = setupDom('https://m.cutd.site/');
  t.after(() => w.close());
  w.document.getElementById('GameCanvas').remove();
  w.eval(code);
  assert.ok(Object.getOwnPropertyDescriptor(w.Object.prototype, '_selectedEntityId'));
  w.__cutdHelper.destroy();
  assert.equal(Object.getOwnPropertyDescriptor(w.Object.prototype, '_selectedEntityId'), undefined);
  assert.equal(Object.getOwnPropertyDescriptor(w.Object.prototype, 'nextSequence'), undefined);
  assert.ok(!('nextSequence' in {}));
});

test('bookmarklet: bản web — nút Móc (dán giữa trận): chỉ nhận cú bấm thật, mở lại đúng trang game trong khung', async t => {
  const { w, log, code } = setupDom('https://m.cutd.site/?room=805A6070');
  t.after(() => w.close());
  w.document.getElementById('GameCanvas').remove();
  w.eval(code);
  await tick(50);
  const root = log.roots[0];
  const hook = () => [...root.querySelectorAll('button')].find(b => b.textContent === 'Móc');
  assert.ok(hook(), 'chế độ chạm có nút Móc');
  hook().click();
  assert.equal(w.document.querySelectorAll('iframe').length, 0, 'click do script → bỏ qua');
  trustedClick(w, hook());
  const frames = w.document.querySelectorAll('iframe');
  assert.equal(frames.length, 1);
  assert.equal(frames[0].src, 'https://m.cutd.site/?room=805A6070', 'chỉ mở lại chính trang game');
  await tick(50);
  assert.ok(!hook(), 'đang móc → ẩn nút');
  assert.match(root.querySelector('.top').textContent, /đang móc/);
  w.__cutdHelper.destroy();
});

test('bookmarklet: phím F bấm nút chính của game (bản web) — chỉ phím thật, không khi đang gõ/giữ phím/nút tắt', async t => {
  const { w, code } = setupDom('https://m.cutd.site/?room=805A6070');
  t.after(() => w.close());
  w.document.getElementById('GameCanvas').remove();
  const doc = w.document;
  let clicks = 0;
  const primary = doc.createElement('button');
  primary.className = 'authored-node';
  primary.dataset.node = 'Primary';
  primary.onclick = () => { clicks++; };
  primary.getClientRects = () => [{ width: 10, height: 10 }];
  const other = doc.createElement('button');
  other.className = 'authored-node';
  other.dataset.node = 'Sell';
  other.onclick = () => { throw new Error('không được bấm nút khác'); };
  const chat = doc.createElement('input');
  doc.body.append(primary, other, chat);
  w.eval(code);

  const key = (opts = {}, target = doc.body, trusted = true) => {
    const ev = new w.KeyboardEvent('keydown', { code: 'KeyF', key: 'f', bubbles: true, cancelable: true, ...opts });
    if (trusted) {
      jsdomUtils.implForWrapper(ev).isTrusted = true;
      jsdomUtils.implForWrapper(target)._dispatch(jsdomUtils.implForWrapper(ev));
    } else target.dispatchEvent(ev);
  };
  key();
  assert.equal(clicks, 1, 'F thật → bấm nút Primary của game');
  key({}, doc.body, false);
  assert.equal(clicks, 1, 'phím do script tạo → bỏ qua');
  key({ repeat: true });
  assert.equal(clicks, 1, 'giữ phím (lặp) → bỏ qua');
  key({}, chat);
  assert.equal(clicks, 1, 'đang gõ chat → bỏ qua');
  key({ code: 'KeyS', key: 's' });
  assert.equal(clicks, 1, 'phím khác → bỏ qua');
  primary.disabled = true;
  key();
  assert.equal(clicks, 1, 'nút đang tắt → không bấm');
  w.__cutdHelper.destroy();
  primary.disabled = false;
  key();
  assert.equal(clicks, 1, 'tắt tool → hết phím tắt');
});

test('bookmarklet: wiki cũ hơn game → tool tự tính DPS thật / vai trò / hạng từ /catalog của game', async t => {
  const saved = overlay;
  overlay = JSON.parse(JSON.stringify(saved));
  overlay.v = 'stalestale00';
  for (const u of Object.values(overlay.u)) for (const k of ['ed', 'r', 'sv', 'md', 'ul', 'tp', 'au', 'hp', 'dps']) delete u[k];
  t.after(() => { overlay = saved; });
  const { w, log, code, FakeWS } = setupDom();
  t.after(() => w.close());
  w.eval(code);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit(summary);
  await tick(0);
  emit(keyframe([{ id: 1, stage_id: scenario.c, owner_id: 11, health: 5, max_health: 10, active: true }]));
  await tick(1200);
  const root = log.roots[0];
  [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith('Wild')).click();
  const tier = root.querySelector('.tier');
  assert.ok(tier, 'vẫn có hạng dù overlay thiếu số liệu');
  assert.match(tier.title, /Đỉnh dòng: |dạng mạnh nhất/);
  [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith('Đo tải')).click();
  assert.match(root.querySelector('.panel').textContent, /wiki cũ hơn game/);
});

test('bookmarklet: nhãn vai trò (ATK/TANK/BUFF…) + lọc theo vai trò ở tab Wild', async t => {
  const { w, log, code, FakeWS } = setupDom();
  t.after(() => w.close());
  w.eval(code);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit(summary);
  await tick(0);
  emit(keyframe([{ id: 1, stage_id: scenario.c, owner_id: 11, health: 5, max_health: 10, active: true }]));
  await tick(1200);
  const root = log.roots[0];
  const clickText = text => [...root.querySelectorAll('button')].find(b => b.textContent === text).click();
  [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith('Wild')).click();
  const chips = [...root.querySelectorAll('.row .kit b')].map(b => b.textContent);
  assert.ok(chips.some(c => c === 'ATK' || c === 'TANK'), 'có vai chính');
  const primary = chips.find(c => c === 'ATK' || c === 'TANK');
  clickText(primary === 'ATK' ? 'TANK' : 'ATK');
  assert.equal(root.querySelectorAll('.row').length, 0);
  assert.match(root.querySelector('.panel').textContent, /Không có con nào đúng vai trò/);
  clickText(primary);
  assert.equal(root.querySelectorAll('.row').length, 1);
  clickText('Tất cả');
});
