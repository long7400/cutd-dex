// tool/*.js → 1 IIFE đã minify → src/data/tool.json { code, sha256, bytes, version, dataUrl }.
// Địa chỉ dữ liệu wiki được KHOÁ vào code lúc build (esbuild define) và nằm trong mã băm SHA-256.
//
// Hàng rào an toàn lúc build (phân tích cú pháp bằng acorn — không phải dò chuỗi):
//  • session / interaction / store / cc của game chỉ được đụng tới trong tool/game-bridge.js.
//  • Trong bridge: session.* chỉ catchWild / evolveCreature / tradePet; interaction.* chỉ selectEntity;
//    không truy cập bằng ngoặc vuông, không gán session/interaction sang biến khác, không destructuring.
//  • Cả tool: cấm eval/Function/Reflect/XMLHttpRequest/sendBeacon/importScripts/document.cookie/storage/innerHTML…,
//    cấm .call/.apply/.bind (trừ desc.get.call trong bộ bắt socket), cấm tạo sự kiện ngoài 1 KeyboardEvent W/A/S/D,
//    fetch chỉ tới DATA_URL hoặc '/catalog' của chính game, WebSocket chỉ dùng cho `instanceof`.
import { build } from 'esbuild';
import { parse } from 'acorn';
import { ancestor } from 'acorn-walk';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readJSON, writeJSON } from './lib/fsx.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRIDGE = 'game-bridge.js';
const GAME_OBJECTS = new Set(['session', 'interaction', 'store', 'cc']);
const ALLOWED = { session: new Set(['catchWild', 'evolveCreature', 'tradePet']), interaction: new Set(['selectEntity']) };
const BANNED_IDENTIFIERS = new Set(['eval', 'Function', 'Reflect', 'XMLHttpRequest', 'importScripts', 'Worker', 'SharedWorker',
  'localStorage', 'sessionStorage', 'indexedDB', 'MouseEvent', 'PointerEvent', 'CustomEvent', 'Event', 'TouchEvent', 'Proxy']);
const BANNED_PROPERTIES = new Set(['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'write', 'writeln', 'cookie', 'sendBeacon',
  'send', 'dispatch', 'postMessage', 'srcdoc', 'constructor', '__proto__', 'prototype', 'call', 'apply', 'bind', 'setAttributeNS']);

const propName = m => (m.computed ? (m.property.type === 'Literal' ? String(m.property.value) : null) : m.property.name);
const src = (code, n) => code.slice(n.start, n.end);

