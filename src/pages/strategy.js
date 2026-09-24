import { html, num, short } from '../lib/html.js';
import { db, label } from '../db.js';
import { img, elBadge, tierChip, pageHead, footer } from '../ui.js';

const TIERS = ['S+', 'S', 'A', 'B', 'C'];
const TIER_CLASS = { 'S+': 't-sp', S: 't-s', A: 't-a', B: 't-b', C: 't-c' };
const TIER_NOTE = {
  'S+': 'Ưu tiên bắt / nâng ngay', S: 'Rất mạnh, nên có trong đội', A: 'Tốt, dùng khi hợp đội hình', B: 'Tạm được / cần điều kiện', C: 'Bỏ qua trừ khi cần vai trò riêng',
};
export const ROLE_TABS = {
  atk: { key: 'atk', name: 'ATK', unit: 'DPS thật', fmt: v => short(Math.round(v)), note: 'Gây sát thương. Xếp theo DPS thật (chỉ số + kỹ năng bắn ra quái) ở dạng mạnh nhất. Chí mạng / choáng dạng "self" dội vào chính con pet (issue #1) nên không cộng, còn bị trừ nếu tự làm con pet chết sớm.' },
  tank: { key: 'tank', name: 'TANK', unit: 'máu hiệu dụng', fmt: v => short(Math.round(v)), note: 'Chặn đầu. Xếp theo máu hiệu dụng: máu × giáp × né × giảm sát thương, cộng hồi máu / khiêu khích.' },
  buff: { key: 'buff', name: 'BUFF', unit: 'buff cả đội', fmt: v => `+${Math.round(v * 100)}%`, note: 'Làm cả đội mạnh hơn. Xếp theo độ lớn hào quang toàn căn cứ (sát thương, tốc đánh, giáp) và hồi máu cho đồng đội — không tính DPS của chính nó.' },
  debuff: { key: 'debuff', name: 'DEBUFF', unit: 'điểm debuff', fmt: v => (Math.round(v * 100) / 100).toString(), note: 'Làm quái yếu đi: làm chậm, giảm tốc đánh, phá giáp, trượt đòn — độ mạnh × thời gian hiệu lực. Chỉ tính hiệu ứng thật sự rơi vào quái.' },
};
const KEY_ROLES = ['aura', 'cc', 'shred', 'sustain', 'taunt', 'boss', 'evade', 'aoe', 'execute', 'selfharm'];

const unit = id => db.units[id];
const lvl = id => (unit(id)?.level ? `Lv${unit(id).level}` : '');
const stageName = id => `${unit(id)?.name ?? id}${unit(id)?.level ? ` Lv${unit(id).level}` : ''}`;
const roleName = r => db.roleNames?.[r] ?? r;
const lineRoles = l => l.roles.filter(([r]) => KEY_ROLES.includes(r));
const hardTrap = l => l.traps.find(([, , k]) => k === 'trap');

function step(id, v, cost, tag, tab) {
  return html`<span class="step" title="${stageName(id)} · ${tab.unit} ${tab.fmt(v)}${cost ? ` · ${num(cost)} vàng tiến hóa` : ''}">
    ${img(unit(id)?.model, '', '', 38)}<b>${tab.fmt(v)}${tierChip(unit(id)?.stageTier, 'Hạng so với các con cùng vai trò, cùng tầm cấp', 'sm')}</b><small>${tag || lvl(id)}</small></span>`;
}

