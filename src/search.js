// Cỗ máy tìm kiếm cho pet — kết hợp 3 cấu trúc dữ liệu:
//
//  1) Inverted index  Map<token, Set<petIdx>> : khớp token chính xác O(1)
//  2) Trie (cây tiền tố)                    : gợi ý theo tiền tố, truy vấn O(len(prefix))
//     (insert tích luỹ id dọc đường → query chỉ cần đọc Set ở node cuối)
//  3) Mảng searchText (chuỗi chuẩn hoá)     : fallback substring cho cụm nhiều từ
//
// Pipeline: tách token → union kết quả (index chính xác ∪ trie prefix) → nếu rỗng,
// quét substring fallback. Debounce bên ngoài giúp mỗi lần gõ chỉ 1 query.
//
// Norm: bỏ dấu tiếng Việt + lowercase → "Lửa" khớp "lua", "Charmander" khớp "char".

export const norm = s => s
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, ' ')
  .trim();

// ---- Trie ----
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
      node.ids.add(id); // node cuối giữ id các từ có đúng prefix này
    },
    // trả về Set id mọi từ có tiền tố `prefix`; dừng sớm khi rẽ nhánh chết
    prefix(prefix, out = new Set()) {
      let node = root;
      for (const ch of prefix) {
        node = node.children.get(ch);
        if (!node) return out; // chết nhánh → kết thúc ngay
      }
      // BFS thu thập toàn bộ nhánh con
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

// ---- Build index 1 lần khi load app ----
export function buildIndex(pets) {
  const exact = new Map();   // inverted index: token -> Set(idx)
  const trie = createTrie();
  const searchTexts = pets.map(p => norm(p.name + ' ' + p.searchTokens.join(' ')));

  pets.forEach((p, idx) => {
    // từng từ trong từng token (vd "mega blastoise" tách 2 từ) + nguyên token
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

    // Truy vấn: trả về mảng pet khớp
    query(q) {
      const nq = norm(q);
      if (!nq) return null; // rỗng → không lọc
      const words = nq.split(' ').filter(Boolean);

      // ghép intersection nhỏ-dọn-trước: dùng word ít kết quả nhất làm mồi
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

      // fallback: substring trên chuỗi tìm kiếm ghép (bắt được "mega gyar")
      const out = [];
      for (let i = 0; i < this.searchTexts.length; i++) {
        if (this.searchTexts[i].includes(nq)) out.push(i);
      }
      return out;
    },
  };
}

// ---- Debounce ----
export function debounce(fn, ms = 90) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
