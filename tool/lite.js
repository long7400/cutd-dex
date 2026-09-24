export const FPS_CAPS = [0, 30, 20, 15];

export function capFrames(win, fps, saved) {
  if (!saved.raf) { saved.raf = win.requestAnimationFrame; saved.caf = win.cancelAnimationFrame; saved.win = win; }
  if (!fps) {
    win.requestAnimationFrame = saved.raf;
    win.cancelAnimationFrame = saved.caf;
    return;
  }
  const gap = 1000 / fps;
  let next = 0;
  win.requestAnimationFrame = fn => {
    const now = win.performance.now();
    next = Math.max(now, next + gap);
    return setTimeout(() => fn(win.performance.now()), next - now);
  };
  win.cancelAnimationFrame = id => clearTimeout(id);
}

export function readLite(win) {
  try {
    const q = win.localStorage.getItem('cutd.quality'), f = win.localStorage.getItem('cutd.frame-rate');
    const v = win.localStorage.getItem('cutd.vfx-optimization'), g = win.localStorage.getItem('cutd.arena-greenery'), b = win.localStorage.getItem('cutd.bloom');
    return { quality: q ?? 'auto', fps: f === '30' ? 30 : 60, vfx: v === 'true', greenery: g !== 'false', bloom: b === 'true' || b === '1' };
  } catch {
    return null;
  }
}

export function writeLite(win, on) {
  try {
    if (on) {
      win.localStorage.setItem('cutd.quality', 'low');
      win.localStorage.setItem('cutd.frame-rate', '30');
      win.localStorage.setItem('cutd.vfx-optimization', 'true');
      win.localStorage.setItem('cutd.arena-greenery', 'false');
      win.localStorage.setItem('cutd.bloom', 'false');
    } else {
      win.localStorage.setItem('cutd.quality', 'auto');
      win.localStorage.setItem('cutd.frame-rate', '60');
      win.localStorage.setItem('cutd.vfx-optimization', 'false');
      win.localStorage.setItem('cutd.arena-greenery', 'true');
      win.localStorage.removeItem('cutd.bloom');
    }
    return true;
  } catch {
    return false;
  }
}
