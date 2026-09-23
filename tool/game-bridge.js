// CẦU NỐI DUY NHẤT giữa CUTD Helper và code của client game. Mọi chỗ khác trong tool KHÔNG được đụng tới
// session / interaction / store của game (scripts/build-tool.mjs kiểm tra bằng AST).
// Chỉ dùng đúng các hàm mà nút của chính game dùng:
//   interaction.selectEntity(store, id)        — chọn con (chỉ đổi lựa chọn trên máy, không gửi gì)
//   session.catchWild(wild)                    — nút Bắt
//   session.evolveCreature(unit, nextStageId)  — nút Tiến hóa
//   session.tradePet(unit, offerSlot)          — nút Trade
// Đi qua session của game nên lệnh được game tự đánh số thứ tự + chờ xác nhận như khi bấm nút trong game.

const KIND = { w: 'wild', u: 'creature', t: 'trade-offer' };
let cached = null;

const isGame = c => c && typeof c.interaction?.selectEntity === 'function'
  && typeof c.store?.entities?.get === 'function' && typeof c.store.entities.values === 'function'
  && c.session && typeof c.session === 'object';

export function findGame() {
  if (isGame(cached)) return cached;
  cached = null;
  try {
    const stack = [window.cc?.director?.getScene?.()].filter(Boolean);
    for (let seen = 0; stack.length && seen < 5000; seen++) {
      const node = stack.pop();
      for (const c of node.components ?? []) if (isGame(c)) return (cached = c);
      stack.push(...(node.children ?? []));
    }
  } catch { /* cấu trúc game đổi → coi như không tìm thấy */ }
  return null;
}

// Tìm entity theo id "w12"/"u3"/"t1"; không có thì dò theo loại + wireId (phòng bản game đặt id khác). Chỉ đọc.
export function findEntity(g, key) {
  if (!g || typeof key !== 'string' || !/^[utw]\d{1,9}$/.test(key)) return null;
  const entities = g.store.entities;
  const direct = entities.get(key);
  if (direct) return { id: key, ent: direct };
  const kind = KIND[key[0]], wire = Number(key.slice(1));
  for (const [id, ent] of entities) {
    if (ent?.kind === kind && (ent.wireId === wire || (kind === 'trade-offer' && ent.tradeSlot === wire))) return { id, ent };
  }
  return null;
}

export function selectEntity(g, id) {
  g.interaction.selectEntity(g.store, id);
}

// Trả null nếu đã gửi, hoặc mã lỗi 'fn' nếu bản game không có hàm đó.
export function catchWild(g, ent) {
  if (typeof g.session.catchWild !== 'function') return 'fn';
  g.session.catchWild(ent);
  return null;
}

export function evolveCreature(g, ent, nextStageId) {
  if (typeof g.session.evolveCreature !== 'function') return 'fn';
  g.session.evolveCreature(ent, nextStageId);
  return null;
}

export function tradePet(g, ent, offerSlot) {
  if (typeof g.session.tradePet !== 'function') return 'fn';
  g.session.tradePet(ent, offerSlot);
  return null;
}

// Loại client đang chạy: 'cocos' (cutd.site, có engine Cocos → nút thao tác dùng được) hoặc 'web' (m.cutd.site,
// code game đóng kín trong module → không có đường gọi hàm game, nút thao tác không hỗ trợ).
export const clientKind = () => (window.cc?.director ? 'cocos' : document.getElementById('GameCanvas') ? 'cocos-loading' : 'web');

// Chỉ đọc: tool nhìn thấy gì trong game — để chẩn đoán khi nút không chạy.
export function probe(toolWildKey) {
  const out = { host: location.host, client: clientKind(), hasEngine: !!window.cc?.director, found: false, fns: [], entities: 0, keys: [], sampleWild: null };
  const g = findGame();
  if (!g) return out;
  out.found = true;
  out.fns = [typeof g.session.catchWild === 'function' && 'catchWild', typeof g.session.evolveCreature === 'function' && 'evolveCreature',
    typeof g.session.tradePet === 'function' && 'tradePet'].filter(Boolean);
  let i = 0;
  for (const [id, ent] of g.store.entities) {
    out.entities++;
    if (i++ < 6) out.keys.push(`${String(id).slice(0, 12)}:${String(ent?.kind ?? '?').slice(0, 12)}`);
    if (!out.sampleWild && ent?.kind === 'wild') out.sampleWild = `${String(id).slice(0, 12)} wireId=${Number(ent.wireId)}`;
  }
  if (toolWildKey) { out.toolWild = toolWildKey; out.toolWildFound = !!findEntity(g, toolWildKey); }
  return out;
}
