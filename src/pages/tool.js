import { html } from '../lib/html.js';
import tool from '../data/tool.json';
import { DOWN, COPY } from '../lib/icons.js';
import { pageHead, footer } from '../ui.js';
import { videoMarkup, mountVideo } from './home/video.js';

const SOURCE = 'https://github.com/long7400/cutd-dex/blob/main/tool/overlay.js';
const bookmarklet = () => `javascript:${encodeURIComponent(tool.code)}`;

export default {
  title: () => 'CUTD Helper',
  render() {
    return html`<main class="tool-page">
      ${pageHead(html`CUTD <em>Helper</em>`, { lead: 'Bảng trợ lý nổi ngay trên màn hình game. Không cài extension, không tải file.' })}

      <section class="install">
        <a class="h-btn primary bm" href="${bookmarklet()}" title="Kéo nút này lên thanh bookmark">${DOWN}CUTD Helper</a>
        <ol class="steps">
          <li><b>Kéo</b> nút vàng lên thanh bookmark <span class="mono">Ctrl/⌘ + Shift + B để hiện thanh</span></li>
          <li><b>Vào trận</b> trên m.cutd.site hoặc cutd.site</li>
          <li><b>Bấm</b> bookmark. Bấm lần nữa để ẩn</li>
        </ol>
        <div class="alt">
          <div><b>Điện thoại</b><span>Chép link → tạo bookmark bất kỳ → dán vào ô URL, đặt tên CUTD Helper.</span><button type="button" class="h-btn" data-copy>${COPY}Chép link</button></div>
          <div><b>Dia, Arc…</b><span>Chép code → tab game mở Console (⌘⌥J / Ctrl⇧J) → dán → Enter. Lần đầu gõ <code>allow pasting</code>.</span><button type="button" class="h-btn" data-copy-console>${COPY}Chép code</button></div>
        </div>
        <p class="mono copied" data-copied></p>
      </section>

      <section class="tool-demo" id="helper">
        <h2>Làm được <em>gì</em></h2>
        ${videoMarkup()}
        <p class="more-feat">Thêm: đợt tới khắc đòn gì · phòng đối thủ · phím <b>F</b> bấm nút chính · giữ <b>Option</b> + kéo để xoay camera.</p>
      </section>

      <section class="safe">
        <h2>An <em>toàn</em></h2>
        <ul>
          <li><b>Chỉ làm khi mày bấm.</b> 1 cú bấm = 1 lệnh của chính game (Bắt / Tiến hóa / Trade / Xếp đội). Không tự mua, không đọc cookie hay bộ nhớ trình duyệt.</li>
          <li><b>Code nằm trọn trong bookmark.</b> Không nạp script từ đâu khác; file dữ liệu wiki chỉ được đọc như chữ.</li>
        </ul>
        <p class="mono hash">v${tool.version} · SHA-256 ${tool.sha256} · <a class="rootlink" href="${SOURCE}" target="_blank" rel="noopener noreferrer">mã nguồn</a></p>
      </section>
      ${footer()}
    </main>`;
  },
  mount(root) {
    const cleanups = [];
    this.unmount = () => { cleanups.splice(0).forEach(fn => { try { fn(); } catch { } }); };
    mountVideo(root.querySelector('.tool-demo'), cleanups);
    const say = t => { root.querySelector('[data-copied]').textContent = t; };
    const copy = (text, ok) => navigator.clipboard?.writeText(text).then(() => say(ok), () => say('Trình duyệt chặn chép — kéo nút vàng lên thanh bookmark.'));
    root.addEventListener('click', e => {
      if (e.target.closest('.bm')) { e.preventDefault(); say('Kéo nút này lên thanh bookmark, đừng bấm ở đây.'); }
      if (e.target.closest('[data-copy-console]')) copy(tool.code, 'Đã chép code — dán vào Console của tab game.');
      if (e.target.closest('[data-copy]')) copy(bookmarklet(), 'Đã chép link bookmark.');
    });
  },
};
