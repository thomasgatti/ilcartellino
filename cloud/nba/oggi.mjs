// NBA, partite della notte (13/11/2026): calendario, rose e infortuni da ESPN, quote «doppia doppia» / «tripla doppia» da OddsPapi (se c'è ODDSPAPI_KEY).
// Uso: node cloud/nba/oggi.mjs <file di uscita .json> [giorno USA AAAAMMGG]
// Scrive { giorno, creato, partite: [{ id, ts, h: [id, sigla, nome], a: [...], rosa: { h: [[id, nome, ruolo, stato]], a: [...] }, quote: { dd: { bookmaker: { nomeGiocatore: quota } }, td: {...} } }] }
// stato: '' disponibile, 'out' fuori, 'dubbio' in forse (day-to-day).
import fs from 'node:fs'; import { NOMI } from './squadre.mjs';
const OUT = process.argv[2] || 'oggi_input.json', E = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/', UA = 'ilcartellino-bot (progetto personale, github.com/thomasgatti/ilcartellino)';
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }); if (r.ok) return await r.json(); } catch {} await sleep(1500); } return null; };
const giorno = process.argv[3] || new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()).replace(/-/g, '');
const sb = await get(E + 'scoreboard?dates=' + giorno + '&limit=100'), partite = [];
if (!Array.isArray(sb?.events)) throw new Error('Calendario ESPN non disponibile: non pubblicare dati NBA incompleti');
const stato = s => /out|suspen/i.test(s || '') ? 'out' : /day|doubt|question|probable|game time/i.test(s || '') ? 'dubbio' : '';
const inf = {}; { const j = await get(E + 'injuries'); for (const T of j?.injuries || []) for (const x of T.injuries || []) { const id = +x.athlete?.id || +(x.athlete?.links?.[0]?.href?.match(/id\/(\d+)/)?.[1] || 0); if (id) inf[id] = [stato(x.status), x.details?.type || x.shortComment?.slice(0, 60) || '']; } }
const rose = {};
const rosa = async id => { if (rose[id]) return rose[id]; const j = await get(E + 'teams/' + id + '/roster'); await sleep(150);
  return rose[id] = (j?.athletes || []).map(a => { const i = inf[+a.id], s = i ? i[0] : stato(a.injuries?.[0]?.status); return [+a.id, a.displayName, a.position?.abbreviation || '', s, i?.[1] || '']; }); };
for (const e of sb?.events || []) { const c = e.competitions?.[0]; if (![2, 3, 5].includes(e.season?.type) || c.competitors.some(x => +x.team.id > 30)) continue;
  if (!/SCHEDULED|PRE/i.test(e.status?.type?.name || '') && e.status?.type?.state !== 'pre') continue;
  const sq = k => { const x = c.competitors.find(x => x.homeAway === k); return [+x.team.id, x.team.abbreviation, x.team.displayName]; }, h = sq('home'), a = sq('away');
  partite.push({ id: e.id, ts: Math.floor(Date.parse(e.date) / 1000), tipo: e.season.type, anno: e.season.year, h, a, rosa: { h: await rosa(h[0]), a: await rosa(a[0]) }, quote: { dd: {}, td: {} } }); }
console.log(`giorno ${giorno}: ${partite.length} partite da giocare · infortunati in elenco ${Object.keys(inf).length}`);
// ---- quote ----
const K = process.env.ODDSPAPI_KEY;
// Per il giro automatico: limita le partite quotate e usa soltanto i bookmaker italiani.
// Il workflow manuale conserva il comportamento originale se le variabili non sono impostate.
const cap = Math.max(0, Math.min(partite.length, Number(process.env.NBA_QUOTE_MAX_PARTITE ?? partite.length) || 0));
const soloItaliani = process.env.NBA_QUOTE_SOLO_ITALIA === '1';
const daQuotare = cap >= partite.length ? partite : Array.from({ length: cap }, (_, i) => partite[Math.floor((i + 0.5) * partite.length / cap)]);
console.log(`quote: ${daQuotare.length}/${partite.length} partite${soloItaliani ? ' · solo bookmaker italiani' : ''}`);
if (K && daQuotare.length && !process.env.NBA_SENZA_QUOTE) { const B = 'https://api.oddspapi.io/v4'; let chiamate = 0;
  const op = async (p, q) => { for (let k = 0; k < 4; k++) { await sleep(3600); const u = new URL(B + p); for (const [a, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(a, v); const r = await fetch(u, { signal: AbortSignal.timeout(60000) }).catch(() => null); if (!r) continue; if (r.status === 429) { const t = await r.text(); if (/REQUEST_LIMIT/.test(t)) { console.log('quota OddsPapi finita'); return null; } await sleep(5000); continue; } chiamate++; if (!r.ok) return null; return r.json(); } return null; };
  const t0 = Math.min(...partite.map(p => p.ts)), d = x => new Date(x * 1000).toISOString().slice(0, 10);
  const fx = await op('/fixtures', { tournamentId: 132, from: d(t0 - 43200), to: d(t0 + 86400) }), F = Array.isArray(fx) ? fx : fx?.data || [];
  const leggi = (o, P) => { let n = 0; for (const [b, v] of Object.entries(o?.bookmakerOdds || {})) for (const [mid, key] of [['112602', 'dd'], ['112603', 'td']]) for (const out of Object.values(v.markets?.[mid]?.outcomes || {})) for (const x of Object.values(out.players || {})) { if (!x?.active || !x.playerName || !(x.price > 1)) continue; (P.quote[key][b] ||= {})[x.playerName] = x.price; n++; } return n; };
  let italiani = null;
  for (const P of daQuotare) { const f = F.find(f => Math.abs(Date.parse(f.startTime) / 1000 - P.ts) < 5 * 3600 && String(f.participant1Name).includes(NOMI[P.h[0]]) && String(f.participant2Name).includes(NOMI[P.a[0]])); if (!f) { console.log('  non trovata su OddsPapi:', P.a[1], '@', P.h[1]); continue; }
    const n = soloItaliani ? 0 : leggi(await op('/odds', { fixtureId: f.fixtureId, bookmakers: 'fanduel,bet365,draftkings' }), P); let ni = 0;
    if (soloItaliani || italiani !== false) { ni = leggi(await op('/odds', { fixtureId: f.fixtureId, bookmakers: 'sisal.it,bet365.it,eurobet.it' }), P); if (italiani === null) italiani = ni > 0; }
    console.log(`  ${P.a[1]} @ ${P.h[1]}: quote ${n}${soloItaliani || italiani !== null ? ' · bookmaker italiani ' + ni : ''}`); }
  console.log('richieste OddsPapi usate:', chiamate, '· bookmaker italiani con questi mercati:', italiani);
}
fs.writeFileSync(OUT, JSON.stringify({ giorno, creato: Math.floor(Date.now() / 1000), partite }));
