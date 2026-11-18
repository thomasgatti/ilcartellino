// Sezione ANGOLI (13/11/2026): per le partite di Serie A, Champions ed Europa League (dal 18/11) dei prossimi 10 giorni e per i big match EXTRA,
// probabilità che nella partita si battano almeno 14 angoli in totale, con gli angoli attesi per squadra.
// Modello in cloud/angoli_modello.mjs (prova sul passato: bot/ammoniti/ricerca/angoli/angoli14.mjs). Non servono le formazioni.
// Scrive data.json → angoli = { updated, soglia, matches: [...], storico: [...], col: { idSquadra: [sfondo, testo] } }.
// La stima si ferma al calcio d'inizio; a partita finita gli angoli veri (FotMob) vanno nello storico della sezione.
// Gira dopo cloud/extra.mjs nella Giornata automatica. Uso: node cloud/angoli.mjs [archivio extra]
import fs from 'node:fs';
import './lib_node.mjs';
import { loadExtra, walk, train, SOGLIA } from './angoli_modello.mjs';

const XDIR = process.argv[2] || 'dati/extra', NDIR = process.argv[3] || 'dati/extra_naz', DATA = 'bot/webapp/data.json', ESITI = 'bot/webapp/vercel/risultati.json';
const hour = 3600, day = 86400, AHEAD = 10 * day, OPTS = { variante: 2, n: 20 };
const now = (process.env.CARTELLINO_ORA ? Date.parse(process.env.CARTELLINO_ORA) : Date.now()) / 1000;
const FORCE = process.env.ANGOLI_FORZA === '1';
// competizioni EXTRA → [archivio della competizione, campionato del paese (media di riserva per le coppe)]
const XLG = { 'Premier League': ['47', '47'], 'LaLiga': ['87', '87'], 'Bundesliga': ['54', '54'], 'Ligue 1': ['53', '53'], 'FA Cup': ['132', '47'], 'EFL Cup': ['133', '47'],
  'Copa del Rey': ['138', '87'], 'DFB Pokal': ['209', '54'], 'Coupe de France': ['134', '53'], 'Coppa Italia': ['141', '55'] };
// 18/11: Europa League aggiunta (prova sul passato, 457 gare 2023-27: modello meglio della media della competizione, 10% più alto 23,9% contro 12,0%).
// Conference (10216) no: il modello non distingue (AUC 0,48), metà delle squadre ha meno di 6 gare note nell'archivio.
const FISSE = [['sa', '55', 'Serie A'], ['ucl', '42', 'Champions League'], ['uel', '73', 'Europa League']];

const data = JSON.parse(fs.readFileSync(DATA, 'utf8'));
const ang = data.angoli ||= { updated: 0, soglia: SOGLIA, matches: [], storico: [], col: {} };
ang.matches ||= []; ang.storico ||= []; ang.col ||= {}; ang.soglia = SOGLIA;
const xm = (data.extra?.matches || []).filter(m => m.ko > now);
const nm = (data.cups?.naz?.matches || []).filter(m => m.ko > now);   // Nazionali (16/11): le partite della sezione Nazionali
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { for (let k = 0; k < 3; k++) { try { const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); if (r.status === 200) return await r.json(); if (r.status === 429) await sleep(4000); } catch {} await sleep(800); } return null; };

// --- quando ricalcolare: ogni 6 ore, se c'è un esito da archiviare o se in EXTRA è entrata una partita nuova
const due = ang.matches.some(m => now > m.ko + 2.5 * hour) || [...xm, ...nm].some(m => !ang.matches.some(x => x.id === m.id));
if (!FORCE && now - (ang.updated || 0) < 6 * hour && !due) { console.log('ANGOLI: niente da fare'); process.exit(0); }

const r2 = v => +v.toFixed(2), r3 = v => +v.toFixed(3);
let changed = false;

// --- 1. esiti delle partite finite
for (const m of [...ang.matches]) {
  if (now < m.ko + 2.5 * hour) continue;
  const j = await get('/api/data/matchDetails?matchId=' + m.id);
  if (!j) continue;
  const st = j.header?.status, drop = () => { ang.matches = ang.matches.filter(x => x.id !== m.id); changed = true; };
  if (st?.cancelled || st?.awarded || (now > m.ko + 2 * day && !st?.finished)) { drop(); continue; }
  if (!st?.finished) continue;
  const c = (j.content?.stats?.Periods?.All?.stats || []).flatMap(g => g.stats || []).find(s => s.key === 'corners')?.stats;
  if (!(Array.isArray(c) && c.length === 2 && c.every(Number.isFinite))) { if (now > m.ko + day) drop(); continue; }   // FotMob a volte pubblica le statistiche in ritardo
  const H = j.header.teams;
  ang.storico.unshift({ id: m.id, c: m.c, lega: m.lega, ko: m.ko, h: m.h, a: m.a, hc: m.hc, ac: m.ac, p: m.p, mu: m.mu, base: m.base, finale: `${H[0].score}-${H[1].score}`, ang: c });
  drop(); console.log('ANGOLI archiviata', m.h, m.a, c.join('-'));
}