export function auditSource(files) {
  const errors = [];
  const err = (file, n, msg) => errors.push(`${file}:${n.loc?.start.line ?? '?'} ${msg}`);
  const counts = { KeyboardEvent: 0, dispatchEvent: 0, fetch: 0, click: 0 };

  for (const [file, code] of files) {
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const isBridge = file === BRIDGE;
    ancestor(ast, {
      Identifier(n, _s, anc) {
        const parent = anc[anc.length - 2];
        const isProp = parent?.type === 'MemberExpression' && parent.property === n && !parent.computed;
        const isKey = parent?.type === 'Property' && parent.key === n && !parent.computed;
        if (isProp || isKey) return;
        if (BANNED_IDENTIFIERS.has(n.name)) err(file, n, `cấm dùng ${n.name}`);
        if (n.name === 'WebSocket' && !(parent?.type === 'BinaryExpression' && parent.operator === 'instanceof' && parent.right === n)) {
          err(file, n, 'WebSocket chỉ được dùng cho instanceof');
        }
        if (n.name === 'fetch') counts.fetch++;
      },
      MemberExpression(n) {
        const name = propName(n);
        if (n.computed && n.property.type !== 'Literal') {
          // Ngoặc vuông với biểu thức: cấm hẳn trên đối tượng game.
          const objName = n.object.type === 'MemberExpression' ? propName(n.object) : n.object.name;
          if (GAME_OBJECTS.has(objName)) err(file, n, `truy cập ${objName}[…] bằng ngoặc vuông`);
          return;
        }
        const allowedUse = (name === 'call' && src(code, n.object) === 'desc.get') || (name === 'prototype' && src(code, n.object) === 'MessageEvent');
        if (name && BANNED_PROPERTIES.has(name) && !allowedUse) {
          err(file, n, `cấm dùng .${name}`);
        }
        if (name && GAME_OBJECTS.has(name) && !isBridge) err(file, n, `.${name} của game chỉ được dùng trong ${BRIDGE}`);
        const objName = n.object.type === 'MemberExpression' ? propName(n.object) : null;
        if (objName && ALLOWED[objName] && isBridge && !ALLOWED[objName].has(name)) err(file, n, `${objName}.${name} không nằm trong danh sách cho phép`);
        if (name === 'dispatchEvent') counts.dispatchEvent++;
        if (name === 'click' && !(n.object.type === 'Identifier' && n.object.name === 'primary')) err(file, n, '.click() chỉ được dùng cho nút chính của game (primary)');
        if (name === 'click') counts.click++;
      },
      VariableDeclarator(n) {
        const init = n.init;
        if (init?.type === 'MemberExpression' && ['session', 'interaction'].includes(propName(init))) err(file, n, 'không được gán session/interaction sang biến khác');
        if (n.id.type === 'ObjectPattern' && n.id.properties.some(p => p.key && GAME_OBJECTS.has(p.key.name))) err(file, n, 'không được destructuring đối tượng game');
      },
      NewExpression(n) {
        if (n.callee.name === 'KeyboardEvent') {
          counts.KeyboardEvent++;
          const init = n.arguments[1];
          const code0 = init?.properties?.find(p => p.key?.name === 'code');
          if (!code0 || src(code, code0.value) !== 'k[0]') err(file, n, 'KeyboardEvent phải lấy code từ CAM_KEYS (k[0])');
        }
      },
      CallExpression(n) {
        if (n.callee.name === 'getJSON') {
          const a = n.arguments[0];
          const ok = (a?.type === 'Literal' && a.value === '/catalog')
            || (a?.type === 'TemplateLiteral' && a.quasis[0].value.raw === '' && a.expressions[0]?.name === 'DATA_URL');
          if (!ok) err(file, n, 'getJSON chỉ được tải DATA_URL/… hoặc /catalog');
        }
      },
      ObjectExpression(n) {
        // CAM_KEYS: chỉ 4 phím camera.
        const isCam = n.properties.some(p => p.key?.name === 'up') && n.properties.every(p => p.value?.type === 'ArrayExpression');
        if (!isCam) return;
        const codes = n.properties.map(p => p.value.elements[0]?.value);
        if (codes.some(c => !['KeyW', 'KeyA', 'KeyS', 'KeyD'].includes(c))) err(file, n, `phím camera ngoài W/A/S/D: ${codes}`);
      },
    });
  }
  if (counts.KeyboardEvent !== 1) errors.push(`KeyboardEvent phải được tạo ở đúng 1 chỗ (đang có ${counts.KeyboardEvent})`);
  if (counts.dispatchEvent !== 1) errors.push(`dispatchEvent chỉ được gọi ở đúng 1 chỗ (camKey) (đang có ${counts.dispatchEvent})`);
  if (counts.fetch !== 1) errors.push(`fetch chỉ được gọi ở đúng 1 chỗ (getJSON) (đang có ${counts.fetch})`);
  if (counts.click > 1) errors.push(`.click() chỉ được dùng ở đúng 1 chỗ (phím F) (đang có ${counts.click})`);
  for (const [file, code] of files) {
    // Phím tắt chỉ được bấm đúng nút chính của game.
    const sel = [...code.matchAll(/querySelectorAll\('([^']*)'\)/g)].map(m => m[1]);
    if (sel.some(s => s.includes('authored-node') && s !== 'button.authored-node[data-node="Primary"]')) errors.push(`${file}: chỉ được bấm nút Primary của game`);
  }
  return errors;
}

export function dataUrl() {
  const pkg = readJSON(join(ROOT, 'package.json'));
  const url = process.env.CUTD_DATA_URL || pkg.homepage;
  if (!/^https:\/\/[a-z0-9.-]+\/[\w./-]*\/$/.test(url ?? '') && !/^http:\/\/localhost:\d+\/$/.test(url ?? '')) {
    throw new Error(`Địa chỉ dữ liệu không hợp lệ: ${url} (cần https://…/ kết thúc bằng /)`);
  }
  return url;
}

export async function buildTool() {
  const pkg = readJSON(join(ROOT, 'package.json'));
  const toolDir = join(ROOT, 'tool');
  const files = readdirSync(toolDir).filter(f => f.endsWith('.js')).map(f => [f, readFileSync(join(toolDir, f), 'utf8')]);
  const problems = auditSource(files);
  if (problems.length) throw new Error(`Bookmarklet vi phạm quy tắc an toàn:\n  ${problems.join('\n  ')}`);

  const url = dataUrl();
  const out = await build({
    entryPoints: [join(toolDir, 'overlay.js')], bundle: true, write: false,
    format: 'iife', minify: true, target: 'es2020', legalComments: 'none', charset: 'utf8',
    define: { __CUTD_DATA_URL__: JSON.stringify(url) },
  });
  let code = out.outputFiles[0].text.trim();
  const version = `${pkg.version}-${createHash('sha256').update(code).digest('hex').slice(0, 7)}`;
  code = code.replace(/__CUTD_VERSION__/g, version);
  // Lớp phòng thủ thứ 2 trên bản đã bundle.
  const banned = [/\beval\s*\(/, /new Function\s*\(/, /\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/,
    /\.send\s*\(/, /sendBeacon/, /createElement\(\s*["'`]script/i, /importScripts/, /\bimport\s*\(/, /localStorage/, /document\.cookie/,
    /XMLHttpRequest/, /\.dispatch\s*\(/];
  const hit = banned.filter(re => re.test(code));
  if (hit.length) throw new Error(`Bookmarklet chứa API bị cấm: ${hit.join(', ')}`);
  if (!code.includes(JSON.stringify(url))) throw new Error('Địa chỉ dữ liệu chưa được khoá vào code');
  const result = { code, sha256: createHash('sha256').update(code).digest('hex'), bytes: Buffer.byteLength(code), version, dataUrl: url };
  writeJSON(join(ROOT, 'src/data/tool.json'), result);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await buildTool();
  console.log(`tool: ${(r.bytes / 1024).toFixed(1)}KB · v${r.version} · data ${r.dataUrl} · sha256 ${r.sha256.slice(0, 16)}…`);
}
