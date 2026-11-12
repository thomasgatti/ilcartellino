// Verifica della catena di produzione con hot_feats.js + ctx_feats.js: ricalcola, con le variabili della produzione, il confronto
// con/senza contesto (Serie A: quote; Champions v4: possesso atteso) su 4 stagioni di prova.
import { boot } from './boot.mjs';
const { st } = await boot(undefined, { produzione: true });
console.log('ammBuild:', st.fase, JSON.stringify(st.hot), JSON.stringify(st.ctx));
globalThis.saPatchVs(); console.log('fmPredict3:', ['hotNow', 'ctxOddsNow', 'x._vs'].map(k => k + ' ' + globalThis.fmPredict3.toString().includes(k)).join(', '), '· cupPredict3 ctxPossNow', globalThis.cupPredict3.toString().includes('ctxPossNow'));
function cmp(R, fs1, k, min) { const fs0 = fs1.slice(0, -k); let a = 0, b = 0, n = 0; const H = [];
  for (const s of ['2023/2024', '2024/2025', '2025/2026', '2026/2027']) { const tr = R.filter(d => d.season < s && (!min || d.season >= min)), te = R.filter(d => d.season === s), A = fitLogit(tr, fs0, 2), B = fitLogit(tr, fs1, 2), byM = {};
    for (const d of te) { const pa = A.pred(d), pb = B.pred(d); a -= d.y ? Math.log(pa) : Math.log(1 - pa); b -= d.y ? Math.log(pb) : Math.log(1 - pb); n++; (byM[d.mid] ||= []).push([pa, pb, d.y]); }
    for (const v of Object.values(byM)) { const t = i => [...v].sort((x, y) => y[i] - x[i]).slice(0, 3).reduce((q, x) => q + x[2], 0); H.push(t(1) - t(0)); } }
  const mu = H.reduce((x, y) => x + y, 0) / H.length, se = Math.sqrt(H.reduce((x, y) => x + (y - mu) ** 2, 0) / (H.length - 1) / H.length);
  return `ΔLL ${((b - a) / n).toFixed(5)}  Δtop3 ${mu.toFixed(3)} ± ${se.toFixed(3)}`; }
console.log('Serie A (hot + quote contro hot):', cmp(globalThis.__ROWS, globalThis.__FS_SA3, 2, '2021/2022'));
console.log('Champions v4 (+ possesso atteso):', cmp(globalThis.__CROWS2.filter(d => d.lg === 42 && d.ex && d.x2 && d.x3), globalThis.__CFS5, 1));
globalThis.__ODDSNOW[123] = [55, 25, 20]; console.log('ctxOddsNow casa/trasferta:', globalThis.ctxOddsNow(123, 1).map(x => x.toFixed(2)), globalThis.ctxOddsNow(123, 0).map(x => x.toFixed(2)), '· nessuna quota:', globalThis.ctxOddsNow(999, 1));
const M = globalThis.cupAll().filter(m => m.lg === 42).slice(-1)[0]; console.log('ctxPossNow', M.h[1], '-', M.a[1], globalThis.ctxPossNow(M.h[0], M.a[0], 1).toFixed(2), globalThis.ctxPossNow(M.h[0], M.a[0], 0).toFixed(2));
