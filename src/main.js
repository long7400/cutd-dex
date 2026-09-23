import './style.css';
import { homePage } from './pages/home.js';
import { petPage } from './pages/pet.js';
import { tradePage } from './pages/trade.js';
import { poolsPage } from './pages/pools.js';
import { filters as homeFilters } from './pages/home.js';

const app = document.getElementById('app');

function nav(active) {
  const links = [
    ['#/pets', 'Pets'],
    ['#/trade', 'Trade'],
    ['#/pools', 'Wild Pools'],
  ];
  return `
  <header class="topbar">
    <a class="brand" href="#/pets">
      <img src="./images/pet_xiaohuolong.png" alt="logo">
      <span>CUTD <em>Dex</em></span>
    </a>
    <nav>${links.map(([href, label]) =>
      `<a class="navlink ${active === href.slice(2) ? 'on' : ''}" href="${href}">${label}</a>`
    ).join('')}</nav>
  </header>`;
}

// Gắn lại mọi listener sau mỗi lần vẽ DOM (kể cả re-render cục bộ)
function bindAll() {
  document.querySelectorAll('[data-action]').forEach(el => {
    if (el.__bound) return;
    el.__bound = true;
    const ev = ['click', 'input', 'change'].includes(el.dataset.action) ? el.dataset.action : 'click';
    el.addEventListener(ev, () => window.__actions?.[el.dataset.fn]?.(el));
  });
  document.querySelectorAll('.skill-card > .skill-head').forEach(h => {
    if (h.__bound) return;
    h.__bound = true;
    h.addEventListener('click', () => h.parentElement.classList.toggle('open'));
  });
}
window.__bind = bindAll;

function render() {
  const hash = location.hash || '#/pets';
  window.scrollTo(0, 0);
  const [, page, param] = hash.split('/');

  let html;
  if (page === 'pet') html = nav('pets') + petPage(decodeURIComponent(param));
  else if (page === 'trade') html = nav('trade') + tradePage();
  else if (page === 'pools') html = nav('pools') + poolsPage();
  else html = nav('pets') + homePage();

  app.innerHTML = html;
  bindAll();
  // giữ focus ô search khi đang gõ filter
  const search = document.querySelector('input[type=search]');
  if (search && homeFilters.q) { search.focus(); search.setSelectionRange(9999, 9999); }
}

window.addEventListener('hashchange', render);
render();
