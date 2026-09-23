// Tự bóc lại dữ liệu game khi có update.
// Cách chạy:  node scripts/scrape.mjs [--force]
//   --force : bỏ qua check hash, bóc lại toàn bộ
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { spawnSync } from 'node:child_process';

const BASE = 'https://m.cutd.site';
const FORCE = process.argv.includes('--force');
const dir = dirname(fileURLToPath(import.meta.url));
const read = f => JSON.parse(readFileSync(join(dir, f), 'utf8'));
const write = (f, d) => writeFileSync(join(dir, f), JSON.stringify(d));

const j = s => `\x1b[36m${s}\x1b[0m`;
const ok = s => `\x1b[32m${s}\x1b[0m`;
const warn = s => `\x1b[33m${s}\x1b[0m`;

async function get(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`${url} → HTTP ${r.status}`);
  return r;
}

// ---------- 1. Lấy bundle JS mới nhất ----------
console.log(j('① Lấy index.html…'));
const html = await (await get(BASE)).text();
const m = html.match(/src="(\/assets\/index-[\w-]+\.js)"/);
if (!m) throw new Error('Không tìm thấy bundle JS trong index.html — game đổi cấu trúc?');
console.log(`   bundle: ${m[1]}`);

// ---------- 2. Bóc map từ bundle ----------
console.log(j('② Bóc mapping từ bundle…'));
const js = await (await get(BASE + m[1])).text();

// unit id → model (portrait)
const unit2model = {};
for (const [, u, p] of js.matchAll(/(unit_h\w{3}):`([a-z0-9_]+)`/g)) {
  unit2model[u] ??= p;
}
console.log(`   unit→model: ${ok(Object.keys(unit2model).length)} unit`);

// model → hệ
const modelAffinity = {};
for (const [, k, a] of js.matchAll(/\{key:`([a-z0-9_]+)`,affinity:`([a-z]+)`/g)) {
  modelAffinity[k] = a;
}
console.log(`   model→affinity: ${ok(Object.keys(modelAffinity).length)} model`);

// màu hệ (fallback: giữ file cũ nếu không bóc được)
let elementColors = null;
const ci = js.indexOf('{normal:[[');
if (ci >= 0) {
  let depth = 0, end = ci;
  for (let i2 = ci; i2 < js.length; i2++) {
    if (js[i2] === '{') depth++;
    else if (js[i2] === '}') { depth--; if (!depth) { end = i2 + 1; break; } }
  }
  elementColors = {};
  for (const [, name, arr] of js.slice(ci, end).matchAll(/(\w+):(\[\[[^\]]+\],\[[^\]]+\],\[[^\]]+\]\])/g)) {
    elementColors[name] = JSON.parse(arr);
  }
}
if (elementColors) console.log(`   màu hệ: ${ok(Object.keys(elementColors).length)} hệ`);
else { elementColors = read('element_colors.json'); console.log(warn('   màu hệ: giữ nguyên file cũ')); }

// ---------- 3. Catalog + check update ----------
console.log(j('③ Lấy catalog…'));
const response = await (await get(BASE + '/catalog')).json();
const cat = response.catalog;

const oldHash = existsSync(join(dir, 'catalog.json'))
  ? read('catalog.json').catalog_hash : null;
console.log(`   hash cũ:  ${oldHash ?? '(chưa có)'}`);
console.log(`   hash mới: ${response.catalog_hash}`);

if (!FORCE && oldHash === response.catalog_hash) {
  console.log(ok('✓ Không có update — hash trùng nhau, kết thúc.'));
  process.exit(0);
}
console.log(warn('⚠ Catalog thay đổi → bóc lại toàn bộ!'));

// so sánh pet mới / pet bị xoá
const oldCat = existsSync(join(dir, 'catalog.json')) ? read('catalog.json').catalog : null;
const nameOf = (c, id) => c.display_names.find(d => d.id === id)?.value ?? id;
if (oldCat) {
  const oldIds = new Set(oldCat.species.filter(s => s.catchable).map(s => s.id));
  const newIds = new Set(cat.species.filter(s => s.catchable).map(s => s.id));
  const added = cat.species.filter(s => s.catchable && !oldIds.has(s.id));
  const removed = oldCat.species.filter(s => s.catchable && !newIds.has(s.id));
  if (added.length) {
    console.log(`   ${ok('+ ' + added.length + ' pet mới')}:`);
    for (const s of added) console.log(`     + ${s.legendary ? '★ ' : ''}${nameOf(cat, s.display_name_id)}`);
  }
  if (removed.length) {
    console.log(`   ${warn('- ' + removed.length + ' pet BỊ XÓA khỏi game')}:`);
    for (const s of removed) console.log(`     - ${s.legendary ? '★ ' : ''}${nameOf(oldCat, s.display_name_id)}`);
  }
  if (!added.length && !removed.length) console.log('   danh sách pet không đổi (chỉ đổi số liệu)');
}

