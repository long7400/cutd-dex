import { html, num, short } from '../lib/html.js';
import { db, label } from '../db.js';
import { img, elBadge, tierChip, pageHead, footer } from '../ui.js';

const TIERS = ['S+', 'S', 'A', 'B', 'C'];
const TIER_CLASS = { 'S+': 't-sp', S: 't-s', A: 't-a', B: 't-b', C: 't-c' };
const TIER_NOTE = {
  'S+': 'Ưu tiên bắt / nâng ngay', S: 'Rất mạnh, nên có trong đội', A: 'Tốt, dùng khi hợp đội hình', B: 'Tạm được / cần điều kiện', C: 'Bỏ qua trừ khi cần vai trò riêng',
};
const MODES = {
  solo: { key: 'solo', name: 'Sức mạnh', note: 'Sức mạnh cá nhân của cả dòng: DPS thật (đã cộng kỹ năng) ở dạng mạnh nhất có thể lên — không tính quái hay đồng đội. Cùng thang với huy hiệu trong CUTD Helper.' },
  pve: { key: 'pve', name: 'PvE · Sinh tồn', note: 'Mốc giữa trận (≤1.500 vàng tiến hóa) × khắc chế của chế độ Sinh tồn + vai trò trong đội.' },
  pvp: { key: 'pvp', name: 'PvP · Đối kháng', note: 'Mốc giữa trận: 70% sức thủ + 30% độ trâu khi bị gửi sang nhà đối thủ + vai trò trong đội.' },
};
const KEY_ROLES = ['aura', 'cc', 'sustain', 'taunt', 'boss', 'evade', 'aoe', 'execute'];

const unit = id => db.units[id];
const lvl = id => (unit(id)?.level ? `Lv${unit(id).level}` : '');
const stageName = id => `${unit(id)?.name ?? id}${unit(id)?.level ? ` Lv${unit(id).level}` : ''}`;
const roleName = r => db.roleNames?.[r] ?? r;
const lineRoles = l => l.roles.filter(([r]) => KEY_ROLES.includes(r));
const hardTrap = l => l.traps.find(([, , k]) => k === 'trap');

function step(id, eff, cost, tag) {
  return html`<span class="step" title="${stageName(id)}${cost ? ` · ${num(cost)} vàng tiến hóa` : ''}">
    ${img(unit(id)?.model, '', '', 38)}<b>${short(Math.round(eff))}${tierChip(unit(id)?.stageTier, 'Hạng so với các con cùng tầm cấp', 'sm')}</b><small>${tag || lvl(id)}</small></span>`;
}

function card(l, mode) {
  const root = unit(l.id);
  const stops = [[l.id, root.eff, 0, 'Lv1'], [l.e1500.id, l.e1500.eff, l.e1500.cost, ''], [l.emax.id, l.emax.eff, l.emax.cost, 'đỉnh']]
    .filter(([id], i, all) => all.findIndex(([x]) => x === id) === i);
  const trap = hardTrap(l);
  return html`<a class="scard ${l.legendary ? 'leg' : ''}" href="#/pet/${l.slug}">
    <div class="shead">
      ${img(root.model, l.name, 'portrait', 60)}
      <div class="sinfo">
        <div class="sname">${l.name}${l.legendary ? html` <span class="star">★</span>` : ''}</div>
        <div class="smeta">${elBadge(l.el)}<span class="atk">${label(l.atk)}</span>${l.catch < 0.5 ? html`<span class="rare">bắt ${Math.round(l.catch * 100)}%</span>` : ''}</div>
      </div>
      <span class="sscore mono" title="Điểm ${mode.name}">${Math.round(l[mode.key].score * 100)}</span>
    </div>
    <div class="chain" title="DPS thật (đã cộng kỹ năng) ở Lv1 → mốc 1.500 vàng → đỉnh; chữ nhỏ = hạng của dạng đó so với các con cùng tầm cấp">
      ${stops.map(([id, eff, cost, tag], i) => html`${i ? html`<span class="arr">›</span>` : ''}${step(id, eff, cost, tag)}`)}
    </div>
    ${lineRoles(l).length || trap ? html`<div class="sroles">
      ${lineRoles(l).map(([r, id, c]) => html`<span class="rchip r-${r}" title="${c ? `Mở ở ${stageName(id)} (${num(c)} vàng)` : 'Có sẵn từ đầu'}">${roleName(r)}${c ? html` <small>${lvl(id)}</small>` : ''}</span>`)}
      ${trap ? html`<span class="rchip trap" title="Lên ${stageName(trap[1])} DPS tụt và không hồi lại">⚠ Dừng ở ${stageName(trap[0])}</span>` : ''}
    </div>` : ''}
  </a>`;
}

