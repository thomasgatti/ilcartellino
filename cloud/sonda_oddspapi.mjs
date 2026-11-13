// Sonda OddsPapi (12-13/11): mercati sui cartellini, torneo Nations League, partita indicata (SONDA_PARTITA, es. "Albania|Finland")
// e quote storiche per i mercati cartellino del giocatore. Serve il segreto ODDSPAPI_KEY. Stampa solo estratti nel log.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4', WANT = (process.env.SONDA_PARTITA || 'Albania|Finland').split('|');
if (!K) { console.log('Manca il segreto ODDSPAPI_KEY'); process.exit(0); }
const get = async (p, q = {}) => { const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v);
  const r = await fetch(u); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {}
  console.log(`\n=== ${r.status} ${p} ${JSON.stringify(q)} (${t.length} caratteri)`); if (!j) console.log(t.slice(0, 500)); return j; };
const arr = x => Array.isArray(x) ? x : x?.data || x?.items || [];
const mk = arr(await get('/markets', { sportId: 10 }));
const names = new Map(); for (const m of mk) { const k = m.marketName + ' · ' + m.marketType; names.set(k, (names.get(k) || 0) + 1); }
const cardish = [...names].filter(([k]) => /card|book|player/i.test(k));
console.log('mercati con card/book/player (nome · tipo · varianti):\n' + cardish.map(([k, n]) => `${k} · ${n}`).join('\n'));
console.log('esempio mercato giocatore:', JSON.stringify(mk.find(m => /player/i.test(m.marketName) && /card|book/i.test(m.marketName)) || null).slice(0, 800));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const bk = arr(await get('/bookmakers')); console.log('bookmaker:', bk.length, bk.map(b => b.slug || b.bookmakerSlug || b.name).join(', ').slice(0, 3000));
const cardIds = new Set(mk.filter(m => m.marketType === 'players-cards' || m.marketType === 'playertotals-cards').map(m => String(m.marketId))); console.log('id mercati cartellino giocatore:', [...cardIds].join(', '));
const FID = process.env.SONDA_FIXTURE || 'id1002375568932518';
// quote "giocatore ammonito" dell'ultimo momento prima del via, per bookmaker; nomi dei giocatori dagli endpoint dei giocatori
const KO = Date.parse(process.env.SONDA_KO || '2026-11-12T19:45:00Z'), last = {};
for (const g of (process.env.SONDA_BOOK || 'betfred,coral').split(';')) {
  await sleep(2500); const o = await get('/historical-odds', { fixtureId: FID, bookmakers: g });
  for (const [b, v] of Object.entries(o?.bookmakers || {})) for (const mid of cardIds) for (const out of Object.values(v.markets?.[mid]?.outcomes || {}))
    for (const [pid, hist] of Object.entries(out.players || {})) { const h = hist.filter(x => x.active && Date.parse(x.createdAt) <= KO).pop(); if (h) (last[pid] ||= {})[b + (mid === '102732' ? '' : '#' + mid)] = h.price; }
}
const pids = Object.keys(last); console.log('giocatori con quota:', pids.length);
let nomi = {};
{ await sleep(2500); const r = await get('/players', { sportId: 10 });
  for (const t of Object.values(r?.participants || {})) for (const x of t.players || []) nomi[x.playerId] = x.playerName;
  console.log('giocatori in anagrafica:', Object.keys(nomi).length, '· trovati:', pids.filter(p => nomi[p]).length, 'su', pids.length); }
console.log('QUOTE CARTELLINO (ultima prima del via):');
for (const [pid, q] of Object.entries(last).sort((a, b) => Math.min(...Object.values(a[1])) - Math.min(...Object.values(b[1])))) console.log(pid, nomi[pid] || '?', JSON.stringify(q));
