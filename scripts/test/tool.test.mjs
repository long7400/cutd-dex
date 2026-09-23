import { test, before } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createState, applyMessage, tradeOptions, evolvePath, nextWaveForBase, myUnits, buildGameCatalog } from '../../tool/logic.js';
import { screenPoint, groundOf, tradeSlotPos } from '../../tool/web-camera.js';
import { buildTool } from '../build-tool.mjs';
import { build, buildOverlay, PATHS } from '../build.mjs';
import { readJSON } from '../lib/fsx.mjs';

const DATA_URL = 'https://long7400.github.io/cutd-dex/';
let tool, overlay, scenario;

before(async () => {
  tool = await buildTool();
  overlay = buildOverlay(build({ raw: readJSON(PATHS.catalog), client: readJSON(PATHS.client) }));
  // Kịch bản từ dữ liệu thật: 1 chuỗi tiến hóa A → B → C; offer 1 cần C (mình có C), offer 2 cần C nhưng mình chỉ có A.
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

  // Delta: mất con C → offer 1 phải chuyển sang "tiến hóa từ A".
  applyMessage(s, { type: 'base_delta', tick: 110, from_tick: 100, base: { base_id: 7, lives: 29, gold: 5000, lumber: 0 },
    unit_ids_removed: [1], creep_ids_removed: [], wild_ids_removed: [1] });
  const t = tradeOptions(s, overlay)[0];
  assert.equal(t.ready.length, 0);
  assert.equal(t.evolve.cost, scenario.costAC);
  assert.equal(s.wilds.size, 0);
  assert.equal(s.lives, 29);

  // Delta của căn cứ khác bị bỏ qua.
  assert.equal(applyMessage(s, { type: 'base_delta', base: { base_id: 99 } }), false);
  assert.deepEqual(nextWaveForBase(s).map(g => g.count), [3]);
});

test('logic: dữ liệu rác không làm vỡ', () => {
  const s = createState();
  for (const m of [null, 1, 'x', [], { type: 'base_keyframe' }, { type: 'base_keyframe', base: 5 }, { type: 'room_summary', bases: 'x' }]) {
    assert.doesNotThrow(() => applyMessage(s, m));
  }
});

function setupDom(url = 'https://cutd.site/?room=TEST') {
  const vc = new VirtualConsole();
  const dom = new JSDOM('<!doctype html><html><body><canvas id="GameCanvas"></canvas></body></html>', { url, runScripts: 'outside-only', pretendToBeVisual: true, virtualConsole: vc });
  const w = dom.window;
  const log = { sent: 0, fetches: [], alerts: [], roots: [] };
  class FakeWS extends w.EventTarget { send() { log.sent++; } }
  w.WebSocket = FakeWS;
  w.alert = m => log.alerts.push(m);
  // overlay.json của wiki + /catalog của chính game (tool lấy dữ liệu quyết định hành động từ /catalog).
  w.fetch = async (u, opts) => {
    log.fetches.push({ u, opts });
    const body = JSON.stringify(u === '/catalog' ? readJSON(PATHS.catalog) : overlay);
    return { ok: true, text: async () => body };
  };
  const attach = w.Element.prototype.attachShadow;
  w.Element.prototype.attachShadow = function (o) { const r = attach.call(this, { ...o, mode: 'open' }); log.roots.push(r); return r; };
  const code = tool.code; // địa chỉ dữ liệu đã khoá sẵn lúc build
  return { w, log, code, FakeWS };
}

const tick = ms => new Promise(r => setTimeout(r, ms));

