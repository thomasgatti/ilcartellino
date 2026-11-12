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
      p.teams[team] = m.ts;
      const v = p.vs[opp] ||= [0, 0]; v[0]++; if (bookedY.has(pid)) v[1]++;
      p.rec.push([m.ts, r[6] || 0, bookedY.has(pid) ? 1 : 0, m.lg + '|' + ROLE(r[3])]);
      last[pid] = {ts:m.ts, team, red:sent.has(pid)};
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
  if (club && p.teams[opp] && p.teams[opp] < ko && (!p.teams[team] || p.teams[opp] < p.teams[team])) out.push(`Ex ${oppName}`);
  const v = club && p.vs[opp];
  if (v && v[1] >= 2) out.push(`${v[1]} gialli in ${v[0]} gare contro ${oppName}`);
  const l = last[pid];
  if (l?.red && l.ts < ko && l.ts > ko - 60 * 86400 && (teamGames[l.team] || []).some(t => t > l.ts && t < ko)) out.push('Rientra da squalifica');
  // testa calda: gialli nelle ultime 3 stagioni contro quelli attesi dai suoi falli (tasso gialli/falli del ruolo nel campionato)
  const rec = p.rec.filter(x => x[0] > ko - 3 * 365 * 86400 && x[0] < ko);
  const y = rec.reduce((a, x) => a + x[2], 0), e = rec.reduce((a, x) => { const k = K[x[3]]; return a + (k && k[0] ? x[1] * k[1] / k[0] : 0); }, 0);
  if (y >= 6 && e > 0 && (y - e) / Math.sqrt(e) >= 2) out.push('Testa calda: prende più gialli di quanto dicano i suoi falli');
  return out;
  };
}
