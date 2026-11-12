// Serie A, modello di produzione (__FS_SA3) contro lo stesso + divario Elo con il segno (sfavorita / favorita). Uso: node sfavorita_sa_prod.mjs <dati/fotmob>
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadLib } from '../../../../cloud/lib_node.mjs';
const DIR = process.argv[2];
loadLib(['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js', 'deep_feats.js', 'cup_x3.js', 'sa_export.js', 'amm_boot.js']);
const all = fs.readdirSync(DIR).filter(f => f.endsWith('.json.gz')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f)))))).filter(m => m.ts && m.pl?.length > 20);
globalThis.idbAll = async name => Object.fromEntries(all.flatMap(m => name === 'amm' ? (m.lg === 55 ? [[m.id, m]] : []) : name === 'amm_ucl' ? (m.lg === 42 ? [[m.id, m]] : []) : name === 'amm_dom' ? (![55, 42].includes(m.lg) ? [[m.id, m]] : []) : (m.x ? [[m.id, m.x]] : [])));
await ammBuild();
const E = {}, GAP = {};
for (const m of all.filter(m => m.lg === 55 && m.hs != null).sort((a, b) => a.ts - b.ts)) { const eh = E[m.h[0]] ?? 1500, ea = E[m.a[0]] ?? 1500; GAP[m.id] = ea - eh - 60;
  const e = 1 / (1 + 10 ** ((ea - eh - 60) / 400)), r = m.hs > m.as ? 1 : m.hs === m.as ? .5 : 0; E[m.h[0]] = eh + 20 * (r - e); E[m.a[0]] = ea - 20 * (r - e); }
const R = __ROWS.filter(d => d.season >= '2021/2022');
const sg = d => (d.home ? 1 : -1) * (GAP[d.mid] ?? 0) / 100;
const B = [...__FS_SA3, d => Math.max(0, sg(d)), d => Math.max(0, -sg(d))];
const tests = ['2022/2023', '2023/2024', '2024/2025', '2025/2026', '2026/2027'];
console.log('Serie A produzione → + divario con il segno:', extPair(R, __FS_SA3, B, tests));
const U = __CROWS2.filter(d => d.lg === 42 && d.ex && d.x2 && d.x3);
const sgU = d => (d.gap ?? 0) * 1;    // in coppe gap è già con il segno (avversario più forte > 0)
console.log('Champions produzione → + divario con il segno:', extPair(U, __CFS5, [...__CFS5, d => Math.max(0, sgU(d)), d => Math.max(0, -sgU(d))], ['2022/2023', '2023/2024', '2024/2025', '2025/2026']));
