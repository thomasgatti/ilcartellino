// Sonda OddsPapi (13/11): chi ha il mercato "giocatore ammonito" (Sisal e altri) su Nations League e Serie A recente e d'inizio stagione.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4', sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (p, q = {}) => { for (let k = 0; k < 4; k++) { await sleep(3500); const u = new URL(B + p); for (const [a, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(a, v);
  const r = await fetch(u), t = await r.text(); if (r.status === 429) continue; console.log(`=== ${r.status} ${p} ${JSON.stringify(q)} (${t.length})`); if (!r.ok) { console.log(t.slice(0, 300)); return null; } return JSON.parse(t); } };
const CARD = ['102732', '102733', '102736', '102738'];
const FIX = { 'Albania-Finlandia (NL 12/11)': 'id1002375568932518', 'Cagliari-Frosinone (SA 7/11)': 'id1000002371945386', 'Inter-Monza (SA 22/8)': 'id1000002371944898' };
const GROUPS = ['sisal.it,snai.it,eurobet.it', 'goldbet.it,lottomatica.it,bet365.it', 'pokerstars.it,leovegas.it,betfair.it', 'betfred,betway,leovegas.dk', 'williamhill,paddypower,skybet'];
for (const [nome, fid] of Object.entries(FIX)) for (const g of GROUPS) {
  const o = await get('/historical-odds', { fixtureId: fid, bookmakers: g }); if (!o) continue;
  for (const b of g.split(',')) { const v = o.bookmakers?.[b]; const c = CARD.map(id => v?.markets?.[id] ? id + ':' + Object.keys(Object.values(v.markets[id].outcomes || {})[0]?.players || {}).length : null).filter(Boolean);
    console.log(`${nome} · ${b}: ${v ? Object.keys(v.markets || {}).length + ' mercati' : 'assente'} · cartellino giocatore ${c.join(' ') || 'no'}`); }
}
