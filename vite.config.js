import { defineConfig } from 'vite';

// CSP cho bản production: chỉ chạy script/ảnh/CSS của chính site. Lỡ có XSS lọt qua thì trình duyệt
// cũng không chạy script lạ và không cho gửi dữ liệu đi nơi khác. (Dev server cần HMR nên không gắn.)
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data:",
  "connect-src 'self'", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'",
].join('; ');

export default defineConfig(({ command }) => ({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 700 },
  plugins: [{
    name: 'csp',
    transformIndexHtml: html => (command === 'build'
      ? html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  <meta name="referrer" content="no-referrer" />`)
      : html),
  }],
}));
