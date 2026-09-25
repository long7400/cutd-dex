import './video.css';
import { html } from '../../lib/html.js';
import { DOWN } from '../../lib/icons.js';

export const videoMarkup = (cta = '') => html`<div class="h-video"><video src="video/cutd-helper.mp4" poster="video/cutd-helper.webp" width="1280" height="720" muted loop playsinline controls preload="none" aria-label="Video giới thiệu CUTD Helper"></video></div>
${cta ? html`<div class="h-caption"><a class="h-btn primary bm" href="${cta}" title="Kéo nút này lên thanh bookmark">${DOWN}Kéo lên thanh bookmark</a></div>` : ''}`;

export function mountVideo(section, cleanups) {
  const video = section?.querySelector('.h-video video');
  if (!video || !('IntersectionObserver' in window) || window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
  const io = new IntersectionObserver(entries => {
    const e = entries[entries.length - 1];
    if (e.isIntersecting && e.intersectionRatio >= 0.5) video.play().catch(() => { });
    else if (!video.paused) video.pause();
  }, { threshold: [0, 0.5] });
  io.observe(video);
  cleanups.push(() => { io.disconnect(); video.pause(); });
}
