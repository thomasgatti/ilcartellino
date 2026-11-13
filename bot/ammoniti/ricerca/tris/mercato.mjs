// Modello contro mercato (13/11): quote "giocatore ammonito" archiviate da OddsPapi (dati/quote_giocatori) contro le probabilità
// fuori campione del modello (Serie A __FS_SA3, Champions __CFS3, allenati sulle stagioni precedenti) sui titolari della stagione 2026/27.
// Esito = giallo, secondo giallo o rosso del giocatore (come il mercato). Mercato: p = (1/quota)/k, k unico per bookmaker stimato sui dati
// (toglie il margine). Confronto: log loss, AUC, ammoniti tra i primi 3 per partita; miscela in logit con peso w.
// Uso: node --max-old-space-size=7000 mercato.mjs
import fs from 'node:fs'; import path from 'node:path';
import { boot } from './boot.mjs';
const DATI = process.env.DATI || '/home/claude/datib/fotmob', Q = path.join(path.dirname(DATI), 'quote_giocatori');
const { all } = await boot(DATI);
const M = new Map(all.map(m => [+m.id, m])), CARD = new Set(['Yellow', 'YellowRed', 'Red']), fitLogit = globalThis.fitLogit;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const key = full => { const w = norm(full).split(' '); return w.length > 1 ? w[0][0] + ' ' + w.slice(1).join(' ') : w[0]; };
const keyQ = s => { const [sur, giv = ''] = String(s).split(',').map(norm); return giv ? giv[0] + ' ' + sur : sur; };
const lg = p => Math.log(p / (1 - p)), sg = z => 1 / (1 + Math.exp(-z));
for (const [comp, rows, fs0, min, file] of [['Serie A', globalThis.__ROWS, globalThis.__FS_SA3, '2021/2022', 'sa_2026-2027.json'], ['Champions', globalThis.__CROWS2.filter(d => d.lg === 42), globalThis.__CFS3, null, 'ucl_2026-2027.json']]) {
  const qf = path.join(Q, file); if (!fs.existsSync(qf)) { console.log(comp, ': nessun archivio quote'); continue; }
  const QS = JSON.parse(fs.readFileSync(qf, 'utf8'));
  const mdl = fitLogit(rows.filter(d => d.season < '2026/2027' && (!min || d.season >= min)), fs0, 2);
  const te = rows.filter(d => d.season === '2026/2027' && QS[d.mid]?.q);
  for (const book of ['bet365.it', 'eurobet.it', 'betfred', 'betway', 'paddypower', 'sisal.it', 'migliore']) {
    const R = [];
    for (const d of te) {
      const rec = QS[d.mid], m = M.get(+d.mid); if (!m) continue;
      const pick = b => { const q = rec.q[b]; if (!q) return null; const k = key(d.name); const hit = Object.entries(q).find(([n]) => keyQ(n) === k); return hit ? hit[1][0] : null; };
      const price = book === 'migliore' ? Math.max(...['bet365.it', 'eurobet.it', 'betfred', 'betway', 'paddypower', 'sisal.it'].map(pick).filter(Boolean), 0) || null : pick(book);
      if (!price) continue;
      const y = (m.cards || []).some(c => +c[0] === +d.pid && CARD.has(c[2])) ? 1 : 0;
      R.push({ mid: d.mid, y, pm: Math.min(.95, Math.max(.01, mdl.pred(d))), inv: 1 / price });
    }
    if (R.length < 200) { console.log(`${comp} · ${book}: ${R.length} giocatori, troppo pochi`); continue; }
    const k = R.reduce((a, x) => a + x.inv, 0) / R.reduce((a, x) => a + x.y, 0);   // margine medio (k > 1)
    for (const x of R) x.pq = Math.min(.95, Math.max(.01, x.inv / k));
    const ll = f => -R.reduce((a, x) => { const p = f(x); return a + (x.y ? Math.log(p) : Math.log(1 - p)); }, 0) / R.length;
    const auc = f => { const P = R.filter(x => x.y).map(f), N = R.filter(x => !x.y).map(f); let s = 0; for (const a of P) for (const b of N) s += a > b ? 1 : a === b ? .5 : 0; return s / (P.length * N.length); };
    const top3 = f => { const by = {}; for (const x of R) (by[x.mid] ||= []).push(x); const v = Object.values(by).filter(a => a.length >= 10).map(a => [...a].sort((p, q) => f(q) - f(p)).slice(0, 3).reduce((s, x) => s + x.y, 0)); return [v.reduce((a, b) => a + b, 0) / v.length, v.length]; };
    const blend = w => x => sg((1 - w) * lg(x.pm) + w * lg(x.pq));
    const out = [['modello', x => x.pm], ['mercato', x => x.pq], ['miscela 0,3', blend(.3)], ['miscela 0,5', blend(.5)], ['miscela 0,7', blend(.7)]]
      .map(([n, f]) => `${n}: LL ${ll(f).toFixed(4)} AUC ${auc(f).toFixed(3)} top3 ${top3(f)[0].toFixed(3)}`);
    console.log(`\n${comp} · ${book}: ${R.length} giocatori in ${top3(x => x.pm)[1]} partite, ammoniti ${R.filter(x => x.y).length}, margine k ${k.toFixed(2)}\n  ` + out.join('\n  '));
  }
}
