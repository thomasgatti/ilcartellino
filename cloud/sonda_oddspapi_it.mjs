// Sonda OddsPapi (13/11): bookmaker italiani con il mercato "giocatore ammonito", profondità dello storico (Serie A passata), limiti del piano.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4', sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (p, q = {}) => { await sleep(2600); const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v);
  const r = await fetch(u), t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  console.log(`=== ${r.status} ${p} ${JSON.stringify(q)} (${t.length}) ${[...r.headers].filter(([k]) => /limit|remaining|quota|usage/i.test(k)).map(x => x.join('=')).join(' ')}`); if (!r.ok) console.log(t.slice(0, 400)); return j; };
const arr = x => Array.isArray(x) ? x : x?.data || [];
const bk = arr(await get('/bookmakers')).map(b => b.slug || b.bookmakerSlug);
const IT = bk.filter(s => /sisal|snai|eurobet|goldbet|lottomatica|betflag|\.it$|planetwin|better|admiral|stanleybet|netbet|starcasino|vincitu|leovegas|betway|bwin/i.test(s)); console.log('bookmaker italiani/possibili:', IT.join(', '));
const tn = arr(await get('/tournaments', { sportId: 10 })), sa = tn.filter(t => /serie a/i.test(t.tournamentName) && /italy/i.test(JSON.stringify(t))); console.log('Serie A:', JSON.stringify(sa).slice(0, 500));
const ucl = tn.filter(t => /champions league/i.test(t.tournamentName) && /uefa|international/i.test(JSON.stringify(t))); console.log('Champions:', JSON.stringify(ucl).slice(0, 400));
const nlFid = 'id1002375568932518', card = '102732';
const groups = []; for (let i = 0; i < IT.length; i += 3) groups.push(IT.slice(i, i + 3));
for (const g of groups) { const o = await get('/historical-odds', { fixtureId: nlFid, bookmakers: g.join(',') });
  for (const [b, v] of Object.entries(o?.bookmakers || {})) console.log(b, 'mercati', Object.keys(v.markets || {}).length, 'cartellino giocatore:', v.markets?.[card] ? Object.keys(v.markets[card].outcomes?.[card]?.players || {}).length + ' giocatori' : 'no'); }
// profondità: una giornata di Serie A di un anno fa e una di inizio stagione
const said = sa[0]?.tournamentId;
for (const [from, to] of [['2025-11-08', '2025-11-10'], ['2026-08-22', '2026-08-24'], ['2026-11-07', '2026-11-09']]) {
  const fx = arr(await get('/fixtures', { tournamentId: said, from, to })); console.log(from, 'partite', fx.length, fx.slice(0, 1).map(f => f.participant1Name + '-' + f.participant2Name + ' ' + f.fixtureId).join());
  if (!fx.length) continue;
  const o = await get('/historical-odds', { fixtureId: fx[0].fixtureId, bookmakers: ['betfred', ...IT.slice(0, 2)].join(',') });
  for (const [b, v] of Object.entries(o?.bookmakers || {})) console.log('  ', b, 'mercati', Object.keys(v.markets || {}).length, 'cartellino giocatore:', v.markets?.[card] ? Object.keys(v.markets[card].outcomes?.[card]?.players || {}).length : 'no');
}
