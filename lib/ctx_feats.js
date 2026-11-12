// ctx_feats.js — contesto della partita nei modelli (12/11/2026, dati recuperati: quote football-data.co.uk e possesso FotMob).
// Test in bot/ammoniti/ricerca/tris/candidati2.mjs (prova 2023/24 → 2026/27, solo partite precedenti):
//   Serie A: forza dalle quote 1X2 senza margine, con segno (logit p propria vittoria − logit p avversaria, parte positiva e negativa):
//            log loss −0,00027, top3 +0,004 ± 0,006, in calo in tutte e 4 le stagioni. (Il divario Elo con segno non dava nulla.)
//   Champions v4: possesso atteso della propria squadra (medie delle ultime 10 partite delle due squadre): −0,00074, top3 −0,014 ± 0,015,
//            in calo in tutte e 4 le stagioni (anche sul v3: −0,00074, top3 +0,005). In Serie A il possesso non aggiunge nulla.
// Dati: window.__CTX = { quote: Map(id → {p:[c,x,t]}), poss: Map(id → [c,t]) } preparato dal cloud (cloud/contesto.mjs). Senza __CTX non fa nulla.
// In partita: quote 1X2 di FotMob (fmOdds, già chiamata da saExport/cupExport3 prima della stima), possesso dalle ultime 10 dell'archivio.
window.ctxBuild = () => {
  const C = window.__CTX; if (!C || !C.poss?.size) return { saltato: 'nessun contesto' };
  const lg2 = p => Math.log(p / (1 - p)), clip = p => Math.min(.97, Math.max(.03, p));
  const sgOf = (p, home) => { const own = clip(home ? p[0] : p[2]), opp = clip(home ? p[2] : p[0]), s = lg2(own) - lg2(opp); return [Math.max(0, s), Math.max(0, -s)]; };
  // possesso medio delle ultime 10 per squadra, prima di ogni partita
  const TP = new Map(), PRE = new Map(), avg = t => { const a = TP.get(t) || []; return a.length >= 3 ? a.reduce((s, x) => s + x, 0) / a.length : 50; };
  for (const m of [...cupAll()].sort((a, b) => a.ts - b.ts || a.id - b.id)) {
    PRE.set(+m.id, [avg(m.h[0]), avg(m.a[0])]);
    const ps = C.poss.get(+m.id); if (ps) for (const [t, v] of [[m.h[0], ps[0]], [m.a[0], ps[1]]]) { const a = TP.get(t) || []; a.push(v); if (a.length > 10) a.shift(); TP.set(t, a); }
  }
  const possF = (ph, pa, home) => (50 - (home ? (ph + 100 - pa) / 2 : (pa + 100 - ph) / 2)) / 10;
  window.ctxPossNow = (hid, aid, home) => possF(avg(hid), avg(aid), home);
  window.__ODDSNOW = window.__ODDSNOW || {};
  window.ctxOddsNow = (mid, home) => { const p = __ODDSNOW[mid] || __ODDSNOW[+mid]; return p && p.every(x => x > 0) ? sgOf(p.map(x => x / 100), home) : [0, 0]; };
  if (!window.fmOdds.__ctx) { const o = window.fmOdds; window.fmOdds = async ids => { const r = await o(ids); for (const [id, v] of Object.entries(r || {})) if (v?.p) __ODDSNOW[id] = v.p; return r; }; window.fmOdds.__ctx = true; }
  const st = {};
  // Serie A: quote
  let nq = 0; for (const d of __ROWS) { const q = C.quote.get(+d.mid); d.ctxq = q ? sgOf(q.p, d.home) : [0, 0]; if (q) nq++; }
  if (!__FS_SA3.__ctx) { const h = __FS_SA3.__hot; window.__FS_SA3 = [...__FS_SA3, d => d.ctxq?.[0] ?? 0, d => d.ctxq?.[1] ?? 0]; __FS_SA3.__ctx = true; __FS_SA3.__hot = h; }
  window.__SAM3 = fitLogit(__ROWS.filter(d => d.season >= '2021/2022'), __FS_SA3, 2);
  let f = fmPredict3.toString();
  if (!f.includes('ctxOddsNow')) { f = f.replace('const d = { ', 'const d = { ctxq: ctxOddsNow(matchId, x.side), '); window.fmPredict3 = eval('(' + f + ')'); }
  st.sa = { righe_con_quote: nq, su: __ROWS.length, coeff: __SAM3.b.slice(-2).map(x => +x.toFixed(3)), patch: f.includes('ctxOddsNow') };
  // Champions v4: possesso atteso
  let np = 0; for (const d of __CROWS2) { const pr = PRE.get(+d.mid); d.ctxp = pr ? possF(pr[0], pr[1], d.home) : 0; if (pr && (pr[0] !== 50 || pr[1] !== 50)) np++; }
  if (!__CFS5.__ctx) { window.__CFS5 = [...__CFS5, d => d.ctxp ?? 0]; __CFS5.__ctx = true; }
  const R = __CROWS2.filter(d => d.lg === 42 && d.ex && d.x2 && d.x3), base = fitLogit(R, __CFS5, 2);
  const rec = R.filter(d => ['2025/2026', '2026/2027'].includes(d.season)), obs = rec.reduce((a, d) => a + d.y, 0) / rec.length;
  const mk = sh => d => { const p = base.pred(d); return 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + sh))); };
  let lo = -1, hi = 1; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2, mp = rec.reduce((a, d) => a + mk(mid)(d), 0) / rec.length; if (mp > obs) hi = mid; else lo = mid; }
  const shift = (lo + hi) / 2; window.__CUPM5 = window.__CUPM3 = { b: base.b, shift, pred: mk(shift) };
  let s = cupPredict3.toString();
  if (!s.includes('ctxPossNow')) { s = s.replace('x2: cupX2(x.id, role),', 'x2: cupX2(x.id, role), ctxp: ctxPossNow(H[0].id, H[1].id, x.side),'); window.cupPredict3 = eval('(' + s + ')'); }
  st.ucl = { righe_con_possesso: np, su: __CROWS2.length, coeff: +base.b[base.b.length - 1].toFixed(3), shift: +shift.toFixed(4), patch: s.includes('ctxPossNow') };
  return st;
};
