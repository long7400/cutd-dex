import { appendFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { request } from './lib/http.mjs';

const WEB = 'https://m.cutd.site';
const COCOS = 'https://cutd.site';

export const SIGNATURES = {
  web: [
    ['WebSocket JSON (tool đọc dữ liệu trận)', /\.onmessage=\w=>\{let \w=\w+\(typeof \w\.data==`string`/],
    ['session.nextSequence (móc hàm game)', /this\.nextSequence=1\b/],
    ['interaction._selectedEntityId (móc hàm game)', /this\._selectedEntityId=null/],
    ['session.catchWild', /catchWild\(\w\)\{return this\.dispatch\(/],
    ['session.evolveCreature', /evolveCreature\(\w,\w\)\{/],
    ['session.tradePet', /tradePet\(\w,\w\)\{return this\.dispatch\(/],
    ['interaction.selectEntity', /selectEntity\(\w,\w\)\{\w\.entities\.has\(\w\)/],
    ['id entity u12/w3/t1', /\{Unit:`u`,Creep:`c`,Wild:`w`,TradeOffer:`t`/],
    ['nút HTML data-node (phím F)', /dataset\.node=\w\.name/],
    ['nút chính Primary', /`Primary`/],
  ],
  cocos: [
    ['WebSocket JSON (tool đọc dữ liệu trận)', /onmessage=function\(\w\)\{var \w=function\(\w\)\{try\{var \w=JSON\.parse/],
    ['session.catchWild', /catchWild/],
    ['session.evolveCreature', /evolveCreature/],
    ['session.tradePet', /tradePet/],
    ['interaction.selectEntity', /selectEntity/],
  ],
};

const KNOWN = {
  trigger: new Set(['on_cast', 'on_attack', 'on_hit', 'aura', 'on_attacked', 'on_death', 'periodic', 'on_kill', 'on_cooldown', 'on_damaged']),
  effect: new Set(['apply_modifier', 'damage', 'heal', 'summon', 'health_loss', 'force_attack_target', 'destroy', 'displace', 'set_health']),
  basis: new Set(['attack_damage', 'max_health', 'current_health', 'point_value_difference', 'point_value']),
  condition: new Set(['chance', 'unit_type_not', 'caster_has_ability', 'caster_has_modifier', 'target_health_below', 'not_legendary', 'point_value', 'target_is_boss', 'target_has_modifier']),
};

export function unknownShapes(catalog) {
  const seen = { trigger: new Map(), effect: new Map(), basis: new Map(), condition: new Map() };
  const note = (kind, value, id) => { if (value && !KNOWN[kind].has(value) && !seen[kind].has(value)) seen[kind].set(value, id); };
  for (const a of catalog.abilities ?? []) {
    if (a.status !== 'executable') continue;
    note('trigger', a.trigger?.kind, a.id);
    for (const c of a.conditions ?? []) note('condition', c.kind, a.id);
    for (const e of a.effects ?? []) {
      note('effect', e.kind, a.id);
      note('basis', e.magnitude?.basis, a.id);
      for (const c of e.conditions ?? []) note('condition', c.kind, a.id);
    }
  }
  return Object.entries(seen).flatMap(([kind, m]) => [...m].map(([value, id]) => `${kind} "${value}" (vd ${id})`));
}

export function missingSignatures(kind, code) {
  return SIGNATURES[kind].filter(([, re]) => !re.test(code)).map(([name]) => name);
}

async function main() {
  const html = (await request(`${WEB}/`, { maxBytes: 1024 * 1024 })).text();
  const bundle = /\/assets\/index-[\w-]+\.js/.exec(html)?.[0];
  const web = bundle ? (await request(`${WEB}${bundle}`, { maxBytes: 16 * 1024 * 1024 })).text() : '';
  const cocos = (await request(`${COCOS}/assets/main/index.js`, { maxBytes: 16 * 1024 * 1024 })).text();
  const catalog = (await request(`${WEB}/catalog`, { maxBytes: 32 * 1024 * 1024 })).json().catalog;

  const missing = [...missingSignatures('web', web).map(n => `m.cutd.site (${bundle ?? 'không thấy bundle'}): ${n}`),
    ...missingSignatures('cocos', cocos).map(n => `cutd.site: ${n}`)];
  const strange = unknownShapes(catalog);
  const lines = [
    `## Kiểm tra client game`,
    missing.length ? `❌ Mất ${missing.length} điểm tool dựa vào — cần cập nhật CUTD Helper:` : `✅ Cả 2 bản game vẫn khớp mọi điểm CUTD Helper dựa vào (${bundle}).`,
    ...missing.map(m => `- ${m}`),
    strange.length ? `⚠️ Catalog có dạng kỹ năng mới, bộ đánh giá chưa hiểu (không cộng điểm cho tới khi cập nhật):` : `✅ Mọi dạng kỹ năng trong catalog đều đã được đánh giá.`,
    ...strange.map(s => `- ${s}`),
  ];
  console.log(lines.join('\n'));
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${lines.join('\n')}\n`);
  if (missing.length) process.exitCode = 1;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
