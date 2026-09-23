import { html, num } from '../lib/html.js';
import tool from '../data/tool.json';
import { footer } from '../ui.js';

const SOURCE = 'https://github.com/long7400/cutd-dex/blob/main/tool/overlay.js';

const consoleCode = () => tool.code;
const bookmarklet = () => `javascript:${encodeURIComponent(consoleCode())}`;

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
          <li>Vào phòng game trên <code>cutd.site</code> hoặc <code>m.cutd.site</code> rồi bấm bookmark <b>CUTD Helper</b>. Bấm lần nữa để ẩn/hiện.</li>
          <li><b>Điện thoại:</b> bấm "Chép link", tạo 1 bookmark bất kỳ, sửa URL thành nội dung vừa chép, đặt tên <b>CUTD Helper</b>. Trong game gõ "CUTD Helper" vào thanh địa chỉ rồi chọn bookmark đó.</li>
        </ol>
        <div class="chips">
          <a class="chip on bm" href="${bookmarklet()}" title="Kéo lên thanh bookmark">CUTD Helper</a>
          <button type="button" class="chip" data-copy>Chép link</button>
          <span class="dim small" data-copied></span>
        </div>
      </section>

      <section class="tool-card">
        <h2>Trình duyệt không chạy bookmark (Dia, Arc…)</h2>
        <p class="sub" style="margin:10px 0 6px">Chạy đúng đoạn code đó bằng Console — áp dụng cho mọi trình duyệt nhân Chromium (Dia, Arc, Chrome, Edge, Brave…).</p>
        <ol class="steps">
          <li>Bấm <b>Chép code cho Console</b> bên dưới.</li>
          <li>Mở tab game, bấm <b>Cmd + Option + J</b> (Windows: <b>Ctrl + Shift + J</b>) để mở Console.</li>
          <li>Lần đầu dán, trình duyệt sẽ cảnh báo: gõ <code>allow pasting</code> rồi Enter.</li>
          <li>Dán code (<b>Cmd/Ctrl + V</b>) → Enter. Panel hiện lên; đóng Console đi là chơi bình thường.</li>
        </ol>
        <p class="note small">Cảnh báo "đừng dán code lạ vào Console" là đúng — chỉ dán code chép từ chính trang này, và có thể đối chiếu SHA-256 bên dưới.</p>
        <div class="chips">
          <button type="button" class="chip on" data-copy-console>Chép code cho Console</button>
          <span class="dim small" data-copied-console></span>
        </div>
      </section>

      <section class="tool-card">
        <h2>Có gì</h2>
        <ul class="steps">
          <li><b>Trade:</b> 7 slot đang mở — nhận con gì, cần đưa con gì; có sẵn lính thì có nút <b>Trade</b>, chưa có thì hiện lính nào tiến hóa tới được và tốn bao nhiêu vàng.</li>
          <li><b>Hai bản game — tool tự nhận biết</b> (góc trên panel ghi <i>Cocos</i> hoặc <i>m. · web</i>), không cần đổi site. Mọi tab, nút Bắt / Tiến hóa / Trade và bấm dòng để chọn đều chạy trên cả hai:
            <ul>
              <li><code>cutd.site</code>: gọi thẳng hàm của nút trong game.</li>
              <li><code>m.cutd.site</code>: thao tác như tay — Esc, Home (camera về mặc định), chạm đúng chỗ con đó trên sàn, kiểm tra tên trên bảng thông tin của game rồi mới bấm nút của game. Chạm lệch là dừng, không bấm gì. Tiến hóa: tool bấm đúng hàng nhánh trong bảng "Chọn tiến hóa" (kiểm tra tên nhánh).</li>
            </ul></li>
          <li><b>Phím F (bản web m.cutd.site):</b> bấm con trên sàn rồi nhấn <b>F</b> = bấm nút chính của game ở dock (Bắt / Tiến hóa / Trade) — khỏi rê chuột. Chỉ nhận phím thật, bỏ qua khi đang gõ chat.</li>
          <li><b>Nút thao tác nhanh:</b> <b>Bắt</b> ở tab Wild, <b>↑ tiến hóa</b> (mỗi nhánh 1 nút) ở tab Đội, <b>Trade</b> ở tab Trade/Đội. Bấm vào dòng để chọn con đó trong game.</li>
          <li><b>Wild:</b> toàn bộ sinh vật hoang dã trên bãi — giá bắt (đủ tiền không), tỉ lệ bắt, DPS tối đa cả cây, cây nào đang có trade cần.</li>
          <li><b>Đội hình:</b> lính của mày — máu, giá bán, các nhánh tiến hóa kèm giá, con nào đem trade được ngay.</li>
          <li><b>Đợt tới:</b> quái sắp tới căn cứ — tổng máu, số mạng mất nếu lọt, loại đòn khắc chế giáp của nó.</li>
          <li><b>Phòng:</b> mạng, vàng, tinh thể, số quái của từng nhà.</li>
          <li><b>Đo tải:</b> bấm bookmark ở sảnh rồi mới vào phòng — tool đo vào trận bao lâu mới có pet và chậm ở khâu nào (server, tải file hay máy), có nút chép báo cáo.</li>
          <li><b>Camera bằng chuột:</b> giữ <b>Option (Alt)</b> + bấm-kéo trên sàn (dùng được trên trackpad), hoặc giữ <b>chuột giữa</b> rồi kéo — bản đồ trôi theo tay, dừng tay là dừng. Kéo chuột trái thường vẫn là thao tác của game. Tool chỉ "giữ" phím W/A/S/D thay mày.</li>
          <li>Nút <b>▭ / ▯</b> trên thanh tiêu đề: đổi panel dọc ↔ thanh ngang dưới đáy màn hình. Rê chuột vào dòng để xem chi tiết.</li>
        </ul>
      </section>

      <section class="tool-card">
        <h2>An toàn</h2>
        <ul class="steps">
          <li>Toàn bộ code nằm sẵn trong bookmark (${num(Math.round(tool.bytes / 102.4) / 10)}KB). Không nạp script từ bất kỳ đâu nên không ai tráo được code.</li>
          <li>Chỉ tải 1 file <b>dữ liệu</b> <code>overlay.json</code> từ wiki. File này chỉ được đọc như dữ liệu và hiển thị dạng chữ, không bao giờ bị chạy như code.</li>
          <li><b>Chỉ hành động khi mày bấm:</b> nút Bắt / Tiến hóa / Trade gọi đúng hàm của game (như bấm nút trong game) — 1 cú bấm = 1 lệnh, khoá 0,6s chống bấm đúp, không có vòng lặp hay tự mua. Click do script khác tạo ra bị bỏ qua.</li>
          <li>Bấm vào 1 dòng = chọn con đó trong game (chỉ đổi lựa chọn trên máy, không gửi gì).</li>
          <li>Camera chuột chỉ giả lập đúng 4 phím W/A/S/D, luôn nhả phím khi dừng tay, thả chuột, mất focus hoặc tắt tool. Cú Option+kéo bị chặn trọn vẹn nên game không kẹt trạng thái.</li>
          <li>Tên, giá, nhánh tiến hóa trên nút lấy từ <b>catalog của chính game</b> — file dữ liệu wiki có bị sửa cũng không đổi được nút làm gì. Đang xem nhà người khác thì nút tự khoá.</li>
          <li>Không đọc/ghi cookie hay localStorage.</li>
          <li>Build phân tích cú pháp (AST) và tự fail nếu code có <code>eval</code>, <code>innerHTML</code>, <code>socket.send</code>, <code>sendBeacon</code>, cookie/storage, nạp script ngoài, truy cập ngoặc vuông/gán biến để lách, hoặc gọi hàm game nào khác ngoài 4 hàm trên (bán, thả, di chuyển, chat… đều bị chặn). Mọi lệnh gọi vào game nằm trong 1 file duy nhất <code>tool/game-bridge.js</code>.</li>
          <li>Phiên bản <code>${tool.version}</code> · dữ liệu chỉ lấy từ <code>${tool.dataUrl}</code> (khoá cứng trong code) và <code>/catalog</code> của chính game.</li>
          <li>SHA-256 của đúng đoạn code mày nhận: <code class="hash">${tool.sha256}</code> — đối chiếu với mã băm ghi trong commit trên GitHub.</li>
          <li>Mã nguồn: <a class="rootlink" href="${SOURCE}" target="_blank" rel="noopener noreferrer">tool/overlay.js</a></li>
        </ul>
        <details class="codebox"><summary>Xem toàn bộ code (dán được thẳng vào Console)</summary><pre>${consoleCode()}</pre></details>

      </section>
      ${footer()}
    </main>`;
  },
  mount(root) {
    root.addEventListener('click', e => {
      if (e.target.closest('.bm')) {
        e.preventDefault();
        root.querySelector('[data-copied]').textContent = 'Kéo nút này lên thanh bookmark, đừng bấm ở đây.';
      }
      if (e.target.closest('[data-copy-console]')) {
        const out = root.querySelector('[data-copied-console]');
        navigator.clipboard?.writeText(consoleCode()).then(
          () => { out.textContent = 'Đã chép — dán vào Console của tab game.'; },
          () => { out.textContent = 'Trình duyệt chặn chép — mở "Xem toàn bộ code" bên dưới và chép tay.'; },
        );
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
