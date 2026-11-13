// Prova endpoint OddsPapi per risalire al nome di un giocatore dal suo id (sonda, solo log).
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4', ID = process.env.SONDA_ID || '1400057', sleep = ms => new Promise(r => setTimeout(r, ms));
for (const [p, q] of [['/players', { playerId: ID }], ['/player', { playerId: ID }], ['/players/' + ID, {}], ['/participants', { sportId: 10, participantId: ID }], ['/players', { sportId: 10, playerIds: ID }], ['/players', { sportId: 10 }]]) {
  const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v);
  const r = await fetch(u), t = await r.text(); console.log(`=== ${r.status} ${p} ${JSON.stringify(q)}\n${t.slice(0, 700)}`); await sleep(2000);
}
