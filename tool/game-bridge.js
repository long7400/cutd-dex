const KIND = { w: 'wild', u: 'creature', t: 'trade-offer' };
let cached = null;

const isGame = c => c && typeof c.interaction?.selectEntity === 'function'
  && typeof c.store?.entities?.get === 'function' && typeof c.store.entities.values === 'function'
  && typeof c.session === 'object' && c.session !== null;

const TRAPS = {
  nextSequence: o => ['catchWild', 'evolveCreature', 'tradePet', 'dispatch'].every(k => typeof o[k] === 'function'),
  _selectedEntityId: o => ['selectEntity', 'tapGround', 'clearSelection'].every(k => typeof o[k] === 'function'),
};
const caught = { nextSequence: null, _selectedEntityId: null };
const armed = new Map();

function disarm(key) {
  const proto = armed.get(key);
  if (!proto) return;
  armed.delete(key);
  const d = Object.getOwnPropertyDescriptor(proto, key);
  if (d?.set?.cutd) delete proto[key];
}

export function armWebCapture(win = window) {
  disarmWebCapture();
  const proto = win.Object.prototype;
  for (const key of Object.keys(TRAPS)) {
    if (caught[key] || Object.getOwnPropertyDescriptor(proto, key)) continue;
    const set = function (v) {
      Object.defineProperty(this, key, { value: v, writable: true, enumerable: true, configurable: true });
      try { if (!caught[key] && TRAPS[key](this)) { caught[key] = this; disarm(key); } } catch { }
    };
    set.cutd = true;
    Object.defineProperty(proto, key, { set, configurable: true, enumerable: false });
    armed.set(key, proto);
  }
}

export function forgetWebCapture() {
  caught.nextSequence = null;
  caught._selectedEntityId = null;
  cached = null;
}

export function disarmWebCapture() {
  for (const key of [...armed.keys()]) disarm(key);
}

export const webCaptured = () => caught.nextSequence !== null && caught._selectedEntityId !== null;
export const webTouched = () => caught.nextSequence !== null || caught._selectedEntityId !== null;

function webGame() {
  if (!webCaptured()) return null;
  const g = { store: caught.nextSequence.store, session: caught.nextSequence, interaction: caught._selectedEntityId };
  return isGame(g) ? g : null;
}

export function findGame() {
  if (isGame(cached)) return cached;
  cached = null;
  const web = webGame();
  if (web) return (cached = web);
  try {
    const stack = [window.cc?.director?.getScene?.()].filter(Boolean);
    for (let seen = 0; stack.length && seen < 5000; seen++) {
      const node = stack.pop();
      for (const c of node.components ?? []) if (isGame(c)) return (cached = c);
      stack.push(...(node.children ?? []));
    }
  } catch { }
  return null;
}

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

const mine = (g, ent) => typeof g.session.canCommand !== 'function' || g.session.canCommand(ent) === true;

export function catchWild(g, ent) {
  if (typeof g.session.catchWild !== 'function') return 'fn';
  g.session.catchWild(ent);
  return null;
}

export function evolveCreature(g, ent, nextStageId) {
  if (typeof g.session.evolveCreature !== 'function') return 'fn';
  if (!mine(g, ent)) return 'other';
  g.session.evolveCreature(ent, nextStageId);
  return null;
}

export function tradePet(g, ent, offerSlot) {
  if (typeof g.session.tradePet !== 'function') return 'fn';
  if (!mine(g, ent)) return 'other';
  g.session.tradePet(ent, offerSlot);
  return null;
}

export function moveCreature(g, ent, pos) {
  if (typeof g.session.moveCreature !== 'function') return { fail: 'fn' };
  if (!mine(g, ent)) return { fail: 'other' };
  const seq = g.session.moveCreature(ent, { x: pos.x, y: pos.y });
  return Number.isInteger(seq) ? { seq } : { fail: 'rule' };
}

export function groundOf(g) {
  const gr = g?.store?.ground;
  const a = gr?.arena;
  if (!a || ![a.originX, a.originY, a.width, a.height].every(Number.isFinite)) return null;
  const path = Array.isArray(gr.path) && gr.path.length >= 2 && gr.path.every(p => Number.isFinite(p?.x) && Number.isFinite(p?.y)) ? gr.path.map(p => ({ x: p.x, y: p.y })) : null;
  return { arena: { originX: a.originX, originY: a.originY, width: a.width, height: a.height }, path };
}

export const clientKind = () => (window.cc?.director ? 'cocos' : document.getElementById('GameCanvas') ? 'cocos-loading' : 'web');

export function probe(toolWildKey) {
  const out = { host: location.host, client: clientKind(), hasEngine: !!window.cc?.director, webHooked: webCaptured(), webArmed: [...armed.keys()], found: false, fns: [], entities: 0, keys: [], sampleWild: null };
  const g = findGame();
  if (!g) return out;
  out.found = true;
  out.fns = [typeof g.session.catchWild === 'function' && 'catchWild', typeof g.session.evolveCreature === 'function' && 'evolveCreature',
    typeof g.session.tradePet === 'function' && 'tradePet', typeof g.session.moveCreature === 'function' && 'moveCreature'].filter(Boolean);
  let i = 0;
  for (const [id, ent] of g.store.entities) {
    out.entities++;
    if (i++ < 6) out.keys.push(`${String(id).slice(0, 12)}:${String(ent?.kind ?? '?').slice(0, 12)}`);
    if (!out.sampleWild && ent?.kind === 'wild') out.sampleWild = `${String(id).slice(0, 12)} wireId=${Number(ent.wireId)}`;
  }
  if (toolWildKey) { out.toolWild = toolWildKey; out.toolWildFound = !!findEntity(g, toolWildKey); }
  return out;
}
