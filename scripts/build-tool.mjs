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
const WEB = 'web-input.js';
const KEY_MAPS = { 'overlay.js': ['CAM_KEYS', ['KeyW', 'KeyA', 'KeyS', 'KeyD']], [WEB]: ['WEB_KEYS', ['Escape', 'Home', 'KeyM']] };
const POINTER_KEYS = new Set(['bubbles', 'cancelable', 'composed', 'clientX', 'clientY', 'button', 'buttons', 'pointerId', 'pointerType', 'isPrimary']);
const AUTHORED_SELECTORS = new Set(['button.authored-node[data-node="Primary"]', 'button.authored-node[data-node^="Row"]', '.authored-node[data-node]']);
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
  const counts = { KeyboardEvent: 0, PointerEvent: 0, fetch: 0, click: 0 };

  for (const [file, code] of files) {
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const isBridge = file === BRIDGE, isWeb = file === WEB;
    let dispatches = 0;
    ancestor(ast, {
      Identifier(n, _s, anc) {
        const parent = anc[anc.length - 2];
        const isProp = parent?.type === 'MemberExpression' && parent.property === n && !parent.computed;
        const isKey = parent?.type === 'Property' && parent.key === n && !parent.computed;
        if (isProp || isKey) return;
        if (isWeb && n.name === 'PointerEvent' && parent?.type === 'NewExpression' && parent.callee === n) return;
        if (isWeb && n.name === 'localStorage') {
          const call = anc[anc.length - 3];
          const ok = parent?.type === 'MemberExpression' && parent.object === n && propName(parent) === 'getItem'
            && call?.type === 'CallExpression' && call.callee === parent && call.arguments.length === 1
            && call.arguments[0].type === 'Literal' && call.arguments[0].value === 'cutd.cameraView';
          if (!ok) err(file, n, "localStorage chỉ được đọc getItem('cutd.cameraView')");
          return;
        }
        if (BANNED_IDENTIFIERS.has(n.name)) err(file, n, `cấm dùng ${n.name}`);
        if (n.name === 'WebSocket' && !(parent?.type === 'BinaryExpression' && parent.operator === 'instanceof' && parent.right === n)) {
          err(file, n, 'WebSocket chỉ được dùng cho instanceof');
        }
        if (n.name === 'fetch') counts.fetch++;
      },
      MemberExpression(n) {
        const name = propName(n);
        if (n.computed && n.property.type !== 'Literal') {
          const objName = n.object.type === 'MemberExpression' ? propName(n.object) : n.object.name;
          if (GAME_OBJECTS.has(objName)) err(file, n, `truy cập ${objName}[…] bằng ngoặc vuông`);
          return;
        }
        const allowedUse = (name === 'call' && src(code, n.object) === 'desc.get') || (name === 'prototype' && src(code, n.object) === 'MessageEvent')
          || (isBridge && name === 'prototype' && src(code, n.object) === 'Object');
        if (name && BANNED_PROPERTIES.has(name) && !allowedUse) {
          err(file, n, `cấm dùng .${name}`);
        }
        if (name && GAME_OBJECTS.has(name) && !isBridge) err(file, n, `.${name} của game chỉ được dùng trong ${BRIDGE}`);
        const objName = n.object.type === 'MemberExpression' ? propName(n.object) : null;
        if (objName && ALLOWED[objName] && isBridge && !ALLOWED[objName].has(name)) err(file, n, `${objName}.${name} không nằm trong danh sách cho phép`);
        if (name === 'dispatchEvent') {
          dispatches++;
          if (!(n.object.type === 'Identifier' && ['target', 'canvas'].includes(n.object.name))) err(file, n, 'dispatchEvent chỉ được gửi tới target/canvas');
        }
        if (name === 'click') {
          counts.click++;
          if (!isWeb || !(n.object.type === 'Identifier' && ['primary', 'row'].includes(n.object.name))) err(file, n, `.click() chỉ được dùng trong ${WEB} cho nút của game (primary/row)`);
        }
      },
      VariableDeclarator(n) {
        const init = n.init;
        if (n.id.name === 'k') {
          const map = KEY_MAPS[file]?.[0];
          if (!map || !(init?.type === 'MemberExpression' && init.computed && init.object.name === map)) err(file, n, `phím giả lập phải lấy từ ${map ?? 'bảng phím được phép'}`);
        }
        if (n.id.name === 'TRAPS') {
          const keys = init?.type === 'ObjectExpression' ? init.properties.map(p => p.key?.name) : [null];
          if (!isBridge || keys.some(k => !['nextSequence', '_selectedEntityId'].includes(k))) err(file, n, 'móc hàm game chỉ được bẫy nextSequence/_selectedEntityId trong game-bridge.js');
        }
        const keyMap = Object.entries(KEY_MAPS).find(([, [name]]) => name === n.id.name);
        if (keyMap) {
          const [owner, [, allowed]] = keyMap;
          const codes = init?.type === 'ObjectExpression' ? init.properties.map(p => p.value?.elements?.[0]?.value) : [null];
          if (owner !== file || codes.some(c => !allowed.includes(c))) err(file, n, `${n.id.name} chỉ được chứa phím ${allowed.join('/')}`);
        }
        if (init?.type === 'MemberExpression' && ['session', 'interaction'].includes(propName(init))) err(file, n, 'không được gán session/interaction sang biến khác');
        if (n.id.type === 'ObjectPattern' && n.id.properties.some(p => p.key && GAME_OBJECTS.has(p.key.name))) err(file, n, 'không được destructuring đối tượng game');
      },
      NewExpression(n) {
        if (n.callee.name === 'KeyboardEvent') {
          counts.KeyboardEvent++;
          const init = n.arguments[1];
          const code0 = init?.properties?.find(p => p.key?.name === 'code');
          const key0 = init?.properties?.find(p => p.key?.name === 'key');
          if (!KEY_MAPS[file] || !code0 || src(code, code0.value) !== 'k[0]' || !key0 || src(code, key0.value) !== 'k[1]') err(file, n, 'KeyboardEvent phải lấy code/key từ bảng phím được phép (k[0]/k[1])');
        }
        if (n.callee.name === 'PointerEvent') {
          counts.PointerEvent++;
          const [type, init] = n.arguments;
          const props = init?.type === 'ObjectExpression' ? init.properties : null;
          const button = props?.find(p => p.key?.name === 'button');
          if (!isWeb || type?.type !== 'Literal' || !['pointerdown', 'pointerup'].includes(type.value) || !props
            || props.some(p => p.type !== 'Property' || p.computed || !POINTER_KEYS.has(p.key?.name))
            || button?.value?.type !== 'Literal' || button.value.value !== 0) err(file, n, 'PointerEvent chỉ được là nhấn/nhả chuột trái, không phím bổ trợ');
        }
      },
      Literal(n) {
        if (typeof n.value === 'string' && n.value.includes('authored-node') && (!isWeb || !AUTHORED_SELECTORS.has(n.value))) err(file, n, `bộ chọn nút game không được phép: ${n.value}`);
      },
      CallExpression(n) {
        if (n.callee.name === 'getJSON') {
          const a = n.arguments[0];
          const ok = (a?.type === 'Literal' && a.value === '/catalog')
            || (a?.type === 'TemplateLiteral' && a.quasis[0].value.raw === '' && a.expressions[0]?.name === 'DATA_URL');
          if (!ok) err(file, n, 'getJSON chỉ được tải DATA_URL/… hoặc /catalog');
        }
      },
    });
    const maxDispatch = file === 'overlay.js' ? 1 : isWeb ? 3 : 0;
    if (dispatches > maxDispatch) errors.push(`${file}: dispatchEvent tối đa ${maxDispatch} chỗ (đang có ${dispatches})`);
  }
  if (counts.KeyboardEvent > 2) errors.push(`KeyboardEvent tối đa 2 chỗ (camera + web-input) (đang có ${counts.KeyboardEvent})`);
  if (counts.PointerEvent > 2) errors.push(`PointerEvent tối đa 2 chỗ (nhấn + nhả) (đang có ${counts.PointerEvent})`);
  if (counts.fetch !== 1) errors.push(`fetch chỉ được gọi ở đúng 1 chỗ (getJSON) (đang có ${counts.fetch})`);
  if (counts.click > 2) errors.push(`.click() tối đa 2 chỗ (nút chính + hàng tiến hóa) (đang có ${counts.click})`);
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
  const banned = [/\beval\s*\(/, /new Function\s*\(/, /\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/,
    /\.send\s*\(/, /sendBeacon/, /createElement\(\s*["'`]script/i, /importScripts/, /\bimport\s*\(/, /document\.cookie/,
    /XMLHttpRequest/, /\.dispatch\s*\(/];
  const hit = banned.filter(re => re.test(code));
  if (hit.length) throw new Error(`Bookmarklet chứa API bị cấm: ${hit.join(', ')}`);
  const ls = code.match(/localStorage/g)?.length ?? 0;
  const lsOk = code.match(/localStorage\.getItem\(["'`]cutd\.cameraView["'`]\)/g)?.length ?? 0;
  if (ls !== lsOk) throw new Error('Bookmarklet dùng localStorage ngoài việc đọc cutd.cameraView');
  if (!code.includes(JSON.stringify(url))) throw new Error('Địa chỉ dữ liệu chưa được khoá vào code');
  const result = { code, sha256: createHash('sha256').update(code).digest('hex'), bytes: Buffer.byteLength(code), version, dataUrl: url };
  writeJSON(join(ROOT, 'src/data/tool.json'), result);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await buildTool();
  console.log(`tool: ${(r.bytes / 1024).toFixed(1)}KB · v${r.version} · data ${r.dataUrl} · sha256 ${r.sha256.slice(0, 16)}…`);
}