test('bookmarklet: chỉ đọc, bắt socket rồi trả getter, hiển thị trade/wild, tắt sạch', async t => {
  const { w, log, code, FakeWS } = setupDom();
  t.after(() => w.close());
  const original = Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data');

  // "Game" đã kết nối từ trước khi bấm bookmark.
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
  assert.ok(root.querySelector('.trade.is-ok button.act'), 'slot có sẵn lính phải có nút Trade');
  assert.doesNotMatch(text(), /Vàng/, 'không lặp lại chỉ số game đã hiện');
  assert.ok(root.querySelector('.trade.is-ok'), 'slot trade được phải được đánh dấu');

  const clickTab = name => [...root.querySelectorAll('button')].find(b => b.textContent.startsWith(name)).click();
  clickTab('Wild');
  assert.match(text(), new RegExp(overlay.u[scenario.a].n));
  clickTab('Đợt');
  assert.match(text(), /×3/);
  assert.doesNotMatch(text(), /×9/, 'không hiện quái của nhà khác');
  clickTab('Phòng');
  assert.match(text(), /Tao/);

  // Không có HTML nào từ dữ liệu được parse: tên độc hại hiển thị dạng chữ.
  assert.equal(root.querySelectorAll('script,iframe,[onerror],[onclick]').length, 0);
  assert.equal(log.sent, 0, 'tool KHÔNG BAO GIỜ gửi gì lên server');

  // Bấm bookmark lần 2 = ẩn/hiện; tắt = dọn sạch.
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
    // Tên lấy theo catalog game nên tên giả không hiện; dù hiện ở đâu (tooltip kỹ năng…) cũng chỉ là chữ.
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

  // Socket sảnh: message không phải của trận → không bám, getter vẫn chờ.
  const lobby = new FakeWS();
  lobby.addEventListener('message', e => e.data);
  lobby.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify({ type: 'room_list', rooms: [] }) }));
  await tick(0);
  assert.notEqual(Object.getOwnPropertyDescriptor(w.MessageEvent.prototype, 'data').get, original.get, 'vẫn phải chờ socket trận');

  // Vào phòng: socket trận mới → server_hello → bám, trả getter.
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

// Click "thật" (isTrusted) trong jsdom — mô phỏng người dùng bấm chuột.
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

  // Trade: nút Trade trên slot có sẵn lính.
  btn('Trade').click();                         // click do script → bị bỏ qua
  assert.deepEqual(calls, []);
  trustedClick(w, btn('Trade'));
  assert.deepEqual(calls.at(-1), ['tradePet', 'u1', 1]);

  // Bấm đúp trong 600ms chỉ tính 1 lệnh.
  await tick(700);
  tab('Wild');
  trustedClick(w, btn('Bắt'));
  trustedClick(w, btn('Bắt'));
  assert.equal(calls.filter(c => c[0] === 'catchWild').length, 1);
  assert.deepEqual(calls.at(-1), ['catchWild', 'w1']);

  // Tiến hóa: đúng nhánh của con đó.
  await tick(700);
  tab('Đội');
  const up = [...root.querySelectorAll('button.act')].find(b => b.textContent.startsWith('↑'));
  trustedClick(w, up);
  assert.equal(calls.at(-1)[0], 'evolveCreature');
  assert.ok(overlay.u[entities.get(calls.at(-1)[1]).contentId].e.some(([to]) => to === calls.at(-1)[2]), 'nhánh tiến hóa phải hợp lệ');

  // Bấm vào dòng = chọn trong game (không gửi lệnh).
  await tick(700);
  trustedClick(w, root.querySelector('.row.pick .mid'));
  assert.equal(calls.at(-1)[0], 'selectEntity');

  // Không bao giờ đụng các hàm khác của game.
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

  // Kéo chuột trái thường → hoàn toàn là của game (tool không giữ phím, không chặn gì).
  fire('mousedown', 500, 400); fire('mousemove', 460, 400); fire('mouseup', 460, 400); fire('click', 460, 400);
  assert.equal(keys.size, 0);
  assert.deepEqual(gameGot, ['mousedown', 'mousemove', 'mouseup', 'click']);

  // Option/Alt + kéo trái → giữ phím; game KHÔNG thấy nửa nào của cú bấm (không kẹt trạng thái).
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

  // Chuột giữa + kéo → giữ phím; game vẫn nhận đủ (game bỏ qua chuột giữa).
  fire('mousedown', 500, 400, { button: 1 });
  fire('mousemove', 500, 430, { button: 1 });
  assert.deepEqual([...keys], ['KeyW']);
  fire('mouseup', 500, 430, { button: 1 });
  assert.equal(keys.size, 0);
  assert.ok(gameGot.includes('mousedown') && gameGot.includes('mouseup'));

  // Đang kéo mà tắt tool → nhả hết phím.
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
  // Dán lại đúng bản đang chạy → chỉ ẩn/hiện.
  w.eval(code);
  assert.equal(log.roots.length, 1);
  assert.ok(log.roots[0].querySelector('.panel').hidden);
});

