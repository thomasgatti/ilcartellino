// Studio del modello per le nazionali (12/11/2026). Uso: node studio.mjs <dati/fotmob> <dati/nazionali>
// Costruisce le righe del modello coppe (cup_model2) anche per le partite delle nazionali e confronta, su test temporali per anno
// (allena solo sul passato): log loss, ammoniti tra i primi 3 per partita (top3), calibrazione, quota della sfavorita.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import vm from 'node:vm';
import { loadLib } from '../../../../cloud/lib_node.mjs';
const [CLUB, NAZ] = process.argv.slice(2);
const INT = new Set([9806, 9807, 9808, 9809, 50, 77, 10607, 10195]);
const load = dir => fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))))));
const all = [...load(CLUB), ...(NAZ && fs.existsSync(NAZ) ? load(NAZ) : [])].filter(m => m.ts && m.pl?.length > 20);
window.__FMM = Object.fromEntries(all.filter(m => m.lg === 55).map(m => [m.id, m]));
window.__UCL = Object.fromEntries(all.filter(m => m.lg === 42).map(m => [m.id, m]));
window.__DOM = Object.fromEntries(all.filter(m => m.lg !== 55 && m.lg !== 42).map(m => [m.id, m]));
loadLib(['fotmob_scrape.js', 'fm_model.js', 'cup_model.js']);
const LIB = new URL('../../../../lib/', import.meta.url);
// cup_model2 con le competizioni delle nazionali tra quelle che producono righe (solo per lo studio)
vm.runInThisContext('{' + fs.readFileSync(new URL('cup_model2.js', LIB), 'utf8').replace('const CUPS = new Set([42, 73, 10216]);', `const CUPS = new Set([42, 73, 10216, ${[...INT]}]);`) + '\n}');
vm.runInThisContext('{' + fs.readFileSync(new URL('amm_boot.js', LIB), 'utf8').replace(/^window\.idbAll[\s\S]*?^window\.cupFS2/m, 'window.cupFS2') + '\n}');
cupBuild2(600);
const TS = Object.fromEntries(all.map(m => [m.id, m.ts])), LGOF = Object.fromEntries(all.map(m => [m.id, m.lg]));
const R = __CROWS2.map(d => ({ ...d, ts: TS[d.mid] }));
const U = R.filter(d => d.lg === 42), N = R.filter(d => INT.has(d.lg));
console.log('righe Champions', U.length, '· righe nazionali', N.length, '· partite nazionali', new Set(N.map(d => d.mid)).size);
const L = x => Math.log(Math.max(.005, x)), lg = p => Math.log(p / (1 - p)), ex = x => 1 / (1 + Math.exp(-x));
const BASE = cupFS2();
// storia del giocatore in nazionale (gialli in nazionale prima della partita, contratti verso la media)
{ const H = {}; const byM = {}; for (const d of N) (byM[d.mid] ||= []).push(d);
  const mids = Object.keys(byM).sort((a, b) => TS[a] - TS[b]); let tot = [0, 0];
  for (const mid of mids) { const rate = tot[0] ? tot[1] / tot[0] : .1;
    for (const d of byM[mid]) { const h = H[d.pid] || [0, 0]; d.intn = h[0]; d.intr = (h[1] + rate * 6) / (h[0] + 6) / rate; }
    for (const d of byM[mid]) { const h = H[d.pid] ||= [0, 0]; h[0]++; h[1] += d.y; tot[0]++; tot[1] += d.y; } } }