const mini = (l, note = '') => html`<a class="mchip" href="#/pet/${l.slug}" title="${l.name}${note ? ` — ${note}` : ''}">${img(unit(l.id).model, l.name, '', 40)}<span>${l.name}</span>${note ? html`<small>${note}</small>` : ''}</a>`;

function comps(lines, modes) {
  const top = (list, n, key = 'pve') => [...list].sort((a, b) => b[key].score - a[key].score).slice(0, n);
  const common = lines.filter(l => !l.legendary);
  const survival = modes.find(m => m.id === 'mode_survival');
  const atkRank = Object.entries(survival?.atk ?? {}).sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const aura = top(common.filter(l => l.roles.some(([r]) => r === 'aura')), 1);
  const core = top(common.filter(l => l.atk === atkRank[0]), 3);
  const second = top(common.filter(l => l.atk === atkRank[1]), 1);
  const cc = top(common.filter(l => l.roles.some(([r]) => r === 'cc')), 1);
  const byEl = Object.create(null);
  for (const l of common) (byEl[l.el] ??= []).push(l);
  const [monoEl, monoLines] = Object.entries(byEl).map(([el, list]) => [el, top(list, 4)])
    .sort((a, b) => b[1].reduce((s, l) => s + l.pve.score, 0) - a[1].reduce((s, l) => s + l.pve.score, 0))[0] ?? [];
  const tanks = top(common.filter(l => l.roles.some(([r]) => ['sustain', 'evade', 'tank'].includes(r))), 2, 'pvp');
  const pvpDps = top(common.filter(l => !tanks.includes(l)), 3, 'pvp');
  const roleNote = (l, r) => { const x = l.roles.find(([k]) => k === r); return x ? `${roleName(r)} từ ${lvl(x[1]) || 'Lv1'}` : roleName(r); };
  const el = e => db.elements[e]?.name ?? e;
  return [
    { title: 'PvE Sinh tồn — theo khắc chế', desc: `Đòn ${label(atkRank[0])} khắc tốt nhất Sinh tồn (×${survival?.atk[atkRank[0]]}) → 3 chủ lực + 1 dòng ${label(atkRank[1])} phủ giáp còn lại + hào quang${cc.length ? ' + khống chế nếu hay bị lọt' : ''}.`,
      picks: [...core.map(l => [l, 'chủ lực']), ...second.map(l => [l, `phụ · ${label(l.atk)}`]), ...aura.map(l => [l, roleNote(l, 'aura')]), ...cc.map(l => [l, roleNote(l, 'cc')])] },
    monoEl && { title: `Đội cùng hệ ${el(monoEl)}`, desc: `4 dòng mạnh nhất cùng hệ ${el(monoEl)} → 1 nhánh nghiên cứu tốc đánh buff cả đội${aura.length && aura[0].el !== monoEl ? `, thêm ${aura[0].name} cho hào quang` : ''}.`,
      picks: [...monoLines.map(l => [l, `hệ ${el(monoEl)}`]), ...(aura.length && aura[0].el !== monoEl ? aura.map(l => [l, roleNote(l, 'aura')]) : [])] },
    { title: 'PvP Đối kháng', desc: 'Đội mày bị gửi sang đánh đối thủ → 3 dòng sát thương + hào quang + 2 con trâu (hồi máu / né / chống chịu) khó giết khi sang nhà đối thủ.',
      picks: [...pvpDps.map(l => [l, 'sát thương']), ...aura.map(l => [l, roleNote(l, 'aura')]), ...tanks.map(l => [l, lineRoles(l).map(([r]) => roleName(r)).slice(0, 1)[0] ?? 'trâu'])] },
  ].filter(Boolean);
}

