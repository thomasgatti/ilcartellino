// hot_feats.js — «testa calda» come variabile continua del modello Serie A (idea 14 del documento «100 idee», test 12/11/2026
// in bot/ammoniti/ricerca/tris/candidati.mjs: log loss −0,00023 su 4 stagioni di prova, tutte in calo; top3 −0,003 ± 0,008).
// z = (gialli − gialli attesi dai propri falli) / √(attesi + 1), ultimi 3 anni, tutte le competizioni dell'archivio, con il tasso
// gialli/fallo della lega e del ruolo calcolato solo sulle partite precedenti; limitato a ±3. Solo Serie A: nel modello Champions v4 non passa.
// Uso: dopo ammBuild() → hotBuild(): aggiunge d.hot alle righe __ROWS, rifà __SAM3 con la variabile e la passa a fmPredict3.
window.hotBuild = () => {
  const A = cupAll(), ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M', Y3 = 3 * 365 * 86400, CARD = new Set(['Yellow', 'YellowRed']);
  const P = new Map(), LR = {}, H = new Map();
  const zOf = (ev, now) => { let y = 0, e = 0;
    for (const x of ev) { if (x[0] < now - Y3) continue; y += x[1]; const lr = LR[x[3] + '|' + x[4]]; e += x[2] * (lr && lr[1] > 300 ? lr[0] / lr[1] : .18); }
    return e > 0 ? Math.max(-3, Math.min(3, (y - e) / Math.sqrt(e + 1))) : 0; };
  for (const m of A) {
    const booked = new Set((m.cards || []).filter(c => CARD.has(c[2])).map(c => +c[0]));
    if (m.lg === 55) for (const r of m.pl) if (r[4] === 1 && r[3] !== 0) { const p = P.get(+r[0]); H.set(m.id + '|' + r[0], p ? zOf(p, m.ts) : 0); }
    for (const r of m.pl) {
      if (r[3] === 0 || !((r[5] || 0) > 0)) continue;
      const role = ROLE(r[3]), y = booked.has(+r[0]) ? 1 : 0, f = +r[6] || 0;
      const ev = P.get(+r[0]) || []; ev.push([m.ts, y, f, m.lg, role]); if (ev.length > 200) ev.shift(); P.set(+r[0], ev);
      const lr = LR[m.lg + '|' + role] ||= [0, 0]; lr[0] += y; lr[1] += f;
    }
  }
  window.__HOT = H; window.hotNow = id => { const ev = P.get(+id); return ev ? zOf(ev, Date.now() / 1000) : 0; };
  let n = 0; for (const d of __ROWS) { d.hot = H.get(d.mid + '|' + d.pid) ?? 0; if (d.hot) n++; }
  if (!__FS_SA3.__hot) { window.__FS_SA3 = [...__FS_SA3, d => d.hot ?? 0]; __FS_SA3.__hot = true; }
  window.__SAM3 = fitLogit(__ROWS.filter(d => d.season >= '2021/2022'), __FS_SA3, 2);
  let f = fmPredict3.toString();
  if (!f.includes('hotNow')) { f = f.replace('const d = { ex: EXM[x.id] || EXM[+x.id], role, yc:', 'const d = { hot: hotNow(x.id), ex: EXM[x.id] || EXM[+x.id], role, yc:'); window.fmPredict3 = eval('(' + f + ')'); }
  return { righe: __ROWS.length, con_storico: n, coeff: +__SAM3.b[__SAM3.b.length - 1].toFixed(3), patch: f.includes('hotNow') };
};