// --- 2. modello sull'archivio
// club + nazionali in un unico allenamento; le nazionali sono un'unica competizione «naz» (prova: ricerca/angoli/angoli14_naz.mjs)
const ms = [...loadExtra(XDIR), ...loadExtra(NDIR, null, 'naz')].sort((a, b) => a.ts - b.ts);
if (ms.length < 3000) { console.log('ANGOLI: archivio extra assente o troppo piccolo (' + ms.length + ' partite)'); if (changed) fs.writeFileSync(DATA, JSON.stringify(data)); process.exit(0); }
const W = walk(ms, OPTS), M = train(W.rows);
// ultime 20 gare di ogni squadra: quante con almeno 14 angoli
const last = {}; for (const m of ms) for (const t of [m.h, m.a]) (last[t] ||= []).push(m.t.angoli[0] + m.t.angoli[1]);
const n14 = t => { const L = (last[t] || []).slice(-OPTS.n); return [L.filter(x => x >= SOGLIA).length, L.length]; };
const idByName = {}; for (const m of ms) { idByName[m.hn] = m.h; idByName[m.an] = m.a; }

// nomi italiani (classifiche) e colori già usati in pagina
const itName = {}; for (const g of [...(data.classifiche?.sa || []), ...(data.classifiche?.ucl || [])]) for (const r of g.rows || []) if (r[10]) itName[r[10]] = r[1];
const colByName = {}; for (const m of [...(data.matches || []), ...(data.cups?.ucl?.matches || []), ...(data.cups?.naz?.matches || []), ...(data.extra?.matches || [])]) { if (m.hc) colByName[m.h] = m.hc; if (m.ac) colByName[m.a] = m.ac; }
const cols = (id, name) => ang.col[id] || colByName[name] || null;

function stima(base, lg, riserva, hid, aid) {
  const f = W.feats(lg, hid, aid, riserva); if (!f) return null;
  const p = M.pred(f), nh = n14(hid), na = n14(aid);
  return { ...base, p: r3(p.p), mu: [r2(p.mh), r2(p.ma)], base: r3(W.freq(lg) ?? W.freq(riserva) ?? 0), sq: { h: [r2(f.med.h[0]), r2(f.med.h[1]), ...nh], a: [r2(f.med.a[0]), r2(f.med.a[1]), ...na] } };
}

// --- 3. partite: Serie A, Champions ed Europa League dal calendario FotMob, EXTRA dalla sezione EXTRA
const out = [], kept = new Set(); let calOk = true;
const keepOld = pred => { for (const m of ang.matches) if (pred(m) && !kept.has(m.id)) { out.push(m); kept.add(m.id); } };
keepOld(m => m.ko <= now);                                   // già iniziate: la stima resta quella del calcio d'inizio
for (const [c, lg, lega] of FISSE) {
  const j = await get('/api/data/leagues?id=' + lg);
  const list = j?.fixtures?.allMatches;
  if (!Array.isArray(list)) { console.log('ANGOLI: calendario non disponibile per', lega); calOk = false; keepOld(m => m.c === c); continue; }
  for (const f of list) {
    const ko = Date.parse(f.status?.utcTime) / 1000;
    if (!(ko > now) || ko > now + AHEAD || f.status?.cancelled || kept.has(+f.id) || !f.home?.id || !f.away?.id) continue;
    const h = itName[f.home.id] || f.home.name, a = itName[f.away.id] || f.away.name;
    const e = stima({ id: +f.id, c, lega, ko, h, a, hc: cols(f.home.id, h), ac: cols(f.away.id, a), hid: +f.home.id, aid: +f.away.id }, lg, null, +f.home.id, +f.away.id);
    if (e) { out.push(e); kept.add(e.id); } else console.log('ANGOLI: storico insufficiente per', h, '-', a);
  }
}
for (const m of xm) {
  if (kept.has(m.id)) continue;
  const [lg, riserva] = XLG[m.comp] || [null, null], hid = m.hid ?? idByName[m.h], aid = m.aid ?? idByName[m.a];
  if (!lg || !hid || !aid) continue;
  const e = stima({ id: m.id, c: 'extra', lega: m.comp, ko: m.ko, h: m.h, a: m.a, hc: m.hc || null, ac: m.ac || null, hid, aid }, lg, riserva, hid, aid);
  if (e) { out.push(e); kept.add(e.id); }
}
for (const m of nm) {
  if (kept.has(m.id)) continue;
  const hid = idByName[m.en?.[0]], aid = idByName[m.en?.[1]];
  if (!hid || !aid) { console.log('ANGOLI: nazionale non trovata in archivio per', m.h, '-', m.a); continue; }
  const e = stima({ id: m.id, c: 'naz', lega: 'Nations League', ko: m.ko, h: m.h, a: m.a, hc: m.hc || null, ac: m.ac || null, hid, aid }, 'naz', null, hid, aid);
  if (e) { out.push(e); kept.add(e.id); } else console.log('ANGOLI: storico insufficiente per', m.h, '-', m.a);
}
// colori mancanti (squadre mai viste in pagina): da FotMob, una volta sola
for (const m of out.filter(m => !m.hc || !m.ac).slice(0, 12)) {
  const tc = (await get('/api/data/matchDetails?matchId=' + m.id))?.general?.teamColors?.lightMode; if (!tc) continue;
  if (tc.home) ang.col[m.hid] = [tc.home, '#ffffff']; if (tc.away) ang.col[m.aid] = [tc.away, '#ffffff'];
  m.hc ||= ang.col[m.hid] || null; m.ac ||= ang.col[m.aid] || null;
}
ang.matches = out.sort((a, b) => a.ko - b.ko);

