export const norm = s => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

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

  return {
    pets, exact, trie, searchTexts,

    query(q) {
      const nq = norm(q);
      if (!nq) return null;
      const words = nq.split(' ').filter(Boolean);

      const hits = words.map(w => {
        const s = new Set();
        const ex = this.exact.get(w);
        if (ex) for (const i of ex) s.add(i);
        this.trie.prefix(w, s);
        return s;
      });
      hits.sort((a, b) => a.size - b.size);

      const result = new Set(hits[0]);
      for (let i = 1; i < hits.length && result.size; i++) {
        for (const id of result) if (!hits[i].has(id)) result.delete(id);
      }

      if (result.size) return [...result];

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
