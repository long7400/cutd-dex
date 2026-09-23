const SCALE = 1 / 32;
const BOARD = { w: 21.1200008392334, d: 21.1200008392334, h: 0.16699999570846558, wildH: -1.0549999475479126 };
const CAM = { tilt: 45.463068498014856, yaw: -23.651314388089816, fov: 26 };
const RAD = Math.PI / 180;

const rect = (r, o) => ({ x: r.min.x + o.x, y: r.min.y + o.y, w: r.max.x - r.min.x, h: r.max.y - r.min.y });
export const inside = (r, p) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

export function groundOf(rules, origin) {
  if (!rules || !origin) return null;
  const arena = rect(rules.arena, origin);
  return {
    arena, wild: rect(rules.wild_area, origin), spawn: rect(rules.spawn_area, origin), exit: rect(rules.exit_area, origin),
    trade: { x: arena.x - 420, y: arena.y + 80, w: 240, h: arena.h - 160 },
  };
}

export function tradeSlotPos(g, slot) {
  const n = Math.max(0, slot - 1), col = n % 2, row = Math.floor(n / 2);
  return { x: g.trade.x + (g.trade.w * (col + 0.5)) / 2, y: g.trade.y + (g.trade.h * (row + 0.5)) / 4 };
}

export function sceneOf(g) {
  const lo = Math.max(g.arena.y, g.spawn.y + g.spawn.h) + 1e-6, hi = Math.min(g.arena.y + g.arena.h, g.exit.y) - 1e-6;
  const cx = g.arena.x + g.arena.w / 2, cy = (lo + hi) / 2;
  const a = (g.arena.w * SCALE) / BOARD.w;
  const zScale = (BOARD.d * a) / (hi - lo), half = (BOARD.d * a) / 2, wildY = (BOARD.wildH - BOARD.h) * a;
  const wildRect = { x: -8 * a, y: (BOARD.d / 2 + 5.5) * a, w: 16 * a, h: 9 * a };
  const tradeRect = { x: -24 * a, y: -8 * a, w: 8 * a, h: 16 * a };
  const entranceZ = -13.5 * a, exitZ = 14.3 * a;
  const map = (p, from, to, y) => ({ x: to.x + ((p.x - from.x) / from.w) * to.w, y, z: to.y + ((p.y - from.y) / from.h) * to.h });
  return {
    toScene(p, zone = 'battle') {
      if (zone === 'wild') return map(p, g.wild, wildRect, wildY);
      if (zone === 'trade') return map(p, g.trade, tradeRect, wildY);
      const x = (p.x - cx) * SCALE;
      if (p.y > hi) return { x, y: 0, z: half + (exitZ - half) * ((p.y - hi) / (g.exit.y + g.exit.h - hi)) };
      if (p.y < lo) return { x, y: 0, z: entranceZ + (-half - entranceZ) * ((p.y - g.spawn.y) / (lo - g.spawn.y)) };
      return { x, y: 0, z: (p.y - cy) * zScale };
    },
  };
}

export const zoneOf = (g, p) => (inside(g.wild, p) ? 'wild' : inside(g.trade, p) ? 'trade' : 'battle');

export function axes(view) {
  const t = -CAM.tilt * RAD, f = [CAM.yaw, 0, -CAM.yaw][view] * RAD;
  const st = Math.sin(t), ct = Math.cos(t), sf = Math.sin(f), cf = Math.cos(f);
  return {
    right: { x: cf, y: 0, z: -sf },
    up: { x: st * sf, y: ct, z: st * cf },
    fwd: { x: -ct * sf, y: st, z: -ct * cf },
  };
}

const dot = (a, b) => a.x * b.x + a.y * b.y + a.z * b.z;

export function homeCamera(g, view, W, H) {
  const { right, up, fwd } = axes([0, 1, 2].includes(view) ? view : 0);
  const sc = sceneOf(g);
  const pts = [];
  for (const r of [g.arena, g.spawn, g.exit]) {
    for (const x of [r.x, r.x + r.w]) for (const y of [r.y, r.y + r.h]) {
      const e = sc.toScene({ x, y }, 'battle');
      pts.push({ x: dot(e, right), y: dot(e, up), depth: dot(e, fwd) });
    }
  }
  const w = Math.max(1, W), h = Math.max(1, H), tanV = Math.tan((CAM.fov * Math.PI) / 360), tanH = (tanV * w) / h;
  const mid = k => (Math.min(...pts.map(p => p[k])) + Math.max(...pts.map(p => p[k]))) / 2;
  const mx = mid('x'), my = mid('y'), md = mid('depth');
  let c = 1;
  for (const p of pts) {
    const e = p.depth - md;
    c = Math.max(c, Math.abs(p.x - mx) / tanH - e, Math.abs(p.y - my) / tanV - e, 1 - e);
  }
  c *= 1.08;
  const depth = md - c;
  const pos = {
    x: right.x * mx + up.x * my + fwd.x * depth,
    y: right.y * mx + up.y * my + fwd.y * depth,
    z: right.z * mx + up.z * my + fwd.z * depth,
  };
  return { pos, right, up, fwd, tanV, aspect: w / h, W: w, H: h };
}

export function project(cam, p) {
  const v = { x: p.x - cam.pos.x, y: p.y - cam.pos.y, z: p.z - cam.pos.z };
  const z = dot(v, cam.fwd);
  if (!(z > 1e-6)) return null;
  const nx = dot(v, cam.right) / (z * cam.tanV * cam.aspect), ny = dot(v, cam.up) / (z * cam.tanV);
  return { x: ((nx + 1) / 2) * cam.W, y: ((1 - ny) / 2) * cam.H };
}

export function screenPoint(rules, origin, view, W, H, pos) {
  const g = groundOf(rules, origin);
  if (!g || !pos) return null;
  const pt = project(homeCamera(g, view, W, H), sceneOf(g).toScene(pos, zoneOf(g, pos)));
  return pt && Number.isFinite(pt.x) && Number.isFinite(pt.y) ? pt : null;
}