test('bookmarklet: nhãn + đích của nút lấy từ catalog GAME, overlay giả mạo không đổi được; không thao tác nhà người khác', async t => {
  const raw = readJSON(PATHS.catalog);
  // Chọn 1 stage có 2 nhánh tiến hóa thật.
  const branchy = raw.catalog.species.find(s => s.evolutions?.length === 2);
  const [realA, realB] = branchy.evolutions.map(e => e.stage_id);
  const { w, log, code, FakeWS } = setupDom();
  t.after(() => { w.close(); overlay = buildOverlay(build({ raw, client: readJSON(PATHS.client) })); });
  // Overlay giả mạo: đảo thứ tự nhánh + tráo tên + giá rẻ bèo.
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
  // Mỗi nút gửi đúng nhánh mà nhãn/giá của nó ghi (theo game), bất kể overlay xếp thế nào.
  for (const b of ups) {
    trustedClick(w, b);
    const sent = calls.at(-1);
    assert.ok(b.title.includes(`${cost(sent).toLocaleString('vi-VN')} vàng`), `nút "${b.textContent}" gửi ${sent} nhưng giá không khớp`);
    await tick(650);
  }

  // Chuyển sang xem nhà người khác (base 8) → nút bị khoá.
  emit({ ...keyframe([{ id: 1, stage_id: branchy.id, owner_id: 12, health: 5, max_health: 10, active: true }]), base: { base_id: 8, lives: 1, gold: 9, lumber: 0 } });
  await tick(1200);
  const n = calls.length;
  for (const b of root.querySelectorAll('button.act')) { assert.ok(b.disabled, 'đang xem nhà khác → nút phải khoá'); trustedClick(w, b); }
  assert.equal(calls.length, n);
});

// Bản web (m.cutd.site): dựng 1 "game giả" đúng các điểm tool dựa vào — canvas #world nhận chạm, phím Esc/Home,
// dock HTML (MonsterPanel/Name, Primary), bảng "Chọn tiến hóa" (ModalShade/RowN/Title). Game giả chọn con gần điểm chạm
// nhất theo toạ độ màn hình của camera mặc định; chỉ khi đã nhấn Home thì camera mới ở mặc định.
function fakeWebGame(w, { honourHome = true } = {}) {
  const doc = w.document;
  const cat = buildGameCatalog(readJSON(PATHS.catalog)), rules = readJSON(PATHS.catalog).catalog.base;
  const game = { commands: [], keys: [], sel: null, tradeTargeting: false, home: false, entities: [], origin: null };
  // jsdom chưa có PointerEvent (trình duyệt thật thì có).
  w.PointerEvent ??= class extends w.MouseEvent {
    constructor(type, o = {}) { super(type, o); this.pointerId = o.pointerId; this.pointerType = o.pointerType; this.isPrimary = !!o.isPrimary; }
  };
  w.Element.prototype.getClientRects = function () { return this.closest('[hidden]') ? [] : [{ width: 1, height: 1 }]; };
  const canvas = doc.createElement('canvas');
  canvas.id = 'world';
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 1280, height: 720 });
  const node = (tag, name, parent) => { const el = doc.createElement(tag); el.className = 'authored-node'; el.dataset.node = name; parent.append(el); return el; };
  const panel = node('div', 'MonsterPanel', doc.body); panel.hidden = true;
  const detail = node('div', 'Detail', panel);
  const nameEl = node('div', 'Name', detail);
  node('div', 'Name', node('button', 'Skill0', detail)).textContent = 'tên kỹ năng';
  const primary = node('button', 'Primary', detail);
  const shade = node('div', 'ModalShade', doc.body); shade.hidden = true;
  doc.body.append(canvas);
  const render = () => {
    const e = game.sel;
    panel.hidden = !e;
    nameEl.textContent = e ? cat.get(e.stage).shown : '';
    primary.disabled = !e;
  };
  w.addEventListener('keydown', e => {
    game.keys.push(e.key);
    if (e.key === 'Home' && honourHome) game.home = true;
    if (e.key === 'Escape') { if (!shade.hidden) shade.hidden = true; else { game.sel = null; game.tradeTargeting = false; render(); } }
  });
  const pick = (x, y) => {
    let best = null, bestD = 25;
    for (const e of game.entities) {
      const pt = screenPoint(rules, game.origin, 0, 1280, 720, e.pos);
      const d = pt ? Math.hypot(pt.x - x, pt.y - y) : Infinity;
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  };
  let down = null;
  canvas.addEventListener('pointerdown', e => { down = e; });
  canvas.addEventListener('pointerup', e => {
    if (!down || e.button !== 0 || down.button !== 0) return;
    down = null;
    game.taps = (game.taps ?? 0) + 1;
    const hit = game.home ? pick(e.clientX, e.clientY) : null; // camera chưa về mặc định → chạm lệch
    if (game.tradeTargeting && hit?.kind === 'unit') { game.commands.push(['trade', hit.key, game.sel.slot]); game.tradeTargeting = false; return; }
    game.sel = hit; render();
  });
  primary.onclick = () => {
    const e = game.sel;
    if (!e) return;
    if (e.kind === 'wild') game.commands.push(['catch', e.key]);
    if (e.kind === 'offer') game.tradeTargeting = true;
    if (e.kind === 'unit') {
      shade.replaceChildren();
      cat.get(e.stage).ev.forEach((to, i) => {
        const row = node('button', `Row${i}`, shade);
        node('div', 'Title', row).textContent = cat.get(to).shown;
        row.onclick = () => { game.commands.push(['evolve', e.key, to]); shade.hidden = true; };
      });
      shade.hidden = false;
    }
  };
  render();
  return { game, canvas, rules, cat };
}

