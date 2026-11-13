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
const tn = arr(await get('/tournaments', { sportId: 10 }));
const nl = tn.filter(t => /nations league/i.test(JSON.stringify(t))); console.log('tornei Nations League:', JSON.stringify(nl).slice(0, 1500));
for (const t of nl.slice(0, 4)) {
  const fx = arr(await get('/fixtures', { tournamentId: t.tournamentId ?? t.id, from: '2026-11-11', to: '2026-11-14' }));
  console.log('partite:', fx.length, JSON.stringify(fx.slice(0, 2)).slice(0, 1200));
  const f = fx.find(x => WANT.every(w => JSON.stringify(x).includes(w)));
  if (!f) continue;
  const fid = f.fixtureId ?? f.id; console.log('TROVATA', fid, JSON.stringify(f).slice(0, 600));
  for (const [p, q] of [['/odds', { fixtureId: fid }], ['/historical-odds', { fixtureId: fid }]]) {
    const o = await get(p, q); const s = JSON.stringify(o || {});
    console.log('estratto:', s.slice(0, 1500));
    const ids = new Set(mk.filter(m => /player/i.test(m.marketName) && /card|book/i.test(m.marketName)).map(m => String(m.marketId)));
    const hits = []; (function walk(x, path) { if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { if (ids.has(k)) hits.push(path + '/' + k + ' ' + JSON.stringify(v).slice(0, 600)); walk(v, path + '/' + k); } })(o, '');
    console.log('mercati cartellino giocatore trovati:', hits.length, '\n' + hits.slice(0, 12).join('\n'));
  }
}
