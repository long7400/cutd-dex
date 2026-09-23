class LiteralError extends Error {}

export const MAX_DEPTH = 64;

export function parseLiteral(src, start = 0, budget = { steps: 2_000_000 }) {
  let i = start, depth = 0;
  const fail = msg => { throw new LiteralError(`${msg} @${i}: ${JSON.stringify(src.slice(i, i + 40))}`); };
  const ws = () => { while (i < src.length && /\s/.test(src[i])) i++; };

  function string() {
    const q = src[i++];
    let out = '';
    while (i < src.length) {
      const c = src[i++];
      if (c === q) return out;
      if (q === '`' && c === '$' && src[i] === '{') fail('template interpolation');
      if (c !== '\\') { out += c; continue; }
      const e = src[i++];
      if (e === 'n') out += '\n';
      else if (e === 't') out += '\t';
      else if (e === 'r') out += '\r';
      else if (e === 'u') {
        if (src[i] === '{') {
          const end = src.indexOf('}', i);
          const cp = end > i && end - i <= 7 ? parseInt(src.slice(i + 1, end), 16) : NaN;
          if (!(cp >= 0 && cp <= 0x10ffff)) fail('bad \\u{}');
          out += String.fromCodePoint(cp); i = end + 1;
        }
        else { out += String.fromCharCode(parseInt(src.slice(i, i + 4), 16)); i += 4; }
      } else if (e === 'x') { out += String.fromCharCode(parseInt(src.slice(i, i + 2), 16)); i += 2; }
      else if (e === '\n') { }
      else out += e;
    }
    fail('unterminated string');
  }

  function value() {
    if (--budget.steps < 0) fail('too much work');
    ws();
    const c = src[i];
    if ((c === '{' || c === '[') && depth >= MAX_DEPTH) fail('too deep');
    if (c === '{') { depth++; const o = object(); depth--; return o; }
    if (c === '[') { depth++; const a = array(); depth--; return a; }
    if (c === '"' || c === "'" || c === '`') return string();
    if (src.startsWith('!0', i)) { i += 2; return true; }
    if (src.startsWith('!1', i)) { i += 2; return false; }
    if (src.startsWith('void 0', i)) { i += 6; return undefined; }
    for (const [kw, v] of [['true', true], ['false', false], ['null', null]]) {
      if (src.startsWith(kw, i) && !/[\w$]/.test(src[i + kw.length])) { i += kw.length; return v; }
    }
    const m = /^-?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?/i.exec(src.slice(i, i + 40));
    if (m) { i += m[0].length; return Number(m[0]); }
    fail('unsupported value');
  }

  function key() {
    ws();
    const c = src[i];
    if (c === '"' || c === "'" || c === '`') return string();
    const m = /^[A-Za-z_$][\w$]*|^\d+/.exec(src.slice(i, i + 200));
    if (!m) fail('bad key');
    i += m[0].length;
    return m[0];
  }

  function object() {
    i++;
    const out = {};
    ws();
    if (src[i] === '}') { i++; return out; }
    for (;;) {
      const k = key();
      ws();
      if (src[i] !== ':') fail('expected :');
      i++;
      const v = value();
      if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') out[k] = v;
      ws();
      if (src[i] === ',') { i++; ws(); if (src[i] === '}') { i++; return out; } continue; }
      if (src[i] === '}') { i++; return out; }
      fail('expected , or }');
    }
  }

  function array() {
    i++;
    const out = [];
    ws();
    if (src[i] === ']') { i++; return out; }
    for (;;) {
      out.push(value());
      ws();
      if (src[i] === ',') { i++; ws(); if (src[i] === ']') { i++; return out; } continue; }
      if (src[i] === ']') { i++; return out; }
      fail('expected , or ]');
    }
  }

  const v = value();
  return { value: v, end: i };
}

export function literalsMatching(src, re, budget = { steps: 5_000_000 }) {
  const out = [];
  const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
  for (const m of src.matchAll(g)) {
    if (budget.steps <= 0) break;
    try { out.push(parseLiteral(src, m.index, budget).value); } catch { }
  }
  return out;
}

export function enclosingObject(src, needle, { maxBack = 200_000, tries = 50, budget = { steps: 5_000_000 } } = {}) {
  const at = src.indexOf(needle);
  if (at < 0) return null;
  let from = at;
  for (let t = 0; t < tries; t++) {
    const open = src.lastIndexOf('={', from);
    if (open < 0 || at - open > maxBack) return null;
    try {
      if (budget.steps <= 0) return null;
      const { value, end } = parseLiteral(src, open + 1, budget);
      if (end > at) return value;
    } catch { }
    from = open - 1;
  }
  return null;
}
