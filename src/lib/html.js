const RAW = Symbol('raw');

export const raw = s => ({ [RAW]: String(s ?? '') });

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

const part = v => {
  if (v == null || v === false) return '';
  if (Array.isArray(v)) return v.map(part).join('');
  if (typeof v === 'object' && RAW in v) return v[RAW];
  return esc(v);
};

export function html(strings, ...values) {
  let out = strings[0];
  for (let i = 0; i < values.length; i++) out += part(values[i]) + strings[i + 1];
  return raw(out);
}

export const toString = h => part(h);

const nf = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 });
export const num = n => (Number.isFinite(n) ? nf.format(n) : '—');
export const pct = (n, d = 1) => (Number.isFinite(n) ? `${+(n * 100).toFixed(d)}%` : '—');
export const short = n => (n >= 1e6 ? `${+(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${Math.round(n / 1e3)}k` : n >= 1e3 ? `${+(n / 1e3).toFixed(1)}k` : String(n));

export const norm = s => String(s ?? '').toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/[^a-z0-9]+/g, ' ').trim();

export function debounce(fn, ms = 90) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
