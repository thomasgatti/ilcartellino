// Champions 2026/27: modello v4 di produzione (variabili __CFS5, allenato sulle stagioni precedenti) con e senza la miscela
// col mercato fatta come in produzione (market_blend.py: de-vig a potenza per partita sul totale del modello, peso 0,5,
// spostamento medio per chi non ha quota). Nessun parametro stimato sulle gare di prova.
// Quote: ultimo prezzo prima del via in dati/quote_giocatori (media delle probabilità implicite di Sisal, bet365.it, Eurobet, come m.qg).
// Uso: node --max-old-space-size=6500 miscela_produzione.mjs   (BOOKS=a,b per cambiare bookmaker)
import fs from 'node:fs'; import path from 'node:path';
import { boot } from './boot.mjs';
const DATI = process.env.DATI || '/home/claude/datib/fotmob', Q = path.join(path.dirname(DATI), 'quote_giocatori');
const { st, all } = await boot(DATI, { produzione: true });
console.log('ammBuild', JSON.stringify(st.ctx || st).slice(0, 300));
const fitLogit = globalThis.fitLogit, FS = globalThis.__CFS5;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const key = full => { const w = norm(full).split(' '); return w.length > 1 ? w[0][0] + ' ' + w.slice(1).join(' ') : w[0]; };
const keyQ = s => { const [sur, giv = ''] = String(s).split(',').map(norm); return giv ? giv[0] + ' ' + sur : sur; };
const lg = p => { p = Math.min(Math.max(p, 1e-4), 1 - 1e-4); return Math.log(p / (1 - p)); }, sg = z => 1 / (1 + Math.exp(-z));
const UC = globalThis.__CROWS2.filter(d => d.lg === 42 && d.ex && d.x2 && d.x3), UCall = globalThis.__CROWS2.filter(d => d.lg === 42);
const QS = JSON.parse(fs.readFileSync(path.join(Q, 'ucl_2026-2027.json'), 'utf8'));
const tr = UC.filter(d => d.season < '2026/2027'), te = UC.filter(d => d.season === '2026/2027');
const mdl = fitLogit(tr, FS, 2);
// spostamento di livello come in produzione, ma calcolato solo sul 2025/26 (prima delle gare di prova)
const cal = tr.filter(d => d.season === '2025/2026'); let sh = 0;
for (let i = 0; i < 40; i++) { const mu = cal.reduce((a, d) => a + sg(lg(mdl.pred(d)) + sh), 0) / cal.length, y = cal.reduce((a, d) => a + d.y, 0) / cal.length; sh += lg(y) - lg(mu); }
console.log('righe UCL v4:', UC.length, 'di', UCall.length, '· prova 2026/27:', te.length, 'in', new Set(te.map(d => d.mid)).size, 'partite · spostamento', sh.toFixed(4));
const BOOKS = (process.env.BOOKS || 'sisal.it,bet365.it,eurobet.it').split(',');
const by = {}; for (const d of te) (by[d.mid] ||= []).push(d);
const G = []; let senza = 0;
for (const [mid, rows] of Object.entries(by)) {
  const rec = QS[mid]; const R = rows.map(d => ({ y: d.y, pm: sg(lg(mdl.pred(d)) + sh), name: d.name }));
  if (rec?.q) for (const x of R) { const k = key(x.name), inv = [];
    for (const b of BOOKS) { const hit = Object.entries(rec.q[b] || {}).find(([n]) => keyQ(n) === k); if (hit?.[1]?.[0] > 1) inv.push(1 / hit[1][0]); }
    if (inv.length) x.inv = inv.reduce((a, b) => a + b, 0) / inv.length; }
  const mt = R.filter(x => x.inv);
  if (mt.length < 6) { senza++; G.push({ mid, R, cop: 0 }); for (const x of R) x.pb = { .3: x.pm, .5: x.pm, .7: x.pm }; continue; }
  const E = mt.reduce((a, x) => a + x.pm, 0); let lo = 0.2, hi = 6;
  for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2; if (mt.reduce((a, x) => a + x.inv ** k, 0) > E) lo = k; else hi = k; }
  const k = (lo + hi) / 2; for (const x of mt) x.pq = x.inv ** k;
  for (const x of R) x.pb = {};
  for (const w of [.3, .5, .7]) { const dz = mt.map(x => w * (lg(x.pq) - lg(x.pm))), d = dz.reduce((a, b) => a + b, 0) / dz.length;
    for (const x of R) x.pb[w] = x.pq ? sg((1 - w) * lg(x.pm) + w * lg(x.pq)) : sg(lg(x.pm) + d); }
  G.push({ mid, R, cop: mt.length / R.length, k });
}
const ll = (x, p) => -(x.y ? Math.log(p) : Math.log(1 - p));
const top3 = (R, f) => [...R].sort((a, b) => f(b) - f(a)).slice(0, 3).reduce((s, x) => s + x.y, 0);
function rep(nome, GG) {
  const n = GG.reduce((a, g) => a + g.R.length, 0), yy = GG.reduce((a, g) => a + g.R.reduce((s, x) => s + x.y, 0), 0), ep = GG.reduce((a, g) => a + g.R.reduce((s, x) => s + x.pm, 0), 0);
  console.log(`\n${nome}: ${GG.length} partite, ${n} titolari, ammoniti ${yy} (attesi dal modello ${ep.toFixed(1)}), copertura media quote ${(GG.reduce((a, g) => a + g.cop, 0) / GG.length * 100).toFixed(0)}%`);
  const L0 = GG.reduce((a, g) => a + g.R.reduce((s, x) => s + ll(x, x.pm), 0), 0) / n, T0 = GG.reduce((a, g) => a + top3(g.R, x => x.pm), 0) / GG.length;
  console.log(`  modello v4: LL ${L0.toFixed(4)} · ammoniti tra i primi 3 ${T0.toFixed(3)}`);
  for (const w of [.3, .5, .7]) {
    const dl = GG.map(g => [g.R.reduce((s, x) => s + ll(x, x.pb[w]) - ll(x, x.pm), 0), g.R.length, top3(g.R, x => x.pb[w]) - top3(g.R, x => x.pm)]);
    const D = dl.reduce((a, v) => a + v[0], 0) / n, T = dl.reduce((a, v) => a + v[2], 0) / GG.length;
    let s = 12345; const rnd = () => (s = (s * 1103515245 + 12345) % 2147483648) / 2147483648; const B = [], BT = [];
    for (let b = 0; b < 4000; b++) { let a = 0, m = 0, t = 0; for (let i = 0; i < dl.length; i++) { const v = dl[Math.floor(rnd() * dl.length)]; a += v[0]; m += v[1]; t += v[2]; } B.push(a / m); BT.push(t / dl.length); }
    B.sort((a, b) => a - b); BT.sort((a, b) => a - b);
    const camb = GG.filter(g => { const t = f => [...g.R].sort((a, b) => f(b) - f(a)).slice(0, 3).map(x => x.name).sort().join(); return t(x => x.pb[w]) !== t(x => x.pm); }).length;
    console.log(`  miscela ${w}${w === .5 ? ' (produzione)' : ''}: ΔLL ${D.toFixed(5)} [${B[100].toFixed(5)}; ${B[3899].toFixed(5)}] · Δprimi3 ${T.toFixed(3)} [${BT[100].toFixed(3)}; ${BT[3899].toFixed(3)}] · primi 3 diversi in ${camb} partite`);
  }
}
console.log('bookmaker:', BOOKS.join(', '), '· partite senza quote utili:', senza);
rep('Tutte le partite 2026/27', G); rep('Solo partite con quote', G.filter(g => g.cop > 0));
const h = G.filter(g => g.cop > 0).sort((a, b) => a.mid - b.mid); const ts = new Map(all.map(m => [String(m.id), m.ts])); h.sort((a, b) => ts.get(String(a.mid)) - ts.get(String(b.mid)));
rep('Con quote, prima metà (in ordine di data)', h.slice(0, Math.floor(h.length / 2))); rep('Con quote, seconda metà', h.slice(Math.floor(h.length / 2)));
