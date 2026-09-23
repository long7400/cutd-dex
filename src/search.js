const norm = s => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

function levenshtein(a, b, max = Infinity) {
  if (Math.abs(a.length - b.length) > max) return max + 1;
  let prev = new Array(b.length + 1);
  let cur = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    cur[0] = i;
    let best = i;
    const lo = Math.max(1, i - max), hi = Math.min(b.length, i + max);
    for (let j = 1; j <= b.length; j++) {
      if (j < lo || j > hi) { cur[j] = max + 1; continue; }
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      if (cur[j] < best) best = cur[j];
    }
    if (best > max) return max + 1;
    [prev, cur] = [cur, prev];
  }
  return prev[b.length];
}

function createBKTree() {
  let root = null;
  return {
    insert(word) {
      if (!root) { root = { word, children: new Map() }; return; }
      let node = root;
      while (true) {
        const d = levenshtein(node.word, word);
        if (d === 0) return;
        const child = node.children.get(d);
        if (!child) { node.children.set(d, { word, children: new Map() }); return; }
        node = child;
      }
    },
    search(word, maxDist, out = []) {
      if (!root) return out;
      const stack = [root];
      while (stack.length) {
        const node = stack.pop();
        const d = levenshtein(node.word, word);
        if (d <= maxDist) out.push({ word: node.word, d });
        for (let i = Math.max(1, d - maxDist); i <= d + maxDist; i++) {
          const c = node.children.get(i);
          if (c) stack.push(c);
        }
      }
      return out;
    },
  };
}

function createTrie() {
  const root = { children: new Map(), ids: new Set() };
  return {
    insert(word, id) {
      let node = root;
      for (const ch of word) {
        let next = node.children.get(ch);
        if (!next) {
          next = { children: new Map(), ids: new Set() };
          node.children.set(ch, next);
        }
        node = next;
      }
      node.ids.add(id);
    },
    prefix(prefix, out = new Set()) {
      let node = root;
      for (const ch of prefix) {
        node = node.children.get(ch);
        if (!node) return out;
      }
      const stack = [node];
      while (stack.length) {
        const n = stack.pop();
        for (const id of n.ids) out.add(id);
        for (const c of n.children.values()) stack.push(c);
      }
      return out;
    },
  };
}

export function buildIndex(pets) {
  const exact = new Map();
  const trie = createTrie();
  const bk = createBKTree();
  const searchTexts = pets.map(p => norm(p.name + ' ' + p.searchTokens.join(' ')));

  pets.forEach((p, idx) => {
    for (const tok of p.searchTokens) {
      const words = tok.split(' ');
      for (const w of new Set([...words, tok])) {
        if (!w) continue;
        let set = exact.get(w);
        if (!set) { set = new Set(); exact.set(w, set); }
        set.add(idx);
        trie.insert(w, idx);
      }
    }
  });
  for (const w of exact.keys()) bk.insert(w);

  const fuzzyFor = word => {
    if (word.length < 3) return [];
    const maxDist = word.length <= 4 ? 1 : 2;
    return bk.search(word, maxDist).filter(m => m.word !== word);
  };

  return {
    pets, exact, trie, searchTexts,

    query(q) {
      const nq = norm(q);
      if (!nq) return null;
      const words = nq.split(' ').filter(Boolean);

      const scores = new Map();
      const add = (ids, score) => { for (const i of ids) scores.set(i, Math.min(scores.get(i) ?? 99, score)); };

      for (const w of words) {
        const ex = exact.get(w);
        if (ex) add(ex, 0);
        const pref = trie.prefix(w);
        if (pref.size) add(pref, 1);
        for (const m of fuzzyFor(w)) {
          const s = exact.get(m.word);
          if (s) add(s, 2 + m.d);
        }
      }

      if (scores.size) {
        return [...scores.entries()].sort((a, b) => a[1] - b[1]).map(e => e[0]);
      }

      const out = [];
      for (let i = 0; i < this.searchTexts.length; i++) {
        if (this.searchTexts[i].includes(nq)) out.push(i);
      }
      return out;
    },
  };
}

export function debounce(fn, ms = 90) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
