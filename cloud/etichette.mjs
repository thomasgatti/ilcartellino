// Etichette dei giocatori dall'archivio FotMob, condivise da giornata.mjs (Serie A, Champions, Nazionali) ed extra.mjs (EXTRA).
function buildTagIndex(all) {
  const ms = all.filter(m => m.ts && m.pl?.length).sort((a, b) => a.ts - b.ts);
  const P = {}, K = {}, last = {}, teamGames = {};
  const ROLE = pos => pos === 1 ? 'D' : pos === 3 ? 'F' : 'M';
  for (const m of ms) {
    const bookedY = new Set(m.cards.filter(c => c[2] !== 'Red').map(c => +c[0])), sent = new Set(m.cards.filter(c => c[2] !== 'Yellow').map(c => +c[0]));
    for (const t of [m.h[0], m.a[0]]) (teamGames[t] ||= []).push(m.ts);
    for (const r of m.pl) {
      if (!r[5]) continue;
      const pid = +r[0], team = r[2] ? m.h[0] : m.a[0], opp = r[2] ? m.a[0] : m.h[0], p = P[pid] ||= {teams:{}, vs:{}, rec:[]};
      (p.teams[team] ||= []).push(m.ts);
      (p.vs[opp] ||= []).push([m.ts, bookedY.has(pid) ? 1 : 0]);
      p.rec.push([m.ts, r[6] || 0, bookedY.has(pid) ? 1 : 0, m.lg + '|' + ROLE(r[3])]);
      (last[pid] ||= []).push({ts:m.ts, team, red:sent.has(pid)});
      const k = K[m.lg + '|' + ROLE(r[3])] ||= [0, 0]; k[0] += r[6] || 0; k[1] += bookedY.has(pid) ? 1 : 0;
    }
  }
  return {P, K, last, teamGames};
}
export function makeTagger(all) {
  const {P, K, last, teamGames} = buildTagIndex(all);
  return (pid, team, opp, oppName, ko, club) => {
  const p = P[pid], out = [];
  if (!p) return out;
  // solo ciò che è successo prima della partita (vale anche per le partite già giocate)
  const before = a => (a || []).filter(t => (t[0] ?? t) < ko), lastIn = a => Math.max(-Infinity, ...before(a).map(t => t[0] ?? t));
  if (club && lastIn(p.teams[opp]) > 0 && lastIn(p.teams[opp]) < lastIn(p.teams[team])) out.push(`Ex ${oppName}`);
  else if (club && lastIn(p.teams[opp]) > 0 && !before(p.teams[team]).length) out.push(`Ex ${oppName}`);
  const v = club && before(p.vs[opp]), vy = v ? v.reduce((a, x) => a + x[1], 0) : 0;
  if (vy >= 2) out.push(`${vy} gialli in ${v.length} gare contro ${oppName}`);
  const l = (last[pid] || []).filter(x => x.ts < ko).at(-1);
  if (l?.red && l.ts < ko && l.ts > ko - 60 * 86400 && (teamGames[l.team] || []).some(t => t > l.ts && t < ko)) out.push('Rientra da squalifica');
  // testa calda: gialli nelle ultime 3 stagioni contro quelli attesi dai suoi falli (tasso gialli/falli del ruolo nel campionato)
  const rec = p.rec.filter(x => x[0] > ko - 3 * 365 * 86400 && x[0] < ko);
  const y = rec.reduce((a, x) => a + x[2], 0), e = rec.reduce((a, x) => { const k = K[x[3]]; return a + (k && k[0] ? x[1] * k[1] / k[0] : 0); }, 0);
  if (y >= 6 && e > 0 && (y - e) / Math.sqrt(e) >= 2) out.push('Testa calda: prende più gialli di quanto dicano i suoi falli');
  return out;
  };
}