function card(l, tab) {
  const root = unit(l.id);
  const stops = [[l.id, l.v1, 0, 'Lv1'], [l.e1500.id, l.e1500.eff, l.e1500.cost, ''], [l.emax.id, l.emax.eff, l.emax.cost, 'đỉnh']]
    .filter(([id], i, all) => all.findIndex(([x]) => x === id) === i);
  const trap = hardTrap(l);
  const roles = lineRoles(l).filter(([r]) => r !== 'selfharm');
  return html`<a class="scard ${l.legendary ? 'leg' : ''}" href="#/pet/${l.slug}">
    <div class="shead">
      ${img(root.model, l.name, 'portrait', 60)}
      <div class="sinfo">
        <div class="sname">${l.name}${l.legendary ? html` <span class="star">★</span>` : ''}</div>
        <div class="smeta">${elBadge(l.el)}<span class="atk">${label(l.atk)}</span>${l.catch < 0.5 ? html`<span class="rare">bắt ${Math.round(l.catch * 100)}%</span>` : ''}</div>
      </div>
      <span class="sscore mono" title="Điểm ${tab.name} (100 = nhóm đầu vai trò)">${Math.round(l.rank.score * 100)}</span>
    </div>
    <div class="chain" title="${tab.unit} ở Lv1 → mốc 1.500 vàng → đỉnh; chữ nhỏ = hạng của dạng đó so với các con cùng vai trò, cùng tầm cấp">
      ${stops.map(([id, v, cost, tag], i) => html`${i ? html`<span class="arr">›</span>` : ''}${step(id, v, cost, tag, tab)}`)}
    </div>
    ${roles.length || trap || l.harm ? html`<div class="sroles">
      ${l.harm ? html`<span class="rchip trap" title="Chí mạng / choáng dạng self dội vào chính nó (issue #1): ${stageName(l.harm[0])} tự mất máu, chết sau ~${l.harm[1]} giây nếu không được hồi">⚠ Tự hại ~${l.harm[1]}s</span>` : ''}
      ${roles.map(([r, id, c]) => html`<span class="rchip r-${r}" title="${c ? `Mở ở ${stageName(id)} (${num(c)} vàng)` : 'Có sẵn từ đầu'}">${roleName(r)}${c ? html` <small>${lvl(id)}</small>` : ''}</span>`)}
      ${trap ? html`<span class="rchip trap" title="Lên ${stageName(trap[1])} bị tụt và không hồi lại">⚠ Dừng ở ${stageName(trap[0])}</span>` : ''}
    </div>` : ''}
  </a>`;
}

const mini = (l, note = '') => html`<a class="mchip" href="#/pet/${l.slug}" title="${l.name}${note ? ` — ${note}` : ''}">${img(unit(l.id).model, l.name, '', 40)}<span>${l.name}</span>${note ? html`<small>${note}</small>` : ''}</a>`;

function comps(lines, modes) {
  const common = lines.filter(l => !l.legendary && !(l.harm && l.harm[1] < 20));
  const top = (role, n, list = common) => list.filter(l => l.role === role).sort((a, b) => b.rank.score - a.rank.score).slice(0, n);
  const survival = modes.find(m => m.id === 'mode_survival');
  const atkRank = Object.entries(survival?.atk ?? {}).sort((a, b) => b[1] - a[1]).map(([a]) => a);
  const tag = l => `${ROLE_TABS[l.role].name} ${l.rank.tier}`;
  const buff = top('buff', 1), debuff = top('debuff', 1);
  const counter = common.filter(l => l.role === 'atk' && l.atk === atkRank[0]).sort((a, b) => b.rank.score - a.rank.score).slice(0, 3);
  return [
    { title: 'Đội cân bằng', desc: '2 TANK chặn đầu + 3 ATK mạnh nhất + BUFF cho cả đội' + (debuff.length ? ' + 1 DEBUFF' : '') + '. Bỏ các con tự hại nặng (chết < 20 giây).',
      picks: [...top('tank', 2), ...top('atk', 3), ...buff, ...debuff].map(l => [l, tag(l)]) },
    counter.length && { title: `Khắc Sinh tồn — đòn ${label(atkRank[0])}`, desc: `Đòn ${label(atkRank[0])} khắc tốt nhất Sinh tồn (×${survival?.atk[atkRank[0]]}) → 3 ATK đòn ${label(atkRank[0])} + TANK + BUFF.`,
      picks: [...counter, ...top('tank', 1), ...buff].map(l => [l, tag(l)]) },
  ].filter(Boolean);
}

