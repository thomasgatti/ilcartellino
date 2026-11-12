// La squadra sfavorita prende più gialli di quanto dice il modello? Controllo su Serie A e sui campionati EXTRA (12/11/2026).
// Uso: node sfavorita_campionati.mjs <dati/fotmob>. Modello come in extra.mjs (gruppi base, lega, squadre, duelli), test per stagione allenando sulle precedenti.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadLib } from '../../../../cloud/lib_node.mjs';
const DIR = process.argv[2];
loadLib(['fotmob_scrape.js', 'fm_model.js']);
const lg = p => Math.log(p / (1 - p)), ex = x => 1 / (1 + Math.exp(-x));
const mk = (a, b, cap) => (rows, P, gap) => {           // gap in Elo, dal punto di vista della squadra di casa (>0 = ospite più forte)
  const under = gap > 0 ? 1 : 0, target = Math.min(cap, a + b * Math.abs(gap) / 100), tot = P.reduce((s, x) => s + x, 0);
  const su = rows.reduce((s, d, i) => s + (d.side === under ? P[i] : 0), 0); if (su / tot >= target) return P;
  const fit = (side, goal) => { let lo = -3, hi = 3; for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; const s = rows.reduce((a, d, i) => a + (d.side === side ? ex(lg(P[i]) + mid) : 0), 0); if (s < goal) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const dU = fit(under, tot * target), dF = fit(1 - under, tot * (1 - target));
  return P.map((p, i) => ex(lg(p) + (rows[i].side === under ? dU : dF)));
};
for (const L of [55, 47, 87, 54, 53]) {
  const ms = fs.readdirSync(DIR).filter(f => f.startsWith(L + '_')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DIR, f))))));
  window.__FMM = Object.fromEntries(ms.map(m => [m.id, m])); fmBuild(); if (typeof addLgr === 'function') try { addLgr(); } catch {}
  // Elo del campionato (vantaggio casa 60) prima di ogni partita
  const E = {}, GAP = {};
  for (const m of [...ms].filter(m => m.ts && m.hs != null).sort((a, b) => a.ts - b.ts)) { const eh = E[m.h[0]] ?? 1500, ea = E[m.a[0]] ?? 1500; GAP[m.id] = ea - eh - 60;
    const e = 1 / (1 + 10 ** ((ea - eh - 60) / 400)), r = m.hs > m.as ? 1 : m.hs === m.as ? .5 : 0; E[m.h[0]] = eh + 20 * (r - e); E[m.a[0]] = ea - 20 * (r - e); }
  const R = window.__ROWS, G = fmGroups(R), seasons = [...new Set(R.map(d => d.season))].sort();
  const groups = R.some(d => Number.isFinite(d.lgr)) ? ['base', 'lega', 'squadre', 'duelli'] : ['base', 'squadre', 'duelli'];
  const FS = G.filter(g => groups.includes(g[0])).flatMap(g => g[1]);
  const FSg = [...FS, d => Math.max(0, (d.side ? 1 : -1) * (GAP[d.mid] ?? 0) / 100), d => Math.max(0, -(d.side ? 1 : -1) * (GAP[d.mid] ?? 0) / 100)];
  const out = {}; const share = {};
  for (const s of seasons.slice(2)) {
    const tr = R.filter(d => d.season < s), te = R.filter(d => d.season === s); if (tr.length < 3000 || !te.length) continue;
    const M = fitLogit(tr, FS), Mg = fitLogit(tr, FSg), byM = {}; for (const d of te) (byM[d.mid] ||= []).push(d);
    for (const [mid, rows] of Object.entries(byM)) {
      const gap = GAP[mid]; if (gap == null) continue; const P = rows.map(M.pred);
      const V = { modello: P, 'sfavorita .515+.033': mk(.515, .033, .64)(rows, P, gap), 'sfavorita .5+.05': mk(.5, .05, .75)(rows, P, gap), 'divario col segno': rows.map(Mg.pred) };
      for (const [k, Q] of Object.entries(V)) { const o = out[k] ||= { ll: 0, n: 0, t3: 0, nm: 0 };
        rows.forEach((d, i) => { const p = Math.min(.999, Math.max(.001, Q[i])); o.ll -= d.y * Math.log(p) + (1 - d.y) * Math.log(1 - p); o.n++; });
        o.t3 += rows.map((d, i) => [Q[i], d.y]).sort((a, b) => b[0] - a[0]).slice(0, 3).reduce((a, x) => a + x[1], 0); o.nm++; }
      const b = Math.min(3, Math.floor(Math.abs(gap) / 100)), under = gap > 0 ? 1 : 0, t = share[b] ||= [0, 0, 0];
      t[0] += rows.filter(d => d.side === under).reduce((a, d) => a + d.y, 0); t[1] += rows.reduce((a, d) => a + d.y, 0);
      t[2] += rows.reduce((a, d, i) => a + (d.side === under ? P[i] : 0), 0) / P.reduce((a, x) => a + x, 0) * rows.reduce((a, d) => a + d.y, 0);
    }
  }
  console.log(`\n== Campionato ${L} (${seasons.slice(2).join(', ')}) ==`);
  for (const [k, o] of Object.entries(out)) console.log(`${k.padEnd(22)} log loss ${(o.ll / o.n).toFixed(5)} · top3 ${(o.t3 / o.nm).toFixed(3)} · ${o.nm} partite`);
  for (const [b, [u, t, pu]] of Object.entries(share)) console.log(`divario ${b * 100}+: sfavorita ${(100 * u / t).toFixed(0)}% dei gialli reali, ${(100 * pu / t).toFixed(0)}% secondo il modello`);
}
