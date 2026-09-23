import { norm } from './html.js';

function levenshtein(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array(b.length + 1), cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = i;
    const lo = Math.max(1, i - max), hi = Math.min(b.length, i + max);
    for (let j = 1; j <= b.length; j++) {
      if (j < lo || j > hi) { cur[j] = max + 1; continue; }
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

function bkTree() {
  let root = null;
  return {
    insert(word) {
      if (!root) { root = { word, kids: new Map() }; return; }
      for (let node = root; ;) {
        const d = levenshtein(node.word, word);
        if (d === 0) return;
        const next = node.kids.get(d);
        if (!next) { node.kids.set(d, { word, kids: new Map() }); return; }
        node = next;
      }
    },
    search(word, max) {
      const out = [];
      const stack = root ? [root] : [];
      while (stack.length) {
        const node = stack.pop();
        const d = levenshtein(node.word, word);
        if (d <= max) out.push({ word: node.word, d });
        for (let i = Math.max(1, d - max); i <= d + max; i++) {
          const k = node.kids.get(i);
          if (k) stack.push(k);
        }
      }
      return out;
    },
  };
}

function trie() {
  const root = { kids: new Map(), ids: new Set() };
  return {
    insert(word, id) {
      let node = root;
      for (const ch of word) {
        let next = node.kids.get(ch);
        if (!next) node.kids.set(ch, (next = { kids: new Map(), ids: new Set() }));
        node = next;
        node.ids.add(id);
      }
    },
    prefix(p) {
      let node = root;
      for (const ch of p) if (!(node = node.kids.get(ch))) return null;
      return node.ids;
    },
  };
}

export function buildIndex(docs, tokensOf) {
  const exact = new Map();
  const pre = trie();
  const bk = bkTree();
  const texts = docs.map(d => norm(tokensOf(d).join(' ')));

  docs.forEach((doc, idx) => {
    for (const tok of tokensOf(doc)) {
      for (const w of norm(tok).split(' ')) {
        if (!w) continue;
        if (!exact.has(w)) exact.set(w, new Set());
        exact.get(w).add(idx);
        pre.insert(w, idx);
      }
    }
  });
  for (const w of exact.keys()) bk.insert(w);

  const scoreWord = w => {
    const s = new Map();
    const add = (ids, score) => { if (ids) for (const i of ids) if (!(s.get(i) <= score)) s.set(i, score); };
    add(exact.get(w), 0);
    add(pre.prefix(w), 1);
    if (w.length >= 3) {
      for (const m of bk.search(w, w.length <= 4 ? 1 : 2)) if (m.word !== w) add(exact.get(m.word), 1 + m.d);
    }
    return s;
  };

  return {
    query(q) {
      const nq = norm(q);
      if (!nq) return null;
      const words = [...new Set(nq.split(' '))];
      const per = words.map(scoreWord).sort((a, b) => a.size - b.size);
      let total = per[0];
      for (const s of per.slice(1)) {
        const next = new Map();
        for (const [i, sc] of total) if (s.has(i)) next.set(i, sc + s.get(i));
        total = next;
      }
      if (total.size) return [...total].sort((a, b) => a[1] - b[1] || a[0] - b[0]).map(e => e[0]);
      const out = [];
      texts.forEach((t, i) => { if (t.includes(nq)) out.push(i); });
      return out;
    },
  };
}
