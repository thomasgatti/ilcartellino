// Sonda (18/11/2026): quote attuali doppia doppia / tripla doppia di una partita NBA, per i giocatori il cui nome contiene il filtro. Solo log, 2 richieste.
// Uso: node cloud/nba/sonda_quota_ora.mjs "<pezzo nome squadra di casa>" "<filtro nomi, regex>"
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4', sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (p, q = {}) => { await sleep(3600); const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v); const r = await fetch(u); const t = await r.text(); console.log(`[${r.status}] ${p}`); try { return JSON.parse(t); } catch { console.log(t.slice(0, 300)); return null; } };
const casa = process.argv[2] || 'Pelicans', filtro = new RegExp(process.argv[3] || 'Thompson|Cunningham', 'i');
const d = x => x.toISOString().slice(0, 10), oggi = new Date();
const fx = await get('/fixtures', { tournamentId: 132, from: d(new Date(+oggi - 864e5)), to: d(new Date(+oggi + 864e5)) }); const F = Array.isArray(fx) ? fx : fx?.data || [];
const f = F.find(x => String(x.participant1Name).includes(casa) && Date.parse(x.startTime) > Date.now() - 3 * 3600e3);
if (!f) { console.log('partita non trovata'); process.exit(0); }
console.log(`${f.participant2Name} @ ${f.participant1Name} · ${f.startTime}`);
const o = await get('/odds', { fixtureId: f.fixtureId, bookmakers: 'sisal.it,bet365.it,eurobet.it,snai.it' });
for (const [b, v] of Object.entries(o?.bookmakerOdds || {})) for (const [mid, key] of [['112602', 'DD'], ['112603', 'TD']]) for (const out of Object.values(v.markets?.[mid]?.outcomes || {}))
  for (const x of Object.values(out.players || {})) if (filtro.test(x?.playerName || '')) console.log(`${b} ${key} ${x.playerName}: ${x.price} ${x.active ? '' : '(sospesa)'} · aggiornata ${x.changedAt || x.createdAt || ''}`);
