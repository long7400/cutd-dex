// Nút "Cập nhật dữ liệu" — flow chống spam request:
//  1) Stream-fetch catalog từ m.cutd.site, ĐỌC ~1KB đầu rồi ABORT
//     (catalog_hash nằm ở đầu JSON, trước blob 1.7MB) → check chỉ tốn ~1KB
//  2) Hash trùng → dừng ngay, không đụng GitHub API (chống spam)
//  3) Hash khác → dispatch workflow update (cần PAT quyền Actions, chỉ repo này)
//     workflow tự check hash lần nữa → chỉ bóc khi thật sự thay đổi
//  4) Theo dõi run → xong thì poll asset mới trên Pages → tự reload
import { meta } from './ui.js';

const REPO = 'long7400/cutd-dex';
const API = `https://api.github.com/repos/${REPO}`;
const SITE = 'https://long7400.github.io/cutd-dex/';

const $ = sel => document.querySelector(sel);
const state = { open: false, checking: false, remoteHash: null, phase: 'idle' };

// ---- 1) Hash từ xa: stream + early exit ----
async function fetchRemoteHash() {
  const res = await fetch('https://m.cutd.site/catalog', { cache: 'no-store' });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const reader = res.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      // catalog_hash ở ngay đầu — đủ dữ liệu là abort stream
      const m = buf.match(/"catalog_hash":"([0-9a-f]+)"/);
      if (m) return m[1];
      if (buf.length > 65536) throw new Error('Không tìm thấy catalog_hash trong 64KB đầu');
    }
    throw new Error('Stream kết thúc bất thường');
  } finally {
    try { await reader.cancel(); } catch { /* đã abort */ }
  }
}

// ---- GitHub API ----
async function gh(path, opts = {}) {
  const token = localStorage.getItem('cutd_pat');
  const r = await fetch(API + path, {
    ...opts,
    headers: {
      Accept: 'application/vnd.github+json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(opts.headers ?? {}),
    },
  });
  if (!r.ok) {
    const body = await r.json().catch(() => ({}));
    throw new Error(body.message ?? `HTTP ${r.status}`);
  }
  return r.status === 204 ? null : r.json();
}

async function dispatchUpdate() {
  await gh('/actions/workflows/update.yml/dispatches', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ref: 'main' }),
  });
}

async function waitRunDone(sinceMs, onTick) {
  for (let i = 0; i < 110; i++) { // ~5.5 phút
    await new Promise(r => setTimeout(r, 3000));
    const runs = await gh('/actions/workflows/update.yml/runs?per_page=5');
    const run = runs.workflow_runs?.find(r => new Date(r.created_at).getTime() >= sinceMs - 20000);
    onTick?.(run);
    if (run && run.status === 'completed') {
      if (run.conclusion !== 'success') throw new Error(`Run ${run.conclusion} — xem log trên GitHub`);
      return run;
    }
  }
  throw new Error('Timeout chờ workflow');
}

// đợi Pages deploy asset mới (tên file JS đổi theo hash nội dung)
async function waitDeployThenReload() {
  const cur = document.querySelector('script[type=module]')?.getAttribute('src') ?? '';
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 5000));
    try {
      const html = await (await fetch(SITE, { cache: 'no-store' })).text();
      const m = html.match(/src="(\.\/assets\/index-[\w-]+\.js)"/);
      if (m && m[1] !== cur) { location.href = location.pathname + location.hash; return; }
    } catch { /* mạng nhấp nhô — thử lại */ }
  }
  setPhase('done', 'Đã xong nhưng chưa đọc được bản mới — bấm F5.');
}

// ---- UI ----
export function updateButtonHTML() {
  return `
  <button class="upd-btn" id="upd-btn" title="Cập nhật dữ liệu game">
    🔄<span class="vhash">${(meta.catalogHash ?? '').slice(0, 6)}</span>
  </button>`;
}

