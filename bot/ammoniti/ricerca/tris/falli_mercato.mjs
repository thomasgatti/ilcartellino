// Quote sui falli del giocatore (OddsPapi, archivio v2) come aiuto al modello (13/11).
// Lo storico delle quote c'è solo per il 2026/27, quindi niente allenamento sulle stagioni passate: si parte dalla probabilità
// fuori campione del modello (allenato fino al 2025/26) e si ricalibra sul 2026/27 con validazione incrociata per partita (5 gruppi):
//   base:   y ~ logit(p modello)
//   falli:  y ~ logit(p modello) + logit(p almeno 2 falli) [+ logit(p almeno 1 fallo)]
//   carta:  y ~ logit(p modello) + logit(p mercato "ammonito")
//   tutto:  le tre insieme
// Mercato: probabilità implicita media dei bookmaker disponibili, senza togliere il margine (lo assorbe la ricalibrazione).
// Uso: node --max-old-space-size=7000 falli_mercato.mjs
import fs from 'node:fs'; import path from 'node:path';
import { boot } from './boot.mjs';
const DATI = process.env.DATI || '/home/claude/datib/fotmob', Q = path.join(path.dirname(DATI), 'quote_giocatori');
const { all } = await boot(DATI);
const M = new Map(all.map(m => [+m.id, m])), CARD = new Set(['Yellow', 'YellowRed', 'Red']), fitLogit = globalThis.fitLogit;
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const key = full => { const w = norm(full).split(' '); return w.length > 1 ? w[0][0] + ' ' + w.slice(1).join(' ') : w[0]; };
const keyQ = s => { const [sur, giv = ''] = String(s).split(',').map(norm); return giv ? giv[0] + ' ' + sur : sur; };
const lg = p => { p = Math.min(.97, Math.max(.03, p)); return Math.log(p / (1 - p)); };
const meanImp = arr => arr.length ? arr.reduce((a, q) => a + 1 / q, 0) / arr.length : null;
for (const [comp, rows, fs0, min, file] of [['Serie A', globalThis.__ROWS, globalThis.__FS_SA3, '2021/2022', 'sa_2026-2027.json'], ['Champions', globalThis.__CROWS2.filter(d => d.lg === 42), globalThis.__CFS3, null, 'ucl_2026-2027.json']]) {
  const QS = JSON.parse(fs.readFileSync(path.join(Q, file), 'utf8'));
  const mdl = fitLogit(rows.filter(d => d.season < '2026/2027' && (!min || d.season >= min)), fs0, 2);
  const R = [];
  for (const d of rows.filter(d => d.season === '2026/2027')) {
    const rec = QS[d.mid], m = M.get(+d.mid); if (!rec?.f || !m) continue;
    const k = key(d.name), find = obj => Object.entries(obj || {}).find(([n]) => keyQ(n) === k)?.[1];
    const f1 = [], f2 = [], cq = [];
    for (const b of Object.keys(rec.f)) { const f = find(rec.f[b]); if (f?.f1?.[0]) f1.push(f.f1[0]); if (f?.f2?.[0]) f2.push(f.f2[0]); }
    for (const b of Object.keys(rec.q || {})) { const c = find(rec.q[b]); if (c?.[0]) cq.push(c[0]); }
    if (!f2.length) continue;
    const y = (m.cards || []).some(c => +c[0] === +d.pid && CARD.has(c[2])) ? 1 : 0;
    R.push({ mid: d.mid, y, zm: lg(mdl.pred(d)), zf2: lg(meanImp(f2)), zf1: f1.length ? lg(meanImp(f1)) : lg(meanImp(f2)) + 1, zc: cq.length ? lg(meanImp(cq)) : null });
  }
  const mids = [...new Set(R.map(x => x.mid))].sort((a, b) => a - b), fold = new Map(mids.map((id, i) => [id, i % 5]));
  const variants = { base: [x => x.zm], 'falli (2+)': [x => x.zm, x => x.zf2], 'falli (1+ e 2+)': [x => x.zm, x => x.zf2, x => x.zf1] };
  const RC = R.filter(x => x.zc != null);
  const variantsC = { base: [x => x.zm], 'ammonito (mercato)': [x => x.zm, x => x.zc], 'ammonito + falli': [x => x.zm, x => x.zc, x => x.zf2] };
  const cv = (S, fs) => { let ll = 0; const pr = new Map();
    for (let f = 0; f < 5; f++) { const tr = S.filter(x => fold.get(x.mid) !== f), te = S.filter(x => fold.get(x.mid) === f), mm = fitLogit(tr, fs, 1);
      for (const x of te) { const p = Math.min(.999, Math.max(.001, mm.pred(x))); ll -= x.y ? Math.log(p) : Math.log(1 - p); pr.set(x, p); } }
    const by = {}; for (const x of S) (by[x.mid] ||= []).push(x);
    const t3 = Object.values(by).filter(a => a.length >= 10).map(a => [...a].sort((p, q) => pr.get(q) - pr.get(p)).slice(0, 3).reduce((s, x) => s + x.y, 0));
    return { ll: ll / S.length, t3: t3.reduce((a, b) => a + b, 0) / t3.length, n3: t3.length, per: Object.values(by).filter(a => a.length >= 10).map(a => [...a].sort((p, q) => pr.get(q) - pr.get(p)).slice(0, 3).reduce((s, x) => s + x.y, 0)) }; };
  const report = (S, V, title) => {
    console.log(`\n== ${comp} · ${title}: ${S.length} titolari, ${new Set(S.map(x => x.mid)).size} partite, ammoniti ${S.filter(x => x.y).length} ==`);
    const base = cv(S, V.base);
    for (const [n, fs] of Object.entries(V)) { const r = cv(S, fs), d = r.per.map((v, i) => v - base.per[i]), mu = d.reduce((a, b) => a + b, 0) / d.length, se = Math.sqrt(d.reduce((a, b) => a + (b - mu) ** 2, 0) / (d.length - 1) / d.length);
      console.log(`${n.padEnd(20)} LL ${r.ll.toFixed(4)} (Δ ${(r.ll - base.ll >= 0 ? '+' : '') + (r.ll - base.ll).toFixed(4)})  top3 ${r.t3.toFixed(3)} (Δ ${mu >= 0 ? '+' : ''}${mu.toFixed(3)} ± ${se.toFixed(3)})`); }
  };
  report(R, variants, 'quote sui falli');
  if (RC.length > 300) report(RC, variantsC, 'con quota ammonito');
}
