import { fileURLToPath } from 'node:url';
import { readJSON, writeJSON } from './lib/fsx.mjs';
import { build, PATHS } from './build.mjs';
import { snapshot, reconcile } from './lib/registry.mjs';

async function main() {
  const raw = readJSON(PATHS.catalog), client = readJSON(PATHS.client);
  if (!raw || !client) throw new Error('thiếu data/catalog.json / client.json — chạy npm run sync');
  const registry = readJSON(PATHS.registry, null);
  const db = build({ raw, client, registry });
  const snap = snapshot(raw.catalog, db.pets);
  const { registry: next, report } = reconcile(registry, snap);
  for (const [slug, e] of Object.entries(next.lines)) {
    const l = db.strategy.lines.find(x => x.slug === slug);
    if (l) { e.role = l.role; e.tier = l.rank.tier; e.also = l.also.map(([r, , t]) => `${r}:${t}`); }
  }
  next.catalogHash = raw.catalog_hash?.slice(0, 16);
  writeJSON(PATHS.registry, next, { pretty: true });
  const name = id => next.abilities[id]?.name ?? id;
  console.log(`sổ định danh: ${Object.keys(next.abilities).length} kỹ năng · ${Object.keys(next.lines).length} dòng pet`);
  console.log(`  mới: ${report.newAbilities.length}${report.newAbilities.length ? ` (${report.newAbilities.slice(0, 12).map(name).join(', ')})` : ''}`);
  console.log(`  đổi: ${report.changedAbilities.length}${report.changedAbilities.length ? ` (${report.changedAbilities.slice(0, 12).map(name).join(', ')})` : ''}`);
  console.log(`  bỏ: ${report.goneAbilities.length} · dòng pet đổi: ${report.changedLines.join(', ') || '—'}`);
  if (report.droppedOverrides.length) console.log(`  ghi đè hết hiệu lực (dòng đổi kỹ năng/chỉ số): ${report.droppedOverrides.join(', ')}`);
  const todo = Object.entries(next.lines).filter(([, e]) => !e.reviewed).map(([s]) => s);
  console.log(`  cần xem lại: ${todo.length ? todo.join(', ') : 'không'}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
