import { existsSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import sharp from 'sharp';
import { NodeIO, Logger } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { dedup, prune, quantize, textureCompress } from '@gltf-transform/functions';
import { request, mapLimit } from './lib/http.mjs';
import { readJSON, writeJSON, writeAtomic } from './lib/fsx.mjs';
import { SAFE_NAME, containedPath } from './lib/validate.mjs';
import { PATHS } from './build.mjs';
import { showcaseModels, COURT } from '../src/lib/showcase.js';

const BASE = (process.env.CUTD_BASE ?? 'https://m.cutd.site').replace(/\/$/, '');
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'public/art');
const STATE = join(ROOT, 'data/art-state.json');
const FORCE = process.argv.includes('--force');

export function checkGlb(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 20 || buf.toString('ascii', 0, 4) !== 'glTF' || buf.readUInt32LE(4) !== 2) throw new Error('không phải GLB v2');
  if (buf.readUInt32LE(8) !== buf.length) throw new Error('độ dài GLB sai');
  const len = buf.readUInt32LE(12);
  if (buf.toString('ascii', 16, 20) !== 'JSON' || 20 + len > buf.length) throw new Error('thiếu khối JSON');
  const json = JSON.parse(buf.toString('utf8', 20, 20 + len));
  const external = [...(json.buffers ?? []), ...(json.images ?? [])].filter(x => typeof x?.uri === 'string');
  if (external.length) throw new Error('GLB trỏ tới file ngoài');
  return json;
}

const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).setLogger(new Logger(Logger.Verbosity.ERROR));

async function optimize(buf, size) {
  checkGlb(buf);
  const doc = await io.readBinary(new Uint8Array(buf));
  doc.setLogger(new Logger(Logger.Verbosity.ERROR));
  await doc.transform(dedup(), prune({ keepLeaves: true }), quantize(), textureCompress({ encoder: sharp, targetFormat: 'webp', resize: [size, size], quality: 82 }));
  const out = Buffer.from(await io.writeBinary(doc));
  checkGlb(out);
  return out;
}

async function main() {
  const db = readJSON(PATHS.db);
  if (!db) throw new Error('chưa có src/data/db.json — chạy npm run data trước');
  const state = readJSON(STATE, {});
  const jobs = [[COURT, `/resources/art/moonlit-court/${COURT}.glb`, 40, 2048], ...showcaseModels(db).filter(m => SAFE_NAME.test(m)).map(m => [m, `/resources/art/monsters/${m}.glb`, 16, 1024])];
  let fetched = 0, same = 0;
  const results = await mapLimit(jobs, 4, async ([name, url, mb, size]) => {
    const file = containedPath(OUT, [OUT], `${name}.glb`);
    const have = existsSync(file) && !FORCE;
    const res = await request(BASE + url, { validator: have ? state[name] : undefined, maxBytes: mb * 1024 * 1024, timeout: 120_000 });
    if (res.notModified) { same++; return; }
    writeAtomic(file, await optimize(res.body, size));
    state[name] = res.validator;
    fetched++;
    console.log(`   ${name}: ${(res.body.length / 1024).toFixed(0)}KB → ${(statSync(file).size / 1024).toFixed(0)}KB`);
  });
  const failed = results.map((r, i) => (r.ok ? null : `${jobs[i][0]} (${r.error.message})`)).filter(Boolean);
  writeJSON(STATE, state, { pretty: true });
  console.log(`art: ${fetched} tải mới · ${same} không đổi${failed.length ? ` · lỗi: ${failed.join(', ')}` : ''}`);
  if (failed.length) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
