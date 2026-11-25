// Quote «over 13,5 angoli» per le proposte della sezione Angoli (25/11/2026), da OddsPapi.
// Usa una chiave gratuita a parte, segreto ODDSPAPI_KEY_ANGOLI (250 richieste al mese): quella dei cartellini (ODDSPAPI_KEY) era già finita.
// Senza chiave non fa nulla. Consumo: per ogni proposta una sola lettura nelle 8 ore prima del via (più una se la proposta cambia),
// e una richiesta /fixtures per competizione e giro: circa 4 richieste al giorno, ~120 al mese.
// Scrive in data.json → angoli.matches[i].q = { agg, b (bookmaker), over, under, fx } oppure { agg, nota } se non trovata.
// Il mercato (id del totale angoli 13,5) si cerca una volta sola con /markets e resta in angoli.qmk.
// Con la quota mensile finita si ferma per 24 ore (angoli.qstop). Uso: node cloud/quote_angoli.mjs
import fs from 'node:fs';

const KEY = process.env.ODDSPAPI_KEY_ANGOLI, DATA = 'bot/webapp/data.json', B = 'https://api.oddspapi.io/v4';
if (!KEY) { console.log('Quote angoli: manca il segreto ODDSPAPI_KEY_ANGOLI, niente da fare'); process.exit(0); }
const BOOKS = ['sisal.it', 'bet365.it', 'eurobet.it', 'snai.it', 'goldbet.it'], NOME = { 'sisal.it': 'Sisal', 'bet365.it': 'bet365', 'eurobet.it': 'Eurobet', 'snai.it': 'Snai', 'goldbet.it': 'Goldbet' };
// id OddsPapi dei tornei (gli stessi di Sportradar)
const TOUR = { sa: 23, ucl: 7, uel: 679, naz: 23755, 'Premier League': 17, 'LaLiga': 8, 'Bundesliga': 35, 'Ligue 1': 34, 'FA Cup': 19, 'EFL Cup': 21, 'Copa del Rey': 329, 'DFB Pokal': 217, 'Coupe de France': 335, 'Coppa Italia': 328 };
const LINEA = 13.5, MAX_ODDS = 4, PRIMA = 8 * 3600;
const now = Date.now() / 1000, sleep = ms => new Promise(r => setTimeout(r, ms));
const data = JSON.parse(fs.readFileSync(DATA, 'utf8')), ang = data.angoli;
if (!ang?.matches?.length) process.exit(0);
if (ang.qstop && now - ang.qstop < 24 * 3600) { console.log('Quote angoli: quota mensile finita, riprovo dopo 24 ore'); process.exit(0); }

class QuotaFinita extends Error {}
let chiamate = 0;
async function get(p, q = {}) {
  for (let k = 0; k < 2; k++) {
    await sleep(3500); chiamate++;
    const u = new URL(B + p); for (const [a, v] of Object.entries({ ...q, apiKey: KEY })) u.searchParams.set(a, v);
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) });
    if (r.status === 429) { const t = await r.text(); if (/REQUEST_LIMIT/i.test(t)) throw new QuotaFinita(t.slice(0, 120)); await sleep(2500); continue; }
    if (!r.ok) return null; return r.json();
  }
  return null;
}
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(fc|ac|as|ss|us|ssc|calcio|cf|club|sv|afc)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const tri = s => { const t = new Set(), x = '  ' + norm(s) + ' '; for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3)); return t; };
const sim = (a, b) => { const A = tri(a), C = tri(b); let k = 0; for (const x of A) if (C.has(x)) k++; return k / Math.max(1, Math.min(A.size, C.size)); };

