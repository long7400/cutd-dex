import { existsSync, readdirSync, unlinkSync, appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { request, mapLimit, stats } from './lib/http.mjs';
import { readJSON, writeJSON, writeAtomic } from './lib/fsx.mjs';
import { toWebp } from './lib/image.mjs';
import { extractClient, validateClient, bundlePathFrom } from './lib/client.mjs';
import { createResolver } from './lib/game.mjs';
import { diffCatalog } from './lib/diff.mjs';
import { SAFE_NAME, validateCatalog, containedPath } from './lib/validate.mjs';
import { build, buildOverlay, PATHS } from './build.mjs';

const BASE = (process.env.CUTD_BASE ?? 'https://m.cutd.site').replace(/\/$/, '');
const FORCE = process.argv.includes('--force');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const STATE = join(ROOT, 'data/state.json');
const ASSET_DIRS = { portraits: join(ROOT, 'public/portraits'), research: join(ROOT, 'public/research'), skills: join(ROOT, 'public/skills') };
const ASSET_SIZE = { skills: 96 };
const CONCURRENCY = 8;

const clean = v => String(v).replace(/[\x00-\x1f\x7f]/g, '?').replace(/::/g, ': :');
const log = (...a) => console.log(a.map(clean).join(' '));
const c = (code, s) => (process.stdout.isTTY ? `\x1b[${code}m${clean(s)}\x1b[0m` : clean(s));
const info = s => console.log(c(36, s)), ok = s => console.log(c(32, s)), warn = s => console.log(c(33, s));
const t0 = performance.now();

const die = err => { console.error(`✗ sync thất bại: ${clean(err?.message ?? err)}`); process.exit(1); };
process.on('uncaughtException', die);
process.on('unhandledRejection', die);

const state = readJSON(STATE, {});
state.assets ??= {};
const stateBefore = JSON.stringify(sortKeys(state));
let oldRaw = readJSON(PATHS.catalog);
let client = readJSON(PATHS.client);

info(`① Kiểm tra ${BASE} …`);
const [htmlRes, catRes] = await Promise.all([
  request(`${BASE}/`, { validator: client && !FORCE ? state.html : undefined, maxBytes: 1024 * 1024 }),
  request(`${BASE}/catalog`, { validator: oldRaw && !FORCE && state.catalogHash === oldRaw.catalog_hash ? state.catalog : undefined, maxBytes: 12 * 1024 * 1024 }),
]);

let raw = oldRaw, catalogChanged = false;
if (catRes.notModified) {
  console.log('   catalog: 304 Not Modified');
} else {
  const fresh = catRes.json();
  const bad = validateCatalog(fresh, oldRaw);
  if (bad.length) throw new Error(`Catalog mới không hợp lệ (${bad.join(', ')}) — giữ nguyên bản cũ.`);
  catalogChanged = fresh.catalog_hash !== oldRaw?.catalog_hash;
  log(`   catalog: ${fresh.catalog_hash.slice(0, 16)}… ${catalogChanged ? '(MỚI)' : '(không đổi)'}`);
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
    const js = (await request(BASE + bundle, { timeout: 60_000, maxBytes: 32 * 1024 * 1024 })).text();
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
    log(`   bundle: ${bundle} (không đổi)`);
  }
}

const resolver = createResolver(raw.catalog, client);
const wanted = new Map();
const want = (dir, name, url) => { if (SAFE_NAME.test(name)) wanted.set(`${dir}/${name}.webp`, url(name)); };
for (const s of raw.catalog.species) {
  const model = resolver.modelOf(s.id);
  if (model) want('portraits', model, m => `/resources/art/portraits/${m}.png`);
}
for (const r of raw.catalog.research ?? []) want('research', r.id, id => `/resources/art/ui/research-icons-v1/${id}.png`);
for (const icon of new Set(['icon-ability', ...Object.values(client.abilityIcon ?? {})])) {
  want('skills', icon, i => `/resources/art/ui/monster-dock/${i}.png`);
}

const localPath = key => containedPath(join(ROOT, 'public'), Object.values(ASSET_DIRS), key);

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
  const res = await request(BASE + url, { validator: have ? state.assets[key] : undefined, retries: 2, maxBytes: 4 * 1024 * 1024 });
  if (res.notModified) { unchanged++; return; }
  writeAtomic(localPath(key), await toWebp(res.body, { size: ASSET_SIZE[key.split('/')[0]] }));
  state.assets[key] = res.validator;
  fetched++;
});
const failed = results.map((r, i) => (r.ok ? null : `${todo[i][0]} (${r.error.message})`)).filter(Boolean);
console.log(`   ↓ ${fetched} tải mới · ${unchanged} không đổi (304)${failed.length ? c(33, ` · ${failed.length} lỗi`) : ''}`);
for (const f of failed.slice(0, 10)) warn(`   ${f}`);

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

const changelog = readJSON(PATHS.changelog, []);
if (catalogChanged && oldRaw) {
  const entry = diffCatalog(oldRaw, raw);
  changelog.unshift(entry);
  const s = entry.summary;
  info(`④ Thay đổi: +${s.unitsAdded} / −${s.unitsRemoved} unit · ${s.statChanges} chỉ số · ${s.abilityChanges} skill · mục: ${s.sections.join(', ') || '—'}`);
  for (const it of entry.items.filter(x => x.kind === 'unit+' || x.kind === 'unit-').slice(0, 20)) {
    log(`   ${it.kind === 'unit+' ? '+' : '−'} ${it.name}`);
  }
}
const db = build({ raw, client, changelog });
const overlay = buildOverlay(db);
if (catalogChanged || FORCE || !existsSync(PATHS.catalog)) writeJSON(PATHS.catalog, raw, { pretty: true });
if (clientChanged || FORCE || !existsSync(PATHS.client)) writeJSON(PATHS.client, client, { pretty: true });
writeJSON(PATHS.changelog, changelog.slice(0, 200), { pretty: true });
writeJSON(STATE, sortKeys(state), { pretty: true });

writeJSON(PATHS.db, db);
writeJSON(PATHS.overlay, overlay);
ok(`✓ Xong — ${db.meta.counts.pets} pet · ${db.meta.counts.units} unit · ${stats.requests} request (${stats.notModified}×304, ${stats.retries} retry) · ${(stats.bytes / 1024 / 1024).toFixed(2)}MB · ${((performance.now() - t0) / 1000).toFixed(1)}s`);
output(catalogChanged || clientChanged || fetched > 0 || migrated > 0);

function output(changed) {
  const hash = /^[0-9a-f]+$/.test(raw?.catalog_hash ?? '') ? raw.catalog_hash.slice(0, 12) : 'unknown';
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, `changed=${changed ? 'true' : 'false'}\nhash=${hash}\n`);
}

function sortKeys(o) {
  if (!o || typeof o !== 'object' || Array.isArray(o)) return o;
  return Object.fromEntries(Object.keys(o).sort().map(k => [k, sortKeys(o[k])]));
}
