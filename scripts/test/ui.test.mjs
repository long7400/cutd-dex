import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { JSDOM, VirtualConsole } from 'jsdom';
import { createServer } from 'vite';
import { PATHS } from '../build.mjs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..');

let server, dom, $, $$;
const sleep = ms => new Promise(r => setTimeout(r, ms));

async function go(hash) {
  dom.window.location.hash = hash;
  for (let i = 0; i < 400; i++) {
    if (document.getElementById('app').dataset.route === dom.window.location.hash) return;
    await sleep(5);
  }
  throw new Error(`Trang ${hash} không render`);
}

before(async () => {
  if (!existsSync(join(ROOT, 'src/data/tool.json'))) await (await import('../build-tool.mjs')).buildTool();
  if (!existsSync(PATHS.db)) await import('../build.mjs').then(async m => {
    const { readJSON, writeJSON } = await import('../lib/fsx.mjs');
    writeJSON(PATHS.db, m.build({ raw: readJSON(PATHS.catalog), client: readJSON(PATHS.client) }));
  });
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented/.test(e.message)) console.error(e); });
  dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
    url: 'http://localhost/#/pets', pretendToBeVisual: true, virtualConsole: vc,
  });
  const w = dom.window;
  w.Element.prototype.scrollIntoView = () => {};
  w.scrollTo = () => {};
  for (const k of ['window', 'document', 'location', 'history', 'HTMLElement', 'Element', 'Event', 'URLSearchParams']) {
    Object.defineProperty(globalThis, k, { value: k === 'window' ? w : w[k], configurable: true, writable: true });
  }
  $ = s => document.querySelector(s);
  $$ = s => [...document.querySelectorAll(s)];
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'silent', optimizeDeps: { noDiscovery: true } });
  await server.ssrLoadModule('/src/main.js');
  await go('#/pets');
});

after(async () => { await server?.close(); dom?.window.close(); });

const type = async (input, text) => {
  for (const ch of text) {
    input.value += ch;
    input.dispatchEvent(new window.Event('input', { bubbles: true }));
    await sleep(15);
  }
  await sleep(200);
};

test('trang Pets: render đủ card', () => {
  const n = $$('.pet-card').length;
  assert.ok(n >= 50, `chỉ có ${n} card`);
  assert.equal($('#result-count').textContent, String(n));
});

test('search: giữ focus khi gõ, chịu typo, AND nhiều từ', async () => {
  const input = $('input[data-q]');
  input.focus();
  await type(input, 'alonlan');
  assert.equal(document.activeElement, input, 'mất focus ô search');
  assert.ok($$('.pet-card .pname').some(e => e.textContent.includes('Alolan')), 'typo "alonlan" không ra Alolan');

  input.value = '';
  await type(input, 'rayquaza');
  assert.equal($$('.pet-card').length, 1);

  input.value = '';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(200);
  assert.ok($$('.pet-card').length >= 50);
});

test('chip lọc hệ + huyền thoại', async () => {
  $('[data-el="fire"]').click();
  const fire = $$('.pet-card').length;
  assert.ok(fire > 0 && fire < 40);
  $('[data-kind="leg"]').click();
  assert.ok($$('.pet-card').length <= fire);
  assert.ok($$('.pet-card').every(c => c.classList.contains('leg')));
  $('[data-el="all"]').click();
  $('[data-kind="all"]').click();
});

test('trang pet có rẽ nhánh hiển thị đủ nhánh', async () => {
  await go('#/pet/poliwag');
  assert.equal($$('.branch-head').length, 2);
  assert.ok($$('.stage-card').length >= 8);
});

test('trang Sinh vật: tìm theo mã unit', async () => {
  await go('#/units');
  const input = $('input[data-q]');
  await type(input, 'h0gt');
  assert.match($('#u-body').textContent, /Arceus/);
  input.value = '';
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(200);
});

test('crawl mọi link nội bộ: không trang nào vỡ', async () => {
  const seen = new Set();
  const queue = ['#/pets', '#/units', '#/waves', '#/waves/roster', '#/trade', '#/pools', '#/research', '#/rules', '#/changelog', '#/tool'];
  const broken = [];
  while (queue.length) {
    const h = queue.shift();
    if (seen.has(h)) continue;
    seen.add(h);
    await go(h);
    if ($$('main .empty').some(e => /Không tìm thấy|Không tải được/.test(e.textContent))) broken.push(h);
    for (const a of $$('a[href^="#/"]')) {
      const href = a.getAttribute('href');
      if (!seen.has(href)) queue.push(href);
    }
  }
  assert.deepEqual(broken, []);
  assert.ok(seen.size > 500, `chỉ crawl được ${seen.size} trang`);
});
