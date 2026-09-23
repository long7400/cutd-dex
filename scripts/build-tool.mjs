// tool/overlay.js → 1 IIFE đã minify → src/data/tool.json { code, sha256, bytes, version }.
// Trang #/tool của wiki chèn URL site vào chỗ __CUTD_DATA_URL__ rồi tạo link bookmarklet.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readJSON, writeJSON } from './lib/fsx.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

export async function buildTool() {
  const pkg = readJSON(join(ROOT, 'package.json'));
  const out = await build({
    entryPoints: [join(ROOT, 'tool/overlay.js')], bundle: true, write: false,
    format: 'iife', minify: true, target: 'es2020', legalComments: 'none', charset: 'utf8',
  });
  let code = out.outputFiles[0].text.trim();
  const hash = createHash('sha256').update(code).digest('hex');
  const version = `${pkg.version}-${hash.slice(0, 7)}`;
  code = code.replace(/__CUTD_VERSION__/g, version);
  // Kiểm tra cứng: bản build không được chứa các API nguy hiểm.
  const banned = [/\beval\s*\(/, /new Function\s*\(/, /\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/,
    /\.send\s*\(/, /createElement\(\s*["'`]script/i, /importScripts/, /\bimport\s*\(/, /localStorage/, /document\.cookie/];
  const hit = banned.filter(re => re.test(code));
  if (hit.length) throw new Error(`Bookmarklet chứa API bị cấm: ${hit.join(', ')}`);
  if (!code.includes('"__CUTD_DATA_URL__"')) throw new Error('Thiếu placeholder __CUTD_DATA_URL__');
  const result = { code, sha256: createHash('sha256').update(code).digest('hex'), bytes: Buffer.byteLength(code), version };
  writeJSON(join(ROOT, 'src/data/tool.json'), result);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await buildTool();
  console.log(`tool: ${(r.bytes / 1024).toFixed(1)}KB · v${r.version} · sha256 ${r.sha256.slice(0, 16)}…`);
}
