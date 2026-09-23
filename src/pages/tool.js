import { html, num } from '../lib/html.js';
import tool from '../data/tool.json';
import { footer } from '../ui.js';

const SOURCE = 'https://github.com/long7400/cutd-dex/blob/main/tool/overlay.js';

// Bookmarklet trỏ dữ liệu về đúng site đang mở trang này (GitHub Pages hoặc localhost khi dev).
function bookmarklet() {
  const dataUrl = new URL('.', location.href).href;
  return `javascript:${encodeURIComponent(tool.code.replace('"__CUTD_DATA_URL__"', JSON.stringify(dataUrl)))}`;
}

export default {
  title: () => 'CUTD Helper',
  render() {
    return html`<main>
      <h1>CUTD Helper</h1>
      <p class="sub">Bảng hỗ trợ nổi ngay trên màn hình game: xem trade, wild, đội hình, đợt tới — tra luôn dữ liệu wiki. Không cài extension, không tải file.</p>

      <section class="tool-card">
        <h2>Cài đặt</h2>
        <ol class="steps">
          <li><b>Máy tính:</b> kéo nút dưới đây thả lên thanh bookmark (Ctrl/Cmd + Shift + B để hiện thanh bookmark).</li>
          <li>Vào phòng game trên <code>cutd.site</code> rồi bấm bookmark <b>CUTD Helper</b>. Bấm lần nữa để ẩn/hiện.</li>
          <li><b>Điện thoại:</b> bấm "Chép link", tạo 1 bookmark bất kỳ, sửa URL thành nội dung vừa chép, đặt tên <b>CUTD Helper</b>. Trong game gõ "CUTD Helper" vào thanh địa chỉ rồi chọn bookmark đó.</li>
        </ol>
        <div class="chips">
          <a class="chip on bm" href="${bookmarklet()}" title="Kéo lên thanh bookmark">CUTD Helper</a>
          <button type="button" class="chip" data-copy>Chép link</button>
          <span class="dim small" data-copied></span>
        </div>
      </section>

      <section class="tool-card">
        <h2>Có gì</h2>
        <ul class="steps">
          <li><b>Trade:</b> 7 slot đang mở — nhận con gì, cần đưa con gì, mày có sẵn chưa; chưa có thì lính nào tiến hóa tới được và tốn bao nhiêu vàng.</li>
          <li><b>Wild:</b> toàn bộ sinh vật hoang dã trên bãi — giá bắt (đủ tiền không), tỉ lệ bắt, DPS tối đa cả cây, cây nào đang có trade cần.</li>
          <li><b>Đội hình:</b> lính của mày — máu, giá bán, các nhánh tiến hóa kèm giá, con nào đem trade được ngay.</li>
          <li><b>Đợt tới:</b> quái sắp tới căn cứ — tổng máu, số mạng mất nếu lọt, loại đòn khắc chế giáp của nó.</li>
          <li><b>Người chơi:</b> mạng, vàng, tinh thể, số quái/wild của từng nhà.</li>
        </ul>
      </section>

      <section class="tool-card">
        <h2>An toàn</h2>
        <ul class="steps">
          <li>Toàn bộ code nằm sẵn trong bookmark (${num(Math.round(tool.bytes / 102.4) / 10)}KB). Không nạp script từ bất kỳ đâu nên không ai tráo được code.</li>
          <li>Chỉ tải 1 file <b>dữ liệu</b> <code>overlay.json</code> từ wiki. File này chỉ được đọc như dữ liệu và hiển thị dạng chữ, không bao giờ bị chạy như code.</li>
          <li><b>Chỉ đọc:</b> không gửi bất cứ gì lên server game, không tự thao tác, không đọc/ghi cookie hay localStorage.</li>
          <li>Build tự fail nếu code có <code>eval</code>, <code>innerHTML</code>, <code>socket.send</code>, nạp script ngoài…</li>
          <li>Phiên bản <code>${tool.version}</code> · SHA-256 <code class="hash">${tool.sha256}</code></li>
          <li>Mã nguồn: <a class="rootlink" href="${SOURCE}" target="_blank" rel="noopener noreferrer">tool/overlay.js</a></li>
        </ul>
        <details class="codebox"><summary>Xem toàn bộ code bookmarklet</summary><pre>${tool.code}</pre></details>
      </section>
      ${footer()}
    </main>`;
  },
  mount(root) {
    root.addEventListener('click', e => {
      if (e.target.closest('.bm')) {
        e.preventDefault(); // bấm trên wiki không chạy — phải kéo lên thanh bookmark
        root.querySelector('[data-copied]').textContent = 'Kéo nút này lên thanh bookmark, đừng bấm ở đây.';
      }
      if (e.target.closest('[data-copy]')) {
        navigator.clipboard?.writeText(bookmarklet()).then(
          () => { root.querySelector('[data-copied]').textContent = 'Đã chép link bookmark.'; },
          () => { root.querySelector('[data-copied]').textContent = 'Trình duyệt chặn chép — hãy kéo nút lên thanh bookmark.'; },
        );
      }
    });
  },
};