export default {
  title: () => 'Chiến thuật',
  render({ params }) {
    const S = db.strategy;
    const tab = (Object.hasOwn(ROLE_TABS, params[0] ?? '') ? ROLE_TABS[params[0]] : null) ?? ROLE_TABS.atk;
    const lines = S.lines;
    const inRole = lines.filter(l => l.role === tab.key);
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
        lead: html`Hạng <b>chia theo vai trò</b>: mỗi dòng pet chỉ so với các dòng cùng vai trò (ATK / TANK / BUFF / DEBUFF), dựa trên chỉ số + kỹ năng thật. Huy hiệu hạng trong <a class="rootlink" href="#/tool">CUTD Helper</a> dùng đúng bảng này.`,
        aside: html`<div class="chips">${Object.values(ROLE_TABS).map(t => html`<a class="chip ${t.key === tab.key ? 'on' : ''}" href="#/strategy/${t.key}">${t.name} <small>${lines.filter(l => l.role === t.key).length}</small></a>`)}</div>`,
      })}
      <p class="note">${tab.note}</p>

      ${inRole.length ? html`<section class="tierlist">
        ${TIERS.map(t => {
          const list = inRole.filter(l => l.rank.tier === t).sort((a, b) => b.rank.score - a.rank.score);
          return list.length ? html`<div class="tier-row">
            <div class="tier-label ${TIER_CLASS[t]}"><b>${t}</b><small>${TIER_NOTE[t]}</small><span class="mono">${list.length} dòng</span></div>
            <div class="tier-cards">${list.map(l => card(l, tab))}</div>
          </div>` : '';
        })}
      </section>` : html`<div class="empty">Chưa có dòng pet bắt được nào có ${tab.name} thật trong dữ liệu game hiện tại.</div>`}
      ${lines.some(l => l.also?.some(([r]) => r === tab.key)) ? html`<h3 class="trade-only">Cũng đảm nhận được ${tab.name} <small class="dim">(vai trò chính khác, xếp theo ${tab.unit})</small></h3>
        <div class="mchips">${lines.flatMap(l => (l.also ?? []).filter(([r]) => r === tab.key).map(([, score, tier, v]) => ({ l, score, tier, v }))).sort((a, b) => b.score - a.score)
          .map(({ l, tier, v }) => html`<a class="mchip" href="#/pet/${l.slug}">${img(unit(l.id).model, l.name, '', 40)}<span>${l.name} ${tierChip(tier, `Hạng ${tab.name} (vai trò phụ)`, 'sm')}</span><small>${ROLE_TABS[l.role].name} chính · ${tab.fmt(v)}</small></a>`)}</div>` : ''}
      ${S.tradeOnly?.some(x => x.role === tab.key) ? html`<h3 class="trade-only">Chỉ có qua trade</h3>
        <div class="mchips">${S.tradeOnly.filter(x => x.role === tab.key).map(x => html`<a class="mchip" href="#/unit/${x.id.replace(/^unit_/, '')}">${img(unit(x.id)?.model, '', '', 40)}<span>${stageName(x.id)}</span><small>${tab.fmt(x.rv)} · hạng ${x.tier ?? '—'}</small></a>`)}</div>` : ''}

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
        <li><b>Vai trò của dòng</b>: có hào quang cả đội / hồi máu đồng đội → BUFF; có hiệu ứng thật làm yếu quái → DEBUFF; máu / giáp dày ở dạng đỉnh → TANK; còn lại → ATK. Mỗi dòng chỉ xếp hạng trong vai trò của nó.</li>
        <li><b>ATK</b>: DPS thật = sát thương thường × (1 + chí mạng bắn ra quái) × buff tốc đánh + sát thương cố định. Chí mạng / choáng dạng "self" (issue #1) dội vào chính con pet: không cộng, và nếu con pet tự chết trước 40 giây thì điểm bị nhân theo thời gian sống.</li>
        <li><b>TANK</b>: máu × (1 + 0,06 × giáp) ÷ (1 − né) ÷ hệ số nhận sát thương, ×1,25 nếu tự hồi máu, ×1,2 nếu khiêu khích.</li>
        <li><b>BUFF</b>: tổng % hào quang toàn căn cứ (sát thương + tốc đánh + ½ phần giảm sát thương nhờ giáp) + hồi máu đồng đội. <b>DEBUFF</b>: (giảm tốc đánh + ½ làm chậm + phá giáp + trượt đòn) × thời gian hiệu lực.</li>
        <li>Điểm 100 = nhóm 10% đầu của vai trò. Chuỗi ảnh trên thẻ: Lv1 → mạnh nhất với ≤ 1.500 vàng tiến hóa → đỉnh, tính theo đúng chỉ số của vai trò.</li>
      </ul></details>
    </main>${footer()}`;
  },
};
