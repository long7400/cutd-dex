const WEB_KEYS = { escape: ['Escape', 'Escape'], home: ['Home', 'Home'] };
const PRIMARY = 'button.authored-node[data-node="Primary"]';
const ROWS = 'button.authored-node[data-node^="Row"]';
const NODES = '.authored-node[data-node]';

export const canvasEl = () => {
  const c = document.getElementById('world');
  return c instanceof HTMLCanvasElement ? c : null;
};

const visible = el => !!el && !el.closest('[hidden]') && el.getClientRects().length > 0;

export function pressKey(name) {
  const k = WEB_KEYS[name];
  const target = canvasEl();
  if (!k || !target) return;
  for (const type of ['keydown', 'keyup']) target.dispatchEvent(new KeyboardEvent(type, { code: k[0], key: k[1], bubbles: true, cancelable: true }));
}

export function tap(x, y, pointerId) {
  const canvas = canvasEl();
  if (!canvas || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const id = Number.isInteger(pointerId) && pointerId >= 0 ? pointerId : 1;
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: id, pointerType: 'mouse', isPrimary: true }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 0, pointerId: id, pointerType: 'mouse', isPrimary: true }));
  return true;
}

export function cameraView() {
  let v = 0;
  try { v = Number(localStorage.getItem('cutd.cameraView')); } catch { v = 0; }
  return [0, 1, 2].includes(v) ? v : 0;
}

export function modalOpen() {
  const shade = [...document.querySelectorAll(NODES)].find(el => el.dataset.node === 'ModalShade');
  return visible(shade);
}

export function selectedName() {
  const panel = [...document.querySelectorAll(NODES)].find(el => el.dataset.node === 'MonsterPanel');
  if (!visible(panel)) return '';
  const name = [...panel.querySelectorAll(NODES)].find(el => el.dataset.node === 'Name' && !el.parentElement?.closest('[data-node^="Skill"]'));
  return (name?.textContent ?? '').trim();
}

const findPrimary = () => [...document.querySelectorAll(PRIMARY)].find(b => !b.disabled && visible(b)) ?? null;
export const primaryReady = () => !!findPrimary();

export function clickPrimary() {
  const primary = findPrimary();
  if (!primary) return false;
  primary.click();
  return true;
}

export function clickRow(i, expectTitle) {
  if (!modalOpen() || !Number.isInteger(i) || i < 0 || i > 9 || !expectTitle) return false;
  const row = [...document.querySelectorAll(ROWS)].find(b => b.dataset.node === `Row${i}` && b.closest('[data-node="ModalShade"]'));
  if (!row || row.disabled || !visible(row)) return false;
  const titleEl = [...row.querySelectorAll(NODES)].find(el => el.dataset.node === 'Title');
  if ((titleEl?.textContent ?? '').trim() !== expectTitle) return false;
  row.click();
  return true;
}

export async function until(ok, ms = 600) {
  const end = performance.now() + ms;
  while (!ok()) {
    if (performance.now() > end) return false;
    await frames(1);
  }
  return true;
}

export const frames = (n = 2) => new Promise(resolve => {
  let left = n;
  const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
  requestAnimationFrame(step);
  setTimeout(resolve, 250 * n);
});
