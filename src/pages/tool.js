import { html } from '../lib/html.js';
import tool from '../data/tool.json';
import { DOWN, COPY } from '../lib/icons.js';
import { pageHead, footer } from '../ui.js';
import { videoMarkup, mountVideo } from './home/video.js';

const REPO = 'https://github.com/long7400/cutd-dex';
const SOURCE = `${REPO}/tree/main/tool`;
const bookmarklet = () => `javascript:${encodeURIComponent(tool.code)}`;
const MAX_PASTE = 400_000;
const WARN = html`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.3 4.2 2.6 17.6A2 2 0 0 0 4.3 20.6h15.4a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0z"/><path d="M12 9.5v4.6M12 17.2v.1"/></svg>`;
const ONE = html`<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="12" y="5" width="48" height="30" rx="4" fill="currentColor" fill-opacity=".12"/><path d="M28 43h16M36 35v8M28 20l6 6 11-12"/></svg>`;
const TWO = html`<svg viewBox="0 0 72 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="3" width="44" height="28" rx="4" stroke-dasharray="4 4" fill="currentColor" fill-opacity=".06"/><rect x="22" y="14" width="46" height="29" rx="4" fill="currentColor" fill-opacity=".16"/><path d="M38 23l10 10M48 23 38 33"/></svg>`;

export function normalizePasted(text) {
  let s = String(text ?? '').trim();
  if (/^javascript:/i.test(s)) s = s.slice(11);
  return s.replace(/(?:%[0-9a-f]{2})+/gi, run => { try { return decodeURIComponent(run); } catch { return run; } }).trim();
}

export const isOfficial = text => normalizePasted(text) === tool.code;

async function sha(text) {
  try {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
  } catch { return ''; }
}

