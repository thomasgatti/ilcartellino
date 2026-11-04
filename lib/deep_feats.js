// deep_feats.js — variabili dalle statistiche extra (amm_xs) per il modello coppe, calcolate SOLO con le partite precedenti.
// odrib = dribbling riusciti per 90' degli avversari che giocano nella sua zona (pesati per vicinanza delle posizioni abituali, come "facing")
// odatt = dribbling tentati degli stessi; own_int / own_rec / own_disp / own_tch = intercetti, recuperi, palloni persi, tocchi del giocatore.
// Tutto diviso per la media del ruolo, shrink 900'. Uso: await deepFeatBuild() → d.x3 sulle righe __CROWS2 della Champions.
window.deepFeatBuild = async () => {
  const XS = await idbAll(window.XDB || 'amm_xs', 'x'), A = cupAll(), ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M', K = 900;
  const F = ['ds', 'da', 'tch', 'int', 'rec', 'disp'], MU = {}, P = {}, OUT = {};
  for (const m of A) { const X = XS[m.id]; if (!X) continue; for (const r of m.pl) { if (r[5] < 30 || r[3] === 0 || !X[r[0]]) continue; const t = MU[ROLE(r[3])] ||= { min: 0, ds: 0, da: 0, tch: 0, int: 0, rec: 0, disp: 0 }; t.min += r[5]; F.forEach((f, i) => t[f] += X[r[0]][i]); } }
  for (const t of Object.values(MU)) F.forEach(f => t[f] = t[f] / t.min * 90);
  const rate = (p, f, role) => { const m = MU[role][f] || 1e-3; return ((p?.[f] || 0) + m * K / 90) / ((p?.xm || 0) + K) * 90 / m; };
  const habit = p => { if (!p || !p.xs.length) return null; const a = p.xs.slice(-8); return [a.reduce((s, x) => s + x[0], 0) / a.length, a.reduce((s, x) => s + x[1], 0) / a.length]; };
  for (const m of A) {
    const X = XS[m.id] || null;
    if (m.lg === 42) { const st = m.pl.filter(r => r[4] === 1 && r[3] !== 0);
      for (const r of st) { const p = P[r[0]], role = ROLE(r[3]), h = habit(p); let sw = 0, sd = 0, sa = 0;
        if (h) for (const o of st) { if (o[2] === r[2]) continue; const po = P[o[0]], ho = habit(po); if (!ho) continue; const d = Math.hypot(h[0] - (1 - ho[0]), h[1] - (1 - ho[1])), w = Math.exp(-d / .12), ro = ROLE(o[3]); sw += w; sd += w * rate(po, 'ds', ro); sa += w * rate(po, 'da', ro); }
        OUT[m.id + '|' + r[0]] = { odrib: sw ? sd / sw : 1, odatt: sw ? sa / sw : 1, int: rate(p, 'int', role), rec: rate(p, 'rec', role), disp: rate(p, 'disp', role), tch: rate(p, 'tch', role) }; } }
    for (const r of m.pl) { if (!r[5] || r[3] === 0) continue; const p = P[r[0]] ||= { xm: 0, ds: 0, da: 0, tch: 0, int: 0, rec: 0, disp: 0, xs: [] };
      if (X && X[r[0]]) { p.xm += r[5]; F.forEach((f, i) => p[f] += X[r[0]][i]); } if (r[12] != null) p.xs.push([r[12], r[13]]); }
  }
  let n = 0; for (const d of __CROWS2) { const x = OUT[d.mid + '|' + d.pid]; if (x) { d.x3 = x; n++; } }
  window.__X3ST = { P, MU, K }; return { righe: n, partite_con_extra: Object.keys(XS).length };
};
