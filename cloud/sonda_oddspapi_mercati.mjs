// Sonda: id dei mercati OddsPapi per falli del giocatore e cartellini della partita (solo log).
const K = process.env.ODDSPAPI_KEY, u = new URL('https://api.oddspapi.io/v4/markets'); u.searchParams.set('sportId', 10); u.searchParams.set('apiKey', K);
const mk = await (await fetch(u)).json(), A = Array.isArray(mk) ? mk : mk.data || [];
for (const m of A.filter(m => /foul|booking|card/i.test(m.marketName + ' ' + m.marketType) && !/corner/i.test(m.marketName)))
  console.log([m.marketId, m.marketName, m.marketType, m.handicap, m.period, JSON.stringify(m.outcomes?.map(o => o.outcomeName + ':' + o.outcomeId))].join(' | ').slice(0, 260));
