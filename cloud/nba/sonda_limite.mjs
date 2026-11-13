// Sonda OddsPapi: cosa risponde quando rifiuta (testo del 429 e intestazioni sul limite). Solo log.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4';
for (const [p, q] of [['/players', { sportId: 11 }], ['/fixtures', { tournamentId: 132, from: '2026-11-01', to: '2026-11-03' }], ['/sports', {}]]) {
  const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v);
  const r = await fetch(u), t = await r.text();
  console.log(`\n[${r.status}] ${p} · ${t.length} caratteri\n  ${t.slice(0, 500)}\n  intestazioni: ${[...r.headers].filter(([k]) => /limit|retry|quota|remaining|reset/i.test(k)).map(([k, v]) => k + '=' + v).join(' · ')}`);
  await new Promise(r => setTimeout(r, 4000));
}
