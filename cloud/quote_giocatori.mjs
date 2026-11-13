// Archivio delle quote "giocatore ammonito" (OddsPapi, 13/11/2026) per le partite già giocate di Serie A, Champions e Nazionali.
// Per ogni partita: quota di ogni giocatore all'ultimo aggiornamento prima del via e circa 24 ore prima, per bookmaker.
// Lo storico di OddsPapi parte da agosto 2026 (stagione 2026/27). Piano gratuito: limite di frequenza stretto, quindi una chiamata ogni 3,5 s
// e al massimo MAX partite per giro; le altre al giro dopo.
// Uso: ODDSPAPI_KEY=… node cloud/quote_giocatori.mjs <cartella ramo dati> [MAX]
// Scrive <dati>/quote_giocatori/<comp>_2026-2027.json: { idFotMob: { v: 2, fx, ko, partita,
//   q: { bookmaker: { "Cognome, Nome": [quota al via, quota 24h prima] } },                      giocatore ammonito
//   f: { bookmaker: { "Cognome, Nome": { f1: [via, 24h], f2: [via, 24h] } } },                  falli del giocatore: almeno 1 / almeno 2
//   t: { bookmaker: { tot: [linea, over, under], h: [...], a: [...] } } } }                      cartellini della partita e delle squadre (linea più equilibrata, al via)
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const K = process.env.ODDSPAPI_KEY, ROOT = process.argv[2] || 'dati', MAX = +(process.argv[3] || 40), B = 'https://api.oddspapi.io/v4';
if (!K) { console.log('Manca ODDSPAPI_KEY'); process.exit(0); }
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function get(p, q = {}) {
  for (let k = 0; k < 5; k++) {
    await sleep(3500); const u = new URL(B + p); for (const [a, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(a, v);
    const r = await fetch(u); if (r.status === 429) { await sleep(3000); continue; }
    const t = await r.text(); if (r.status === 404) return null; if (!r.ok) throw new Error(`${r.status} ${p}: ${t.slice(0, 200)}`); return JSON.parse(t);
  }
  throw new Error('troppi 429 su ' + p);
}
// competizioni: id OddsPapi del torneo, archivi FotMob
const COMP = {
  sa: { t: [23], files: [['fotmob', '55_2026-2027']] },
  ucl: { t: [7], files: [['fotmob', '42_2026-2027']] },
  naz: { t: [23755], files: [['nazionali', '9806_2026-2027'], ['nazionali', '9807_2026-2027'], ['nazionali', '9808_2026-2027'], ['nazionali', '9809_2026-2027']] },
};
// bookmaker con il mercato (verificato il 13/11): gli italiani lo offrono solo su alcune partite, gli esteri quasi sempre
const BOOKS = ['sisal.it,bet365.it,eurobet.it', 'betfred,betway,paddypower'], CARD = '102732';
const norm = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(fc|ac|as|ss|us|ssc|calcio|cf|club|de|sv|1\.)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const tri = s => { const t = new Set(), x = '  ' + norm(s) + ' '; for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3)); return t; };
const sim = (a, b) => { const A = tri(a), B2 = tri(b); let k = 0; for (const x of A) if (B2.has(x)) k++; return k / Math.max(1, Math.min(A.size, B2.size)); };
const al = s => s;

const outDir = path.join(ROOT, 'quote_giocatori'); fs.mkdirSync(outDir, { recursive: true });
let names = null, fatte = 0;
// mercati: id → [tipo, linea, Over/Under]; falli del giocatore 102699 (Sì = almeno 1), 102702 (2+), 102708 (Over 1,5)
const MK = new Map();
{ const r = await get('/markets', { sportId: 10 }); for (const m of (Array.isArray(r) ? r : r?.data || [])) if (m.period === 'fulltime' && /^(totals-bookings|teamtotals-bookings-team[12])$/.test(m.marketType))
    for (const o of m.outcomes || []) MK.set(String(o.outcomeId), [m.marketType === 'totals-bookings' ? 'tot' : m.marketType.endsWith('1') ? 'h' : 'a', m.handicap, o.outcomeName, String(m.marketId)]); }