// ---------- 4. Tính ảnh cần + tải thiếu ----------
console.log(j('④ Kiểm tra ảnh portrait…'));
const spById = new Map(cat.species.map(s => [s.id, s]));
const imgOf = sid => unit2model[sid];

const need = new Set();
for (const s of cat.species) {
  if (!s.catchable) continue;
  let cur = s, seen = new Set();
  while (cur && !seen.has(cur.id)) {
    seen.add(cur.id);
    if (imgOf(cur.id)) need.add(imgOf(cur.id));
    const e = cur.evolutions ?? [];
    if (!e.length) break;
    cur = spById.get(e[0].stage_id);
  }
}
for (const slot of cat.trade.slots) for (const r of slot.recipes) {
  for (const sid of [r.required_stage_id, r.offered_stage_id]) {
    if (imgOf(sid)) need.add(imgOf(sid));
  }
}
for (const p of cat.wild.pools) for (const e of p.entries) {
  if (imgOf(e.stage_id)) need.add(imgOf(e.stage_id));
}

const imgDir = join(dir, '../public/images');
const { readdirSync } = await import('node:fs');
const have = new Set(readdirSync(imgDir).map(f => f.replace('.png', '')));
const missing = [...need].filter(x => !have.has(x));
console.log(`   cần ${need.size} ảnh | thiếu ${missing.length}`);
if (missing.length) console.log(`   ${missing.map(x => x + '.png').join(', ')}`);

let downloaded = 0, failed = [];
const queue = [...missing];
await Promise.all(Array.from({ length: 8 }, async () => {
  while (queue.length) {
    const model = queue.pop();
    try {
      const r = await get(`${BASE}/resources/art/portraits/${model}.png`);
      const buf = Buffer.from(await r.arrayBuffer());
      writeFileSync(join(imgDir, model + '.png'), buf);
      downloaded++;
    } catch (e) {
      failed.push(`${model} (${e.message})`);
    }
  }
}));
if (downloaded) console.log(`   ${ok('↓ ' + downloaded + ' ảnh mới')}`);
if (failed.length) console.log(warn(`   Lỗi tải: ${failed.join(', ')}`));

// ---------- XÓA ẢNH RÁC (pet bị game remove) ----------
// keepList: ảnh UI tự tham chiếu (logo/favicon), không thuộc data
const keepList = new Set(['pet_xiaohuolong']);
// an toàn: nếu bóc mapping bị lỗi (quá ít unit) thì KHÔNG xoá gì cả
if (Object.keys(unit2model).length < 100 || need.size < 100) {
  console.log(warn(`   ⚠ Bóc mapping bất thường (${Object.keys(unit2model).length} unit, ${need.size} ảnh cần) — BỎ QUA bước xoá rác để an toàn.`));
} else {
  const garbage = readdirSync(imgDir)
    .filter(f => f.endsWith('.png') && !keepList.has(f.replace('.png', '')) && !need.has(f.replace('.png', '')));
  if (garbage.length) {
    const { unlinkSync } = await import('node:fs');
    for (const f of garbage) unlinkSync(join(imgDir, f));
    console.log(`   ${warn('🗑 XÓA ' + garbage.length + ' ảnh rác (pet không còn trong game)')}:`);
    console.log(`     ${garbage.join(', ')}`);
  } else {
    console.log('   không có ảnh rác');
  }
}

// ---------- 5. Lưu + build data ----------
write('catalog.json', response);
write('unit2model.json', unit2model);
write('model_affinity.json', modelAffinity);
write('element_colors.json', elementColors);

console.log(j('⑤ Build data.json…'));
const r = spawnSync('node', [join(dir, 'build-data.mjs')], { stdio: 'inherit' });
if (r.status !== 0) throw new Error('build-data thất bại');

console.log(ok(`\n✓ Update xong — hash ${response.catalog_hash.slice(0, 12)}…`));
console.log('   Commit & push để deploy (hoặc để GitHub Action tự làm).');
