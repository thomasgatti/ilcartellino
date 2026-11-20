// Sonda (20/11/2026): quali mercati «triple segnate» (canestri da 3 per giocatore) ci sono in /odds-by-tournaments, con che id e com'è fatta una linea. Solo log, 2 richieste.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4', sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async (p, q = {}) => { await sleep(3600); const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v); const r = await fetch(u); const t = await r.text(); console.log(`[${r.status}] ${p} · ${t.length} caratteri`); try { return JSON.parse(t); } catch { console.log(t.slice(0, 300)); return null; } };
const bk = process.argv[2] || 'sisal.it';
const M = await get('/markets', { sportId: 11 }); const LM = Array.isArray(M) ? M : M?.data || [];
console.log('mercati basket:', LM.length, '· chiavi:', Object.keys(LM[0] || {}).join(','));
const nome = {}; for (const m of LM) nome[m.marketId] = m;
const tre = LM.filter(m => /three|3pt|3-point|3 point/i.test(JSON.stringify(m)));
console.log('mercati con «three»:', tre.length); for (const m of tre.slice(0, 40)) console.log('  ', JSON.stringify(m).slice(0, 260));
const o = await get('/odds-by-tournaments', { bookmaker: bk, tournamentIds: 132 }); const L = Array.isArray(o) ? o : o?.data || [];
const cont = {};
for (const f of L) for (const v of Object.values(f.bookmakerOdds || {})) for (const [mid, mk] of Object.entries(v.markets || {})) {
  const n = Object.values(mk.outcomes || {}).reduce((a, out) => a + Object.keys(out.players || {}).length, 0); if (!n) continue; (cont[mid] ||= [0, 0, null]); cont[mid][0]++; cont[mid][1] += n; cont[mid][2] ||= mk; }
console.log(`${bk}: ${L.length} partite; mercati giocatore presenti:`);
for (const [mid, [nf, n, mk]] of Object.entries(cont).sort((a, b) => b[1][1] - a[1][1])) {
  const m = nome[mid] || {}; console.log(`  ${mid} · ${m.marketName || m.name || '?'} · ${m.handicap ?? ''} · ${m.marketType || ''} · partite ${nf}, quote ${n}`);
  if (tre.some(t => String(t.marketId) === mid)) { const out = Object.entries(mk.outcomes); console.log('     esempio:', JSON.stringify(out.slice(0, 2)).slice(0, 500)); }
}
