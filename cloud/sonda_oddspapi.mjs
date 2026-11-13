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
const slugs = bk.map(b => b.slug || b.bookmakerSlug).filter(Boolean), pref = ['bet365', 'williamhill', 'unibet', 'paddypower', 'skybet', 'betfair-sb', 'betway', 'pinnacle', 'snai', 'sisal', 'eurobet', 'bwin', '888sport', 'ladbrokes', 'betfred', 'coral'];
const groups = []; const cand = pref.filter(x => slugs.includes(x)); for (let i = 0; i < cand.length; i += 3) groups.push(cand.slice(i, i + 3));
for (const g of groups.slice(0, 4)) {
  await sleep(1500); const o = await get('/historical-odds', { fixtureId: FID, bookmakers: g.join(',') });
  const s = JSON.stringify(o || {}); console.log('estratto:', s.slice(0, 600));
  const hits = []; (function walk(x, path) { if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (cardIds.has(k)) hits.push(path + '/' + k + ' ' + JSON.stringify(v).slice(0, 1500)); walk(v, path + '/' + k); } })(o, '');
  console.log(g.join(','), '→ mercati cartellino giocatore:', hits.length, '\n' + hits.slice(0, 6).join('\n'));
}
