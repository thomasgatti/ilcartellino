// Sonda OddsPapi (18/11/2026): SNAI c'è fra i bookmaker? Ha i mercati NBA doppia doppia (112602) e tripla doppia (112603)? Solo log, ~3 richieste.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4', sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (p, q = {}) => { await sleep(3600); const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v); const r = await fetch(u); const t = await r.text(); console.log(`[${r.status}] ${p} ${JSON.stringify(q)} · ${t.length} caratteri`); try { return JSON.parse(t); } catch { console.log(t.slice(0, 300)); return null; } };
const bk = process.env.SALTA_ELENCO ? [{ slug: 'snai.it' }] : await get('/bookmakers'); const L = Array.isArray(bk) ? bk : bk?.data || Object.values(bk || {});
const snai = L.filter(b => /snai/i.test(JSON.stringify(b))); console.log('bookmaker con «snai»:', JSON.stringify(snai).slice(0, 800));
const it = L.filter(b => /\.it\b|ital/i.test(JSON.stringify(b))).map(b => b.slug || b.bookmaker || b.name || JSON.stringify(b).slice(0, 60)); console.log('italiani:', it.join(', ').slice(0, 1500));
const oggi = new Date(), d = x => x.toISOString().slice(0, 10);
const fx = await get('/fixtures', { tournamentId: 132, from: d(oggi), to: d(new Date(+oggi + 2 * 864e5)) }); const F = Array.isArray(fx) ? fx : fx?.data || [];
console.log('partite NBA prossime:', F.length);
for (const s of snai.slice(0, 1)) { const slug = s.slug || s.bookmaker || s.id; const f = F.find(x => Date.parse(x.startTime) > Date.now() + 3600e3); if (!f) break;
  const o = await get('/odds', { fixtureId: f.fixtureId, bookmakers: slug + ',sisal.it' }); for (const [nome, v] of Object.entries(o?.bookmakerOdds || {})) {
  const M = Object.keys(v?.markets || {}); console.log(`${nome} su ${f.participant1Name}-${f.participant2Name}: mercati ${M.length}, doppia doppia ${M.includes('112602')}, tripla ${M.includes('112603')}`);
  for (const m of ['112602', '112603']) if (v?.markets?.[m]) console.log('  esempio', m, JSON.stringify(v.markets[m]).slice(0, 400)); } }