let cambiato = false;
try {
  // mercato del totale angoli: una volta sola (o di nuovo dopo una settimana, se non trovato)
  if (!ang.qmk || (ang.qmk.nessuno && now - ang.qmk.agg > 7 * 86400)) {
    const r = await get('/markets', { sportId: 10 }), A = Array.isArray(r) ? r : r?.data || [];
    const m = A.find(m => /corner/i.test(m.marketType + ' ' + m.marketName) && /^totals/.test(m.marketType) && !/team/i.test(m.marketType) && m.period === 'fulltime' && +m.handicap === LINEA);
    const o = k => String(m?.outcomes?.find(x => new RegExp(k, 'i').test(x.outcomeName))?.outcomeId || '');
    ang.qmk = m ? { id: String(m.marketId), over: o('over'), under: o('under'), nome: m.marketName, agg: Math.round(now) } : { nessuno: 1, agg: Math.round(now) };
    console.log('Quote angoli: mercato', JSON.stringify(ang.qmk)); cambiato = true;
  }
  if (ang.qmk.nessuno) throw new Error('mercato «totale angoli 13,5» non trovato su OddsPapi');
  const ids = new Set(Object.values(ang.proposte || {}).flatMap(p => p.ids || []));
  const due = ang.matches.filter(m => ids.has(m.id) && m.ko > now && m.ko - now < PRIMA && !m.q).sort((a, b) => a.ko - b.ko).slice(0, MAX_ODDS);
  if (!due.length) { console.log('Quote angoli: nessuna proposta da leggere'); }
  const fixCache = {};
  for (const m of due) {
    const t = TOUR[m.c === 'extra' ? m.lega : m.c]; if (!t) { m.q = { agg: Math.round(now), nota: 'competizione non coperta' }; cambiato = true; continue; }
    if (!fixCache[t]) { const d0 = new Date((now - 86400) * 1000).toISOString().slice(0, 10), d1 = new Date((now + 2 * 86400) * 1000).toISOString().slice(0, 10);
      const r = await get('/fixtures', { tournamentId: t, from: d0, to: d1 }); fixCache[t] = Array.isArray(r) ? r : r?.data || []; }
    const en = m.en || [m.h, m.a];
    const best = fixCache[t].map(f => ({ f, s: sim(en[0], f.participant1Name) + sim(en[1], f.participant2Name), dt: Math.abs(Date.parse(f.startTime) / 1000 - m.ko) }))
      .filter(x => x.dt < 6 * 3600).sort((a, b) => b.s - a.s)[0];
    if (!best || best.s < .9) { m.q = { agg: Math.round(now), nota: 'partita non trovata' }; cambiato = true; console.log('Quote angoli: non trovata', m.h, '-', m.a); continue; }
    const o = await get('/odds', { fixtureId: best.f.fixtureId, bookmakers: BOOKS.join(',') }); if (!o) continue;
    const pr = (b, oid) => { const x = Object.values(o.bookmakerOdds?.[b]?.markets?.[ang.qmk.id]?.outcomes?.[oid]?.players || {})[0]; return x && x.active !== false && x.price > 1 ? x.price : null; };
    const b = BOOKS.find(b => pr(b, ang.qmk.over));
    m.q = b ? { agg: Math.round(now), b: NOME[b], over: pr(b, ang.qmk.over), under: pr(b, ang.qmk.under), fx: best.f.fixtureId } : { agg: Math.round(now), nota: 'nessun bookmaker italiano con la linea 13,5', fx: best.f.fixtureId };
    cambiato = true;
    console.log(`Quote angoli ${m.h}-${m.a}: ${b ? NOME[b] + ' over 13,5 a ' + m.q.over + ' (equa ' + (1 / m.p).toFixed(2) + ')' : m.q.nota}`);
  }
  if (ang.qstop) { delete ang.qstop; cambiato = true; }
} catch (e) {
  if (e instanceof QuotaFinita) { ang.qstop = Math.round(now); cambiato = true; console.log('::warning title=OddsPapi angoli::quota mensile finita: niente quote angoli per 24 ore'); }
  else console.log('Quote angoli:', e.message);
}
if (cambiato) fs.writeFileSync(DATA, JSON.stringify(data));
console.log('Quote angoli: richieste OddsPapi in questo giro', chiamate);
