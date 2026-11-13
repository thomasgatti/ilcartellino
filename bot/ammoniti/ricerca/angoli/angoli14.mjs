// «Almeno 14 angoli» nella partita: prova sul passato (13/11/2026). Stesso codice della sezione Angoli (cloud/angoli_modello.mjs).
// Per ogni stagione di prova il modello è allenato solo sulle stagioni precedenti e ogni gara vede solo le gare giocate prima.
// Confronto con la frequenza della competizione nelle ultime 380 gare (il riferimento da battere).
// Uso: node bot/ammoniti/ricerca/angoli/angoli14.mjs <cartella extra> [soglia]
import { loadExtra, walk, train, SOGLIA } from '../../../../cloud/angoli_modello.mjs';

const DIR = process.argv[2] || 'dati/extra', S = +(process.argv[3] || SOGLIA);
const NOMI = { 55: 'Serie A', 42: 'Champions', 47: 'Premier', 87: 'LaLiga', 54: 'Bundesliga', 53: 'Ligue 1' };
const ms = loadExtra(DIR);
const ll = (p, y) => -(y ? Math.log(p) : Math.log(1 - p));
const auc = P => { const pos = P.filter(x => x[1]), neg = P.filter(x => !x[1]); if (!pos.length || !neg.length) return NaN; let s = 0; for (const a of pos) for (const b of neg) s += a[0] > b[0] ? 1 : a[0] === b[0] ? .5 : 0; return s / pos.length / neg.length; };
const f3 = v => v.toFixed(4).replace('.', ',');

for (const [nome, opts] of [['solo media di competizione', { variante: 0 }], ['+ angoli delle squadre', { variante: 1 }], ['+ tiri, tocchi in area, xG, possesso', { variante: 2 }], ['come sopra, ultime 20 gare', { variante: 2, n: 20 }]]) {
  console.log(`\n### Variante: ${nome} (soglia ${S}+)`);
  const all = [];
  for (const season of [2023, 2024, 2025, 2026]) {
    const tr = walk(ms.filter(m => m.season < season), opts).rows; if (tr.length < 2000) continue;
    const M = train(tr, S);
    // seconda passata: frequenza di riferimento «prima della partita»
    const seen = {}, base = {};
    for (const m of ms) { const L = (seen[m.lg] ||= []); if (m.season === season) { const X = L.slice(-380); base[m.id] = X.length >= 100 ? (X.filter(t => t >= S).length + 2) / (X.length + 16) : null; } L.push(m.t.angoli[0] + m.t.angoli[1]); }
    for (const r of walk(ms.filter(m => m.season <= season), opts).rows.filter(r => r.m.season === season)) {
      if (base[r.m.id] == null) continue; const p = M.pred(r.f); all.push({ lg: r.m.lg, season, y: r.yh + r.ya >= S ? 1 : 0, p: p.p, nb: p.nb, b: base[r.m.id], mu: p.mh + p.ma, tot: r.yh + r.ya });
    }
  }
  const riga = (et, A) => { if (A.length < 30) return; const n = A.length, y = A.reduce((s, x) => s + x.y, 0);
    const L = k => A.reduce((s, x) => s + ll(x[k], x.y), 0) / n; const top = [...A].sort((a, b) => b.p - a.p).slice(0, Math.max(1, Math.round(n / 10)));
    console.log(`${et.padEnd(22)} gare ${String(n).padStart(5)} · 14+ ${(100 * y / n).toFixed(1).padStart(4)}% · log loss rif. ${f3(L('b'))} · bin.neg. ${f3(L('nb'))} · modello ${f3(L('p'))} (Δ ${f3(L('p') - L('b'))}) · AUC ${auc(A.map(x => [x.p, x.y])).toFixed(3)} · 10% più alto: ${(100 * top.reduce((s, x) => s + x.y, 0) / top.length).toFixed(1)}% (atteso ${(100 * top.reduce((s, x) => s + x.p, 0) / top.length).toFixed(1)}%)`); };
  for (const season of [2023, 2024, 2025, 2026]) riga(`tutte ${season}/${season - 1999}`, all.filter(x => x.season === season));
  for (const lg of Object.keys(NOMI)) riga(NOMI[lg], all.filter(x => x.lg === lg));
  for (const lg of ['55', '42']) for (const season of [2024, 2025, 2026]) riga(`${NOMI[lg]} ${season}/${season - 1999}`, all.filter(x => x.lg === lg && x.season === season));
  riga('TUTTE', all);
  // taratura per fasce di probabilità
  const fasce = [[0, .08], [.08, .12], [.12, .16], [.16, .22], [.22, 1]];
  console.log('taratura: ' + fasce.map(([a, b]) => { const A = all.filter(x => x.p >= a && x.p < b); return A.length ? `${Math.round(a * 100)}-${Math.round(b * 100)}%: ${A.length} gare, previsto ${(100 * A.reduce((s, x) => s + x.p, 0) / A.length).toFixed(1)}%, reale ${(100 * A.reduce((s, x) => s + x.y, 0) / A.length).toFixed(1)}%` : ''; }).filter(Boolean).join(' · '));
}
