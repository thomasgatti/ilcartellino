// v0.5 — storico partita per partita del giocatore: forma recente, minuti attesi da titolare,
// conversione fallo->giallo, interazioni (arbitro x aggressività, linea cartellini x aggressività, squadra sfavorita x difensore)
function patchBuild5() {
  let src = buildV03.toString()
    .replace('data.push({ eid, mi,', 'data.push({ eid, mi, pid: r[2], hx: h ? h[0] : null, hy: h ? h[1] : null, hist: p.hist.slice(-8),')
    .replace("pending: false, returning: false };", "pending: false, returning: false, hist: [] };")
    .replace('p.returning = false; p.pending =', 'p.hist.push([r[6], r[7], r[13], r[5]]); p.returning = false; p.pending =');
  return eval('(' + src + ')');
}
function extraFeats(G) {
  const last = (d, n) => (d.hist || []).slice(-n);
  const r5f = d => { const a = last(d, 5); const m = a.reduce((s, x) => s + x[0], 0), f = a.reduce((s, x) => s + x[1], 0); return (f + 1.3 * 2.5) / (m + 225) * 90; };
  const r5y = d => { const a = last(d, 5); const m = a.reduce((s, x) => s + x[0], 0), y = a.reduce((s, x) => s + x[2], 0); return (y + 0.17 * 2.5) / (m + 225) * 90; };
  const minStart = d => { const a = (d.hist || []).filter(x => x[3]).slice(-8); return a.length ? a.reduce((s, x) => s + x[0], 0) / a.length : 78; };
  const cpf = d => Math.log((d.ycr + 0.05) / (d.flr + 0.3)); // gialli per fallo (relativo)
  return {
    forma_recente: [d => Math.log(r5f(d)), d => r5y(d)],
    minuti_attesi: [d => minStart(d)],
    falli_giallo: [cpf],
    interazioni: [d => Math.log(d.ycr) * d.ref, d => Math.log(d.flr) * Math.log(d.lam ?? 4), d => ((d.pO ?? 0.35) - (d.pT ?? 0.35)) * (d.pos === 'D' ? 1 : 0)],
  };
}
