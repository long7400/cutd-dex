import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readJSON } from '../lib/fsx.mjs';
import { build, PATHS } from '../build.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');
const raw = readJSON(PATHS.catalog);
const client = readJSON(PATHS.client);
const db = build({ raw, client, changelog: readJSON(PATHS.changelog, []) });
const units = db.units;

test('mọi species đều có mặt, mọi pet bắt được đều có cây', () => {
  assert.equal(Object.keys(units).length, raw.catalog.species.length);
  assert.equal(db.pets.length, raw.catalog.species.filter(s => s.catchable).length);
  for (const p of db.pets) assert.ok(p.stages.length >= 1 && p.stages[0] === p.id, p.name);
});

test('slug pet là duy nhất', () => {
  assert.equal(new Set(db.pets.map(p => p.slug)).size, db.pets.length);
});

test('giữ đủ nhánh tiến hóa (code cũ chỉ lấy evolutions[0])', () => {
  const branchy = raw.catalog.species.filter(s => (s.evolutions?.length ?? 0) > 1);
  assert.ok(branchy.length > 0);
  for (const s of branchy) assert.equal(units[s.id].evo.length, s.evolutions.length);
  const reachable = new Set(db.pets.flatMap(p => p.stages));
  for (const s of branchy) if (reachable.has(s.id)) for (const e of s.evolutions) assert.ok(reachable.has(e.stage_id), `${s.id} → ${e.stage_id}`);
});

test('tham chiếu không trỏ vào hư không', () => {
  for (const u of Object.values(units)) {
    for (const e of u.evo ?? []) assert.ok(units[e.to], `${u.id}.evo → ${e.to}`);
    for (const f of u.from ?? []) assert.ok(units[f], `${u.id}.from → ${f}`);
    for (const s of u.skills ?? []) assert.ok(db.abilities[s], `${u.id}.skill → ${s}`);
    if (u.pet) assert.ok(db.pets.some(p => p.id === u.pet), `${u.id}.pet`);
  }
  for (const s of db.trade) for (const r of s.recipes) assert.ok(units[r.give] && units[r.get]);
  for (const p of db.pools) for (const e of p.entries) assert.ok(units[e.unit]);
  for (const set of db.waveSets) for (const w of set.waves) for (const g of w.groups) assert.ok(units[g.unit], `${set.id}#${w.n}`);
});

test('mọi portrait và icon research đều có file trong public/', () => {
  const missing = [...new Set(Object.values(units).map(u => u.model))].filter(m => !existsSync(join(ROOT, 'public/portraits', `${m}.webp`)));
  assert.deepEqual(missing, []);
  for (const r of db.research) assert.ok(existsSync(join(ROOT, 'public/research', `${r.id}.webp`)), r.id);
  for (const [id, a] of Object.entries(db.abilities)) assert.ok(existsSync(join(ROOT, 'public/skills', `${a.icon}.webp`)), `${id} → ${a.icon}`);
});

test('hệ theo wild pool khớp research theo hệ cho gần như mọi pet', () => {
  const byId = new Map(db.research.map(r => [r.id, r.el]));
  const agree = db.pets.filter(p => (units[p.id].research ?? []).every(id => byId.get(id) === p.el)).length;
  assert.ok(agree / db.pets.length > 0.9, `${agree}/${db.pets.length}`);
});

test('skill hệ thống (Sell…) không lọt vào danh sách kỹ năng', () => {
  const system = new Set(raw.catalog.abilities.filter(a => a.status === 'system').map(a => a.id));
  for (const u of Object.values(units)) for (const s of u.skills ?? []) assert.ok(!system.has(s), `${u.id} có ${s}`);
});
