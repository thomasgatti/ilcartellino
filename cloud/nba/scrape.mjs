// Archivio NBA (13/11/2026): statistiche partita per partita e giocatore per giocatore da ESPN (site.api.espn.com), nel ramo dati, cartella nba/.
// stats.nba.com e cdn.nba.com non rispondono dai runner di GitHub (vedi RUNBOOK): ESPN sì, con titolari, minuti, motivo del «non entrato» e linea prepartita.
// Uso: node cloud/nba/scrape.mjs <cartella nba> [minuti massimi] [primo giorno AAAAMMGG]
// File:
//   <stagione>.json.gz  (es. 2026-2027) { "<id ESPN>": { ts, g (giorno USA AAAAMMGG), tipo (2 stagione regolare, 3 playoff, 5 play-in), nota, neutro, tempi,
//       h: [id squadra, sigla, punti], a: [...], linea: [handicap della squadra di casa, totale punti] | null,
//       t: { h: {fga, fta, oreb, dreb, reb, ast, stl, blk, to, pf}, a: {...} },
//       p: [[id, lato (1 casa), titolare, min, pts, reb, ast, stl, blk, to, fgm, fga, tpm, tpa, ftm, fta, oreb, dreb, pf, +/-]],   solo chi è entrato
//       np: [[id, lato, motivo]] } }                                                                                              a referto ma non entrati
//   giocatori.json  { id: [nome, ruolo ESPN, id ultima squadra] }
//   indice.json     { giorni: { AAAAMMGG: numero di partite archiviate } }   giorni chiusi, da non riscaricare
//   infortuni/<AAAA-MM>.json  { "AAAA-MM-GG": [[id giocatore, sigla squadra, stato, tipo, rientro previsto, data nota]] }   fotografia giornaliera (lo storico non esiste)
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const OUT = process.argv[2] || 'dati/nba', MAXMIN = +(process.argv[3] || 25), DAL = process.argv[4] || '20201201', T0 = Date.now();
const E = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/', UA = 'ilcartellino-bot (progetto personale, github.com/thomasgatti/ilcartellino)';
fs.mkdirSync(path.join(OUT, 'infortuni'), { recursive: true });
const loadGz = f => fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f))) : {};
const loadJ = (f, d) => fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : d;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { for (let k = 0; k < 4; k++) { try { const r = await fetch(u, { headers: { 'User-Agent': UA }, signal: AbortSignal.timeout(30000) }); if (r.status === 200) return await r.json(); if (r.status === 404 || r.status === 400) return null; if (r.status === 429 || r.status === 403) await sleep(15000); } catch {} await sleep(1500 * (k + 1)); } return null; };
const fuori = () => (Date.now() - T0) / 60000 > MAXMIN;
const n = v => { const x = parseFloat(v); return Number.isFinite(x) ? x : 0; }, due = v => String(v || '').split('-').map(n);