export default {
  title: () => 'CUTD Helper',
  render() {
    return html`<main class="tool-page">
      ${pageHead(html`CUTD <em>Helper</em>`, { lead: 'Bảng trợ lý nổi ngay trên màn hình game. Không cài extension, không tải file.' })}

      <section class="install">
        <a class="h-btn primary bm" href="${bookmarklet()}" title="Kéo nút này lên thanh bookmark">${DOWN}CUTD Helper</a>
        <ol class="steps">
          <li><b>Kéo</b> nút vàng lên thanh bookmark <span class="mono">Ctrl/⌘ + Shift + B để hiện thanh</span></li>
          <li><b>Ở sảnh, bấm</b> bookmark (m.cutd.site hoặc cutd.site). Bấm lần nữa để ẩn</li>
          <li><b>Vào trận</b> là dùng được ngay</li>
        </ol>
        <div class="alt">
          <div><b>Điện thoại</b><span>Chép link → tạo bookmark bất kỳ → dán vào ô URL, đặt tên CUTD Helper.</span><button type="button" class="h-btn" data-copy>${COPY}Chép link</button></div>
          <div><b>Dia, Arc…</b><span>Chép code → tab game mở Console (⌘⌥J / Ctrl⇧J) → dán → Enter. Lần đầu gõ <code>allow pasting</code>.</span><button type="button" class="h-btn" data-copy-console>${COPY}Chép code</button></div>
        </div>
        <p class="mono copied" data-copied></p>
      </section>

      <section class="lobby" aria-labelledby="lobby-h">
        <div class="lb-head">
          <span class="lb-icon">${WARN}</span>
          <div>
            <p class="mono lb-kick">Quan trọng · m.cutd.site</p>
            <h2 id="lobby-h">Bấm bookmark <em>ở sảnh</em><span>trước khi vào trận</span></h2>
            <p class="lb-lead">Chỉ có <b>một bản game</b> chạy: nhẹ RAM, không giật, mọi nút của tool dùng được ngay khi trận bắt đầu.</p>
          </div>
        </div>
        <div class="lb-cmp">
          <div class="lb-card ok">${ONE}<div><b>Ở sảnh</b><strong>1 bản game</strong><span>Tool móc thẳng vào game. Bắt, Tiến hóa, Trade, Xếp đội dùng được ngay.</span></div></div>
          <div class="lb-card bad">${TWO}<div><b>Giữa trận</b><strong>2 bản game</strong><span>Muốn dùng nút, tool phải mở lại trận trong khung. Bản cũ vẫn nằm phía sau, RAM gần gấp đôi.</span></div></div>
        </div>
        <p class="lb-foot">Lỡ bấm giữa trận: xem số liệu vẫn được. Chỉ bấm <b>Móc</b> khi thật sự cần nút, trận sau nhớ bấm ở sảnh.</p>
      </section>

      <section class="verify">
        <h2>Bookmark <em>có sạch không?</em></h2>
        <p class="lead">Chỉ cài từ nút vàng trên <b>long7400.github.io/cutd-dex</b>. Link hay code tool gửi qua chat, Discord, trang khác: <b>đừng dùng</b>. Nghi ngờ thì dán vào đây, kiểm ngay trên máy mày, không gửi đi đâu.</p>
        <div class="vf-box">
          <textarea class="search vf-in" data-verify-in maxlength="${MAX_PASTE}" rows="3" spellcheck="false" autocomplete="off" placeholder="Dán URL của bookmark (chuột phải bookmark → Sửa → chép ô URL) hoặc đoạn code Console"></textarea>
          <button type="button" class="h-btn primary" data-verify>Kiểm tra</button>
        </div>
        <p class="vf-out" data-verify-out hidden></p>
        <details class="selfbuild"><summary>Chắc nhất: tự build từ mã nguồn</summary>
          <pre><code>git clone ${REPO}.git && cd cutd-dex${tool.commit ? `\ngit checkout ${tool.commit}` : ''}
npm ci --ignore-scripts
node scripts/build-tool.mjs --out</code></pre>
          <p>Lệnh cuối in ra SHA-256, phải trùng mã ở mục An toàn. Mở <code>build/cutd-helper-bookmark.txt</code>, chép hết, dán vào ô URL của bookmark. Đọc code tại <a class="rootlink" href="${SOURCE}" target="_blank" rel="noopener noreferrer">tool/</a>.</p>
        </details>
      </section>

      <section class="tool-demo" id="helper">
        <h2>Làm được <em>gì</em></h2>
        ${videoMarkup()}
        <p class="more-feat">Thêm: đợt tới khắc đòn gì · phòng đối thủ · phím <b>F</b> bấm nút chính · giữ <b>Option</b> + kéo để xoay camera.</p>
      </section>

      <section class="safe">
        <h2>An <em>toàn</em></h2>
        <ul>
          <li><b>Chỉ làm khi mày bấm.</b> 1 cú bấm = 1 lệnh của chính game (Bắt / Tiến hóa / Trade); riêng Xếp đội 1 cú bấm dời tối đa 2 con, và nút ⇑ của pet gắn ★ nâng liền nhiều cấp; mỗi lệnh sau chỉ đi khi game đã xác nhận lệnh trước, cách nhau ≥ 0,8 giây. Không tự bắt, không tự mua, không đọc cookie hay phiên đăng nhập. Bộ nhớ trình duyệt: chỉ đọc 5 cài đặt đồ hoạ của game ở tab ⚙︎ và chỉ ghi khi mày bấm "Bật đồ hoạ nhẹ" / "Khôi phục".</li>
          <li><b>Code nằm trọn trong bookmark.</b> Không nạp script từ đâu khác; file dữ liệu wiki chỉ được đọc như chữ.</li>
        </ul>
        <p class="mono hash">v${tool.version} · SHA-256 <span data-sha>${tool.sha256}</span>${tool.commit ? html` · build từ commit <a class="rootlink" href="${`${REPO}/tree/${tool.commit}/tool`}" target="_blank" rel="noopener noreferrer">${tool.commit.slice(0, 7)}</a>` : html` · <a class="rootlink" href="${SOURCE}" target="_blank" rel="noopener noreferrer">mã nguồn</a>`}</p>
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
      if (e.target.closest('[data-verify]')) verify();
    });
    const out = root.querySelector('[data-verify-out]');
    const verify = async () => {
      const text = root.querySelector('[data-verify-in]').value.slice(0, MAX_PASTE);
      out.hidden = false;
      out.className = 'vf-out';
      if (!text.trim()) { out.textContent = 'Dán URL bookmark hoặc code vào ô trên trước đã.'; return; }
      if (isOfficial(text)) {
        out.classList.add('ok');
        out.textContent = `✓ Đúng bản chính thức v${tool.version}. Dùng được.`;
        return;
      }
      const got = (await sha(normalizePasted(text))).slice(0, 16);
      out.classList.add('bad');
      out.textContent = `✗ KHÁC bản chính thức${got ? ` (SHA-256 ${got}… ≠ ${tool.sha256.slice(0, 16)}…)` : ''}. Xoá bookmark đó, cài lại từ nút vàng. Nếu đã lỡ bấm nó trong game: đăng xuất game rồi đổi mật khẩu.`;
    };
  },
};
