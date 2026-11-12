// Idee sbloccate dai dati recuperati il 12/11: possesso (archivio extra di FotMob) e quote storiche (football-data.co.uk).
// 11 falli in rapporto al possesso avversario · 31 possesso atteso · 40/68 forza dalle quote di chiusura (sfavorita con segno, partita da over, pareggio).
// Stesso criterio e stesse stagioni di candidati.mjs. Uso: DATI=/percorso/ramo-dati/fotmob node --max-old-space-size=7000 candidati2.mjs
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { boot } from './boot.mjs';
import { loadFD } from '../../../../cloud/contesto.mjs';
const DATI = process.env.DATI || '/home/claude/datib/fotmob', ROOT = path.dirname(DATI);
const { all } = await boot(DATI);
const fitLogit = globalThis.fitLogit, lg2 = p => Math.log(p / (1 - p));
const EX = new Map(); for (const f of fs.readdirSync(path.join(ROOT, 'extra')).filter(f => f.endsWith('.json.gz')))
  for (const [id, e] of Object.entries(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(ROOT, 'extra', f)))))) if (e.t?.possesso) EX.set(+id, e.t.possesso);
const FD = loadFD(path.join(ROOT, 'quote'), all); console.log('possesso:', EX.size, 'partite · quote football-data: righe', FD.righe, 'abbinate', FD.ok);
const sa = all.filter(m => m.lg === 55); console.log('Serie A con quote:', sa.filter(m => FD.map.has(+m.id)).length, 'su', sa.length);

