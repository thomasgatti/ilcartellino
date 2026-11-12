// Idee del documento «100 idee» provabili con l'archivio attuale: variabili nuove calcolate SOLO con le partite precedenti,
// aggiunte una alla volta al modello di produzione (Serie A __FS_SA3, Champions __CFS3) e confrontate stagione per stagione.
// Criterio del progetto: log loss −0,0002 o meglio senza peggiorare gli ammoniti tra i primi 3 per partita.
// Uso: node --max-old-space-size=7000 candidati.mjs
import fs from 'node:fs';
import { boot } from './boot.mjs';
const { all } = await boot();
const fitLogit = globalThis.fitLogit, L = x => Math.log(Math.max(.005, x));
const ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M', CARD = new Set(['Yellow', 'YellowRed']);
const byTs = [...all].sort((a, b) => a.ts - b.ts || a.id - b.id), Y3 = 3 * 365 * 86400;
const F = new Map(); // mid|pid → variabili

// stati cumulativi
const P = new Map();          // pid → {ev:[[ts, y, fouls, actions, lg, role]], last: ts}
const LR = {};                // lg|role → [gialli, falli] (gialli per fallo della lega)
const REF = new Map();        // id arbitro → {g, y, f, yh, yt}
const LG = {};                // lg → {g, y, f, yh, yt}
const TEAM = new Map();       // team id → [[ts, {D,M,F} gialli]] ultime 20
const TF = new Map();         // team id → falli per partita, ultime 10
const LROLE = {};             // lg → {D,M,F} gialli totali (quota per ruolo)
for (const m of byTs) {
  const booked = new Set((m.cards || []).filter(c => CARD.has(c[2])).map(c => +c[0]));
  const ref = m.ref?.[0] ?? m.ref?.[1] ?? null, lg = m.lg;
  const st = m.pl.filter(r => r[4] === 1 && r[3] !== 0);
  // --- variabili prima della partita ---
  const lgS = LG[lg] || { g: 0, y: 0, f: 0, yh: 0, yt: 0 }, rS = ref != null ? REF.get(ref) : null;
  const lgYPF = lgS.f > 500 ? lgS.y / lgS.f : .2, lgHome = lgS.yt > 200 ? lgS.yh / lgS.yt : .47;
  const K = 10; // shrink arbitro: 10 partite di media della lega
  const refYPF = rS ? ((rS.y + K * lgS.y / Math.max(1, lgS.g)) / (rS.f + K * lgS.f / Math.max(1, lgS.g))) / lgYPF : 1;
  const refHome = rS ? ((rS.yh + 40 * lgHome) / (rS.yt + 40)) / lgHome : 1;
  const lr0 = LROLE[lg] || { D: 0, M: 0, F: 0 }, lgRole = { D: lr0.D + 30, M: lr0.M + 45, F: lr0.F + 25 }, lrTot = lgRole.D + lgRole.M + lgRole.F;
  for (const r of st) {
    const pid = +r[0], role = ROLE(r[3]), side = r[2], team = side ? m.h[0] : m.a[0];
    const p = P.get(pid), ev = p ? p.ev.filter(e => e[0] >= m.ts - Y3) : [];
    let Yp = 0, E = 0, fo = 0, act = 0;
    for (const e of ev) { Yp += e[1]; fo += e[2]; act += e[3]; const lr = LR[e[4] + '|' + e[5]]; E += e[2] * (lr && lr[1] > 300 ? lr[0] / lr[1] : .18); }
    const z = E > 0 ? Math.max(-3, Math.min(3, (Yp - E) / Math.sqrt(E + 1))) : 0;
    const roleFPA = { D: .12, M: .16, F: .25 }[role]; // falli per azione difensiva tipici (inizio), poi shrink 40 azioni
    const fpa = ((fo + 40 * roleFPA) / (act + 40)) / roleFPA;
    const days = p?.last ? (m.ts - p.last) / 86400 : null;
    const T = (TEAM.get(team) || []).slice(-20), tr = { D: 0, M: 0, F: 0 }; for (const t of T) for (const k in tr) tr[k] += t[1][k];
    const tf = TF.get(team) || [], tfi = tf.length ? Math.log(((tf.reduce((a, x) => a + x, 0) + 3 * (lgS.g ? lgS.f / lgS.g / 2 : 12)) / (tf.length + 3)) / (lgS.g ? lgS.f / lgS.g / 2 : 12)) : 0;
    const tt = tr.D + tr.M + tr.F, share = (tr[role] + 6 * lgRole[role] / lrTot) / (tt + 6), lshare = lgRole[role] / lrTot;
    F.set(m.id + '|' + pid, { hot: z, hot2: z >= 2 ? 1 : 0, fpa: Math.log(fpa), refypf: Math.log(refYPF), refhome: Math.log(refHome) * (side ? 1 : -1),
      teamrole: Math.log(share / lshare), lungo: days != null && days >= 21 ? 1 : 0, lungo45: days != null && days >= 45 ? 1 : 0, refxint: Math.log(refYPF) * tfi });
  }
  // --- aggiornamento con l'esito ---
  let mf = 0, my = 0, myh = 0; const tY = { 1: { D: 0, M: 0, F: 0 }, 0: { D: 0, M: 0, F: 0 } };
  for (const r of m.pl) {
    const pid = +r[0], role = ROLE(r[3]), y = booked.has(pid) ? 1 : 0, fouls = +r[6] || 0, act = (+r[8] || 0) + (+r[9] || 0) + (+r[10] || 0);
    if (r[3] === 0) continue;
    mf += fouls; my += y; if (y && r[2] === 1) myh++; if (y) tY[r[2]][role]++;
    if ((r[5] || 0) > 0) {
      const p = P.get(pid) || { ev: [] }; p.ev.push([m.ts, y, fouls, act, lg, role]); if (p.ev.length > 200) p.ev.shift(); p.last = m.ts; P.set(pid, p);
      const k = lg + '|' + role, lr = LR[k] ||= [0, 0]; lr[0] += y; lr[1] += fouls;
    }
  }
  const g = LG[lg] ||= { g: 0, y: 0, f: 0, yh: 0, yt: 0 }; g.g++; g.y += my; g.f += mf; g.yh += myh; g.yt += my;
  if (ref != null) { const s = REF.get(ref) || { g: 0, y: 0, f: 0, yh: 0, yt: 0 }; s.g++; s.y += my; s.f += mf; s.yh += myh; s.yt += my; REF.set(ref, s); }
  const lr = LROLE[lg] ||= { D: 0, M: 0, F: 0 }; for (const sd of [1, 0]) for (const k in lr) lr[k] += tY[sd][k];
  for (const [sd, tid] of [[1, m.h[0]], [0, m.a[0]]]) { const ff = m.pl.filter(r => r[2] === sd).reduce((a, r) => a + (+r[6] || 0), 0); const b = TF.get(tid) || []; b.push(ff); if (b.length > 10) b.shift(); TF.set(tid, b); const a = TEAM.get(tid) || []; a.push([m.ts, tY[sd]]); if (a.length > 20) a.shift(); TEAM.set(tid, a); }
}

