// Helpers dùng chung
import data from './data.json';

export const pets = data.pets;
export const trade = data.trade;
export const pools = data.pools;
export const elements = data.elements;
export const meta = {
  catalogHash: data.catalogHash ?? '',
  builtAt: data.builtAt ?? '',
  ruleset: data.rulesetVersion ?? '',
};

export const img = file => `images/${file ?? 'icon-list.png'}`;

export function elBadge(el) {
  const c = elements[el] ?? elements.normal;
  return `<span class="badge el" style="background:linear-gradient(135deg,${rgb(c.light)},${rgb(c.mid)});color:${rgb(c.dark)}">${c.vn}</span>`;
}
const rgb = a => `rgb(${a[0]},${a[1]},${a[2]})`;

export function elColor(el, i = 1) {
  const c = elements[el] ?? elements.normal;
  return rgb([c.light, c.mid, c.dark][i]);
}

export function catchBadge(c) {
  return `<span class="badge catch">Catch ${Math.round(c * 100)}%</span>`;
}

export function skillsHTML(skills, open = false) {
  if (!skills?.length) return `<div class="sub" style="margin:0">— Chưa có kỹ năng ở cấp này —</div>`;
  return skills.map(s => `
    <div class="skill-card ${open ? 'open' : ''}">
      <div class="skill-head">
        <span class="sname">⚡ ${esc(s.name)}</span>
        <span class="trig">${s.triggerVn}</span>
        ${s.cooldownTicks ? `<span class="badge">CD ${(s.cooldownTicks / 32).toFixed(1)}s</span>` : ''}
        <span class="caret">▶</span>
      </div>
      <div class="skill-body">
        <ul>
          ${s.effects.map(e => `<li><b>${eKind(e.raw.kind)}</b> — <span class="desc">${esc(e.text)}</span></li>`).join('')}
        </ul>
        <div class="meta">
          Mục tiêu: ${esc(s.targeting || '—')} · Hình thức: ${esc(s.delivery || '—')}
          ${s.status !== 'executable' ? ` · <span style="color:var(--red)">[${s.status}]</span>` : ''}
        </div>
      </div>
    </div>`).join('');
}

const EK = {
  damage: 'Sát thương', heal: 'Hồi máu', apply_modifier: 'Trạng thái',
  summon: 'Triệu hồi', health_loss: 'Mất máu', force_attack_target: 'Taunt',
  destroy: 'Tiêu diệt', displace: 'Đẩy dời', set_health: 'Đặt máu',
};
export const eKind = k => EK[k] ?? k;

export const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
