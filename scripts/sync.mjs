// Đồng bộ dữ liệu từ game → data/ + public/ rồi build src/data/db.json.
//   node scripts/sync.mjs            # chỉ tải khi có thay đổi
//   node scripts/sync.mjs --force    # bỏ qua cache, tải + kiểm tra lại toàn bộ
//
// Chiến lược chống request thừa:
//   ① /catalog và / (index.html) gửi song song kèm If-None-Match → không đổi = 304, 0 byte body.
//   ② Bundle JS (~2.5MB, tên file có content-hash) chỉ tải khi tên bundle đổi.
//   ③ Ảnh: thiếu thì tải; khi game đổi thì revalidate bằng ETag (304 nếu ảnh không đổi); lưu dạng WebP.
//   ④ Mọi file ghi atomic; dữ liệu mới phải qua validate mới được ghi đè bản cũ.
import { existsSync, readdirSync, unlinkSync, appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { request, mapLimit, stats } from './lib/http.mjs';
import { readFileSync } from 'node:fs';
import { readJSON, writeJSON, writeAtomic } from './lib/fsx.mjs';
import { toWebp } from './lib/image.mjs';
import { extractClient, validateClient, bundlePathFrom } from './lib/client.mjs';
import { createResolver } from './lib/game.mjs';
import { diffCatalog } from './lib/diff.mjs';
import { build, PATHS } from './build.mjs';

const BASE = (process.env.CUTD_BASE ?? 'https://m.cutd.site').replace(/\/$/, '');
const FORCE = process.argv.includes('--force');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE = join(ROOT, 'data/state.json');
const ASSET_DIRS = { portraits: join(ROOT, 'public/portraits'), research: join(ROOT, 'public/research'), skills: join(ROOT, 'public/skills') };
const ASSET_SIZE = { skills: 96 };
const CONCURRENCY = 8;

const c = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${s}\x1b[0m` : String(s));
const info = s => console.log(c(36, s)), ok = s => console.log(c(32, s)), warn = s => console.log(c(33, s));
const t0 = performance.now();

const state = readJSON(STATE, {});
state.assets ??= {};
const stateBefore = JSON.stringify(sortKeys(state));
let oldRaw = readJSON(PATHS.catalog);
let client = readJSON(PATHS.client);

function validateCatalog(raw) {
  const cat = raw?.catalog;
  const bad = [];
  if (typeof raw?.catalog_hash !== 'string') bad.push('catalog_hash');
  for (const k of ['species', 'abilities', 'modifiers', 'display_names']) if (!Array.isArray(cat?.[k]) || !cat[k].length) bad.push(k);
  if ((cat?.species?.filter(s => s.catchable).length ?? 0) < 10) bad.push('catchable<10');
  return bad;
}

// ① Kiểm tra thay đổi (2 request nhỏ, song song).
info(`① Kiểm tra ${BASE} …`);
const [htmlRes, catRes] = await Promise.all([
  request(`${BASE}/`, { validator: client && !FORCE ? state.html : undefined }),
  // Chỉ tin ETag khi file local đúng là bản đã tải kèm ETag đó (file bị sửa tay/hỏng → tải lại).
  request(`${BASE}/catalog`, { validator: oldRaw && !FORCE && state.catalogHash === oldRaw.catalog_hash ? state.catalog : undefined }),
]);

let raw = oldRaw, catalogChanged = false;
if (catRes.notModified) {
  console.log('   catalog: 304 Not Modified');
} else {
  const fresh = catRes.json();
  const bad = validateCatalog(fresh);
  if (bad.length) throw new Error(`Catalog mới không hợp lệ (${bad.join(', ')}) — giữ nguyên bản cũ.`);
  catalogChanged = fresh.catalog_hash !== oldRaw?.catalog_hash;
  console.log(`   catalog: ${fresh.catalog_hash.slice(0, 16)}… ${catalogChanged ? c(33, '(MỚI)') : '(không đổi)'}`);
  raw = fresh;
  state.catalog = catRes.validator;
  state.catalogHash = fresh.catalog_hash;
}

let clientChanged = false;
if (htmlRes.notModified) {
  console.log('   index.html: 304 Not Modified');
} else {
  state.html = htmlRes.validator;
  const bundle = bundlePathFrom(htmlRes.text());
  if (!bundle) {
    warn('   ⚠ Không thấy bundle JS trong index.html — game đổi cấu trúc? Giữ client.json cũ.');
  } else if (bundle !== state.bundle || !client || FORCE) {
    info(`② Bundle mới ${bundle} → bóc dữ liệu client…`);
    const js = (await request(BASE + bundle, { timeout: 60_000 })).text();
    const fresh = extractClient(js);
    const problems = validateClient(fresh);
    if (problems.length) {
      if (!client) throw new Error(`Bóc bundle thất bại: ${problems.join(', ')}`);
      warn(`   ⚠ Bóc bundle bất thường (${problems.join(', ')}) — giữ client.json cũ.`);
    } else {
      clientChanged = JSON.stringify(fresh) !== JSON.stringify(client);
      client = fresh;
      console.log(`   ${fresh.models.length} model · ${Object.keys(fresh.unitModel).length} unit→model · ${Object.keys(fresh.i18n).length} câu dịch ${clientChanged ? c(33, '(ĐỔI)') : '(không đổi)'}`);
    }
    state.bundle = bundle;
  } else {
    console.log(`   bundle: ${bundle} (không đổi)`);
  }
}

// ③ Ảnh cần thiết: portrait của mọi species (theo đúng logic client) + icon research.
const resolver = createResolver(raw.catalog, client);
const wanted = new Map();
for (const s of raw.catalog.species) {
  const model = resolver.modelOf(s.id);
  if (model) wanted.set(`portraits/${model}.webp`, `/resources/art/portraits/${model}.png`);
}
for (const r of raw.catalog.research ?? []) wanted.set(`research/${r.id}.webp`, `/resources/art/ui/research-icons-v1/${r.id}.png`);
for (const icon of new Set(['icon-ability', ...Object.values(client.abilityIcon ?? {})])) {
  wanted.set(`skills/${icon}.webp`, `/resources/art/ui/monster-dock/${icon}.png`);
}

const localPath = key => join(ROOT, 'public', key);

// Migrate 1 lần: PNG đã có sẵn → WebP tại chỗ (không tải lại), giữ ETag của bản gốc.
let migrated = 0;
for (const key of wanted.keys()) {
  const pngKey = key.replace(/\.webp$/, '.png');
  if (existsSync(localPath(key)) || !existsSync(localPath(pngKey))) continue;
  writeAtomic(localPath(key), await toWebp(readFileSync(localPath(pngKey))));
  unlinkSync(localPath(pngKey));
  if (state.assets[pngKey]) state.assets[key] = state.assets[pngKey];
  delete state.assets[pngKey];
  migrated++;
}
if (migrated) info(`   ↻ chuyển ${migrated} ảnh PNG có sẵn sang WebP`);
const revalidate = catalogChanged || clientChanged || FORCE;
const todo = [...wanted].filter(([key]) => revalidate || !existsSync(localPath(key)));

if (!todo.length && !catalogChanged && !clientChanged && !migrated) {
  if (JSON.stringify(sortKeys(state)) !== stateBefore) writeJSON(STATE, sortKeys(state), { pretty: true });
  ok(`✓ Không có gì mới — ${stats.requests} request, ${(stats.bytes / 1024).toFixed(1)}KB, ${((performance.now() - t0) / 1000).toFixed(1)}s`);
  output(false);
  process.exit(0);
}

info(`③ Ảnh: cần ${wanted.size}, kiểm tra ${todo.length}${revalidate ? ' (revalidate bằng ETag)' : ' (chỉ ảnh thiếu)'}…`);
let fetched = 0, unchanged = 0;
const results = await mapLimit(todo, CONCURRENCY, async ([key, url]) => {
  const have = existsSync(localPath(key));
  const res = await request(BASE + url, { validator: have ? state.assets[key] : undefined, retries: 2 });
  if (res.notModified) { unchanged++; return; }
  writeAtomic(localPath(key), await toWebp(res.body, { size: ASSET_SIZE[key.split('/')[0]] }));
  state.assets[key] = res.validator; // ETag của PNG gốc trên server
  fetched++;
});
const failed = results.map((r, i) => (r.ok ? null : `${todo[i][0]} (${r.error.message})`)).filter(Boolean);
console.log(`   ↓ ${fetched} tải mới · ${unchanged} không đổi (304)${failed.length ? c(33, ` · ${failed.length} lỗi`) : ''}`);
if (failed.length) warn(`   ${failed.slice(0, 10).join('\n   ')}`);

// Dọn ảnh không còn dùng — có guard chống xoá nhầm khi dữ liệu bóc ra bất thường.
for (const [dirKey, dir] of Object.entries(ASSET_DIRS)) {
  if (!existsSync(dir)) continue;
  const files = readdirSync(dir).filter(f => /\.(png|webp)$/.test(f));
  const orphans = files.filter(f => !wanted.has(`${dirKey}/${f}`));
  if (!orphans.length) continue;
  if (orphans.length > Math.max(5, files.length * 0.25)) {
    warn(`   ⚠ ${dirKey}: ${orphans.length}/${files.length} ảnh không dùng — quá nhiều, BỎ QUA xoá để an toàn.`);
    continue;
  }
  for (const f of orphans) { unlinkSync(join(dir, f)); delete state.assets[`${dirKey}/${f}`]; }
  warn(`   🗑 ${dirKey}: xoá ${orphans.length} ảnh không dùng: ${orphans.join(', ')}`);
}

// ④ Ghi dữ liệu thô + changelog.
const changelog = readJSON(PATHS.changelog, []);
if (catalogChanged && oldRaw) {
  const entry = diffCatalog(oldRaw, raw);
  changelog.unshift(entry);
  const s = entry.summary;
  info(`④ Thay đổi: +${s.unitsAdded} / −${s.unitsRemoved} unit · ${s.statChanges} chỉ số · ${s.abilityChanges} skill · mục: ${s.sections.join(', ') || '—'}`);
  for (const it of entry.items.filter(x => x.kind === 'unit+' || x.kind === 'unit-').slice(0, 20)) {
    console.log(`   ${it.kind === 'unit+' ? c(32, '+') : c(33, '−')} ${it.name}`);
  }
}
if (catalogChanged || FORCE || !existsSync(PATHS.catalog)) writeJSON(PATHS.catalog, raw, { pretty: true });
if (clientChanged || FORCE || !existsSync(PATHS.client)) writeJSON(PATHS.client, client, { pretty: true });
writeJSON(PATHS.changelog, changelog.slice(0, 200), { pretty: true });
writeJSON(STATE, sortKeys(state), { pretty: true });

// ⑤ Build DB cho web.
const db = build({ raw, client, changelog });
writeJSON(PATHS.db, db);
ok(`✓ Xong — ${db.meta.counts.pets} pet · ${db.meta.counts.units} unit · ${stats.requests} request (${stats.notModified}×304, ${stats.retries} retry) · ${(stats.bytes / 1024 / 1024).toFixed(2)}MB · ${((performance.now() - t0) / 1000).toFixed(1)}s`);
output(catalogChanged || clientChanged || fetched > 0 || migrated > 0);

function output(changed) {
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed}\nhash=${raw?.catalog_hash?.slice(0, 12) ?? ''}\n`);
}

function sortKeys(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  return Object.fromEntries(Object.keys(o).sort().map(k => [k, sortKeys(o[k])]));
}
