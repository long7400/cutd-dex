// tool/overlay.js → 1 IIFE đã minify → src/data/tool.json { code, sha256, bytes, version }.
// Trang #/tool của wiki chèn URL site vào chỗ __CUTD_DATA_URL__ rồi tạo link bookmarklet.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
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
  // Hàm gửi lệnh của client game (bắt/trade/tiến hóa/bán/di chuyển/…) tuyệt đối không được nhắc tới.
  // Chỉ 3 lệnh được phép (catchWild / evolveCreature / tradePet — qua session của game); mọi lệnh khác cấm.
  banned.push(/\.dispatch\s*\(/, /\b(sellCreature|sellForWood|moveCreature|moveSelected|dismissWild|setFinder|toggleMoveTargeting|toggleTradeTargeting|tapGround|sendChat|subscribeTo|switchBase|leaveRoom|research)\s*\(/);
  const hit = banned.filter(re => re.test(code));
  if (hit.length) throw new Error(`Bookmarklet chứa API bị cấm: ${hit.join(', ')}`);
  // Với object interaction của game, chỉ được dùng đúng selectEntity (đổi lựa chọn trên máy).
  const src = readFileSync(join(ROOT, 'tool/overlay.js'), 'utf8').replace(/\/\/.*$/gm, '');
  const used = [...src.matchAll(/interaction\??\.(\w+)/g)].map(m => m[1]);
  const extra = [...new Set(used)].filter(n => n !== 'selectEntity');
  if (extra.length) throw new Error(`Bookmarklet dùng hàm game ngoài selectEntity: ${extra.join(', ')}`);
  const ALLOWED_SESSION = new Set(['catchWild', 'evolveCreature', 'tradePet']);
  const sessionUsed = [...src.matchAll(/session\??\.(\w+)/g)].map(m => m[1]);
  const extraSession = [...new Set(sessionUsed)].filter(n => !ALLOWED_SESSION.has(n));
  if (extraSession.length) throw new Error(`Bookmarklet dùng lệnh game ngoài danh sách cho phép: ${extraSession.join(', ')}`);
  if (!code.includes('"__CUTD_DATA_URL__"')) throw new Error('Thiếu placeholder __CUTD_DATA_URL__');
  const result = { code, sha256: createHash('sha256').update(code).digest('hex'), bytes: Buffer.byteLength(code), version };
  writeJSON(join(ROOT, 'src/data/tool.json'), result);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await buildTool();
  console.log(`tool: ${(r.bytes / 1024).toFixed(1)}KB · v${r.version} · sha256 ${r.sha256.slice(0, 16)}…`);
}