test('bookmarklet: bản m.cutd.site — tự nhận bản web, chạm đúng con rồi bấm nút của game (Bắt / Tiến hóa / Trade)', async t => {
  const { w, log, code, FakeWS } = setupDom('https://m.cutd.site/?room=805A6070');
  t.after(() => w.close());
  w.document.getElementById('GameCanvas').remove(); // bản web không có #GameCanvas/cc
  const { game, rules } = fakeWebGame(w);
  const origin = { x: 2048, y: 2336 };
  const g = groundOf(rules, origin);
  game.origin = origin;
  const wildPos = { x: origin.x + 300, y: origin.y + 1900 }, u1Pos = { x: origin.x + 608, y: origin.y + 1000 }, u2Pos = { x: origin.x + 400, y: origin.y + 700 };
  game.entities = [
    { key: 'w1', kind: 'wild', stage: scenario.a, pos: wildPos },
    { key: 'u1', kind: 'unit', stage: scenario.c, pos: u1Pos },
    { key: 'u2', kind: 'unit', stage: scenario.a, pos: u2Pos },
    { key: 't1', kind: 'offer', stage: scenario.b, slot: 1, pos: tradeSlotPos(g, 1) },
  ];

  w.eval(code);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit(summary);
  await tick(0);
  emit(keyframe([
    { id: 1, stage_id: scenario.c, owner_id: 11, health: 5, max_health: 10, active: true, position: u1Pos },
    { id: 2, stage_id: scenario.a, owner_id: 11, health: 5, max_health: 10, active: true, position: u2Pos },
  ], { base: { base_id: 7, lives: 30, gold: 50000, lumber: 0, alive: true, research: [], origin }, wilds: [{ id: 1, stage_id: scenario.a, position: wildPos }] }));
  await tick(1200);
  const root = log.roots[0];
  assert.match(root.querySelector('.top').textContent, /m\. · web/, 'tự nhận bản web');
  assert.ok(!root.querySelector('.webnote'), 'không còn gợi ý chuyển sang cutd.site');
  const btn = text => [...root.querySelectorAll('button.act')].find(b => b.textContent.startsWith(text));
  const tab = name => [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith(name)).click();
  const done = () => tick(900);

  // Trade: click do script → bỏ qua; click thật → chọn hàng trade, bấm Trade, chạm đúng con u1.
  btn('Trade').click();
  await done();
  assert.equal(game.taps ?? 0, 0);
  trustedClick(w, btn('Trade'));
  await done();
  assert.deepEqual(game.commands, [['trade', 'u1', 1]], root.querySelector('.toast')?.textContent);
  assert.ok(game.keys.includes('Escape') && game.keys.includes('Home'), 'Esc + Home trước khi chạm');

  // Bắt.
  tab('Wild');
  await tick(50);
  trustedClick(w, btn('Bắt'));
  await done();
  assert.deepEqual(game.commands.at(-1), ['catch', 'w1']);

  // Tiến hóa: mở bảng của game rồi bấm đúng hàng nhánh.
  tab('Đội');
  await tick(50);
  const up = [...root.querySelectorAll('button.act')].find(b => b.textContent.startsWith('↑'));
  trustedClick(w, up);
  await done();
  const evo = game.commands.at(-1);
  assert.equal(evo[0], 'evolve');
  const stage = game.entities.find(e => e.key === evo[1]).stage;
  assert.ok(overlay.u[stage].e.some(([to]) => to === evo[2]), 'đúng nhánh của đúng con');

  // Bấm dòng = chỉ chọn, không lệnh.
  const n = game.commands.length;
  trustedClick(w, root.querySelector('.row.pick .mid'));
  await done();
  assert.equal(game.commands.length, n);
  assert.ok(game.sel, 'đã chọn con trong game');
  assert.equal(log.sent, 0, 'không tự gửi gì qua socket');
});