const CAND = {
  '14 testa calda (z continuo)': [d => d.k.hot],
  '14 testa calda (z ≥ 2)': [d => d.k.hot2],
  '12 falli per azione difensiva': [d => d.k.fpa],
  '41 arbitro: gialli per fallo': [d => d.k.refypf],
  '44 arbitro: casa/trasferta': [d => d.k.refhome],
  '38 gialli della squadra per ruolo': [d => d.k.teamrole],
  '5 rientro dopo ≥21 giorni': [d => d.k.lungo],
  '5 rientro dopo ≥45 giorni': [d => d.k.lungo45],
  '45 arbitro × falli della squadra': [d => d.k.refxint],
  '14 + 38 insieme': [d => d.k.hot, d => d.k.teamrole],
};
function pair(rows, fsA, fsB, tests, minSeason) {
  const H = []; let llA = 0, llB = 0, n = 0, byS = {};
  for (const s of tests) {
    const tr = rows.filter(d => d.season < s && (!minSeason || d.season >= minSeason)), te = rows.filter(d => d.season === s); if (!te.length) continue;
    const mA = fitLogit(tr, fsA, 2), mB = fitLogit(tr, fsB, 2), byM = {}; let a0 = 0, b0 = 0;
    for (const d of te) { const a = Math.min(.999, Math.max(.001, mA.pred(d))), b = Math.min(.999, Math.max(.001, mB.pred(d)));
      const la = -(d.y * Math.log(a) + (1 - d.y) * Math.log(1 - a)), lb = -(d.y * Math.log(b) + (1 - d.y) * Math.log(1 - b)); llA += la; llB += lb; a0 += la; b0 += lb; n++; (byM[d.mid] ||= []).push([a, b, d.y]); }
    byS[s] = +((b0 - a0) / te.length).toFixed(5);
    for (const a of Object.values(byM)) { const t = k => [...a].sort((x, y) => y[k] - x[k]).slice(0, 3).reduce((s2, x) => s2 + x[2], 0); H.push(t(1) - t(0)); }
  }
  const mu = H.reduce((a, b) => a + b, 0) / H.length, sd = Math.sqrt(H.reduce((a, b) => a + (b - mu) ** 2, 0) / (H.length - 1));
  return { dll: (llB - llA) / n, dt3: mu, se: sd / Math.sqrt(H.length), byS, n };
}
const SA = globalThis.__ROWS, UC = globalThis.__CROWS2.filter(d => d.lg === 42);
let miss = 0; for (const d of [...SA, ...UC]) { d.k = F.get(d.mid + '|' + d.pid); if (!d.k) { miss++; d.k = { hot: 0, hot2: 0, fpa: 0, refypf: 0, refhome: 0, teamrole: 0, lungo: 0, lungo45: 0, refxint: 0 }; } }
console.log('righe senza variabili:', miss, 'su', SA.length + UC.length);
for (const k of ["refxint","refypf","hot","teamrole"]) { const v = SA.map(d => d.k[k]); console.log(k, Math.min(...v).toFixed(3), Math.max(...v).toFixed(3), (v.reduce((a,b)=>a+b,0)/v.length).toFixed(4)); }
if (process.env.SOLO_STAT) process.exit(0);
const TESTS = ['2023/2024', '2024/2025', '2025/2026', '2026/2027'], out = {};
const f = (x, d = 5) => (x >= 0 ? '+' : '') + x.toFixed(d).replace('.', ',');
const UC5 = UC.filter(d => d.ex && d.x2 && d.x3);
const GRUPPI = process.env.SOLO_V4 ? [['Champions v4 (produzione)', UC5, globalThis.__CFS5, null]] : [['Serie A', SA, globalThis.__FS_SA3, '2021/2022'], ['Champions', UC, globalThis.__CFS3, null], ['Champions v4 (produzione)', UC5, globalThis.__CFS5, null]];
for (const [comp, rows, fs, min] of GRUPPI) {
  console.log(`\n== ${comp} (prova ${TESTS.join(', ')}) ==`);
  for (const [nome, add] of Object.entries(CAND)) {
    const r = pair(rows, fs, [...fs, ...add], TESTS, min), ok = r.dll <= -0.0002 && r.dt3 >= -r.se;
    console.log(`${ok ? 'PASSA ' : '      '}${nome}: ΔLL ${f(r.dll)}  Δtop3 ${f(r.dt3, 3)} ± ${r.se.toFixed(3).replace('.', ',')}  per stagione ${Object.values(r.byS).map(x => f(x)).join(' ')}`);
    (out[comp] ||= {})[nome] = { ...r, passa: ok };
  }
}
fs.writeFileSync(new URL('./candidati.json', import.meta.url), JSON.stringify(out, null, 1));
