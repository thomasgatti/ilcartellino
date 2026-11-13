// Archivio delle quote «doppia doppia» e «tripla doppia» del giocatore (OddsPapi, basket = sportId 11, NBA = torneo 132; mercati 112602 e 112603, solo esito «Sì»).
// Per ogni partita NBA già giocata della stagione in archivio: ultima quota attiva prima della palla a due, per bookmaker.
// Uso: ODDSPAPI_KEY=… node cloud/nba/quote.mjs <cartella nba> [MAX partite] [stagione, es. 2026-2027]
// Scrive <nba>/quote_<stagione>.json: { "<id ESPN>": { fx, ko, dd: { bookmaker: { idGiocatoreOddsPapi: quota } }, td: {...} } | { nessuna, tentativi, provato }, "_nomi": { idGiocatoreOddsPapi: nome } }
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { NOMI } from './squadre.mjs';
const K = process.env.ODDSPAPI_KEY, OUT = process.argv[2] || 'dati/nba', MAX = +(process.argv[3] || 60), ST = process.argv[4] || '2026-2027', B = 'https://api.oddspapi.io/v4';
if (!K) { console.log('Manca ODDSPAPI_KEY'); process.exit(0); }
const BOOKS = process.env.NBA_BOOK || 'fanduel,bet365,draftkings', FINE = Date.now() + (+process.env.MINUTI || 40) * 60000, DD = '112602', TD = '112603';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(p, q = {}) { for (let k = 0; k < 6; k++) { await sleep(3600); const u = new URL(B + p); for (const [a, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(a, v);
    const r = await fetch(u); if (r.status === 429) { await sleep(6000 * (k + 1)); continue; } const t = await r.text(); if (r.status === 404) return null; if (!r.ok) throw new Error(`${r.status} ${p}: ${t.slice(0, 200)}`); return JSON.parse(t); }
  throw new Error('troppi 429 su ' + p); }
const fA = path.join(OUT, ST + '.json.gz'), fQ = path.join(OUT, `quote_${ST}.json`);
const A = fs.existsSync(fA) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(fA))) : {}, S = fs.existsSync(fQ) ? JSON.parse(fs.readFileSync(fQ, 'utf8')) : {};
const ora = Date.now() / 1000, todo = Object.entries(A).filter(([id]) => id !== '_nomi').filter(([id, m]) => m.ts < ora - 4 * 3600 && (!S[id] || (S[id].nessuna && (S[id].tentativi || 0) < 3 && ora - (S[id].provato || 0) > 86400))).sort((a, b) => b[1].ts - a[1].ts);
console.log(`${ST}: ${todo.length} partite da cercare (in archivio quote: ${Object.keys(S).length})`);
const cache = new Map(); let fatte = 0, con = 0;
// anagrafica dei giocatori (id OddsPapi → nome): prima delle partite, e rinfrescata quando ci sono partite nuove
const anagrafica = async () => { const r = await get('/players', { sportId: 11 }), N = S._nomi || {}; for (const t of Object.values(r?.participants || {})) for (const x of t.players || []) N[x.playerId] = x.playerName; S._nomi = N; console.log('anagrafica giocatori:', Object.keys(N).length); };
try {
  if (!S._nomi || todo.length) await anagrafica();
  for (const [id, m] of todo) { if (fatte >= MAX || Date.now() > FINE) break;
    const d0 = new Date((m.ts - 86400) * 1000).toISOString().slice(0, 10), d1 = new Date((m.ts + 86400) * 1000).toISOString().slice(0, 10);
    if (!cache.has(d0)) { const r = await get('/fixtures', { tournamentId: 132, from: d0, to: d1 }); cache.set(d0, Array.isArray(r) ? r : r?.data || []); }
    const f = cache.get(d0).find(f => Math.abs(Date.parse(f.startTime) / 1000 - m.ts) < 5 * 3600 && String(f.participant1Name).includes(NOMI[m.h[0]]) && String(f.participant2Name).includes(NOMI[m.a[0]]));
    const no = perche => { S[id] = { ko: m.ts, nessuna: perche, tentativi: (S[id]?.tentativi || 0) + 1, provato: Math.floor(ora) }; };
    fatte++; if (!f) { no('partita non trovata'); continue; }
    const o = await get('/historical-odds', { fixtureId: f.fixtureId, bookmakers: BOOKS }), ko = Math.min(m.ts, Date.parse(f.trueStartTime || f.startTime) / 1000) * 1000, rec = { fx: f.fixtureId, ko: m.ts, dd: {}, td: {} };
    for (const [bk, v] of Object.entries(o?.bookmakers || {})) for (const [mid, key] of [[DD, 'dd'], [TD, 'td']]) for (const out of Object.values(v.markets?.[mid]?.outcomes || {}))
      for (const [pid, hist] of Object.entries(out.players || {})) { const h = hist.filter(x => x.active && Date.parse(x.createdAt) <= ko).pop(); if (h) (rec[key][bk] ||= {})[pid] = h.price; }
    if (!Object.keys(rec.dd).length && !Object.keys(rec.td).length) { no('nessuna quota'); continue; }
    S[id] = rec; con++; if (con % 10 === 0) { console.log(`  ${con} partite con quote · ${fatte} cercate`); fs.writeFileSync(fQ, JSON.stringify(S)); }
  }
} catch (e) { console.log('INTERROTTO:', e.message); }
fs.writeFileSync(fQ, JSON.stringify(S));
const V = Object.entries(S).filter(([k]) => k !== '_nomi').map(([, v]) => v), cnt = k => V.filter(v => v[k] && Object.keys(v[k]).length).length;
console.log(`cercate ${fatte}, con quote ${con} · archivio: ${V.length} partite, doppia doppia ${cnt('dd')}, tripla doppia ${cnt('td')}, senza ${V.filter(v => v.nessuna).length}`);
const es = V.find(v => v.dd && Object.keys(v.dd).length); if (es) console.log('esempio:', JSON.stringify(es).slice(0, 600));