export default {
  title: () => 'Chiến thuật',
  render({ params }) {
    const S = db.strategy;
    const mode = (Object.hasOwn(MODES, params[0] ?? '') ? MODES[params[0]] : null) ?? MODES.solo;
    const lines = S.lines;
    const atkEl = Object.create(null);
    for (const l of lines) (atkEl[l.atk] ??= Object.create(null))[l.el] = (atkEl[l.atk][l.el] ?? 0) + 1;
    const elOfAtk = a => Object.entries(atkEl[a] ?? {}).sort((x, y) => y[1] - x[1])[0]?.[0];
    const atkTypes = Object.keys(S.modes[0]?.atk ?? {}).sort((a, b) => (S.modes[0].atk[b] ?? 0) - (S.modes[0].atk[a] ?? 0));
    const traps = lines.flatMap(l => l.traps.map(([from, to, kind]) => ({ l, from, to, kind }))).sort((a, b) => (a.kind === 'trap' ? 0 : 1) - (b.kind === 'trap' ? 0 : 1));
    const byRole = Object.create(null);
    for (const l of lines) for (const [r, id, c] of l.roles) if (KEY_ROLES.includes(r)) (byRole[r] ??= []).push({ l, id, c });
    const unsure = lines.filter(l => l.unsure.length);
    const cell = v => html`<td class="n ${v >= 1.15 ? 'up' : v <= 0.95 ? 'down' : ''}">×${v.toFixed(2)}</td>`;

    return html`<main class="strategy">
      ${pageHead(html`Chiến <em>thuật</em>`, {
        lead: html`Hạng mỗi dòng pet theo <b>DPS thật</b> (chỉ số + kỹ năng + kỹ năng mở khi tiến hóa), vai trò và khắc chế theo chế độ. Huy hiệu hạng trong <a class="rootlink" href="#/tool">CUTD Helper</a> dùng đúng bảng <b>Sức mạnh</b>.`,
        aside: html`<div class="chips">${Object.values(MODES).map(m => html`<a class="chip ${m.key === mode.key ? 'on' : ''}" href="#/strategy/${m.key}">${m.name}</a>`)}</div>`,
      })}
      <p class="note">${mode.note}</p>

      <section class="tierlist">
        ${TIERS.map(t => {
          const list = lines.filter(l => l[mode.key].tier === t).sort((a, b) => b[mode.key].score - a[mode.key].score);
          return list.length ? html`<div class="tier-row">
            <div class="tier-label ${TIER_CLASS[t]}"><b>${t}</b><small>${TIER_NOTE[t]}</small><span class="mono">${list.length} dòng</span></div>
            <div class="tier-cards">${list.map(l => card(l, mode))}</div>
          </div>` : '';
        })}
      </section>

      <h2>Đội hình gợi ý</h2>
      <p class="sub">Chọn tự động từ bảng hạng hiện tại — game cân bằng lại thì gợi ý tự đổi theo.</p>
      <div class="comps">${comps(lines, S.modes).map(c => html`<div class="comp">
        <h3>${c.title}</h3><p class="small">${c.desc}</p>
        <div class="mchips">${c.picks.map(([l, note]) => mini(l, note))}</div>
      </div>`)}</div>

      <h2>Khắc chế theo chế độ</h2>
      <p class="sub">Hệ số trung bình của mỗi loại đòn lên toàn bộ máu quái trong kịch bản đợt. Xanh = lợi, đỏ = thiệt.</p>
      <div class="table-wrap"><table class="dmg">
        <thead><tr><th>Đòn (hệ thường gặp)</th>${S.modes.map(m => html`<th class="n">${m.name}</th>`)}</tr></thead>
        <tbody>${atkTypes.map(a => html`<tr><td><b>${label(a)}</b> ${elOfAtk(a) ? elBadge(elOfAtk(a)) : ''}</td>${S.modes.map(m => cell(m.atk[a] ?? 1))}</tr>`)}</tbody>
      </table></div>
      <p class="small">Giáp chiếm nhiều máu nhất — ${S.modes.map(m => `${m.name}: ${Object.entries(m.mix).slice(0, 2).map(([k, v]) => `${label(k)} ${Math.round(v * 100)}%`).join(', ')}`).join(' · ')}.</p>

      <h2>Bẫy tiến hóa</h2>
      <p class="sub"><b>Bẫy</b>: lên cấp làm DPS thật tụt và các cấp sau không gỡ lại → dừng ở cấp trước. <b>Tụt tạm</b>: tụt một bước rồi các cấp sau mạnh hơn.</p>
      <div class="traps">${traps.map(t => html`<a class="trap-card ${t.kind}" href="#/pet/${t.l.slug}">
        ${img(unit(t.from)?.model, '', '', 44)}<span class="arr">→</span>${img(unit(t.to)?.model, '', '', 44)}
        <div><b>${stageName(t.from)} → ${lvl(t.to) || stageName(t.to)}</b>
          <span class="small">DPS thật ${num(Math.round(unit(t.from).eff))} → <span class="down">${num(Math.round(unit(t.to).eff))}</span></span>
          <span class="badge ${t.kind === 'trap' ? 'warn' : ''}">${t.kind === 'trap' ? 'Bẫy — dừng lại' : 'Tụt tạm'}</span></div>
      </a>`)}</div>

      <h2>Vai trò</h2>
      <div class="roles-grid">${KEY_ROLES.filter(r => byRole[r]).map(r => html`<div class="role-box">
        <h3><span class="rchip r-${r}">${roleName(r)}</span> <small class="mono">${byRole[r].length} dòng</small></h3>
        <div class="mchips">${byRole[r].map(({ l, id, c }) => mini(l, c ? `từ ${lvl(id)}` : ''))}</div>
      </div>`)}</div>

      ${unsure.length ? html`<h2>Cần thử trong trận</h2>
        <p class="sub">Kỹ năng có điều kiện chưa rõ nguồn hoặc xoá sổ quái — chưa cộng vào điểm tới khi kiểm chứng.</p>
        <div class="mchips">${unsure.map(l => mini(l))}</div>` : ''}

      <details class="howto"><summary>Cách tính điểm</summary><ul class="notes">
        <li><b>DPS thật</b> = sát thương thường × (1 + chí mạng / đòn phụ theo xác suất) × buff tốc đánh (theo thời gian hiệu lực) + sát thương cố định / theo % máu mỗi đòn. Kỹ năng bị khoá, vô tác dụng hoặc điều kiện chưa rõ thì không cộng.</li>
        <li>Chuỗi ảnh trên mỗi thẻ: Lv1 → dạng mạnh nhất với ≤1.500 vàng tiến hóa (dòng khó bắt đã trừ tiền bắt kỳ vọng) → đỉnh. Hạng dựa trên mốc 1.500 vàng.</li>
        <li><b>PvE</b> nhân khắc chế của Sinh tồn. <b>PvP</b> 70% sức thủ + 30% độ trâu khi làm quái sang nhà đối thủ. Vai trò (nhất là hào quang) cộng điểm.</li>
      </ul></details>
    </main>${footer()}`;
  },
};
