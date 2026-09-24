import { build } from 'esbuild';
import { parse } from 'acorn';
import { ancestor } from 'acorn-walk';
import { createHash } from 'node:crypto';
import { readFileSync, readdirSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { readJSON, writeJSON } from './lib/fsx.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BRIDGE = 'game-bridge.js';
const WEB = 'web-input.js';
const CAM_FILE = 'overlay.js';
const CAM_CODES = ['KeyW', 'KeyA', 'KeyS', 'KeyD'];
const PRIMARY_SELECTOR = 'button.authored-node[data-node="Primary"]';
const GAME_OBJECTS = new Set(['session', 'interaction', 'store', 'cc']);
const SESSION_FNS = new Set(['catchWild', 'evolveCreature', 'tradePet', 'moveCreature']);
const INTERACTION_FNS = new Set(['selectEntity']);
const SESSION_READ = new Set([...SESSION_FNS, 'store', 'canCommand']);
const ALLOWED = { session: SESSION_READ, nextSequence: SESSION_READ, interaction: INTERACTION_FNS, _selectedEntityId: INTERACTION_FNS };
const H_TAGS = new Set(['a', 'b', 'button', 'div', 'i', 'img', 'p', 'small', 'span', 'style', 'table', 'td', 'th', 'tr']);
const H_PROPS = new Set(['class', 'text', 'style', 'onClick', 'href', 'src', 'title', 'tabindex', 'disabled', 'alt', 'width', 'height']);
const STRING_BUILDERS = new Set(['join', 'concat', 'fromCharCode', 'fromCodePoint', 'replace', 'replaceAll', 'slice', 'substring', 'substr', 'toString', 'repeat', 'padStart', 'padEnd', 'atob', 'decodeURIComponent', 'reverse', 'trim', 'toLowerCase', 'toUpperCase', 'normalize', 'raw', 'at']);
const builtKey = k => (k.type === 'BinaryExpression' && k.operator === '+') || k.type === 'TemplateLiteral' || k.type === 'AssignmentExpression' || k.type === 'SequenceExpression'
  || (k.type === 'CallExpression' && ((k.callee.type === 'MemberExpression' && STRING_BUILDERS.has(k.callee.property?.name)) || ['String', 'atob', 'decodeURIComponent', 'unescape'].includes(k.callee.name)))
  || (k.type === 'ConditionalExpression' && (builtKey(k.consequent) || builtKey(k.alternate))) || (k.type === 'LogicalExpression' && (builtKey(k.left) || builtKey(k.right)));
const BANNED_IDENTIFIERS = new Set(['eval', 'Function', 'Reflect', 'XMLHttpRequest', 'importScripts', 'Worker', 'SharedWorker',
  'localStorage', 'sessionStorage', 'indexedDB', 'MouseEvent', 'PointerEvent', 'CustomEvent', 'Event', 'TouchEvent', 'Proxy',
  'Image', 'Audio', 'EventSource', 'RTCPeerConnection', 'BroadcastChannel', 'ServiceWorker', 'open', 'opener', 'getPrototypeOf', 'setPrototypeOf',
  '__defineGetter__', '__defineSetter__', 'execCommand', 'requestSubmit', 'WebTransport', 'fetchLater', 'navigation', 'cookieStore',
  'caches', 'DOMParser', 'XSLTProcessor', 'WebAssembly', 'Blob', 'SharedArrayBuffer', 'Atomics', 'Notification', 'globalThis',
  'self', 'top', 'parent', 'frames']);
const WINDOW_ALIASES = new Set(['self', 'top', 'parent', 'frames']);
const WRITE_TARGETS = new Set(['u.traps', 'caught', 'out', 'count', 'db.u', 'o', 'u']);
const BANNED_PROPERTIES = new Set(['innerHTML', 'outerHTML', 'insertAdjacentHTML', 'write', 'writeln', 'cookie', 'sendBeacon',
  'send', 'dispatch', 'postMessage', 'srcdoc', 'constructor', '__proto__', 'prototype', 'call', 'apply', 'bind', 'setAttributeNS',
  'createContextualFragment', 'setHTMLUnsafe', 'parseHTMLUnsafe', 'parseFromString', 'srcset', 'ping', 'poster', 'submit', 'storage',
  'createObjectURL', 'getOwnPropertyNames', 'getOwnPropertyDescriptors', 'defineProperties', 'registerProtocolHandler', 'showModalDialog',
  'contentDocument', 'defaultView', 'opener', 'webkitRequestFileSystem', 'credentials']);
const GLOBALISH = /^(window|globalThis|self|top|parent|frames|document|navigator|location|win|realm\.win|patchedWin)$|\.(contentWindow|ownerDocument)$/;
const PATTERN_BANNED = new Set([...BANNED_IDENTIFIERS, ...BANNED_PROPERTIES, 'fetch', 'WebSocket', 'getJSON', 'setTimeout', 'setInterval', 'location', 'href', 'src']);
const TIMER_FNS = new Set(['r', 'releaseAll', 'arm']);
const inFn = (anc, name) => anc.some(a => (a.type === 'FunctionDeclaration' || a.type === 'FunctionExpression') && a.id?.name === name);

const propName = m => (m.computed ? (m.property.type === 'Literal' ? String(m.property.value) : null) : m.property.name);
const src = (code, n) => code.slice(n.start, n.end);

export function auditSource(files) {
  const errors = [];
  const err = (file, n, msg) => errors.push(`${file}:${n.loc?.start.line ?? '?'} ${msg}`);
  const counts = { KeyboardEvent: 0, fetch: 0, click: 0 };

  for (const [file, code] of files) {
    const ast = parse(code, { ecmaVersion: 'latest', sourceType: 'module', locations: true });
    const isBridge = file === BRIDGE, isWeb = file === WEB;
    let dispatches = 0;
    const imported = new Set(ast.body.filter(n => n.type === 'ImportDeclaration').flatMap(n => n.specifiers.map(sp => sp.local.name)));
    const names = p => (p?.type === 'Identifier' ? [p] : p?.type === 'AssignmentPattern' ? names(p.left) : p?.type === 'RestElement' ? names(p.argument)
      : p?.type === 'ArrayPattern' ? p.elements.flatMap(names) : p?.type === 'ObjectPattern' ? p.properties.flatMap(q => names(q.value ?? q.argument)) : []);
    const shadow = id => { if (imported.has(id.name)) err(file, id, `${id.name} trùng tên hàm import — đổi tên để không gọi nhầm hàm`); };
    ancestor(ast, {
      Function(n) { if (n.id) shadow(n.id); n.params.flatMap(names).forEach(shadow); },
      VariableDeclarator(n) { names(n.id).forEach(shadow); },
      CatchClause(n) { names(n.param).forEach(shadow); },
    });
    ancestor(ast, {
      Identifier(n, _s, anc) {
        const parent = anc[anc.length - 2];
        const isProp = parent?.type === 'MemberExpression' && parent.property === n && !parent.computed;
        const isKey = parent?.type === 'Property' && parent.key === n && !parent.computed;
        if (isProp || isKey) return;
        if (BANNED_IDENTIFIERS.has(n.name)) err(file, n, `cấm dùng ${n.name}`);
        if (n.name === 'WS' && !(parent?.type === 'VariableDeclarator' && parent.id === n) && !(parent?.type === 'BinaryExpression' && parent.operator === 'instanceof' && parent.right === n)) err(file, n, 'WS chỉ được dùng cho instanceof');
        if (n.name === 'getJSON' && !(parent?.type === 'CallExpression' && parent.callee === n) && !(parent?.type === 'VariableDeclarator' && parent.id === n)) err(file, n, 'getJSON chỉ được gọi trực tiếp');
        if (n.name === 'WebSocket' && !(parent?.type === 'BinaryExpression' && parent.operator === 'instanceof' && parent.right === n)) {
          err(file, n, 'WebSocket chỉ được dùng cho instanceof');
        }
        if (n.name === 'fetch') counts.fetch++;
      },
      MemberExpression(n, _s, anc) {
        const name = propName(n);
        const parent = anc[anc.length - 2];
 if (BANNED_IDENTIFIERS.has(name) && (!WINDOW_ALIASES.has(name) || GLOBALISH.test(src(code, n.object)))) err(file, n, `cấm dùng .${name}`);
        if (name === 'fetch') counts.fetch++;
        if (n.computed && typeof name === 'string' && GLOBALISH.test(src(code, n.object))) err(file, n, `cấm truy cập ${src(code, n.object)}[…]`);
        if (n.computed && n.property.type !== 'Literal' && GLOBALISH.test(src(code, n.object)) && !(file === CAM_FILE && src(code, n) === 'window[NS]')) err(file, n, `cấm truy cập ${src(code, n.object)}[khoá biến]`);
        if (name === 'WebSocket' && !(file === CAM_FILE && src(code, n) === 'win.WebSocket' && parent?.type === 'VariableDeclarator' && parent.id.name === 'WS')) err(file, n, '.WebSocket chỉ được đọc vào const WS (để instanceof)');
        if (n.computed && builtKey(n.property)) err(file, n, 'truy cập […] bằng khoá ghép/tính động');
        if (!n.computed && ['assign', 'replace', 'reload'].includes(name) && /(^|\.)location$/.test(src(code, n.object))) err(file, n, `cấm location.${name}`);
        if (isBridge && !n.computed && ['session', 'interaction', 'nextSequence', '_selectedEntityId'].includes(name)) {
          const ok = (parent?.type === 'MemberExpression' && parent.object === n) || (parent?.type === 'UnaryExpression' && parent.operator === 'typeof')
            || (parent?.type === 'BinaryExpression' && ['===', '!=='].includes(parent.operator))
            || (parent?.type === 'AssignmentExpression' && parent.left === n && parent.right.type === 'Literal' && parent.right.value === null)
            || (parent?.type === 'Property' && parent.value === n && ALLOWED[parent.key.name] === ALLOWED[name]);
          if (!ok) err(file, n, `.${name} của game chỉ được dùng trực tiếp (x.${name}.hàm), không truyền/gán đi chỗ khác`);
        }
        if (n.computed && n.property.type !== 'Literal') {
          const objName = n.object.type === 'MemberExpression' ? propName(n.object) : n.object.name;
          if (GAME_OBJECTS.has(objName)) err(file, n, `truy cập ${objName}[…] bằng ngoặc vuông`);
          return;
        }
        const allowedUse = (name === 'call' && src(code, n.object) === 'desc.get') || (name === 'prototype' && /(^|\.)MessageEvent$/.test(src(code, n.object)))
          || (isBridge && name === 'prototype' && /(^|\.)Object$/.test(src(code, n.object)));
        if (name && BANNED_PROPERTIES.has(name) && !allowedUse) {
          err(file, n, `cấm dùng .${name}`);
        }
        if (name && GAME_OBJECTS.has(name) && !isBridge) err(file, n, `.${name} của game chỉ được dùng trong ${BRIDGE}`);
        const objName = n.object.type === 'MemberExpression' ? propName(n.object) : null;
        if (objName && ALLOWED[objName] && isBridge && !ALLOWED[objName].has(name)) err(file, n, `${objName}.${name} không nằm trong danh sách cho phép`);
        if (name === 'dispatchEvent') {
          dispatches++;
          if (!(n.object.type === 'Identifier' && n.object.name === 'target')) err(file, n, 'dispatchEvent chỉ được gửi tới target (phím camera)');
        }
        if (name === 'click') {
          counts.click++;
          if (!isWeb || !(n.object.type === 'Identifier' && n.object.name === 'primary')) err(file, n, `.click() chỉ được dùng trong ${WEB} cho nút chính của game`);
        }
      },
      VariableDeclarator(n) {
        const init = n.init;
        if (n.id.name === 'k' && !(file === CAM_FILE && init?.type === 'MemberExpression' && init.computed && init.object.name === 'CAM_KEYS')) err(file, n, 'phím giả lập phải lấy từ CAM_KEYS');
        if (n.id.name === 'CAM_KEYS') {
          const codes = init?.type === 'ObjectExpression' ? init.properties.map(p => p.value?.elements?.[0]?.value) : [null];
          if (file !== CAM_FILE || codes.some(c => !CAM_CODES.includes(c))) err(file, n, `CAM_KEYS chỉ được chứa phím ${CAM_CODES.join('/')}`);
        }
        if (n.id.name === 'TRAPS') {
          const keys = init?.type === 'ObjectExpression' ? init.properties.map(p => p.key?.name) : [null];
          if (!isBridge || keys.some(k => !['nextSequence', '_selectedEntityId'].includes(k))) err(file, n, 'móc hàm game chỉ được bẫy nextSequence/_selectedEntityId trong game-bridge.js');
        }
        if (init?.type === 'MemberExpression' && ['session', 'interaction'].includes(propName(init))) err(file, n, 'không được gán session/interaction sang biến khác');
        if (n.id.type === 'ObjectPattern' && n.id.properties.some(p => p.key && GAME_OBJECTS.has(p.key.name))) err(file, n, 'không được destructuring đối tượng game');
      },
      NewExpression(n) {
        if (n.callee.type !== 'Identifier') err(file, n, 'new chỉ được dùng với tên hàm dựng trực tiếp');
        if (n.callee.name === 'KeyboardEvent') {
          counts.KeyboardEvent++;
          const init = n.arguments[1];
          const code0 = init?.properties?.find(p => p.key?.name === 'code');
          const key0 = init?.properties?.find(p => p.key?.name === 'key');
          if (file !== CAM_FILE || !code0 || src(code, code0.value) !== 'k[0]' || !key0 || src(code, key0.value) !== 'k[1]') err(file, n, 'KeyboardEvent phải lấy code/key từ CAM_KEYS (k[0]/k[1])');
        }
      },
      Literal(n) {
        if (typeof n.value === 'string' && /url\s*\(|@import|javascript:/i.test(n.value)) err(file, n, 'chuỗi chứa url( / @import / javascript: bị cấm');
        if (typeof n.value === 'string' && n.value.includes('authored-node') && (!isWeb || n.value !== PRIMARY_SELECTOR)) err(file, n, `bộ chọn nút game không được phép: ${n.value}`);
      },
      ObjectPattern(n, _s, anc) {
        for (const p of n.properties) {
          if (p.type !== 'Property') continue;
          const key = p.computed ? null : (p.key?.name ?? p.key?.value);
          if (p.computed) err(file, n, 'cấm destructuring bằng khoá tính động');
          else if (GAME_OBJECTS.has(key)) err(file, n, `cấm destructuring ${key} của game`);
          else if (PATTERN_BANNED.has(key)) err(file, n, `cấm destructuring ${key}`);
        }
        const parent = anc[anc.length - 2];
        const from = parent?.type === 'VariableDeclarator' && parent.id === n ? parent.init : parent?.type === 'AssignmentExpression' && parent.left === n ? parent.right : parent?.type === 'AssignmentPattern' && parent.left === n ? parent.right : null;
        if (from && GLOBALISH.test(src(code, from))) err(file, n, `cấm destructuring từ ${src(code, from)}`);
      },
      TaggedTemplateExpression(n) { err(file, n, 'cấm gọi hàm bằng template có thẻ (fn`…`)'); },
      TemplateElement(n) {
        if (/url\s*\(|@import|javascript:/i.test(n.value.cooked ?? n.value.raw)) err(file, n, 'chuỗi chứa url( / @import / javascript: bị cấm');
      },
      UpdateExpression(n) {
        const t = n.argument;
        if (t.type === 'MemberExpression' && t.computed && t.property.type !== 'Literal' && !WRITE_TARGETS.has(src(code, t.object))) err(file, n, `cấm ghi ${src(code, t.object)}[khoá biến]`);
      },
      AssignmentExpression(n) {
        const left = src(code, n.left);
        if (n.left.type === 'MemberExpression' && n.left.computed && n.left.property.type !== 'Literal' && !WRITE_TARGETS.has(src(code, n.left.object)) && !(file === CAM_FILE && left === 'window[NS]')) err(file, n, `cấm ghi ${src(code, n.left.object)}[khoá biến]`);
        if (/(^|\.)location\b/.test(left)) err(file, n, 'cấm đổi location');
        if (n.left.type === 'MemberExpression' && ['src', 'href', 'action', 'formAction', 'srcdoc', 'data'].includes(propName(n.left)) && !(file === CAM_FILE && left === 'frame.src' && src(code, n.right) === 'location.href')) {
          if (!(file === CAM_FILE && ['el.src', 'el.href'].includes(left))) err(file, n, `cấm gán .${propName(n.left)} (chỉ qua h())`);
        }
      },
      ImportExpression(n) { err(file, n, 'cấm import() động'); },
      CallExpression(n, _s, anc) {
        const timer = n.callee.type === 'MemberExpression' ? propName(n.callee) : n.callee.name;
        if (['setTimeout', 'setInterval'].includes(timer)) {
          const a = n.arguments[0];
          if (!(['ArrowFunctionExpression', 'FunctionExpression'].includes(a?.type) || (a?.type === 'Identifier' && TIMER_FNS.has(a.name)))) err(file, n, `${timer} chỉ nhận hàm viết thẳng`);
        }
        const callee = n.callee.type === 'MemberExpression' ? src(code, n.callee) : '';
        if (/^Object\.(getOwnPropertyDescriptor|defineProperty)$/.test(callee)) {
          const [o, k] = n.arguments.map(a => (a ? src(code, a) : ''));
          const ok = (isBridge && ['proto', 'this'].includes(o) && k === 'key') || (file === CAM_FILE && /^(win|patchedWin)\.MessageEvent\.prototype$/.test(o) && k === "'data'");
          if (!ok) err(file, n, `${callee} chỉ được dùng cho bẫy nextSequence/_selectedEntityId hoặc MessageEvent.data`);
        }
        if (callee === 'Object.assign' && !(file === CAM_FILE && src(code, n.arguments[0] ?? n) === 'host.style' && n.arguments[1]?.type === 'ConditionalExpression')) err(file, n, 'Object.assign chỉ được dùng cho host.style');
        if (n.callee.type === 'MemberExpression' && n.callee.computed && n.callee.property.type !== 'Literal' && n.callee.object.type !== 'ObjectExpression' && !(isBridge && src(code, n.callee) === 'TRAPS[key]')) err(file, n, 'cấm gọi hàm qua x[khoá]()');
        if (n.callee.type === 'MemberExpression' && propName(n.callee) === 'createElement') {
          const a = n.arguments[0];
          const ok = (a?.type === 'Literal' && a.value === 'iframe' && file === CAM_FILE) || (a?.type === 'Identifier' && a.name === 'tag' && file === CAM_FILE);
          if (!ok) err(file, n, 'createElement chỉ trong h() hoặc iframe Móc');
        }
        if (n.callee.type === 'MemberExpression' && ['setAttribute', 'setAttributeNS'].includes(propName(n.callee)) && !(file === CAM_FILE && src(code, n.arguments[0]) === 'k' && inFn(anc, 'h'))) err(file, n, 'setAttribute chỉ trong h()');
        if (n.callee.type === 'Identifier' && n.callee.name === 'h') {
          const [tag, props] = n.arguments;
          if (tag?.type !== 'Literal' || !H_TAGS.has(tag.value)) err(file, n, `h(): thẻ không cho phép ${tag ? src(code, tag) : ''}`);
          if (props && props.type !== 'ObjectExpression' && !(props.type === 'Literal' && props.value === null)) err(file, n, 'h(): props phải là object viết thẳng');
          for (const p of props?.properties ?? []) if (p.type !== 'Property' || p.computed || !H_PROPS.has(p.key.name ?? p.key.value)) err(file, n, `h(): thuộc tính không cho phép ${p.key ? (p.key.name ?? p.key.value) : '...'}`);
        }
        if (n.callee.name === 'getJSON') {
          const a = n.arguments[0];
          const ok = (a?.type === 'Literal' && a.value === '/catalog')
            || (a?.type === 'TemplateLiteral' && a.quasis[0].value.raw === '' && a.expressions[0]?.name === 'DATA_URL');
          if (!ok) err(file, n, 'getJSON chỉ được tải DATA_URL/… hoặc /catalog');
        }
      },
    });
    const maxDispatch = file === CAM_FILE ? 1 : 0;
    if (dispatches > maxDispatch) errors.push(`${file}: dispatchEvent tối đa ${maxDispatch} chỗ (đang có ${dispatches})`);
  }
  if (counts.KeyboardEvent > 1) errors.push(`KeyboardEvent chỉ được tạo ở 1 chỗ (phím camera) (đang có ${counts.KeyboardEvent})`);
  if (counts.fetch !== 1) errors.push(`fetch chỉ được gọi ở đúng 1 chỗ (getJSON) (đang có ${counts.fetch})`);
  if (counts.click > 1) errors.push(`.click() chỉ được dùng ở 1 chỗ (nút chính) (đang có ${counts.click})`);
  return errors;
}

function dataUrl() {
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
    entryPoints: [join(toolDir, 'overlay.js')], bundle: true, write: false, metafile: true, absWorkingDir: ROOT,
    format: 'iife', minify: true, target: 'es2020', legalComments: 'none', charset: 'utf8',
    define: { __CUTD_DATA_URL__: JSON.stringify(url) },
  });
  const inputs = Object.keys(out.metafile.inputs);
  const stray = inputs.filter(p => !/^tool\/[\w-]+\.js$/.test(p) || !files.some(([f]) => `tool/${f}` === p));
  if (stray.length) throw new Error(`Bookmarklet kéo file ngoài tool/*.js đã kiểm: ${stray.join(', ')}`);
  let code = out.outputFiles[0].text.trim();
  const version = `${pkg.version}-${createHash('sha256').update(code).digest('hex').slice(0, 7)}`;
  code = code.replace(/__CUTD_VERSION__/g, version);
  const banned = [/\beval\s*\(/, /new Function\s*\(/, /\.innerHTML\b/, /\.outerHTML\b/, /insertAdjacentHTML/, /document\.write/,
    /\.send\s*\(/, /sendBeacon/, /createElement\(\s*["'`]script/i, /importScripts/, /\bimport\s*\(/, /localStorage/, /document\.cookie/,
    /XMLHttpRequest/, /\.dispatch\s*\(/, /\bnew Image\b/, /\.open\s*\(/, /setTimeout\(\s*["'`]/, /getPrototypeOf/, /sellCreature|dismissWild|sendChat/,
    /sessionStorage|indexedDB|cookieStore|WebTransport|fetchLater|DOMParser|createContextualFragment|setHTMLUnsafe|parseHTMLUnsafe|srcdoc|WebAssembly/];
  const hit = banned.filter(re => re.test(code));
  if (hit.length) throw new Error(`Bookmarklet chứa API bị cấm: ${hit.join(', ')}`);
  if (!code.includes(JSON.stringify(url))) throw new Error('Địa chỉ dữ liệu chưa được khoá vào code');
  if (/%[0-9a-f]{2}/i.test(code)) throw new Error('Code chứa chuỗi %XX — bộ "Kiểm tra bookmark" trên wiki sẽ so sai');
  const commit = /^[0-9a-f]{40}$/.test(process.env.CUTD_COMMIT ?? '') ? process.env.CUTD_COMMIT : null;
  const result = { code, sha256: createHash('sha256').update(code).digest('hex'), bytes: Buffer.byteLength(code), version, dataUrl: url, commit };
  writeJSON(join(ROOT, 'src/data/tool.json'), result);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const r = await buildTool();
  console.log(`tool: ${(r.bytes / 1024).toFixed(1)}KB · v${r.version} · data ${r.dataUrl} · sha256 ${r.sha256.slice(0, 16)}…`);
  if (process.argv.includes('--out')) {
    const dir = join(ROOT, 'build');
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, 'cutd-helper-bookmark.txt'), `javascript:${encodeURIComponent(r.code)}\n`);
    writeFileSync(join(dir, 'cutd-helper-console.js'), `${r.code}\n`);
    console.log(`sha256 ${r.sha256}\nbookmark: build/cutd-helper-bookmark.txt · console: build/cutd-helper-console.js`);
  }
}
