// CẦU NỐI DUY NHẤT với bản web (m.cutd.site). Bản này không lộ code game ra ngoài nên tool thao tác y như tay người:
//   • phím của chính game: Esc (bỏ chọn / thoát chế độ nhắm) và Home (camera về mặc định);
//   • 1 cú chạm chuột trái lên canvas #world (nhấn + nhả tại 1 điểm) — game tự đổi toạ độ màn hình ra sàn
//     rồi chọn con gần nhất (chạm sàn KHÔNG gửi lệnh, trừ khi game đang ở chế độ nhắm trade do tool vừa bật);
//   • bấm đúng nút HTML của game: nút chính ở dock (Bắt / Tiến hóa / Trade) và 1 hàng trong bảng "Chọn tiến hóa".
// Lệnh vẫn do game gửi theo đường của nó, server vẫn tự kiểm tra. Không đụng socket, không đụng code game.
// scripts/build-tool.mjs khoá bằng AST: chỉ file này được tạo PointerEvent, chỉ chuột trái, không phím bổ trợ,
// chỉ phím Esc/Home, chỉ .click() vào `primary`/`row`, chỉ đọc localStorage 'cutd.cameraView'.

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

// 1 cú chạm chuột trái tại (x, y) toạ độ trang. pointerId lấy từ cú bấm thật của người dùng (chuột đang có thật).
export function tap(x, y, pointerId) {
  const canvas = canvasEl();
  if (!canvas || !Number.isFinite(x) || !Number.isFinite(y)) return false;
  const id = Number.isInteger(pointerId) && pointerId >= 0 ? pointerId : 1;
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 1, pointerId: id, pointerType: 'mouse', isPrimary: true }));
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, cancelable: true, composed: true, clientX: x, clientY: y, button: 0, buttons: 0, pointerId: id, pointerType: 'mouse', isPrimary: true }));
  return true;
}

// Góc nhìn camera người chơi đã chọn (nút Camera của game lưu 0/1/2). Chỉ đọc đúng khoá này.
export function cameraView() {
  let v = 0;
  try { v = Number(localStorage.getItem('cutd.cameraView')); } catch { v = 0; }
  return [0, 1, 2].includes(v) ? v : 0;
}

// Bảng hội thoại (tiến hóa / bán / nghiên cứu…) của game đang mở?
export function modalOpen() {
  const shade = [...document.querySelectorAll(NODES)].find(el => el.dataset.node === 'ModalShade');
  return visible(shade);
}

// Tên con đang chọn trên dock của game ('' nếu chưa chọn gì).
export function selectedName() {
  const panel = [...document.querySelectorAll(NODES)].find(el => el.dataset.node === 'MonsterPanel');
  if (!visible(panel)) return '';
  const name = [...panel.querySelectorAll(NODES)].find(el => el.dataset.node === 'Name' && !el.parentElement?.closest('[data-node^="Skill"]'));
  return (name?.textContent ?? '').trim();
}

const findPrimary = () => [...document.querySelectorAll(PRIMARY)].find(b => !b.disabled && visible(b)) ?? null;
export const primaryReady = () => !!findPrimary();

// Bấm nút chính của dock (đang hiện + đang bật). Trả true nếu đã bấm.
export function clickPrimary() {
  const primary = findPrimary();
  if (!primary) return false;
  primary.click();
  return true;
}

// Bấm hàng thứ i trong bảng của game — chỉ khi bảng đang mở, hàng bật, và tiêu đề hàng đúng tên nhánh mong đợi.
export function clickRow(i, expectTitle) {
  if (!modalOpen() || !Number.isInteger(i) || i < 0 || i > 9 || !expectTitle) return false;
  const row = [...document.querySelectorAll(ROWS)].find(b => b.dataset.node === `Row${i}` && b.closest('[data-node="ModalShade"]'));
  if (!row || row.disabled || !visible(row)) return false;
  const titleEl = [...row.querySelectorAll(NODES)].find(el => el.dataset.node === 'Title');
  if ((titleEl?.textContent ?? '').trim() !== expectTitle) return false;
  row.click();
  return true;
}

// Chờ game vẽ xong vài khung hình (camera/giao diện cập nhật theo khung hình).
export const frames = (n = 2) => new Promise(resolve => {
  let left = n;
  const step = () => (--left <= 0 ? resolve() : requestAnimationFrame(step));
  requestAnimationFrame(step);
  setTimeout(resolve, 250 * n); // tab bị ẩn → rAF dừng, vẫn không treo
});
