// Livello di ammonizioni della stagione nel modello Serie A FotMob: finestra W delle righe titolari (oggi 3000).
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const { loadLib } = await import('../../../../cloud/lib_node.mjs');
loadLib(['fm_model.js']);
const H = '../../../../dati/fotmob';
const all = fs.readdirSync(H).filter(f => f.startsWith('55_')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(H, f))))));
window.__FMM = Object.fromEntries(all.map(m => [m.id, m]));
fmBuild();
const R = window.__ROWS;
const seasons = [...new Set(R.map(d => d.season))].sort(); console.log('stagioni', seasons.map(s => s + ':' + R.filter(d => d.season === s).length).join(' '));
for (const s of seasons) { const a = R.filter(d => d.season === s); console.log(' tasso gialli titolari', s, (a.reduce((x, d) => x + d.y, 0) / a.length * 100).toFixed(1) + '%'); }
const kept = ['base', 'lega', 'squadre', 'duelli'];
const tests = [[['2021/2022','2022/2023','2023/2024'], '2024/2025'], [['2021/2022','2022/2023','2023/2024','2024/2025'], '2025/2026'], [['2021/2022','2022/2023','2023/2024','2024/2025','2025/2026'], '2026/2027']];
for (const W of [750, 1500, 3000, 6000, 12000]) {
  addLgr(W);
  const line = tests.map(([tr, te]) => { const f = fmFinal(kept, tr, te); const atteso = f.P.reduce((s, p) => s + p, 0), oss = f.te.reduce((s, d) => s + d.y, 0);
    return `${te}: ll ${f.test.logloss.toFixed(5)} top3 ${f.test.top3_per_partita} attesi ${atteso.toFixed(0)} osservati ${oss}`; });
  console.log('W', W, '|', line.join(' | '));
}
// senza il gruppo "lega"
addLgr(3000);
console.log('senza lega |', tests.map(([tr, te]) => { const f = fmFinal(['base','squadre','duelli'], tr, te); return `${te}: ll ${f.test.logloss.toFixed(5)} attesi ${f.P.reduce((s,p)=>s+p,0).toFixed(0)}`; }).join(' | '));