export function modalHTML() {
  return `
  <div class="upd-overlay" id="upd-overlay" hidden>
    <div class="upd-modal">
      <div class="upd-title">🔄 Cập nhật dữ liệu game</div>
      <div class="upd-body" id="upd-body"></div>
      <div class="upd-foot">
        <input id="upd-pat" type="password" placeholder="GitHub token (Actions RW) — lưu 1 lần thôi"
               value="${localStorage.getItem('cutd_pat') ?? ''}">
        <div class="upd-actions">
          <button class="chip" id="upd-close">Đóng</button>
          <button class="chip on" id="upd-check">Kiểm tra &amp; cập nhật</button>
        </div>
      </div>
      <div class="upd-help">🔍 <b>Check hash không cần token.</b> Có bản mới thì cron tự update trong ~2 tiếng —
        token chỉ dùng khi muốn ép cập nhật NGAY qua nút.
        Token tạo tại <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">github.com → Fine-grained token</a>,
        chọn repo <code>${REPO}</code>, quyền <b>Actions: Read and write</b>, hạn chế hạn mức tùy ý.
        Token chỉ lưu trong máy mày (localStorage) — không gửi đi đâu khác ngoài GitHub API.</div>
    </div>
  </div>`;
}

export function bindUpdateUI() {
  const btn = $('#upd-btn'), overlay = $('#upd-overlay');
  const close = $('#upd-close'), check = $('#upd-check');
  if (!btn) return;
  btn.addEventListener('click', openModal);
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  close.addEventListener('click', closeModal);
  check.addEventListener('click', runFlow);
  $('#upd-pat').addEventListener('change', e => {
    localStorage.setItem('cutd_pat', e.target.value.trim());
  });
}

function openModal() {
  $('#upd-overlay').hidden = false;
  setPhase('idle', `Đang dùng dữ liệu <code>${meta.catalogHash.slice(0, 12)}…</code> (bóc ${new Date(meta.builtAt).toLocaleString('vi-VN')})`);
}

function closeModal() { $('#upd-overlay').hidden = true; }

function setPhase(phase, html) {
  state.phase = phase;
  const b = $('#upd-body');
  if (b) b.innerHTML = `<div class="upd-${phase === 'error' ? 'err' : 'msg'}">${html}</div>`;
}

async function runFlow() {
  if (state.checking) return;
  state.checking = true;
  const checkBtn = $('#upd-check');
  checkBtn.disabled = true;
  try {
    // B1: check hash — abort sớm sau ~1KB
    setPhase('checking', '⏳ Đang so hash với server game… <small>(stream, chỉ đọc ~1KB)</small>');
    const remote = await fetchRemoteHash();
    state.remoteHash = remote;
    if (remote === meta.catalogHash) {
      setPhase('same', `✓ Dữ liệu đã <b>mới nhất</b> — hash trùng <code>${remote.slice(0, 12)}…</code><br>Không gửi bất kỳ request nào lên GitHub.`);
      return;
    }
    setPhase('diff', `⚠ Game có bản mới!<br>cũ <code>${meta.catalogHash.slice(0, 8)}…</code> → mới <code>${remote.slice(0, 8)}…</code><br><br>🕐 <b>Cron sẽ tự update trong tối đa ~2 tiếng</b> (mỗi 2h chạy 1 lần, không cần làm gì).<br>Muốn cập nhật NGAY: dán GitHub token vào ô dưới rồi bấm lại — hoặc chạy <code>npm run update</code> trên máy.`);

    // B2: PAT là TUỲ CHỌN — không có thì để cron lo
    if (!localStorage.getItem('cutd_pat')) {
      setPhase('need-token', `⚠ Game có bản mới (<code>${remote.slice(0, 8)}…</code>).<br><br>🕐 Cron tự update trong ~2 tiếng tới — không cần làm gì cả.<br><br>Muốn cập nhật ngay thì dán GitHub token (Actions RW) vào ô dưới rồi bấm lại.`);
      return;
    }

    // B3: dispatch + theo dõi
    const since = Date.now();
    setPhase('dispatch', '🚀 Đã gửi lệnh update — đợi workflow chạy…');
    await dispatchUpdate();
    await waitRunDone(since, run => {
      if (run) setPhase('running', `⚙ Workflow: <b>${run.status}</b>…`);
    });

    // B4: đợi Pages đổi asset rồi tự reload
    setPhase('deploying', '📦 Workflow xong — đợi Pages deploy bản mới (~40s)… trang sẽ tự tải lại.');
    await waitDeployThenReload();
  } catch (e) {
    setPhase('error', `❌ ${e.message}`);
  } finally {
    state.checking = false;
    checkBtn.disabled = false;
  }
}
