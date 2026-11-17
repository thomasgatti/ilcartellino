// cup_x2.js — modello coppe v3 (4/11/2026): aggiunge al modello Champions due variabili di stile del giocatore,
// dai dati FotMob già scaricati (righe pl: r[8] duelli vinti, r[11] volte saltato in dribbling):
//   dp = volte saltato in dribbling per 90' (riportato alla media del ruolo, shrink 900')
//   dw = duelli vinti per 90' (stesso trattamento)  → giocatori "di contatto" che vengono superati: più falli tattici.
// Test temporale su 16.140 titolari UCL (2022/23→2025/26): log loss −0,00058, top3 +0,021 ± 0,020 (extPair). Coefficienti +0,25 (dp) e +0,47 (dw), in log.
// Provati e scartati nello stesso giro: capitano (O/E 1,08 vs 1,07, peggiora), gialli in Europa vs campionato, ultime giornate,
// duelli persi, contrasti, duelli vinti/saltati della squadra avversaria, forza_ruolo, sfavoriti non difensori.
// Uso (dopo extBuild/extMakeModels/extPatchPredict, con __CFS3 e __CUPM3 pronti): cupX2Build() → __CUPM4, patch di cupPredict3,
// e window.__CUPM3 = __CUPM4 così cupExport3 usa il nuovo modello (il vecchio resta in __CUPM3_OLD).
window.cupX2Build = () => {
  const A = cupAll(); const ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M'; const K = 900;
  const MEAN = {}; for (const m of A) if (!(m.ts >= window.__MEDIE_FINO)) for (const r of m.pl) {   // __MEDIE_FINO: limite di data per le medie di ruolo (solo ricerca; in produzione non è impostato)
  if (r[5] < 30 || r[3] === 0) continue; const t = MEAN[ROLE(r[3])] ||= [0, 0, 0]; t[0] += r[5]; t[1] += r[8]; t[2] += r[11]; }
  const mu = {}; for (const [k, t] of Object.entries(MEAN)) mu[k] = { dw: t[1] / t[0] * 90, dp: t[2] / t[0] * 90 };
  const rate = (p, f, role) => ((p?.[f] || 0) + mu[role][f] * K / 90) / ((p?.min || 0) + K) * 90 / mu[role][f];
  const P = {}, X = {};
  for (const m of A) {
    if (m.lg === 42) for (const r of m.pl) if (r[4] === 1 && r[3] !== 0) { const role = ROLE(r[3]); X[m.id + '|' + r[0]] = { dp: rate(P[r[0]], 'dp', role), dw: rate(P[r[0]], 'dw', role) }; }
    for (const r of m.pl) { if (!r[5] || r[3] === 0) continue; const p = P[r[0]] ||= { min: 0, dw: 0, dp: 0 }; p.min += r[5]; p.dw += r[8]; p.dp += r[11]; }
  }
  for (const d of __CROWS2) { const x = X[d.mid + '|' + d.pid]; if (x) d.x2 = x; }
  window.cupX2 = (id, role) => ({ dp: rate(P[id], 'dp', mu[role] ? role : 'M'), dw: rate(P[id], 'dw', mu[role] ? role : 'M') });
  const Lg = v => Math.log(Math.max(.05, v));
  window.__CFS4 = [...__CFS3, d => Lg(d.x2?.dp ?? 1), d => Lg(d.x2?.dw ?? 1)];
  const R = __CROWS2.filter(d => d.lg === 42 && d.ex && d.x2), base = fitLogit(R, __CFS4, 2);
  const rec = R.filter(d => ['2025/2026', '2026/2027'].includes(d.season)), obs = rec.reduce((a, d) => a + d.y, 0) / rec.length;
  const mk = sh => d => { const p = base.pred(d); return 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + sh))); };
  let lo = -1, hi = 1; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, mp = rec.reduce((a, d) => a + mk(mid)(d), 0) / rec.length; if (mp > obs) hi = mid; else lo = mid; }
  const shift = (lo + hi) / 2; window.__CUPM4 = { b: base.b, shift, pred: mk(shift) };
  let s = cupPredict3.toString(); if (!s.includes('cupX2')) { s = s.replace("const d = { ex: EXM[x.id] || EXM[+x.id], role,", "const d = { ex: EXM[x.id] || EXM[+x.id], x2: cupX2(x.id, role), role,"); window.cupPredict3 = eval('(' + s + ')'); }
  window.__CUPM3_OLD = window.__CUPM3_OLD || window.__CUPM3; window.__CUPM3 = window.__CUPM4;
  return { righe: R.length, shift: +shift.toFixed(4), b_dp_dw: base.b.slice(-2).map(x => +x.toFixed(3)) };
};
