// Sonda (20/11/2026): quote Sisal di tutte le linee «over» delle triple per le partite NBA in programma, stampate come JSON (una riga «TRIPLE_SISAL …»).
// Serve a completare a mano la pagina della notte quando Sisal non era il bookmaker migliore. 1 richiesta.
const K = process.env.ODDSPAPI_KEY;
const u = new URL('https://api.oddspapi.io/v4/odds-by-tournaments'); u.searchParams.set('bookmaker', 'sisal.it'); u.searchParams.set('tournamentIds', '132'); u.searchParams.set('apiKey', K);
const r = await fetch(u); const o = await r.json(); const L = Array.isArray(o) ? o : o?.data || [];
const out = {};
for (const f of L) for (const v of Object.values(f.bookmakerOdds || {})) for (let mid = 111792; mid <= 111806; mid += 2) { const oc = v.markets?.[mid]?.outcomes?.[mid]; if (!oc) continue;
  for (const x of Object.values(oc.players || {})) if (x?.active && x.playerName && x.price > 1) (((out[f.fixtureId] ||= {})[String(0.5 + (mid - 111792) / 2)] ||= {})[x.playerName] = x.price); }
console.log(`[${r.status}] partite ${L.length}`); console.log('TRIPLE_SISAL ' + JSON.stringify(out));
