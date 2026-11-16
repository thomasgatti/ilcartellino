// «Almeno 14 angoli» per le nazionali (16/11/2026): il modello dei club regge anche qui?
// Archivio dati/extra_naz (Nations League, Europei, Mondiali, qualificazioni UEFA) sotto un'unica competizione «naz».
// Blocchi di prova per data; ogni blocco è stimato con un modello allenato solo sulle gare precedenti. Riferimento: frequenza delle nazionali nelle ultime 380 gare.
// Uso: node bot/ammoniti/ricerca/angoli/angoli14_naz.mjs <dati/extra> <dati/extra_naz>
import { loadExtra, walk, train, SOGLIA } from '../../../../cloud/angoli_modello.mjs';
const club = loadExtra(process.argv[2] || 'dati/extra'), naz = loadExtra(process.argv[3] || 'dati/extra_naz', null, 'naz');
const S = SOGLIA, ll = (p, y) => -(y ? Math.log(p) : Math.log(1 - p)), f4 = v => v.toFixed(4).replace('.', ',');
const auc = P => { const pos = P.filter(x => x[1]), neg = P.filter(x => !x[1]); let s = 0; for (const a of pos) for (const b of neg) s += a[0] > b[0] ? 1 : a[0] === b[0] ? .5 : 0; return s / pos.length / neg.length; };
console.log('nazionali in archivio:', naz.length, '· 14+:', (100 * naz.filter(m => m.t.angoli[0] + m.t.angoli[1] >= S).length / naz.length).toFixed(1) + '%', '· media angoli', (naz.reduce((s, m) => s + m.t.angoli[0] + m.t.angoli[1], 0) / naz.length).toFixed(2));
const T = d => Date.parse(d) / 1000, tagli = [T('2024-06-01'), T('2025-06-01'), T('2026-06-01'), T('2027-06-01')];
for (const [nome, opts, conClub, soloNaz] of [['modello dei club + nazionali, ultime 20', { variante: 2, n: 20 }, 1, 0], ['idem, ultime 10', { variante: 2, n: 10 }, 1, 0], ['solo angoli, ultime 20', { variante: 1, n: 20 }, 1, 0], ['allenato solo sulle nazionali, ultime 20', { variante: 2, n: 20 }, 0, 1]]) {
  const all = [...(conClub ? club : []), ...naz].sort((a, b) => a.ts - b.ts), out = [];
  const seen = [], base = {};
  for (const m of naz) { const X = seen.slice(-380); base[m.id] = X.length >= 100 ? (X.filter(t => t >= S).length + 2) / (X.length + 16) : null; seen.push(m.t.angoli[0] + m.t.angoli[1]); }
  const rows = walk(all, opts).rows;
  for (let k = 0; k < tagli.length - 1; k++) {
    const tr = rows.filter(r => r.m.ts < tagli[k] && (!soloNaz || r.m.lg === 'naz')); if (tr.length < 300) continue;
    const M = train(tr, S);
    for (const r of rows.filter(r => r.m.lg === 'naz' && r.m.ts >= tagli[k] && r.m.ts < tagli[k + 1])) { if (base[r.m.id] == null) continue; const p = M.pred(r.f); out.push({ k, y: r.yh + r.ya >= S ? 1 : 0, p: p.p, b: base[r.m.id] }); }
  }
  const riga = (et, A) => { if (A.length < 30) return; const n = A.length, L = q => A.reduce((s, x) => s + ll(x[q], x.y), 0) / n, top = [...A].sort((a, b) => b.p - a.p).slice(0, Math.round(n / 5));
    console.log(`  ${et.padEnd(10)} gare ${n} · 14+ ${(100 * A.reduce((s, x) => s + x.y, 0) / n).toFixed(1)}% (previsto ${(100 * A.reduce((s, x) => s + x.p, 0) / n).toFixed(1)}%) · log loss rif. ${f4(L('b'))} → ${f4(L('p'))} (Δ ${f4(L('p') - L('b'))}) · AUC ${auc(A.map(x => [x.p, x.y])).toFixed(3)} · 20% più alto: ${(100 * top.reduce((s, x) => s + x.y, 0) / top.length).toFixed(1)}%`); };
  console.log('### ' + nome); for (let k = 0; k < 3; k++) riga(['2024/25', '2025/26', '2026/27'][k], out.filter(x => x.k === k)); riga('TUTTE', out);
}