const FEATS = {
  base: BASE,
  sfavorita: [...BASE, d => Math.max(0, d.gap ?? 0), d => Math.max(0, -(d.gap ?? 0))],          // divario con il segno: sfavorito / favorito
  storia_naz: [...BASE, d => L(d.intr ?? 1)],
  torneo: [...BASE, d => [50, 77].includes(d.lg) ? 1 : 0, d => [10607, 10195].includes(d.lg) ? 1 : 0],
  tutto: [...BASE, d => Math.max(0, d.gap ?? 0), d => Math.max(0, -(d.gap ?? 0)), d => L(d.intr ?? 1), d => [50, 77].includes(d.lg) ? 1 : 0, d => [10607, 10195].includes(d.lg) ? 1 : 0],
};
const YEARS = [2023, 2024, 2025, 2026], yts = y => Date.UTC(y, 0, 1) / 1000;
function evaluate(name, train, test, fs_, post) {
  let ll = 0, n = 0, t3 = 0, nm = 0, obs = 0, exp = 0;
  for (const y of YEARS) {
    const tr = train(y), te = test.filter(d => d.ts >= yts(y) && d.ts < yts(y + 1)); if (!te.length) continue;
    const M = fitLogit(tr, fs_, 2);
    // intercetta riportata al livello delle nazionali sulle partite di nazionali precedenti
    const cal = N.filter(d => d.ts < yts(y)); let sh = 0;
    if (cal.length > 500) { let lo = -1, hi = 1; const o = cal.reduce((a, d) => a + d.y, 0); for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, s = cal.reduce((a, d) => a + ex(lg(M.pred(d)) + mid), 0); if (s > o) hi = mid; else lo = mid; } sh = (lo + hi) / 2; }
    const byM = {}; for (const d of te) (byM[d.mid] ||= []).push(d);
    for (const rows of Object.values(byM)) {
      let P = rows.map(d => ex(lg(M.pred(d)) + sh)); if (post) P = post(rows, P);
      rows.forEach((d, i) => { const p = Math.min(.999, Math.max(.001, P[i])); ll -= d.y * Math.log(p) + (1 - d.y) * Math.log(1 - p); n++; obs += d.y; exp += p; });
      t3 += rows.map((d, i) => [P[i], d.y]).sort((a, b) => b[0] - a[0]).slice(0, 3).reduce((a, x) => a + x[1], 0); nm++;
    }
  }
  console.log(`${name.padEnd(42)} log loss ${(ll / n).toFixed(5)} · top3 ${(t3 / nm).toFixed(3)} · oss/att ${(obs / exp).toFixed(3)} · ${nm} partite`);
  return { ll: ll / n, t3: t3 / nm };
}
// correzione della sfavorita come in produzione (quota storica dei gialli in base al divario; qui il divario è l'Elo dell'archivio)
const mkUnderdog = (a, b, cap) => (rows, P) => {
  const gap = rows.find(d => d.side === 1)?.gap; if (gap == null) return P;    // gap visto dalla squadra di casa: >0 = avversario più forte
  const under = gap > 0 ? 1 : 0, target = Math.min(cap, a + b * Math.abs(gap));
  const tot = P.reduce((a, b) => a + b, 0), su = rows.reduce((a, d, i) => a + (d.side === under ? P[i] : 0), 0);
  if (su / tot >= target) return P;
  const fit = (side, goal) => { let lo = -3, hi = 3; for (let k = 0; k < 50; k++) { const mid = (lo + hi) / 2; const s = rows.reduce((a, d, i) => a + (d.side === side ? ex(lg(P[i]) + mid) : 0), 0); if (s < goal) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const dU = fit(under, tot * target), dF = fit(1 - under, tot * (1 - target));
  return P.map((p, i) => ex(lg(p) + (rows[i].side === under ? dU : dF)));
};
const underdog = mkUnderdog(.515, .033, .64);
console.log('\n— Test sulle partite delle nazionali (2023-2026), modello allenato sulla Champions —');
const onU = y => U.filter(d => d.ts < yts(y)), onUN = y => [...U, ...N].filter(d => d.ts < yts(y));
const r0 = evaluate('A. Champions → nazionali (come oggi)', onU, N, BASE);
evaluate('B. A + correzione sfavorita (produzione)', onU, N, BASE, underdog);
evaluate('C. Champions + nazionali passate', onUN, N, BASE);
for (const k of ['sfavorita', 'storia_naz', 'torneo', 'tutto']) evaluate(`D. C + ${k}`, onUN, N, FEATS[k]);
evaluate('E. C + tutto + correzione sfavorita', onUN, N, FEATS.tutto, underdog);
console.log('\n— Quota dei gialli della sfavorita nelle nazionali (osservata) —');
{ const byM = {}; for (const d of N) (byM[d.mid] ||= []).push(d); const B = {};
  for (const rows of Object.values(byM)) { const g = rows.find(d => d.side === 1)?.gap; if (g == null) continue; const under = g > 0 ? 1 : 0, b = Math.min(3, Math.floor(Math.abs(g)));
    const t = B[b] ||= [0, 0, 0]; t[0]++; t[1] += rows.filter(d => d.side === under).reduce((a, d) => a + d.y, 0); t[2] += rows.reduce((a, d) => a + d.y, 0); }
  for (const [b, [n, u, t]] of Object.entries(B)) console.log(`divario ${b * 100}-${b * 100 + 99}${b == 3 ? '+' : ''}: ${n} partite, sfavorita ${(100 * u / t).toFixed(0)}% dei gialli, ${(t / n).toFixed(2)} gialli titolari a partita`); }
console.log('\n— Gialli a partita per competizione —');
{ const C = {}; for (const m of all.filter(m => INT.has(m.lg) || m.lg === 42)) { const c = C[m.lg] ||= [0, 0]; c[0]++; c[1] += m.cards.filter(k => k[2] !== 'Red').length; }
  for (const [k, [n, y]] of Object.entries(C)) console.log(k, n, 'partite', (y / n).toFixed(2), 'gialli a partita'); }
console.log('\n— Variabili sulla Champions (controllo: allena e prova sulla Champions) —');
const onUonly = y => U.filter(d => d.ts < yts(y));
evaluate('Champions base', onUonly, U, BASE); evaluate('Champions + sfavorita', onUonly, U, FEATS.sfavorita); evaluate('Champions base + correzione sfavorita', onUonly, U, BASE, underdog);

console.log('\n— Curva della correzione sulle nazionali (quota sfavorita = a + b·divario/100, massimo) —');
for (const [a, b, cap] of [[.515, .033, .64], [.515, .033, .75], [.5, .05, .75], [.5, .065, .8], [.49, .08, .8], [.48, .1, .85]]) evaluate(`a ${a} b ${b} max ${cap}`, onU, N, BASE, mkUnderdog(a, b, cap));

console.log('\n— Variabili "aleatorie": orario, giorno, mese, età (nazionali e Champions) —');
const AGE = {}; for (const m of all) for (const r of m.pl) AGE[m.id + '|' + r[0]] = r[14];
const hr = d => new Date(d.ts * 1000).getUTCHours(), wd = d => new Date(d.ts * 1000).getUTCDay(), mo = d => new Date(d.ts * 1000).getUTCMonth();
const ALEA = {
  sera: [...BASE, d => hr(d) >= 18 ? 1 : 0],
  weekend: [...BASE, d => [0, 6].includes(wd(d)) ? 1 : 0],
  fine_stagione: [...BASE, d => [2, 3, 4, 5].includes(mo(d)) ? 1 : 0],
  eta: [...BASE, d => { const a = AGE[d.mid + '|' + d.pid]; return a ? (a - 27) / 5 : 0; }, d => { const a = AGE[d.mid + '|' + d.pid]; return a ? ((a - 27) / 5) ** 2 : 0; }],
};
for (const [k, f] of Object.entries(ALEA)) { evaluate(`nazionali + ${k}`, onU, N, f, underdog); evaluate(`Champions + ${k}`, onUonly, U, f); }