export function parsePartita(j) {
  const c = j.header?.competitions?.[0], B = j.boxscore; if (!c || !B?.players?.length) return null;
  const lato = {}, o = { tempi: 0 };
  for (const x of c.competitors) { lato[x.id] = x.homeAway === 'home' ? 1 : 0; o[x.homeAway === 'home' ? 'h' : 'a'] = [+x.id, x.team.abbreviation, n(x.score)]; o.tempi = Math.max(o.tempi, x.linescores?.length || 0); }
  const pc = (j.pickcenter || []).find(p => p.spread != null || p.overUnder != null); o.linea = pc ? [pc.spread ?? null, pc.overUnder ?? null] : null;
  o.t = {}; o.p = []; o.np = []; const G = {};
  for (const T of B.teams || []) { const s = {}; for (const x of T.statistics || []) s[x.name] = x.displayValue; const [, fga] = due(s['fieldGoalsMade-fieldGoalsAttempted']), [, fta] = due(s['freeThrowsMade-freeThrowsAttempted']);
    o.t[lato[T.team.id] ? 'h' : 'a'] = { fga, fta, oreb: n(s.offensiveRebounds), dreb: n(s.defensiveRebounds), reb: n(s.totalRebounds), ast: n(s.assists), stl: n(s.steals), blk: n(s.blocks), to: n(s.totalTurnovers ?? s.turnovers), pf: n(s.fouls) }; }
  for (const T of B.players) { const S = T.statistics?.[0]; if (!S) continue; const L = lato[T.team.id], ix = Object.fromEntries(S.names.map((k, i) => [k, i]));
    for (const a of S.athletes || []) { const id = +a.athlete.id; G[id] = [a.athlete.displayName, a.athlete.position?.abbreviation || '', +T.team.id];
      const st = a.stats || [], v = k => st[ix[k]], min = n(v('MIN'));
      if (a.didNotPlay || !st.length || (!min && !n(v('PTS')) && !n(v('REB')) && !n(v('AST')))) { o.np.push([id, L, a.reason || '']); continue; }
      const [fgm, fga] = due(v('FG')), [tpm, tpa] = due(v('3PT')), [ftm, fta] = due(v('FT'));
      o.p.push([id, L, a.starter ? 1 : 0, min, n(v('PTS')), n(v('REB')), n(v('AST')), n(v('STL')), n(v('BLK')), n(v('TO')), fgm, fga, tpm, tpa, ftm, fta, n(v('OREB')), n(v('DREB')), n(v('PF')), n(v('+/-'))]); } }
  if (o.p.length < 10 || !o.h || !o.a) return null;
  return [o, G];
}
const stagione = y => `${y - 1}-${y}`;
const giornoUSA = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d).replace(/-/g, '');