test('bookmarklet: bản web — chạm lệch (tên trên dock không khớp) thì dừng, không bấm nút của game', async t => {
  const { w, log, code, FakeWS } = setupDom('https://m.cutd.site/?room=805A6070');
  t.after(() => w.close());
  w.document.getElementById('GameCanvas').remove();
  const { game } = fakeWebGame(w, { honourHome: false }); // game "đổi camera": Home không đưa về mặc định
  const origin = { x: 2048, y: 2336 };
  const wildPos = { x: origin.x + 300, y: origin.y + 1900 };
  game.origin = origin;
  game.entities = [{ key: 'w1', kind: 'wild', stage: scenario.a, pos: wildPos }];
  w.eval(code);
  const ws = new FakeWS();
  ws.addEventListener('message', e => e.data);
  const emit = m => ws.dispatchEvent(new w.MessageEvent('message', { data: JSON.stringify(m) }));
  emit(summary);
  await tick(0);
  emit(keyframe([], { base: { base_id: 7, lives: 30, gold: 50000, lumber: 0, alive: true, research: [], origin }, wilds: [{ id: 1, stage_id: scenario.a, position: wildPos }] }));
  await tick(1200);
  const root = log.roots[0];
  [...root.querySelectorAll('.tab')].find(b => b.textContent.startsWith('Wild')).click();
  await tick(50);
  trustedClick(w, [...root.querySelectorAll('button.act')].find(b => b.textContent.startsWith('Bắt')));
  await tick(900);
  assert.equal(game.taps, 1);
  assert.deepEqual(game.commands, [], 'chạm lệch → không bấm nút Bắt');
  assert.match(root.querySelector('.toast').textContent, /Chạm chưa trúng/);
});

test('web-camera: khớp số tính bằng PlayCanvas + hàm căn khung của game (m.cutd.site)', () => {
  const rules = readJSON(PATHS.catalog).catalog.base;
  const origin = { x: 2048, y: 2336 };
  // Sinh bằng playcanvas@2.22 (Quat.setFromEulerAngles, Mat4.setPerspective) + hàm KL/aR chép từ bundle game.
  const golden = [
    [0, 1280, 720, { x: 2656, y: 3336 }, 655.979, 386.007], [0, 1280, 720, { x: 2348, y: 4236 }, 752.985, 765.694],
    [0, 1280, 720, { x: 1688, y: 3232 }, 138.538, 492.545], [0, 1280, 720, { x: 2148, y: 2536 }, 368.436, 244.394],
    [2, 900, 1100, { x: 2656, y: 3336 }, 431.971, 579.343], [2, 900, 1100, { x: 2348, y: 4236 }, 119.554, 905.997],
    [2, 900, 1100, { x: 1688, y: 3232 }, 2.811, 386.85], [2, 900, 1100, { x: 2148, y: 2536 }, 378.565, 307.336],
  ];
  for (const [view, W, H, pos, x, y] of golden) {
    const pt = screenPoint(rules, origin, view, W, H, pos);
    assert.ok(Math.abs(pt.x - x) < 0.01 && Math.abs(pt.y - y) < 0.01, `view ${view} ${JSON.stringify(pos)} → ${pt.x},${pt.y}`);
  }
  assert.deepEqual(tradeSlotPos(groundOf(rules, origin), 3), { x: 1688, y: 3232 });
  assert.equal(screenPoint(null, origin, 0, 100, 100, origin), null);
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
  primary.getClientRects = () => [{ width: 10, height: 10 }]; // jsdom không tính layout
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
