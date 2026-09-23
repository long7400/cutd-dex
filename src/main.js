import './style.css';
import { html, toString } from './lib/html.js';
import { loadDB } from './db.js';

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
const NAV = [
  ['pets', 'Pets'], ['units', 'Sinh vật'], ['waves', 'Đợt quái'], ['trade', 'Trade'],
  ['pools', 'Wild'], ['strategy', 'Chiến thuật'], ['research', 'Nghiên cứu'], ['rules', 'Luật chơi'], ['tool', 'Công cụ'],
];
const ACTIVE = { pet: 'pets', unit: 'units' };

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

function topbar(active) {
  return html`<header class="topbar">
    <a class="brand" href="#/"><img src="portraits/pet_xiaohuolong.webp" alt="" width="34" height="34"><span>CUTD <em>Wiki</em></span></a>
    <nav>${NAV.map(([k, l]) => html`<a class="navlink ${k === active ? 'on' : ''}" href="#/${k}">${l}</a>`)}</nav>
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
  document.title = title ? `${title} · CUTD Wiki` : 'CUTD Dex — Moonlit Court';
  app.innerHTML = toString(html`${page.chrome === false ? '' : topbar(ACTIVE[route.name] ?? route.name)}${page.render(route)}`);
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
    <button class="chip" data-reload>Tải lại</button></div></main>`);
  app.querySelector('[data-reload]')?.addEventListener('click', () => location.reload());
}