// --- 4. primo avvio: lo storico parte con le ultime tre settimane di Serie A e Champions, ricalcolate a posteriori
// (variabili note prima di ogni gara, modello allenato solo sulle gare precedenti alla prima di queste). Segnate con retro: 1.
if (!ang.storico.length && !ang.seme) {
  const t0 = now - 21 * day, prima = train(W.rows.filter(r => r.m.ts < t0));
  const seen = {}, base = {};
  for (const m of ms) { const L = (seen[m.lg] ||= []); if (m.ts >= t0) { const X = L.slice(-380); base[m.id] = (X.filter(t => t >= SOGLIA).length + 2) / (X.length + 16); } L.push(m.t.angoli[0] + m.t.angoli[1]); }
  for (const r of W.rows.filter(r => r.m.ts >= t0 && r.m.ts < now - 3 * hour && ['55', '42'].includes(r.m.lg))) {
    const p = prima.pred(r.f), h = itName[r.m.h] || r.m.hn, a = itName[r.m.a] || r.m.an;
    ang.storico.push({ id: r.m.id, c: r.m.lg === '55' ? 'sa' : 'ucl', lega: r.m.lg === '55' ? 'Serie A' : 'Champions League', ko: r.m.ts, h, a, hc: cols(r.m.h, h), ac: cols(r.m.a, a),
      p: r3(p.p), mu: [r2(p.mh), r2(p.ma)], base: r3(base[r.m.id]), ang: r.m.t.angoli, retro: 1 });
  }
  ang.storico.sort((a, b) => b.ko - a.ko); ang.seme = 1;
  console.log('ANGOLI: storico iniziale con', ang.storico.length, 'partite ricalcolate');
}
// --- 5. Nazionali già giocate (ultimi 30 giorni, quelle passate dalla sezione Nazionali) e non ancora nello storico degli angoli:
// si aggiungono ricalcolate (retro: 1) appena entrano in archivio, con un modello allenato solo sulle gare precedenti alla più vecchia.
try {
  const fatte = new Set(ang.storico.map(r => r.id)), inCorso = new Set(ang.matches.map(m => m.id));
  const esiti = JSON.parse(fs.readFileSync(ESITI, 'utf8')).filter(r => r.comp === 'naz' && r.ko > now - 30 * day && !fatte.has(r.matchId) && !inCorso.has(r.matchId));
  const righe = new Map(W.rows.filter(r => r.m.lg === 'naz').map(r => [r.m.id, r])), nuove = esiti.filter(r => righe.has(r.matchId));
  if (nuove.length) {
    const t0 = Math.min(...nuove.map(r => righe.get(r.matchId).m.ts)), prima = train(W.rows.filter(r => r.m.ts < t0));
    const seen = [], base = {}; for (const m of ms) if (m.lg === 'naz') { const X = seen.slice(-380); base[m.id] = (X.filter(t => t >= SOGLIA).length + 2) / (X.length + 16); seen.push(m.t.angoli[0] + m.t.angoli[1]); }
    for (const e of nuove) { const r = righe.get(e.matchId), p = prima.pred(r.f), [h, a] = e.partita.split(' - ');
      ang.storico.push({ id: e.matchId, c: 'naz', lega: 'Nations League', ko: e.ko, h, a, hc: colByName[h] || null, ac: colByName[a] || null, p: r3(p.p), mu: [r2(p.mh), r2(p.ma)], base: r3(base[e.matchId]), finale: e.finale, ang: r.m.t.angoli, retro: 1 }); }
    ang.storico.sort((a, b) => b.ko - a.ko);
    console.log('ANGOLI: nazionali ricalcolate nello storico:', nuove.length);
  }
} catch (e) { console.log('ANGOLI: nazionali nello storico non aggiunte:', e.message); }
ang.storico = ang.storico.slice(0, 400);
ang.n = M.n; ang.updated = calOk ? Math.round(now) : 0;   // calendario mancante: si riprova al giro dopo
fs.writeFileSync(DATA, JSON.stringify(data));
console.log('ANGOLI aggiornata:', ang.matches.length, 'partite,', ang.storico.length, 'nello storico ·', ang.matches.map(m => `${m.h}-${m.a} ${Math.round(m.p * 100)}%`).join(', '));