const byTs = [...all].sort((a, b) => a.ts - b.ts || a.id - b.id), Y3 = 3 * 365 * 86400, ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M';
const TP = new Map(), P = new Map(), F = new Map();
for (const m of byTs) {
  const poss = EX.get(+m.id), od = FD.map.get(+m.id);
  const avg = t => { const a = TP.get(t) || []; return a.length >= 3 ? a.reduce((s, x) => s + x, 0) / a.length : 50; };
  const ph = avg(m.h[0]), pa = avg(m.a[0]);
  for (const r of m.pl) if (r[4] === 1 && r[3] !== 0) {
    const side = r[2], eOwn = side ? (ph + 100 - pa) / 2 : (pa + 100 - ph) / 2;
    const ev = (P.get(+r[0]) || []).filter(e => e[0] >= m.ts - Y3); let f = 0, mi = 0, ma = 0;
    for (const e of ev) { f += e[1]; mi += e[2]; ma += e[3]; }
    const raw = (f + 1.5) / (mi / 90 + 1), adj = (f + 1.5) / (ma / 90 + 1); // ma = minuti pesati per possesso avversario / 50
    let sg = 0, pO = 0, pD = 0;
    if (od) { const own = side ? od.p[0] : od.p[2], opp = side ? od.p[2] : od.p[0]; sg = lg2(own) - lg2(opp); pO = od.pO ? lg2(od.pO) : 0; pD = od.p[1] - .27; }
    F.set(m.id + '|' + r[0], { fposs: Math.log(adj / raw), possatt: (50 - eOwn) / 10, possown: (50 - (side ? ph : pa)) / 10, sgp: Math.max(0, sg), sgn: Math.max(0, -sg), over: pO, pari: pD, hasq: od ? 1 : 0 });
  }
  if (poss) {
    for (const [t, v] of [[m.h[0], poss[0]], [m.a[0], poss[1]]]) { const a = TP.get(t) || []; a.push(v); if (a.length > 10) a.shift(); TP.set(t, a); }
    for (const r of m.pl) { if (r[3] === 0 || !((r[5] || 0) > 0)) continue; const opp = r[2] ? poss[1] : poss[0];
      const ev = P.get(+r[0]) || []; ev.push([m.ts, +r[6] || 0, r[5], r[5] * opp / 50]); if (ev.length > 200) ev.shift(); P.set(+r[0], ev); }
  }
}
const SA = globalThis.__ROWS, UC = globalThis.__CROWS2.filter(d => d.lg === 42), UC5 = UC.filter(d => d.ex && d.x2 && d.x3);
const Z = { fposs: 0, possatt: 0, possown: 0, sgp: 0, sgn: 0, over: 0, pari: 0, hasq: 0 }; let miss = 0;
for (const d of [...SA, ...UC]) { d.k2 = F.get(d.mid + '|' + d.pid); if (!d.k2) { miss++; d.k2 = Z; } }
console.log('righe senza variabili:', miss);
const CAND = {
  '11 falli rispetto al possesso avversario': [d => d.k2.fposs],
  '31 possesso atteso (medie ultime 10)': [d => d.k2.possatt],
  '31 possesso abituale della squadra': [d => d.k2.possown],
  '40/68 forza dalle quote (sfavorita con segno)': [d => d.k2.sgp, d => d.k2.sgn],
  '68 partita da over 2,5 (quote)': [d => d.k2.over],
  '68 probabilità di pareggio (quote)': [d => d.k2.pari],
  '68 tutte le quote insieme': [d => d.k2.sgp, d => d.k2.sgn, d => d.k2.over, d => d.k2.pari],
};
function pair(rows, fsA, fsB, tests, minSeason) {
  const H = []; let llA = 0, llB = 0, n = 0; const byS = {};
  for (const s of tests) {
    const tr = rows.filter(d => d.season < s && (!minSeason || d.season >= minSeason)), te = rows.filter(d => d.season === s); if (!te.length) continue;
    const mA = fitLogit(tr, fsA, 2), mB = fitLogit(tr, fsB, 2), byM = {}; let a0 = 0, b0 = 0;
    for (const d of te) { const a = Math.min(.999, Math.max(.001, mA.pred(d))), b = Math.min(.999, Math.max(.001, mB.pred(d)));
      const la = -(d.y * Math.log(a) + (1 - d.y) * Math.log(1 - a)), lb = -(d.y * Math.log(b) + (1 - d.y) * Math.log(1 - b)); llA += la; llB += lb; a0 += la; b0 += lb; n++; (byM[d.mid] ||= []).push([a, b, d.y]); }
    byS[s] = (b0 - a0) / te.length;
    for (const a of Object.values(byM)) { const t = k => [...a].sort((x, y) => y[k] - x[k]).slice(0, 3).reduce((s2, x) => s2 + x[2], 0); H.push(t(1) - t(0)); }
  }
  const mu = H.reduce((a, b) => a + b, 0) / H.length, sd = Math.sqrt(H.reduce((a, b) => a + (b - mu) ** 2, 0) / (H.length - 1));
  return { dll: (llB - llA) / n, dt3: mu, se: sd / Math.sqrt(H.length), byS, n };
}
const TESTS = ['2023/2024', '2024/2025', '2025/2026', '2026/2027'], out = {}, f = (x, d = 5) => (x >= 0 ? '+' : '') + x.toFixed(d).replace('.', ',');
for (const [comp, rows, fs0, min] of [['Serie A', SA, globalThis.__FS_SA3, '2021/2022'], ['Champions', UC, globalThis.__CFS3, null], ['Champions v4 (produzione)', UC5, globalThis.__CFS5, null]]) {
  console.log(`\n== ${comp} ==`);
  for (const [nome, add] of Object.entries(CAND)) {
    if (comp !== 'Serie A' && nome.includes('quote')) continue;
    const r = pair(rows, fs0, [...fs0, ...add], TESTS, min), ok = r.dll <= -0.0002 && r.dt3 >= -r.se;
    console.log(`${ok ? 'PASSA ' : '      '}${nome}: ΔLL ${f(r.dll)}  Δtop3 ${f(r.dt3, 3)} ± ${r.se.toFixed(3).replace('.', ',')}  per stagione ${Object.values(r.byS).map(x => f(x)).join(' ')}`);
    (out[comp] ||= {})[nome] = { ...r, passa: ok };
  }
}
fs.writeFileSync(new URL('./candidati2.json', import.meta.url), JSON.stringify(out, null, 1));
