// cup_x3.js — modello coppe v4 (4/11/2026, pomeriggio): + palloni persi per 90' del giocatore (da deep_feats.js, stato finale __X3ST).
// Con le stagioni vecchie dei campionati esteri (+9.061 partite) e le statistiche extra, test temporale UCL (16.140 titolari):
//   v3 (dati vecchi, K 600) log loss .41854, top3 .705 per partita → v3 (dati nuovi) .41618, .750 → + palloni persi: dll −0,00033, top3 +0,010 ± 0,010.
// Provati e scartati: dribbling riusciti/tentati degli avversari di zona (odrib top3 −0,011 ± 0,007), tocchi (peggio), recuperi (zero), intercetti (−0,00025 ma top3 −0,006).
// Uso: dopo ammBuild() e await deepFeatBuild(): cupX3Build() → __CUPM5, patch di cupPredict3, window.__CUPM3 = __CUPM5.
window.cupX3Build = () => {
  const { P, MU, K } = window.__X3ST, rate = (p, f, role) => { const m = MU[role]?.[f] || 1e-3; return ((p?.[f] || 0) + m * K / 90) / ((p?.xm || 0) + K) * 90 / m; };
  window.cupX3 = (id, role) => ({ disp: rate(P[id], 'disp', MU[role] ? role : 'M') });
  const Lg = v => Math.log(Math.max(.05, v ?? 1));
  window.__CFS5 = [...__CFS4, d => Lg(d.x3?.disp)];
  const R = __CROWS2.filter(d => d.lg === 42 && d.ex && d.x2 && d.x3), base = fitLogit(R, __CFS5, 2);
  const rec = R.filter(d => ['2025/2026', '2026/2027'].includes(d.season)), obs = rec.reduce((a, d) => a + d.y, 0) / rec.length;
  const mk = sh => d => { const p = base.pred(d); return 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + sh))); };
  let lo = -1, hi = 1; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, mp = rec.reduce((a, d) => a + mk(mid)(d), 0) / rec.length; if (mp > obs) hi = mid; else lo = mid; }
  const shift = (lo + hi) / 2; window.__CUPM5 = { b: base.b, shift, pred: mk(shift) };
  let s = cupPredict3.toString(); if (!s.includes('cupX3')) { s = s.replace("x2: cupX2(x.id, role),", "x2: cupX2(x.id, role), x3: cupX3(x.id, role),"); window.cupPredict3 = eval('(' + s + ')'); }
  window.__CUPM3 = window.__CUPM5; return { righe: R.length, shift: +shift.toFixed(4), b_disp: +base.b[base.b.length - 1].toFixed(3), patch: s.includes('cupX3') };
};
