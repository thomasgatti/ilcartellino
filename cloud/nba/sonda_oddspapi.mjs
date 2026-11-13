// Sonda OddsPapi basket (13/11/2026): sport, torneo NBA, mercati doppia/tripla doppia, quote storiche di una partita. Solo log.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4'; if (!K) { console.log('Manca ODDSPAPI_KEY'); process.exit(0); }
const sleep = ms => new Promise(r => setTimeout(r, ms)); let primo = true;
const get = async (p, q = {}) => { if (!primo) await sleep(2600); primo = false; const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v);
  const r = await fetch(u); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} console.log(`\n=== ${r.status} ${p} ${JSON.stringify(q)} (${t.length} caratteri)`); if (!j || r.status !== 200) console.log(t.slice(0, 400)); return j; };
const arr = x => Array.isArray(x) ? x : x?.data || x?.items || [];
const sp = arr(await get('/sports')); console.log(sp.map(s => (s.sportId ?? s.id) + ':' + (s.sportName || s.name || s.slug)).join(' · ').slice(0, 1500));
const SID = (sp.find(s => /basket/i.test(s.sportName || s.name || s.slug || '')) || {}).sportId ?? 11; console.log('sportId basket =', SID);
const mk = arr(await get('/markets', { sportId: SID })); console.log('mercati:', mk.length);
const tipi = new Map(); for (const m of mk) { const k = m.marketType; tipi.set(k, (tipi.get(k) || 0) + 1); } console.log('tipi:', [...tipi].map(([k, n]) => k + '×' + n).join(' · ').slice(0, 4000));
const dd = mk.filter(m => /double|triple/i.test(m.marketName + ' ' + m.marketType)); console.log('doppia/tripla:', dd.length);
for (const m of dd.slice(0, 40)) console.log([m.marketId, m.marketName, m.marketType, m.handicap, m.period, JSON.stringify(m.outcomes?.map(o => o.outcomeName + ':' + o.outcomeId))].join(' | ').slice(0, 300));
const pl = mk.filter(m => /player/i.test(m.marketName + ' ' + m.marketType)); const pn = new Map(); for (const m of pl) pn.set(m.marketName + ' · ' + m.marketType, (pn.get(m.marketName + ' · ' + m.marketType) || 0) + 1);
console.log('mercati giocatore:\n' + [...pn].map(([k, n]) => k + '×' + n).join('\n').slice(0, 5000));
const tr = arr(await get('/tournaments', { sportId: SID })); const nba = tr.filter(t => /nba\b/i.test(t.tournamentName || t.name || '')); console.log('tornei NBA:', JSON.stringify(nba.slice(0, 8)).slice(0, 1500));
const TID = process.env.SONDA_TID || (nba.find(t => /^nba$/i.test(t.tournamentName || '')) || nba[0] || {}).tournamentId; console.log('tournamentId =', TID);
if (TID) {
  const day = d => new Date(d).toISOString().slice(0, 10);
  for (const [a, b] of [[Date.now() - 3 * 864e5, Date.now() - 864e5], [Date.parse('2026-04-10'), Date.parse('2026-04-13')], [Date.parse('2025-12-01'), Date.parse('2025-12-03')]]) {
    const fx = arr(await get('/fixtures', { tournamentId: TID, from: day(a), to: day(b) })); console.log('partite:', fx.length, JSON.stringify(fx.slice(0, 2)).slice(0, 900));
    const f = fx.find(x => x.hasOdds !== false) || fx[0]; if (!f) continue;
    for (const g of (process.env.SONDA_BOOK || 'bet365;draftkings;fanduel;pinnacle;sisal;betmgm').split(';')) {
      const o = await get('/historical-odds', { fixtureId: f.fixtureId, bookmakers: g }); const ids = new Set(dd.map(m => String(m.marketId)));
      for (const [bk, v] of Object.entries(o?.bookmakers || {})) { const M = Object.keys(v.markets || {}); const hit = M.filter(m => ids.has(m)); console.log(' ', bk, 'mercati', M.length, 'doppia/tripla', hit.join(','));
        for (const m of hit.slice(0, 2)) console.log('   ', m, JSON.stringify(v.markets[m]).slice(0, 700)); }
    }
  }
}
