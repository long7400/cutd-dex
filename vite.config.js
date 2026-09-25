import { defineConfig } from 'vite';
import { readFileSync } from 'node:fs';

const HOME = process.env.CSP_BASE || JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')).homepage;
if (!/^(https:\/\/[a-z0-9.-]+|http:\/\/localhost:\d+)\/([\w.-]+\/)*$/.test(HOME)) throw new Error(`CSP_BASE / homepage không hợp lệ: ${HOME}`);
const CSP = [
  "default-src 'none'", `script-src ${HOME}assets/`, `style-src ${HOME}assets/ 'unsafe-inline'`, `img-src ${HOME} data: blob:`,
  `connect-src ${HOME} blob:`, `font-src ${HOME}assets/`, "object-src 'none'", "frame-src 'none'", "child-src 'none'", "worker-src 'none'",
  `media-src ${HOME}video/`, "manifest-src 'none'", "base-uri 'none'", "form-action 'none'",
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
