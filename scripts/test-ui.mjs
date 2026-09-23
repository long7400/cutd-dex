// Test UI thật bằng jsdom — mô phỏng gõ search, debounce, re-render.
// Chạy:  npm i --no-save jsdom && node scripts/test-ui.mjs
import { readFileSync, writeFileSync, mkdtempSync, cpSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const tmp = mkdtempSync(join(tmpdir(), 'cutd-test-'));
cpSync(new URL('../src', import.meta.url), join(tmp, 'src'), { recursive: true });

let ui = readFileSync(join(tmp, 'src/ui.js'), 'utf8');
ui = ui.replace("import data from './data.json';", "import data from './data.json' with { type: 'json' };");
writeFileSync(join(tmp, 'src/ui.js'), ui);

let main = readFileSync(join(tmp, 'src/main.js'), 'utf8');
main = main.replace("import './style.css';", '');
writeFileSync(join(tmp, 'src/main.js'), main);

const { JSDOM } = await import('jsdom').catch(() => {
  console.error('Thiếu jsdom → chạy:  npm i --no-save jsdom');
  process.exit(2);
});
const dom = new JSDOM('<!doctype html><html><body><div id="app"></div></body></html>', {
  url: 'https://long7400.github.io/cutd-dex/',
  pretendToBeVisual: true,
});
globalThis.window = dom.window;
globalThis.document = dom.window.document;
globalThis.location = dom.window.location;

await import(join(tmp, 'src/main.js'));
const { filters } = await import(join(tmp, 'src/pages/home.js'));

const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = s => document.querySelector(s);
let pass = 0, fail = 0;
const t = (name, cond) => cond ? (pass++, console.log('  ✓', name)) : (fail++, console.log('  ✗', name));

const input = $('input[type=search]');
t('trang pets render + có ô search', !!input);
t('grid có 83 card ban đầu', document.querySelectorAll('.pet-card').length === 83);

// ---- SCENARIO 1: gõ 1 chữ, ĐỢI DEBOUNCE XONG (grid re-render), rồi gõ tiếp ----
console.log('\n· gõ "a" → đợi 250ms (debounce đã re-render grid) → gõ tiếp "lonlan":');
input.focus();
t('focus trước khi gõ', document.activeElement === input);

const type = async ch => {
  input.value += ch;
  input.dispatchEvent(new window.Event('input', { bubbles: true }));
  await sleep(40);
};

await type('a');
await sleep(250); // debounce 90ms đã fire → grid re-render xong
t('sau re-render: grid có kết quả cho chữ "a"', document.querySelectorAll('.pet-card').length > 0);
t('★ FOCUS VẪN Ở Ô SEARCH (không phải click lại)', document.activeElement === input);

for (const ch of 'lonlan') await type(ch);
await sleep(250);
t('filters.q === "alonlan"', filters.q === 'alonlan');
t('grid có Alolan (fuzzy typo)', document.querySelectorAll('.pet-card').length > 0
  && document.body.textContent.includes('Alolan'));
t('★ FOCUS VẪN Ở Ô SEARCH sau toàn bộ lượt gõ', document.activeElement === input);

// ---- SCENARIO 2: gõ liên tục không nghỉ (debounce chỉ fire 1 lần cuối) ----
console.log('\n· gõ liên tục "rayquaza" không nghỉ:');
input.value = '';
input.focus();
for (const ch of 'rayquaza') await type(ch);
await sleep(250);
t('kết quả có Rayquaza', document.body.textContent.includes('Rayquaza'));
t('focus vẫn giữ', document.activeElement === input);
t('đếm kết quả = 1', document.querySelectorAll('.pet-card').length === 1);

// ---- SCENARIO 3: xoá hết chữ ( ô clear ) ----
input.value = '';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(250);
t('xoá search → 83 card trở lại', document.querySelectorAll('.pet-card').length === 83);
t('focus vẫn giữ', document.activeElement === input);

// ---- SCENARIO 4: chip lọc không giết search ----
console.log('\n· bấm chip hệ + gõ search cùng lúc:');
input.value = 'alolan';
input.dispatchEvent(new window.Event('input', { bubbles: true }));
await sleep(250);
const chip = document.querySelector('[data-el="normal"]');
chip.dispatchEvent(new window.Event('click', { bubbles: true }));
await sleep(50);
t('chip vẫn toggle được', chip.classList.contains('on'));
t('focus không bị chip đánh mất', document.activeElement === input);

console.log(`\n${fail ? '❌' : '✅'} PASS ${pass} / ${pass + fail}`);
rmSync(tmp, { recursive: true, force: true });
process.exit(fail ? 1 : 0);