if (import.meta.url === 'file://' + process.argv[1]) {
  const fI = path.join(OUT, 'indice.json'), fG = path.join(OUT, 'giocatori.json'), IDX = loadJ(fI, { giorni: {} }), GIOC = loadJ(fG, {}), ARCH = {}, sporchi = new Set();
  const arch = y => ARCH[y] ||= loadGz(path.join(OUT, stagione(y) + '.json.gz'));
  const salva = () => { for (const y of sporchi) fs.writeFileSync(path.join(OUT, stagione(y) + '.json.gz'), zlib.gzipSync(JSON.stringify(ARCH[y]))); sporchi.clear(); fs.writeFileSync(fI, JSON.stringify(IDX)); fs.writeFileSync(fG, JSON.stringify(GIOC)); };
  // 1) calendario: tutti i giorni non ancora chiusi, dal più recente (così l'aggiornamento giornaliero è immediato e lo storico procede all'indietro)
  const oggi = giornoUSA(), giorni = [];
  for (let d = new Date(Date.UTC(+oggi.slice(0, 4), +oggi.slice(4, 6) - 1, +oggi.slice(6))); ; d = new Date(+d - 864e5)) { const k = d.toISOString().slice(0, 10).replace(/-/g, ''); if (k < DAL) break; const m = +k.slice(4, 6); if (!(k in IDX.giorni) && (m <= 7 || m >= 10 || k.slice(4) >= '0925')) giorni.push(k); }
  console.log(`giorni da controllare: ${giorni.length} (dal ${giorni.at(-1) || '-'} al ${giorni[0] || '-'})`);
  const coda = []; let gi = 0, viste = 0;
  await Promise.all([0, 1, 2, 3].map(async () => { while (gi < giorni.length && !fuori()) { const g = giorni[gi++], j = await get(E + 'scoreboard?dates=' + g + '&limit=100'); if (!j) continue;
    let aperte = 0, buone = 0;
    for (const e of j.events || []) { const c = e.competitions?.[0], tipo = e.season?.type, st = e.status?.type?.name; if (![2, 3, 5].includes(tipo) || c?.type?.abbreviation === 'ALLSTAR' || c.competitors.some(x => +x.team.id > 30)) continue;
      if (st === 'STATUS_POSTPONED' || st === 'STATUS_CANCELED') continue; if (st !== 'STATUS_FINAL') { aperte++; continue; }
      buone++; const y = e.season.year, A = arch(y), ts = Math.floor(Date.parse(e.date) / 1000), fresca = Date.now() / 1000 - ts < 3 * 86400;
      if (!A[e.id] || (fresca && !A[e.id].rivista)) coda.push({ id: e.id, y, g, base: { ts, g, tipo, nota: c.notes?.[0]?.headline || '', neutro: c.neutralSite ? 1 : 0 }, fresca: fresca && !!A[e.id] }); }
    viste++; IDX._tmp ||= {}; IDX._tmp[g] = [aperte, buone]; await sleep(60); } }));
  // 2) partite
  console.log(`giorni letti: ${viste} · partite da scaricare: ${coda.length}`);
  coda.sort((a, b) => b.base.ts - a.base.ts); let pi = 0, ok = 0, vuote = 0; const mancanti = {};
  await Promise.all([0, 1, 2].map(async () => { while (pi < coda.length && !fuori()) { const q = coda[pi++], j = await get(E + 'summary?event=' + q.id), r = j && parsePartita(j);
    if (!r) { vuote++; mancanti[q.g] = 1; if (vuote <= 20) console.log('senza tabellino:', q.id, q.g); continue; }
    const [o, G] = r; arch(q.y)[q.id] = { ...q.base, ...o, ...(q.fresca ? { rivista: 1 } : {}) }; Object.assign(GIOC, G); sporchi.add(q.y); ok++;
    if (ok % 300 === 0) { console.log(`  ${ok}/${coda.length} · ${((Date.now() - T0) / 60000).toFixed(1)} min`); }
    await sleep(120); } }));
  for (; pi < coda.length; pi++) mancanti[coda[pi].g] = 1;
  // un giorno si chiude quando è passato da almeno 4 giorni (correzioni ufficiali comprese), non ha partite in sospeso e tutte quelle finite sono in archivio
  const lim = giornoUSA(new Date(Date.now() - 4 * 864e5));
  for (const [g, [aperte, buone]] of Object.entries(IDX._tmp || {})) if (g < lim && !aperte && !mancanti[g]) IDX.giorni[g] = buone;
  delete IDX._tmp;
  // 3) fotografia degli infortuni di oggi
  if (!process.env.NBA_SENZA_INFORTUNI) { const j = await get(E + 'injuries'); if (j?.injuries) { const righe = [];
    for (const T of j.injuries) for (const x of T.injuries || []) righe.push([+x.athlete?.id || +(x.athlete?.links?.[0]?.href?.match(/id\/(\d+)/)?.[1] || 0), x.athlete?.team?.abbreviation || T.displayName, x.status, x.details?.type || '', x.details?.returnDate || '', (x.date || '').slice(0, 16), x.athlete?.displayName || '']);
    const d = new Date().toISOString().slice(0, 10), f = path.join(OUT, 'infortuni', d.slice(0, 7) + '.json'), M = loadJ(f, {}); M[d] = righe; fs.writeFileSync(f, JSON.stringify(M)); console.log('infortuni di oggi:', righe.length); } }
  salva();
  const tot = fs.readdirSync(OUT).filter(f => f.endsWith('.json.gz')).map(f => f.replace('.json.gz', '') + ': ' + Object.keys(loadGz(path.join(OUT, f))).length);
  console.log(`scaricate ${ok}, senza tabellino ${vuote}, rimaste ${coda.length - pi > 0 ? coda.length - pi : 0} · ${((Date.now() - T0) / 60000).toFixed(1)} min\narchivio: ${tot.join(' · ')}\ngiorni chiusi: ${Object.keys(IDX.giorni).length}${fuori() ? ' · TEMPO FINITO: rilanciare per continuare' : ''}`);
}
