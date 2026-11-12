// Verifica di hot_feats.js nella catena di produzione (stesso ordine di cloud/giornata.mjs) e confronto con/senza su 4 stagioni.
import { boot } from './boot.mjs';
import { loadLib } from '../../../../cloud/lib_node.mjs';
loadLib(['hot_feats.js']);
const { st } = await boot();
console.log('ammBuild:', st.fase, JSON.stringify(st.hot));
globalThis.saPatchVs(); console.log('fmPredict3 con hotNow:', globalThis.fmPredict3.toString().includes('hotNow'), 'e vs:', globalThis.fmPredict3.toString().includes('x._vs'));
const R = globalThis.__ROWS, fs1 = globalThis.__FS_SA3, fs0 = fs1.slice(0, -1); let llA = 0, llB = 0, n = 0; const H = [];
for (const s of ['2023/2024', '2024/2025', '2025/2026', '2026/2027']) {
  const tr = R.filter(d => d.season < s && d.season >= '2021/2022'), te = R.filter(d => d.season === s), a = fitLogit(tr, fs0, 2), b = fitLogit(tr, fs1, 2), byM = {};
  for (const d of te) { const pa = a.pred(d), pb = b.pred(d); llA -= d.y ? Math.log(pa) : Math.log(1 - pa); llB -= d.y ? Math.log(pb) : Math.log(1 - pb); n++; (byM[d.mid] ||= []).push([pa, pb, d.y]); }
  for (const v of Object.values(byM)) { const t = k => [...v].sort((x, y) => y[k] - x[k]).slice(0, 3).reduce((q, x) => q + x[2], 0); H.push(t(1) - t(0)); }
}
const mu = H.reduce((a, b) => a + b, 0) / H.length, sd = Math.sqrt(H.reduce((a, b) => a + (b - mu) ** 2, 0) / (H.length - 1)) / Math.sqrt(H.length);
console.log('ΔLL', ((llB - llA) / n).toFixed(5), 'Δtop3', mu.toFixed(3), '±', sd.toFixed(3));
const ids = [...new Set(R.filter(d => d.season === '2026/2027').map(d => d.pid))].slice(0, 400), z = ids.map(globalThis.hotNow);
console.log('hotNow su 400 giocatori 2026/27: media', (z.reduce((a, b) => a + b, 0) / z.length).toFixed(3), 'z≥2:', z.filter(x => x >= 2).length);