const F1 = [['102699', '102699'], ['102700', '102701']], F2 = [['102708', '102708'], ['102700', '102702']];
const fixCache = new Map();
for (const [comp, C] of Object.entries(COMP)) {
  const file = path.join(outDir, `${comp}_2026-2027.json`), store = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  const ms = C.files.flatMap(([d, f]) => { const p = path.join(ROOT, d, f + '.json.gz'); return fs.existsSync(p) ? Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(p)))) : []; })
    .filter(m => m.ts && m.ts < Date.now() / 1000 - 3 * 3600 && (!store[m.id] || (store[m.id].q && (store[m.id].v || 1) < 2) || (store[m.id].nessuna && (store[m.id].tentativi || 0) < 3 && Date.now() / 1000 - (store[m.id].provato || 0) > 86400)))
    .sort((a, b) => b.ts - a.ts);
  console.log(`${comp}: ${ms.length} partite da cercare`);
  for (const m of ms) {
    if (fatte >= MAX) break;
    const day = new Date(m.ts * 1000), d0 = new Date(day - 86400000).toISOString().slice(0, 10), d1 = new Date(+day + 86400000).toISOString().slice(0, 10);
    let fx = [];
    for (const t of C.t) { const k = t + d0; if (!fixCache.has(k)) { const r = await get('/fixtures', { tournamentId: t, from: d0, to: d1 }); fixCache.set(k, Array.isArray(r) ? r : r?.data || []); } fx.push(...fixCache.get(k)); }
    const best = fx.map(f => ({ f, s: sim(al(m.h[1]), f.participant1Name) + sim(al(m.a[1]), f.participant2Name), dt: Math.abs(Date.parse(f.startTime) / 1000 - m.ts) }))
      .filter(x => x.dt < 6 * 3600).sort((a, b) => b.s - a.s)[0];
    const rec = { partita: `${m.h[1]} - ${m.a[1]}`, ko: m.ts };
    if (!best || best.s < .9) { store[m.id] = { ...rec, nessuna: 'partita non trovata', tentativi: (store[m.id]?.tentativi || 0) + 1, provato: Math.floor(Date.now() / 1000) }; fatte++; continue; }
    rec.v = 2; rec.fx = best.f.fixtureId; rec.q = {};
    for (const g of BOOKS) {
      const o = await get('/historical-odds', { fixtureId: rec.fx, bookmakers: g });
      const atOf = hist => { const ok = (hist || []).filter(x => x.active && Date.parse(x.createdAt) / 1000 <= m.ts), at = t => ok.filter(x => Date.parse(x.createdAt) / 1000 <= t).pop()?.price ?? null; return [at(m.ts), at(m.ts - 86400)]; };
      for (const [b, v] of Object.entries(o?.bookmakers || {})) {
        const P = Object.values(v.markets?.[CARD]?.outcomes || {})[0]?.players;
        if (P) for (const [pid, hist] of Object.entries(P)) { const x = atOf(hist); if (x[0] != null) ((rec.q[b] ||= {}))[pid] = x; }
        for (const [key, alts] of [['f1', F1], ['f2', F2]]) for (const [mid, oid] of alts) {
          const PP = v.markets?.[mid]?.outcomes?.[oid]?.players; if (!PP) continue;
          for (const [pid, hist] of Object.entries(PP)) { const x = atOf(hist); if (x[0] == null) continue; const f = (((rec.f ||= {})[b] ||= {})[pid] ||= {}); if (!f[key]) f[key] = x; }
        }
        // cartellini della partita/squadre: per ogni linea Over e Under al via, poi la linea più equilibrata
        const L = {};
        for (const [mid, mv] of Object.entries(v.markets || {})) for (const [oid, ov] of Object.entries(mv.outcomes || {})) {
          const d = MK.get(oid); if (!d || d[3] !== mid) continue; const pr = atOf(Object.values(ov.players || {})[0])[0]; if (pr == null) continue;
          ((L[d[0]] ||= {})[d[1]] ||= {})[d[2]] = pr;
        }
        for (const [k, lines] of Object.entries(L)) {
          const best = Object.entries(lines).filter(([, x]) => x.Over && x.Under).sort((a, c) => Math.abs(Math.log(a[1].Over / a[1].Under)) - Math.abs(Math.log(c[1].Over / c[1].Under)))[0];
          if (best) ((rec.t ||= {})[b] ||= {})[k] = [+best[0], best[1].Over, best[1].Under];
        }
      }
    }
    if (Object.keys(rec.q).length) {
      if (!names) { const r = await get('/players', { sportId: 10 }); names = {}; for (const t of Object.values(r?.participants || {})) for (const x of t.players || []) names[x.playerId] = x.playerName; }
      for (const b of Object.keys(rec.q)) rec.q[b] = Object.fromEntries(Object.entries(rec.q[b]).map(([pid, v]) => [names[pid] || pid, v]));
      for (const b of Object.keys(rec.f || {})) rec.f[b] = Object.fromEntries(Object.entries(rec.f[b]).map(([pid, v]) => [names[pid] || pid, v]));
      store[m.id] = rec;
    } else store[m.id] = { ...rec, nessuna: 'nessuna quota cartellino', tentativi: (store[m.id]?.tentativi || 0) + 1, provato: Math.floor(Date.now() / 1000) };
    fatte++;
    console.log(`${rec.partita}: ${Object.entries(rec.q || {}).map(([b, q]) => b + ' ' + Object.keys(q).length).join(', ') || store[m.id].nessuna} · falli ${Object.keys(rec.f || {}).join('/') || '-'} · linea ${Object.entries(rec.t || {}).map(([b, t]) => b + ' ' + (t.tot?.[0] ?? '-')).join(', ') || '-'}`);
    fs.writeFileSync(file, JSON.stringify(store));
  }
  fs.writeFileSync(file, JSON.stringify(store));
}
console.log('partite lavorate:', fatte);
