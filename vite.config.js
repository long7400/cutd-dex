import { defineConfig } from 'vite';

const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline'", "img-src 'self' data: blob:",
  "connect-src 'self' blob:", "font-src 'self'", "object-src 'none'", "base-uri 'self'", "form-action 'none'",
].join('; ');

export default defineConfig(({ command }) => ({
  base: './',
  build: { outDir: 'dist', chunkSizeWarningLimit: 700, assetsInlineLimit: file => (/\.(woff2?|ttf|otf)$/.test(file) ? false : undefined) },
  plugins: [{
    name: 'csp',
    transformIndexHtml: html => (command === 'build'
      ? html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n  <meta http-equiv="Content-Security-Policy" content="${CSP}" />\n  <meta name="referrer" content="no-referrer" />`)
      : html),
  }],
}));
