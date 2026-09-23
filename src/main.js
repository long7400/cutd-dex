import '@fontsource/big-shoulders-display/900';
import '@fontsource/barlow/500';
import '@fontsource/barlow/600';
import '@fontsource/barlow/700';
import '@fontsource/barlow/800';
import '@fontsource/jetbrains-mono/700';
import './style.css';
import { html, toString } from './lib/html.js';
import { loadDB } from './db.js';
import { PLAY } from './lib/icons.js';

const ROUTES = {
  home: () => import('./pages/home.js'),
  pets: () => import('./pages/pets.js'),
  pet: () => import('./pages/pet.js'),
  units: () => import('./pages/units.js'),
  unit: () => import('./pages/unit.js'),
  waves: () => import('./pages/waves.js'),
  trade: () => import('./pages/trade.js'),
  pools: () => import('./pages/pools.js'),
  research: () => import('./pages/research.js'),
  rules: () => import('./pages/rules.js'),
  strategy: () => import('./pages/strategy.js'),
  changelog: () => import('./pages/changelog.js'),
  tool: () => import('./pages/tool.js'),
};
const SECTIONS = [
  ['pets', 'Pets', [['pets', 'Pet bắt được'], ['units', 'Toàn bộ sinh vật']]],
  ['strategy', 'Chiến thuật'],
  ['waves', 'Đợt quái'],
  ['pools', 'Bắt & Trade', [['pools', 'Bãi hoang'], ['trade', 'Trade']]],
  ['rules', 'Cơ chế', [['rules', 'Luật chơi'], ['research', 'Nghiên cứu'], ['changelog', 'Lịch sử cập nhật']]],
  ['tool', 'Công cụ'],
];
const OWNER = { pet: 'pets', unit: 'pets', units: 'pets', trade: 'pools', research: 'rules', changelog: 'rules' };

const app = document.getElementById('app');
const scrolls = new Map();
let navByClick = false;
let current = null;

history.scrollRestoration = 'manual';
document.addEventListener('click', e => {
  const head = e.target.closest?.('.skill-head');
  if (head) { head.parentElement.classList.toggle('open'); return; }
  const a = e.target.closest?.('a[href^="#/"]');
  if (a && !e.defaultPrevented) navByClick = true;
});

function parse() {
  const [path, query = ''] = (location.hash.slice(1) || '/home').split('?');
  const [, name = 'home', ...params] = path.split('/');
  if (!name) return { name: 'home', params: [], query: new URLSearchParams(query) };
  return { name: Object.hasOwn(ROUTES, name) ? name : 'pets', params: params.map(p => { try { return decodeURIComponent(p); } catch { return ''; } }), query: new URLSearchParams(query) };
}

function topbar(name) {
  const sec = SECTIONS.find(([k]) => k === (OWNER[name] ?? name));
  const subs = sec?.[2]?.some(([k]) => k === name) ? sec[2] : null;
  return html`<header class="topbar">
    <div class="bar">
      <a class="brand" href="#/">CUTD <b>DEX</b></a>
      <nav class="nav">${SECTIONS.map(([k, l]) => html`<a class="navlink ${k === sec?.[0] ? 'on' : ''}" href="#/${k}">${l}</a>`)}</nav>
      <a class="h-btn primary play" href="https://m.cutd.site/" target="_blank" rel="noopener noreferrer">${PLAY}<span>Mở game</span></a>
    </div>
    ${subs ? html`<nav class="subnav">${subs.map(([k, l]) => html`<a class="sublink ${k === name ? 'on' : ''}" href="#/${k}">${l}</a>`)}</nav>` : ''}
  </header>`;
}

async function render() {
  const route = parse();
  const key = location.hash;
  const fresh = navByClick;
  navByClick = false;

  if (current?.unmount) current.unmount();
  const [mod] = await Promise.all([ROUTES[route.name](), loadDB()]);
  if (key !== location.hash) return;

  const page = mod.default;
  const title = page.title?.(route) ?? '';
  document.title = title ? `${title} · CUTD Dex` : 'CUTD Dex — Moonlit Court';
  app.innerHTML = toString(html`${page.chrome === false ? '' : topbar(route.name)}${page.render(route)}`);
  current = page;
  page.mount?.(app.querySelector('main') ?? app, route);
  app.dataset.route = key;

  const anchor = route.params[1] && document.getElementById(`s-${route.params[1]}`);
  const saved = scrolls.get(key);
  if (anchor && (fresh || saved === undefined)) anchor.scrollIntoView({ block: 'start' });
  else window.scrollTo(0, fresh ? 0 : saved ?? 0);
}

let saveTimer;
window.addEventListener('scroll', () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => scrolls.set(location.hash, window.scrollY), 80);
}, { passive: true });
window.addEventListener('hashchange', e => {
  clearTimeout(saveTimer);
  scrolls.set(new URL(e.oldURL).hash, window.scrollY);
  render().catch(fail);
});
render().catch(fail);

function fail(err) {
  console.error(err);
  app.innerHTML = toString(html`<main><div class="empty">Không tải được dữ liệu<br><small>${err.message}</small><br>
    <button class="h-btn" data-reload>Tải lại</button></div></main>`);
  app.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
}
