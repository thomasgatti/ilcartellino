// Scaricamento storico Serie A da Sofascore (eseguire nella console di una pagina https://www.sofascore.com/api/v1/...)
// Riempie window.__H (partite, righe giocatore-partita, cartellini, quote, posizioni medie) e window.__TE (calendari squadre).
// Durata: ~10 minuti per 5 stagioni. Id stagioni Serie A: 22/23=42415, 23/24=52760, 24/25=63515, 25/26=76457, 26/27=95836.
async function scrapeSofascore(seasons = [[42415, 38], [52760, 38], [63515, 38], [76457, 38], [95836, 38]]) {
  const B = 'https://www.sofascore.com/api/v1'; const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function j(u) { for (let i = 0; i < 4; i++) { try { const r = await fetch(B + u); if (r.ok) return await r.json(); if (r.status === 404) return null; if (r.status === 429 || r.status === 403) await sleep(3000 * (i + 1)); } catch (e) { } await sleep(800 * (i + 1)); } return null; }
  const frac = s => { if (!s) return null; const [a, b] = s.split('/').map(Number); return 1 + a / b; };
  const H = window.__H = { matches: [], rows: [], cards: {}, odds: {}, ap: {}, status: 'listing', done: 0, total: 0, err: 0 };
  const evs = [];
  for (const [sid, maxr] of seasons) for (let r = 1; r <= maxr; r++) {
    const d = await j(`/unique-tournament/23/season/${sid}/events/round/${r}`);
    if (d) for (const e of d.events) if (e.status.type === 'finished') evs.push({ id: e.id, sid, round: r, ts: e.startTimestamp, h: e.homeTeam.name, a: e.awayTeam.name, hid: e.homeTeam.id, aid: e.awayTeam.id, hs: e.homeScore?.current, as: e.awayScore?.current });
    await sleep(80);
  }
  H.total = evs.length; H.status = 'running'; let i = 0;
  async function w() { while (i < evs.length) { const e = evs[i++];
    const [lu, inc, od, ap, ev] = await Promise.all([j(`/event/${e.id}/lineups`), j(`/event/${e.id}/incidents`), j(`/event/${e.id}/odds/1/all`), j(`/event/${e.id}/average-positions`), j(`/event/${e.id}`)]);
    if (!lu) { H.err++; H.done++; continue; }
    const cards = (inc?.incidents || []).filter(x => x.incidentType === 'card' && x.player && !x.rescinded).map(x => [x.player.id, x.incidentClass, x.reason || '', x.time]);
    H.cards[e.id] = cards; const yc = {}, rc = {}; for (const c of cards) { if (c[1] === 'yellow' || c[1] === 'yellowRed') yc[c[0]] = 1; if (c[1] !== 'yellow') rc[c[0]] = 1; }
    if (od) { const ft = od.markets.find(m => m.marketName === 'Full time'); const cm = od.markets.filter(m => m.marketName === 'Cards in match');
      H.odds[e.id] = { ft: ft ? ft.choices.map(c => frac(c.fractionalValue)) : null, cards: cm.map(m => [+m.choiceGroup, ...m.choices.map(c => frac(c.fractionalValue))]) }; }
    if (ap) H.ap[e.id] = { h: ap.home.map(p => [p.player.id, +(+p.averageX).toFixed(1), +(+p.averageY).toFixed(1), p.pointsCount]), a: ap.away.map(p => [p.player.id, +(+p.averageX).toFixed(1), +(+p.averageY).toFixed(1), p.pointsCount]) };
    H.matches.push([e.id, e.sid, e.round, e.ts, e.h, e.a, e.hs, e.as, ev?.event?.referee?.name || '', e.hid, e.aid]);
    // riga: [eventId, casa, playerId, nome, ruolo G/D/M/F, titolare, minuti, falli, falli subiti, dribbling tentati, dribbling riusciti, velocità max, scatti, ammonito, espulso]
    for (const side of ['home', 'away']) for (const p of lu[side].players) { const s = p.statistics || {}; if (!s.minutesPlayed) continue;
      H.rows.push([e.id, side === 'home' ? 1 : 0, p.player.id, p.player.shortName || p.player.name, p.position || p.player.position || '', p.substitute ? 0 : 1, s.minutesPlayed, s.fouls || 0, s.wasFouled || 0, s.totalContest || 0, s.wonContest || 0, s.topSpeed || 0, s.numberOfSprints || 0, yc[p.player.id] || 0, rc[p.player.id] || 0]); }
    H.done++; await sleep(100); } }
  await Promise.all([w(), w(), w(), w()]);
  // calendari di tutte le competizioni (per riposo / coppe)
  const TE = window.__TE = { teams: {} }; const ids = new Set(); H.matches.forEach(m => { ids.add(m[9]); ids.add(m[10]); });
  for (const tid of ids) { const dates = []; for (let page = 0; page < 12; page++) { const d = await j(`/team/${tid}/events/last/${page}`); if (!d?.events?.length) break;
      for (const e of d.events) if (e.status?.type === 'finished') dates.push([e.startTimestamp, e.tournament?.uniqueTournament?.id || 0]);
      if (Math.min(...d.events.map(e => e.startTimestamp)) < 1656633600) break; await sleep(200); }
    TE.teams[tid] = dates.sort((a, b) => a[0] - b[0]); }
  H.status = 'done'; return { partite: H.matches.length, righe: H.rows.length };
}
