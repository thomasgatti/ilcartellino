// Sonda (18/11/2026): /odds-by-tournaments restituisce anche i mercati giocatore doppia doppia (112602) e tripla doppia (112603)? E quante richieste restano (/account)? Solo log, 2 richieste.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4', sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (p, q = {}) => { await sleep(3600); const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v); const r = await fetch(u); const t = await r.text(); console.log(`[${r.status}] ${p} · ${t.length} caratteri`); try { return JSON.parse(t); } catch { console.log(t.slice(0, 300)); return null; } };
const a = await get('/account'); console.log('account:', JSON.stringify(a).replace(/"apiKey":"[^"]*"/g, '"apiKey":"…"').slice(0, 800));
const o = await get('/odds-by-tournaments', { bookmaker: process.argv[2] || 'sisal.it', tournamentIds: 132 });
const L = Array.isArray(o) ? o : o?.data || Object.values(o || {}); console.log('partite:', L.length, '· chiavi del primo:', Object.keys(L[0] || {}).join(','));
for (const f of L.slice(0, 12)) { const bo = f.bookmakerOdds || {}; for (const [b, v] of Object.entries(bo)) { const M = Object.keys(v?.markets || {});
  let n = 0, es = ''; for (const m of ['112602', '112603']) for (const out of Object.values(v.markets?.[m]?.outcomes || {})) for (const x of Object.values(out.players || {})) { n++; if (!es && /Thompson/.test(x?.playerName || '')) es = `${m} ${x.playerName} ${x.price}`; }
  console.log(`${f.participant1Name || f.fixtureId}-${f.participant2Name || ''} ${f.startTime || ''} · ${b}: mercati ${M.length}, quote DD/TD giocatore ${n} ${es}`); } }
