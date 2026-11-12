// Aggiorna le ufficiali e gli esiti delle partite presenti nell'app. Avanza da solo la giornata di Serie A e di Champions,
// e completa arbitro (con le sue medie) e linea cartellini (stima del modello se manca quella del mercato).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLib } from './lib_node.mjs';
import { makeTagger } from './etichette.mjs';
import { loadContesto } from './contesto.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const app = path.join(root, 'bot/webapp');
const bot = path.join(root, 'bot/ammoniti');
const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const write = (f, value) => fs.writeFileSync(f, JSON.stringify(value));
const files = {
  data: path.join(app, 'data.json'),
  results: path.join(app, 'vercel/risultati.json'),
  lineups: path.join(app, 'lineups.txt'),
  tris: path.join(app, 'tris_app.json'),
};
const now = (process.env.CARTELLINO_ORA ? Date.parse(process.env.CARTELLINO_ORA) : Date.now()) / 1000;   // CARTELLINO_ORA solo per le prove
const hour = 3600;
const historic = process.argv[2] || path.join(root, 'dati/fotmob');
const python = process.env.PYTHON || 'python3';
const data = read(files.data);
const results = read(files.results);
const tris = read(files.tris);
const savedTris = new Map(tris.map(t => [t.id,t]));
// Il tris registrato va rivisto (e, se cambia, esce dal bilancio prepartita) quando a partita iniziata uno dei tre non è titolare,
// oppure quando le ufficiali sono arrivate solo dopo il calcio d'inizio e il tris era stato registrato sulle probabili (uff_late = 1:
// es. Napoli-Lazio dell'8/11, Vergara non era nelle probabili). Se sulle ufficiali il tris è lo stesso, resta com'è.
function needsTrisRevision(m) {
  const prior = savedTris.get(m.id);
  return m.uff && m.ko <= now && prior?.trio?.length === 3 && !prior.revised &&
    (prior.trio.some(t => !m.pl.some(p => p[0] === t.n && (p[6] ?? 100) === 100)) || (m.uff_late === 1 && prior.uff === false));
}
const seen = new Set(results.map(r => r.matchId));
const rounds = [{comp:'sa', section:data, matches:data.matches}];
if (data.cups?.ucl?.matches?.length) {
  rounds.push({comp:'ucl', section:data.cups.ucl, matches:data.cups.ucl.matches});
}
// Nazionali (Nations League A): le partite entrano una per una nelle 72 ore prima del calcio d'inizio.
{
  const section = data.cups?.naz || {name:'Nations League', round:'', season:'2026-27', matches:[]};
  rounds.push({comp:'naz', section, matches:section.matches});
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cartellino-'));
const cache = new Map();
const prepared = new Map();
const field = new Map(fs.readFileSync(files.lineups,'utf8').trim().split(/\r?\n/).filter(Boolean).map(l => [+l.split('|')[0],l]));
const request = globalThis.fetch;
// Modello, campo e statistiche leggono lo stesso tabellino per tutta l'esecuzione.
globalThis.fetch = (url, opts) => {
  const key = String(url);
  if (!key.startsWith('/api/data/matchDetails?')) return request(url, {...opts, signal:AbortSignal.timeout(15000)});
  const id = Number(key.split('=')[1]);
  if (prepared.has(id)) return Promise.resolve({json:async () => structuredClone(prepared.get(id).j)});
  if (!cache.has(key)) cache.set(key, request(url, {...opts, signal:AbortSignal.timeout(15000)}).then(async response => {
    if (!response.ok) throw new Error(`FotMob ${response.status}: ${key}`);
    const value = await response.json();
    if (!value.header?.status || !value.general?.matchId) throw new Error(`Tabellino incompleto: ${key}`);
    return value;
  }));
  return cache.get(key).then(value => ({json:async () => structuredClone(value)}));
};
const matchDetails = id => fetch('/api/data/matchDetails?matchId=' + id).then(r => r.json());
const validLineup = (lineup, type) => lineup?.lineupType === type && [lineup.homeTeam,lineup.awayTeam].every(team =>
  team?.formation && team.starters?.length === 11 && new Set(team.starters.map(p => p.id)).size === 11 &&
  team.starters.every(p => p.id && p.name && p.usualPlayingPositionId != null));
const warn = (m, e) => console.warn(`Partita ${m.id}: ${e.message}`);
const short = n => n.includes(' ') ? n[0] + '. ' + n.slice(n.indexOf(' ') + 1) : n;
const norm = n => n.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}]/gu, '');
loadLib(['field_lineups.js']);

async function prepareLineup(id, raw, verifiedOut = []) {
  const j = structuredClone(raw);
  const lineup = j.content.lineup;
  const excluded = new Set();
  if (lineup.lineupType !== 'standard') {
    for (const id of verifiedOut) excluded.add(id);
    for (const team of [lineup.homeTeam, lineup.awayTeam]) {
      for (const player of team.unavailable || []) {
        const reason = player.unavailability;
        const id = Number(player.id);
        if (!id || !/^(injury|suspension)$/i.test(reason?.type || '') || /doubtful|back in training/i.test(reason.expectedReturn || '')) continue;
        excluded.add(id);
      }
    }
    for (const team of [lineup.homeTeam, lineup.awayTeam]) {
      team.starters = team.starters.filter(player => !excluded.has(+player.id));
      if (team.subs) team.subs = team.subs.filter(player => !excluded.has(+player.id));
    }
  }
  const abs = [...excluded].sort((a,b) => a-b);
  const item = {id,j,excluded,abs};
  prepared.set(id,item);
  item.line = globalThis.fieldExport(await globalThis.fieldLineups([id]));
  if (!item.line) throw new Error('Formazione in campo mancante');
  return item;
}

function startModel(cutoff) {
  loadLib(['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js',
    'deep_feats.js', 'cup_x3.js', 'hot_feats.js', 'ctx_feats.js', 'sa_export.js', 'amm_boot.js']);
  const all = fs.readdirSync(historic).filter(f => f.endsWith('.json.gz')).flatMap(f =>
    Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(historic, f))))));
  const before = all.filter(m => m.ts && m.ts < cutoff && m.pl?.length > 20);
  if (!before.some(m => m.lg === 55) || !before.some(m => m.lg === 42)) throw new Error('Archivio del modello incompleto');
  globalThis.idbAll = async name => Object.fromEntries(before.flatMap(m => {
    if (name === 'amm') return m.lg === 55 ? [[m.id,m]] : [];
    if (name === 'amm_ucl') return m.lg === 42 ? [[m.id,m]] : [];
    if (name === 'amm_dom') return ![55,42].includes(m.lg) ? [[m.id,m]] : [];
    return m.x ? [[m.id,m.x]] : [];
  }));
  try { globalThis.__CTX = loadContesto(path.dirname(historic), before); console.log(`Contesto: quote ${globalThis.__CTX.quote.size}, possesso ${globalThis.__CTX.poss.size}`); }
  catch (e) { console.warn('Contesto non caricato:', e.message); }
  const odds = globalThis.fmOdds;
  globalThis.fmOdds = async ids => Object.fromEntries(Object.entries(await odds(ids)).filter(([,v]) => v.p));
  return globalThis.ammBuild();
}

// Calendario della giornata (Serie A: FotMob 55, 10 partite; Champions fase campionato: FotMob 42, 18 partite).
// Passa alla giornata successiva quando quella in corso è tutta archiviata e la prossima inizia entro 72 ore e almeno metà
// delle partite ha una formazione (ultima, probabile o ufficiale). Le partite rimaste fuori entrano ai giri successivi.
const LEAGUE = {sa:{id:55,size:10}, ucl:{id:42,size:18}, naz:{id:9806,size:0}};
async function syncRound(round, archived) {
  if (round.comp === 'naz') return syncNaz(round);
  const season = round.section.season?.replace(/^(\d{4})-(\d{2})$/, '$1/20$2');
  if (!season) return;
  const {id:league,size} = LEAGUE[round.comp];
  const current = Number(round.section.round);
  const finishedAll = round.matches.length > 0 && round.matches.every(m => archived.has(m.id));
  if (!finishedAll && round.matches.length >= size) return;
  const response = await fetch(`/api/data/leagues?id=${league}&season=` + encodeURIComponent(season));
  if (!response.ok) throw new Error(`Calendario ${round.comp}: FotMob ${response.status}`);
  const list = (await response.json()).fixtures?.allMatches || [];
  const day = finishedAll ? current + 1 : current;
  const known = new Set(round.matches.map(m => m.id));
  const fixtures = list.filter(m => Number(m.round) === day && !m.status?.cancelled);
  const todo = fixtures.filter(m => !known.has(+m.id) && Date.parse(m.status.utcTime) / 1000 > now);
  if (!todo.length) return;
  if (finishedAll) {
    const first = Math.min(...fixtures.map(m => Date.parse(m.status.utcTime) / 1000));
    if (fixtures.length !== size || first <= now || first > now + Number(process.env.CARTELLINO_ANTICIPO_ORE || 72) * hour) return;
  }
  const loaded = await Promise.allSettled(todo.map(m => matchDetails(+m.id)));
  const ready = loaded.flatMap((r, i) => {
    if (r.status !== 'fulfilled') { warn(todo[i], r.reason); return []; }
    const j = r.value, lu = j.content?.lineup;
    return ['lastStarting11','predicted','standard'].some(t => validLineup(lu,t)) ? [{id:+todo[i].id, j}] : [];
  });
  console.log(`Giornata ${round.comp} ${day}: formazioni pronte ${ready.length}/${todo.length}`);
  if (!ready.length || (finishedAll && ready.length < Math.ceil(size / 2))) return;
  round.pending = await Promise.all(ready.map(({id,j}) => prepareLineup(id,j)));
  for (const item of round.pending) item.beforeKickoff = true;
  if (finishedAll) round.advance = day; else round.append = true;
}

// Nazionali: classifica dei gironi e posta in palio (quarti per le prime due, spareggio per la terza, retrocessione per la quarta).
const NAZ_IT = {Italy:'Italia', France:'Francia', Belgium:'Belgio', Turkiye:'Turchia', Turkey:'Turchia', Netherlands:'Olanda', Greece:'Grecia',
  Germany:'Germania', Serbia:'Serbia', Spain:'Spagna', England:'Inghilterra', Croatia:'Croazia', Czechia:'Rep. Ceca', 'Czech Republic':'Rep. Ceca',
  Portugal:'Portogallo', Denmark:'Danimarca', Wales:'Galles', Norway:'Norvegia', Albania:'Albania', Finland:'Finlandia', Belarus:'Bielorussia',
  'San Marino':'San Marino', Switzerland:'Svizzera', Scotland:'Scozia', Slovenia:'Slovenia', 'North Macedonia':'Macedonia del Nord', Sweden:'Svezia',
  Poland:'Polonia', Romania:'Romania', Austria:'Austria', Ireland:'Irlanda', Hungary:'Ungheria', Ukraine:'Ucraina', 'Northern Ireland':'Irlanda del Nord',
  Georgia:'Georgia', Kosovo:'Kosovo', Israel:'Israele', 'Bosnia and Herzegovina':'Bosnia', Iceland:'Islanda', Slovakia:'Slovacchia', Montenegro:'Montenegro'};
const it = n => NAZ_IT[n] || n;
const ART = {Italia:"l'", Inghilterra:"l'", Olanda:"l'", Belgio:'il ', Portogallo:'il ', Galles:'il ', Albania:"l'", Austria:"l'", Irlanda:"l'", Ungheria:"l'", Ucraina:"l'", Islanda:"l'", Israele:"l'", Kosovo:'il ', Montenegro:'il ', Lussemburgo:'il ', 'San Marino':'', 'Irlanda del Nord':"l'"};
const art = n => (ART[n] ?? 'la ') + n;
// Per ogni squadra la posizione finale migliore e peggiore su tutti gli esiti (V/N/P) delle partite rimaste; a pari punti vale il caso peggiore/migliore.
function groupRanks(table, left) {
  const ids = table.map(t => t.id), range = Object.fromEntries(ids.map(id => [id, [5, 0]]));
  const pts0 = Object.fromEntries(table.map(t => [t.id, t.pts]));
  for (let k = 0; k < 3 ** left.length; k++) {
    const pts = {...pts0};
    left.forEach((m, i) => { const o = Math.floor(k / 3 ** i) % 3; if (o === 0) pts[m.h] += 3; else if (o === 2) pts[m.a] += 3; else { pts[m.h]++; pts[m.a]++; } });
    for (const id of ids) {
      const best = 1 + ids.filter(x => x !== id && pts[x] > pts[id]).length, worst = 1 + ids.filter(x => x !== id && pts[x] >= pts[id]).length;
      range[id] = [Math.min(range[id][0], best), Math.max(range[id][1], worst)];
    }
  }
  return range;
}
// Zone della classifica dalla legenda FotMob del girone (Lega A: quarti, spareggio, retrocessione; Lega B e C: promozione e spareggi).
const ZONE = {championship_playoff:['i quarti', 1], promotion:['la promozione', 1], promotionqual:['lo spareggio promozione', 1],
  relegationqual:['lo spareggio salvezza', -1], relegation:['la retrocessione', -1]};
function stakeOf([best, worst], zoneAt) {
  const bz = zoneAt(best), wz = zoneAt(worst), lab = z => ZONE[z][0];
  if (best === worst) return `già ${best}ª` + (bz ? `: ${lab(bz)}` : '');
  if (bz && bz === wz && ZONE[bz][1] > 0) return (bz === 'championship_playoff' ? 'già ai quarti' : `${lab(bz).replace(/^\S+ /, '')} già sicura`) + (best === 1 ? ', si gioca il primo posto' : '');
  if (bz && ZONE[bz][1] > 0) return `in corsa per ${lab(bz)}` + (wz && ZONE[wz][1] < 0 ? `, ma rischia anche ${lab(wz)}` : '');
  if (wz && ZONE[wz][1] < 0) return `lotta per evitare ${lab(wz)}` + (bz && bz !== wz ? `, al massimo ${lab(bz)}` : '');
  return 'senza obiettivi di classifica';
}
function nazStakes(j) {
  const out = new Map();
  const fixtures = j.fixtures?.allMatches || [];
  const lega = (j.details?.name || '').replace(/^UEFA Nations League /, 'Lega ');
  for (const g of j.table?.[0]?.data?.tables || []) {
    const table = g.table?.all || [];
    if (table.length !== 4) continue;
    const legend = g.legend || j.table[0].data.legend || [];
    const zoneAt = pos => legend.find(l => ZONE[l.tKey] && l.indices.includes(pos - 1))?.tKey || null;
    const ids = new Set(table.map(t => t.id)), name = Object.fromEntries(table.map(t => [t.id, it(t.name)]));
    const pts = Object.fromEntries(table.map(t => [t.id, t.pts])), pos = Object.fromEntries(table.map(t => [t.id, t.idx]));
    const left = fixtures.filter(m => ids.has(+m.home.id) && ids.has(+m.away.id) && !m.status?.finished && !m.status?.cancelled)
      .map(m => ({id:+m.id, h:+m.home.id, a:+m.away.id}));
    const range = groupRanks(table, left);
    for (const m of left) {
      const lines = [];
      for (const me of [m.h, m.a]) {
        let line = `${name[me]} (${pos[me]}ª, ${pts[me]} punti): ${stakeOf(range[me], zoneAt)}`;
        if (range[me][0] !== range[me][1]) {
          const above = table.filter(t => t.id !== me && t.pts > pts[me] && t.pts <= pts[me] + 3);
          const reach = above.filter(t => t.pts === pts[me] + 3), pass = above.filter(t => t.pts < pts[me] + 3);
          const who = (list, verb) => list.length ? `${verb} ${list.map(t => art(name[t.id])).join(' e ')}` : '';
          const win = [who(pass, 'supera'), who(reach, 'aggancia')].filter(Boolean).join(' e ');
          if (win) line += `. Con una vittoria ${win}` + (reach.length && !pass.length ? ` a ${pts[me] + 3} punti` : '');
        }
        lines.push(line);
      }
      const open = side => range[side][0] !== range[side][1];
      const group = g.leagueName?.replace('Grp.', 'Girone');
      out.set(m.id, {posta:lines, hot:open(m.h) && open(m.a), group:lega && lega !== 'Lega A' ? `${lega} · ${group}` : group});
    }
  }
  return out;
}
// Lega A tutta; dalle altre leghe solo le partite scelte in bot/webapp/naz_scelte.json ({"aggiunte":[id FotMob], "escluse":[]}).
const NAZ_SCELTE = (() => { try { return read(path.join(app, 'naz_scelte.json')); } catch { return {aggiunte:[], escluse:[]}; } })();
let nazPosta = new Map(), nazLeagues = null;
// Classifiche per la scheda "Classifica" (FotMob): dopo ogni partita archiviata, altrimenti ogni 6 ore (ogni salvataggio è un deploy su Vercel).
const ZONE_IT = {championsleague:'Champions League', europaleague:'Europa League', europa_conference_league:'Conference League (preliminari)',
  relegation:'Retrocessione', q1of8finals:'Ottavi di finale', q1of16finals:'Spareggi per gli ottavi', championship_playoff:'Quarti di finale',
  promotion:'Promozione', promotionqual:'Spareggio promozione', relegationqual:'Spareggio salvezza', relegation_playoff:'Spareggio salvezza'};
function tableOf(j, rename = n => n) {
  const d = j?.table?.[0]?.data; if (!d) return null;
  const row = t => [t.idx, rename(t.name), t.played, t.wins, t.draws, t.losses, t.scoresStr, t.goalConDiff, t.pts, t.qualColor || null, t.id];
  const legend = l => (l || []).map(x => [ZONE_IT[x.tKey] || x.title, x.color]);
  const groups = d.table?.all ? [{name:'', rows:d.table.all.map(row), legend:legend(d.legend)}]
    : (d.tables || []).map(g => ({name:(g.leagueName || '').replace('Grp.', 'Girone'), rows:(g.table?.all || []).map(row), legend:legend(g.legend || d.legend)}));
  return groups.length ? groups : null;
}
async function updateTables(force) {
  const old = data.classifiche;
  if (!force && old?.updated && now - old.updated < 6 * 3600) return false;
  const get = async (id, season = '2026%2F2027') => { try { const r = await fetch(`/api/data/leagues?id=${id}&season=${season}`); return r.ok ? await r.json() : null; } catch { return null; } };
  const out = {updated:now, sa:null, ucl:null, naz:{}, extra:{}};
  out.sa = tableOf(await get(55));
  out.ucl = tableOf(await get(42));
  for (const [id, j] of nazLeagues || await Promise.all([9806, 9807, 9808].map(async id => [id, await get(id)])))
    out.naz[(j?.details?.name || String(id)).replace(/^UEFA Nations League /, 'Lega ')] = tableOf(j, it);
  for (const [id, name] of [[47, 'Premier League'], [87, 'LaLiga'], [54, 'Bundesliga'], [53, 'Ligue 1']]) out.extra[name] = tableOf(await get(id));
  data.classifiche = out;
  return true;
}
async function syncNaz(round) {
  const leagues = await Promise.all([9806, 9807, 9808].map(async id => {
    const response = await fetch(`/api/data/leagues?id=${id}&season=2026%2F2027`);
    if (!response.ok) throw new Error(`Calendario nazionali ${id}: FotMob ${response.status}`);
    return [id, await response.json()];
  }));
  nazPosta = new Map(leagues.flatMap(([, j]) => [...nazStakes(j)]));
  nazLeagues = leagues;
  const known = new Set(round.matches.map(m => m.id)), pending = new Set(round.pending.map(x => x.id));
  const horizon = now + Number(process.env.CARTELLINO_ANTICIPO_ORE || 72) * hour;
  const chosen = new Set((NAZ_SCELTE.aggiunte || []).map(Number)), skip = new Set((NAZ_SCELTE.escluse || []).map(Number));
  const todo = leagues.flatMap(([id, j]) => (j.fixtures?.allMatches || []).filter(m => (id === LEAGUE.naz.id || chosen.has(+m.id)) && !skip.has(+m.id)))
    .filter(m => !m.status?.cancelled && !known.has(+m.id) && !pending.has(+m.id) &&
      Date.parse(m.status.utcTime) / 1000 > now && Date.parse(m.status.utcTime) / 1000 <= horizon);
  if (!todo.length) return;
  const loaded = await Promise.allSettled(todo.map(m => matchDetails(+m.id)));
  const ready = loaded.flatMap((r, i) => {
    if (r.status !== 'fulfilled') { warn(todo[i], r.reason); return []; }
    const lu = r.value.content?.lineup;
    return ['lastStarting11','predicted','standard'].some(t => validLineup(lu,t)) ? [{id:+todo[i].id, j:r.value, round:+todo[i].round}] : [];
  });
  console.log(`Nazionali: formazioni pronte ${ready.length}/${todo.length}`);
  if (!ready.length) return;
  for (const {id, j:raw, round:md} of ready) {
    const item = await prepareLineup(id, raw);
    item.beforeKickoff = true;
    round.pending.push(item);
    round.md = Math.max(round.md || 0, md || 0);
  }
  round.append = true;
}
// Squadra sfavorita: nell'archivio (20.722 partite, Elo con vantaggio casa) la sfavorita prende il 53% dei gialli con divario < 100,
// il 56% tra 100 e 200, il 59% tra 200 e 300, il 62% oltre (Champions: 53, 57, 63, 67%). Il modello coppe per le nazionali vede solo
// il divario in valore assoluto: se dà alla sfavorita meno di questa quota, si spostano le probabilità (in logit, per lato) fino alla quota
// storica, lasciando invariato il totale dei gialli attesi. Forza dalle quote 1X2 (punteggio atteso → divario Elo).
// Curva rivista sulle 1.124 partite di nazionali in archivio (12/11, ricerca/nazionali/studio.mjs): lì la sfavorita prende il 53/60/68/77% dei gialli;
// test per anno 2023-2026 (646 partite): senza correzione log loss .41371 e top3 .666; vecchia curva .41266 / .687; questa .41246 / .687.
// Più ripida (.49 + .08) fa ancora meglio con l'Elo dell'archivio, ma in produzione il divario viene dalle quote, che allargano le distanze: si resta prudenti.
const UNDERDOG = gap => Math.min(.75, .5 + .05 * Math.abs(gap) / 100);
function underdogFix(round) {
  const changed = [];
  const lg = x => Math.log(x / (1 - x)), ex = x => 1 / (1 + Math.exp(-x));
  for (const m of round.section.matches) {
    if (m.sfav || m.ko <= now || !m.odds || !m.pl?.length) continue;
    const [ph, pa] = m.odds.split('/').map(Number), px = Math.max(0, 100 - ph - pa), E = (ph + px / 2) / 100;
    if (!(E > 0 && E < 1)) continue;
    const gap = -400 * Math.log10(1 / E - 1), under = gap > 0 ? 'a' : 'h', target = UNDERDOG(gap);
    const sum = side => m.pl.filter(r => r[1] === side).reduce((a, r) => a + r[4], 0), tot = sum('h') + sum('a'), share = sum(under) / tot;
    m.sfav = 1;
    if (share >= target) { changed.push(0); continue; }
    changed.push(m.id);
    const fit = (side, goal) => { let lo = -3, hi = 3; for (let i = 0; i < 50; i++) { const mid = (lo + hi) / 2;
      if (m.pl.filter(r => r[1] === side).reduce((a, r) => a + ex(lg(r[4]) + mid), 0) < goal) lo = mid; else hi = mid; } return (lo + hi) / 2; };
    const d = {[under]: fit(under, tot * target), [under === 'h' ? 'a' : 'h']: fit(under === 'h' ? 'a' : 'h', tot * (1 - target))};
    for (const r of m.pl) r[4] = +ex(lg(r[4]) + d[r[1]]).toFixed(3);
    m.pl.sort((a, b) => b[4] - a[4]);
    const team = under === 'h' ? m.h : m.a;
    m.ctx = [...(m.ctx || []), `Squadra sfavorita: a ${team} va il ${Math.round(target * 100)}% dei gialli attesi (nello storico, con questo divario, la sfavorita prende il ${Math.round(target * 100)}% dei gialli; il modello le dava il ${Math.round(share * 100)}%)`];
  }
  return changed;
}
// Posta in palio sulle partite delle nazionali (ricalcolata a ogni giro dalla classifica).
function applyStakes(round) {
  let changed = false;
  for (const m of round.section.matches) {
    const s = nazPosta.get(m.id);
    if (!s || m.ko <= now) continue;
    const next = {posta:s.posta, hot:s.hot ? 1 : 0, girone:s.group};
    if (JSON.stringify(next) !== JSON.stringify({posta:m.posta, hot:m.hot, girone:m.girone})) { Object.assign(m, next); changed = true; }
  }
  return changed;
}

// Archivio FotMob (ramo dati) letto una volta sola, per arbitri e linee cartellini.
let archiveCache = null;
const archive = () => archiveCache ??= fs.existsSync(historic) ? fs.readdirSync(historic).filter(f => f.endsWith('.json.gz')).flatMap(f =>
  Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(historic, f)))))) : [];
const dec = x => x.toFixed(1).replace('.', ',');
// Nota arbitro dallo storico: cartellini (gialli, secondi gialli e rossi) e gialli per gara.
// Serie A: solo gare di Serie A; Champions: tutte le competizioni in archivio.
function refNote(name, comp, ko) {
  const games = archive().filter(m => m.ref?.[1] && norm(m.ref[1]) === norm(name) && m.ts < ko && (comp !== 'sa' || m.lg === 55));
  if (!games.length) return null;
  const cards = games.reduce((a,m) => a + (m.cards || []).length, 0), yellows = games.reduce((a,m) => a + (m.cards || []).filter(c => c[2] !== 'Red').length, 0);
  return `${dec(cards / games.length)} cartellini/gara · ${dec(yellows / games.length)} gialli · ${games.length} gare${comp === 'sa' ? ' di Serie A' : ' in archivio'}`;
}
// Linea cartellini stimata dal modello quando manca quella del mercato: media cartellini delle ultime gare della competizione
// × √(somma delle probabilità dei titolari / media della giornata), poi la soglia x,5 più vicina alla mediana (Poisson).
// Sull'11ª giornata coincideva con la linea dei bookmaker in 7 partite su 10.
function estimateLines(round) {
  const open = round.section.matches.filter(m => m.line == null || m.line_est);
  if (!open.length) return false;
  // Nazionali: nessuno storico di Nations League in archivio, si parte dalla media della Champions (stessa scala del modello coppe)
  const lg = round.comp === 'naz' ? 42 : LEAGUE[round.comp].id, cut = Math.min(...round.section.matches.map(m => m.ko));
  const past = archive().filter(m => m.lg === lg && m.ts < cut).sort((a,b) => b.ts - a.ts).slice(0, round.comp === 'sa' ? 380 : 250);
  if (past.length < 50) return false;
  const avg = past.reduce((a,m) => a + (m.cards || []).length, 0) / past.length;
  const sum = m => m.pl.reduce((a,p) => a + (p[4] || 0), 0), mean = round.section.matches.reduce((a,m) => a + sum(m), 0) / round.section.matches.length;
  let changed = false;
  for (const m of open) {
    let lambda = avg * Math.sqrt(sum(m) / mean);
    // Nazionali: media geometrica con i cartellini a gara dell'arbitro designato (FotMob), quando c'è
    if (round.comp === 'naz' && m.refstat) lambda = Math.sqrt(lambda * (m.refstat.y + m.refstat.r));
    let k = 0, term = Math.exp(-lambda), cdf = term;
    while (cdf < .5) { k++; term *= lambda / k; cdf += term; }
    const line = dec(k + .5);
    if (m.line !== line || !m.line_est) { m.line = line; m.line_est = 1; changed = true; }
  }
  return changed;
}
// Medie arbitri inserite a mano (Sofascore), con precedenza su FotMob
const ARBITRI = (() => { try { return read(path.join(app, 'arbitri.json')); } catch { return {}; } })();
// Arbitro designato (FotMob) e nota con le sue medie; vale anche quando la formazione non cambia.
function updateReferee(round, m, j) {
  const name = j?.content?.matchFacts?.infoBox?.Referee?.text;
  let changed = false;
  if (name && name !== m.ref) { m.ref = name; delete m.refnote; delete m.refstat; changed = true; }
  // medie dell'arbitro secondo FotMob (tutte le competizioni che segue): partite, gialli a gara, rossi totali
  const st = Object.fromEntries((j?.content?.matchFacts?.infoBox?.Referee?.stats || []).map(x => [x.type, x.value]));
  const manual = name && Object.entries(ARBITRI).find(([k]) => norm(k) === norm(name))?.[1];
  if (name && (manual || (st.matches >= 5 && Number.isFinite(st.yellowCards)))) {
    const refstat = manual ? {y:manual.y, r:manual.r, src:'Sofascore'} : {g:st.matches, y:+st.yellowCards.toFixed(2), r:+((st.redCards || 0) / st.matches).toFixed(2)};
    if (JSON.stringify(refstat) !== JSON.stringify(m.refstat)) { m.refstat = refstat; changed = true; }
    if (round.comp === 'naz') {
      const note = `${dec(refstat.y)} gialli e ${refstat.r.toFixed(2).replace('.', ',')} rossi a gara` + (refstat.src ? ` (${refstat.src})` : ` · ${refstat.g} gare (FotMob)`);
      if (m.refnote !== note) { m.refnote = note; changed = true; }
    }
  }
  if (m.ref && m.ref !== '–' && !m.refnote) {
    const note = refNote(m.ref, round.comp, m.ko);
    if (note) { m.refnote = note; changed = true; }
  }
  return changed;
}

async function inspect(round) {
  const window = round.matches.filter(m => now < m.ko + 7 * 24 * hour && (
    (!m.uff && now >= m.ko - 60 * hour) || (now >= m.ko + 75 * 60 && (!seen.has(m.id) || now < m.ko + 48 * hour))));
  round.pending = [];
  round.finished = [];
  for (const m of window) {
    try {
      const j = await matchDetails(m.id), status = j.header.status;
      if (status.cancelled || status.awarded) continue;
      if (!status.started && updateReferee(round,m,j)) round.touched = true;
      if (now < m.ko - 36 * hour) continue;            // tra 60 e 36 ore prima: solo l'arbitro
      if (status.finished && !seen.has(m.id)) round.finished.push({m,j});
      // nelle 48 ore dopo la fine FotMob a volte corregge i cartellini (9/11: giallo di Musah passato a Diawara): riarchivia
      else if (status.finished && cardsChanged(m,j)) round.finished.push({m,j});
      if (m.uff) continue;
      const lineup = j.content?.lineup;
      const beforeKickoff = !status.started && !status.finished && now < m.ko;
      if (!validLineup(lineup,'standard') && !(beforeKickoff && (
        validLineup(lineup,'predicted') || (m.src === 'provv' && validLineup(lineup,'lastStarting11'))))) {
        if (now >= m.ko - hour) console.warn(`Partita ${m.id}: formazione ufficiale in attesa (${lineup?.lineupType || 'assente'})`);
        continue;
      }
      const item = await prepareLineup(m.id,j,m.forfait);
      if (validLineup(lineup,'standard') || item.line !== field.get(m.id) || item.abs.join(',') !== (m.abs || []).join(',')) {
        round.pending.push({...item,beforeKickoff});
      }
    } catch (e) { warn(m,e); }
  }
}

// Etichette dei giocatori dall'archivio FotMob (come quelle della prima versione su Sofascore): "Ex <squadra>",
// "N gialli in M gare contro <squadra>" (N ≥ 2), "Rientra da squalifica", "Testa calda" (più gialli di quanti ne dicano i suoi falli).
// Informative: le probabilità restano quelle del modello.
let tagger = null;
const playerTags = (...a) => (tagger ??= makeTagger(archive()))(...a);
function addTags(round, m, j = prepared.get(m.id)?.j) {
  const H = j?.header?.teams, lu = j?.content?.lineup;
  const old = archive().find(x => x.id === m.id);          // partita già giocata: id dei giocatori dall'archivio
  if (!old && (!H || !lu)) return false;
  const ids = {};
  if (old) for (const r of old.pl) ids[(r[2] ? 'h' : 'a') + '|' + norm(short(r[1]))] = +r[0];
  else for (const [side, T] of [['h', lu.homeTeam], ['a', lu.awayTeam]]) for (const x of [...(T?.starters || []), ...(T?.subs || [])]) if (x.name) ids[side + '|' + norm(short(x.name))] = +x.id;
  const teamId = i => old ? +(i ? old.a : old.h)[0] : +H[i].id;
  const lastName = n => norm(n.split(' ').pop());
  const club = round.comp !== 'naz';
  for (const r of m.pl) {
    const side = r[1], pid = ids[side + '|' + norm(r[0])] ?? Object.entries(ids).find(([k]) => k.startsWith(side + '|') && k.endsWith(lastName(r[0])))?.[1];
    if (!pid) continue;
    const team = teamId(side === 'h' ? 0 : 1), opp = teamId(side === 'h' ? 1 : 0), oppName = side === 'h' ? m.a : m.h;
    const extra = playerTags(pid, team, opp, oppName, m.ko, club).filter(t => !(m.tags?.[r[0]] || []).includes(t));
    if (extra.length) (m.tags ||= {})[r[0]] = [...extra, ...(m.tags?.[r[0]] || [])];
  }
  m.tagv = 1;
  return true;
}
function applyForecast(round, exportRows) {
  const sa = round.comp === 'sa', day = round.advance || (round.comp === 'naz' ? round.md || round.section.round : round.section.round);
  const filename = path.join(temp, round.comp + '.json');
  write(filename, exportRows);
  const args = [path.join(bot, sa ? 'sa_to_data.py' : 'cup_to_data.py'), filename, String(day)];
  if (!sa) args.push(exportRows.map(x => x.id).join(','));
  const prefix = 'oc_' + round.comp;
  const qdir = path.join(bot,'data/quote');
  const quote = fs.readdirSync(qdir).filter(f => new RegExp(`^${prefix}${day}(?:_|\\.)`).test(f) && !f.includes('live')).sort().at(-1);
  if (quote) args.push(path.join(qdir,quote));
  const previous = fs.readFileSync(files.data);
  let newMatches;
  try {
    execFileSync(python,args,{stdio:'inherit',env:{...process.env,PYTHONUTF8:'1',CUP_COMP:round.comp}});
    const generated = read(files.data);
    newMatches = sa ? generated.matches : generated.cups[round.comp].matches;
    if (round.comp === 'naz' && !data.cups?.naz) {
      const {matches, ...rest} = generated.cups.naz;
      Object.assign(round.section, rest);
      (data.cups ??= {}).naz = round.section;
    }
  } finally {
    fs.writeFileSync(files.data,previous);
  }
  const former = new Map(round.matches.map(m => [m.id,m]));
  for (const m of newMatches) {
    const e = exportRows.find(e => e.id === m.id);
    const old = former.get(m.id);
    const {abs} = prepared.get(m.id);
    m.uff = Number(e.lt === 'standard');
    m.src = e.lt === 'lastStarting11' ? 'provv' : 'fotmob';
    if (abs.length) m.abs = abs;
    if (!m.ref || m.ref === '–') m.ref = prepared.get(m.id).j.content?.matchFacts?.infoBox?.Referee?.text || m.ref;
    if (m.uff && (m.pl.filter(p => p[1] === 'h' && p[6] === 100).length !== 10 ||
        m.pl.filter(p => p[1] === 'a' && p[6] === 100).length !== 10)) {
      throw new Error(`Pronostico incompleto per la formazione ufficiale: ${m.id}`);
    }
    if (!old) continue;
    if (!m.uff && old.forfait?.length) m.forfait = old.forfait;
    for (const key of ['derby','hc','ac','uff_late']) if (old[key] != null) m[key] = old[key];
    if (m.line == null && old.line != null) { m.line = old.line; if (old.line_est) m.line_est = 1; }
    if (!m.odds) m.odds = old.odds;
    if (m.ref === '–') m.ref = old.ref;
    if (old.ref === m.ref && old.refnote) m.refnote = old.refnote;
    if (old.live) m.live = old.live;
  }
  for (const m of newMatches) { try { addTags(round, m); } catch (e) { warn(m, e); } }
  const changed = new Map(newMatches.map(m => [m.id,m]));
  round.section.matches = round.advance ? newMatches : [...round.matches.map(m => changed.get(m.id) || m),
    ...newMatches.filter(m => !former.has(m.id))].sort((a,b) => a.ko - b.ko || a.id - b.id);
  if (round.comp === 'naz') {
    for (const m of newMatches) {
      const fr = round.fifa?.[m.id];
      if (fr?.length === 2) m.ctx = [`Ranking FIFA: ${m.h} ${fr[0]}º · ${m.a} ${fr[1]}º`, ...(m.ctx || [])];
    }
    // restano le partite delle ultime 36 ore e le prossime; le altre sono già nello storico
    round.section.matches = round.section.matches.filter(m => m.ko > now - 36 * hour || !seen.has(m.id));
    round.section.round = String(Math.max(Number(round.section.round) || 0, round.md || 0) || '');
  }
  if (round.advance) {
    round.section.round = day;
    round.section.lineups_note = 'Le schede distinguono l’ultima formazione disponibile, le probabili e gli undici ufficiali di FotMob. La titolarità degli undici ufficiali è al 100%.';
  }
  round.section.updated = new Date().toISOString().slice(0,16) + '+00:00';
  return [...changed.keys()];
}

function cardsChanged(m, j) {
  const stored = results.find(r => r.matchId === m.id);
  if (!stored) return false;
  const key = x => norm(short(x));
  const players = new Set(Object.values(j.content?.playerStats || {}).map(p => p.name && key(p.name)));   // niente allenatori
  const fresh = new Set((j.content?.matchFacts?.events?.events || []).filter(e => e.type === 'Card' && e.player?.name)
    .map(e => key(e.player.name)).filter(x => players.has(x)));
  const before = new Set(stored.ammoniti.map(norm));
  return fresh.size !== before.size || [...fresh].some(x => !before.has(x));
}

function archiveResult(round, m, j) {
  const rawScore = j.header.status.scoreStr;
  if (typeof rawScore !== 'string' || !/^\d+\s*-\s*\d+$/.test(rawScore)) throw new Error('Punteggio finale assente');
  const events = j.content?.matchFacts?.events?.events;
  if (!Array.isArray(events)) throw new Error('Cronaca finale assente');
  const lineup = j.content?.lineup;
  const teams = new Map(j.header.teams.map((t,i) => [+t.id,i === 0 ? 'h' : 'a']));
  const n = (name,side) => m.pl.find(r => r[1] === side && norm(r[0]) === norm(short(name)))?.[0] || short(name);
  const fl = {};
  for (const p of Object.values(j.content.playerStats || {})) {
    const stats = Object.fromEntries((p.stats || []).flatMap(g => Object.entries(g.stats || {})));
    const v = key => stats[key]?.stat?.value ?? 0;
    const side = teams.get(+p.teamId);
    if (p.name && side && (v('Minutes played') > 0 || stats['Fouls committed'])) {
      fl[n(p.name,side)] = [v('Fouls committed'),v('Was fouled'),side];
    }
  }
  if (Object.keys(fl).length < 22 || !validLineup(lineup,'standard')) throw new Error('Statistiche individuali ancora incomplete');
  const totals = j.content.stats?.Periods?.All?.stats?.flatMap(g => g.stats).find(s => s.key === 'fouls')?.rawStats;
  if (totals?.length === 2 && ['h','a'].some((side,i) =>
    Number.isFinite(totals[i].value) && totals[i].value !== Object.values(fl).filter(v => v[2] === side).reduce((sum,v) => sum + v[0],0))) {
    throw new Error('Falli individuali non ancora allineati ai totali');
  }
  // angoli per squadra (FotMob), per la ricerca EXTRA sugli angoli: [casa, trasferta]
  const corners = j.content.stats?.Periods?.All?.stats?.flatMap(g => g.stats).find(s => s.key === 'corners')?.stats;
  const cards = [], ammoniti = new Set(), sub = {};
  for (const e of events) {
    const side = e.isHome ? 'h' : 'a';
    if (e.type === 'Card' && e.player?.name && ['Yellow','YellowRed','Red'].includes(e.card)) {
      const name = n(e.player.name,side);
      if (Object.hasOwn(fl,name)) ammoniti.add(name);          // anche il rosso diretto vale come ammonito (regola del gioco)
      cards.push([e.overloadTime > 0 ? `${e.time}+${e.overloadTime}` : e.time,name,e.card === 'Yellow' ? 'G' : 'R']);
    }
    if (e.type === 'Substitution' && e.swap?.[0]?.name && e.swap?.[1]?.name) sub[n(e.swap[1].name,side)] = n(e.swap[0].name,side);
  }
  const previous = results.findIndex(r => r.matchId === m.id);
  const kept = previous >= 0 ? results[previous] : null;
  const prior = savedTris.get(m.id) || (kept && {trio:kept.tris_app,p3:kept.p3_app,revised:kept.tris_app_revisione});
  if (!prior?.trio?.length) throw new Error('Tris prepartita assente');
  if (previous >= 0) { results.splice(previous,1); console.log('Cartellini corretti da FotMob:',m.h,m.a); }
  m.live = {t:'FT',sc:rawScore,fin:true,cards,fl,p:{},out:Object.keys(sub),sub,src:'fotmob'};
  results.push({
    matchId:m.id,comp:round.comp,partita:`${m.h} - ${m.a}`,giornata:round.section.round,ko:m.ko,
    finale:rawScore.replace(/\s/g,''),p3_app:prior.p3,ammoniti:[...ammoniti],
    falli:Object.fromEntries(Object.entries(fl).map(([p,row]) => [p,row[0]])),
    falli_subiti:Object.fromEntries(Object.entries(fl).map(([p,row]) => [p,row[1]])),
    sostituzioni:sub,...(Array.isArray(corners) && corners.length === 2 && corners.every(Number.isFinite) ? {angoli:corners} : {}),
    ...(m.odds ? {quote_1x2:m.odds} : {}), ...(m.line != null ? {linea_cartellini:m.line, ...(m.line_est ? {linea_stimata:1} : {})} : {}),tris_app:prior.trio.map(({n,p}) => ({n,p})),tris_app_revisione:prior.revised,aggiornato:new Date().toISOString(),
  });
  seen.add(m.id);
  console.log('Archiviata',m.h,m.a,rawScore);
}

try {
  const changedIds = [];
  const trisIds = [];
  let finished = 0;
  for (const round of rounds) {
    await inspect(round);
    for (const {m,j} of round.finished) {
      try { archiveResult(round,m,j); finished++; } catch (e) { warn(m,e); }
    }
  }
  for (const round of rounds) {
    if (round.comp === 'naz' || (!round.pending.length && !round.matches.some(needsTrisRevision))) {
      await syncRound(round,seen).catch(e => console.warn(e.message));
    }
  }
  const all = rounds.flatMap(r => r.pending);
  if (all.length) {
    await startModel(Math.min(now,...all.map(({j}) => Date.parse(j.general.matchTimeUTCDate) / 1000)));
    globalThis.saPatchVs();
    const predict = globalThis.fmPredict3;
    globalThis.fmPredict3 = (id,model,extra = []) => predict(id,model,extra.filter(p => !prepared.get(id).excluded.has(+p.id)));
    for (const round of rounds.filter(r => r.pending.length)) {
      const ids = round.pending.map(x => x.id);
      let exported;
      if (round.comp === 'sa') {
        globalThis.__SAX = await globalThis.saExport(ids);
        exported = globalThis.saFinal();
      } else {
        if (round.comp === 'naz') {
          // Le nazionali non hanno Elo in archivio: forza dal ranking FIFA (1º ≈ 1950, 15º ≈ 1665, 75º ≈ 1500), scala dei club di Champions
          const E = globalThis.__CST2?.ELO, clubs = Object.values(E || {}).filter(Number.isFinite).sort((a, b) => a - b);
          if (clubs.length) console.log(`Elo club: 10% ${clubs[Math.floor(clubs.length * .1)].toFixed(0)}, mediana ${clubs[Math.floor(clubs.length / 2)].toFixed(0)}, 99% ${clubs[Math.floor(clubs.length * .99)].toFixed(0)}`);
          for (const item of round.pending) for (const t of item.j.header?.teams || []) {
            if (E && t.fifaRank > 0) E[t.id] = 1950 - 105 * Math.log(t.fifaRank);
            if (t.fifaRank > 0) (round.fifa ??= {})[item.id] = [...((round.fifa || {})[item.id] || []), t.fifaRank];
          }
        }
        exported = await globalThis.cupExport3(ids);
      }
      if (exported.length !== ids.length || exported.some(m => !m.pl?.length)) throw new Error('Il modello non ha prodotto tutte le stime');
      changedIds.push(...applyForecast(round,exported));
      for (const item of round.pending) {
        field.set(item.id,item.line);
        if (item.beforeKickoff || round.advance) trisIds.push(item.id);
        else {
          const m = round.section.matches.find(x => x.id === item.id);
          if (m?.uff && !m.uff_late) { m.uff_late = 1; console.warn(`Partita ${m.id}: formazioni ufficiali arrivate dopo il calcio d'inizio (${m.h}-${m.a})`); }
        }
      }
    }
    const currentIds = new Set(rounds.flatMap(r => r.section.matches.map(m => m.id)));
    fs.writeFileSync(files.lineups,[...field].filter(([id]) => currentIds.has(id)).map(([,line]) => line).join('\n')+'\n');
  }
  let touched = rounds.some(r => r.touched);
  for (const round of rounds) {
    for (const m of round.section.matches) {
      if (m.ko > now && m.ref && m.ref !== '–' && !m.refnote) {
        const note = refNote(m.ref, round.comp, m.ko);
        if (note) { m.refnote = note; touched = true; }
      }
    }
    if (estimateLines(round)) touched = true;
    // etichette anche sulle partite già in pagina (calcolate una volta: tagv)
    for (const m of round.section.matches.filter(m => !m.tagv)) {
      try { const ok = addTags(round, m, prepared.get(m.id)?.j || (archive().some(x => x.id === m.id) ? null : await matchDetails(m.id))); if (ok) touched = true; } catch (e) { warn(m, e); }
    }
    if (round.comp === 'naz' && applyStakes(round)) touched = true;
    if (round.comp === 'naz') {
      const fixed = underdogFix(round);
      if (fixed.length) touched = true;
      for (const id of fixed) if (id && !trisIds.includes(id)) trisIds.push(id);
    }
  }
  try { if (await updateTables(finished > 0)) touched = true; } catch (e) { console.warn('Classifiche:', e.message); }
  if (finished || changedIds.length || touched) {
    write(files.data,data);
    if (finished) write(files.results,results);
  }
  const revisedIds = rounds.flatMap(r => r.section.matches.filter(needsTrisRevision).map(m => m.id));
  // la revisione per ufficiali in ritardo si chiede una volta sola
  const lateDone = rounds.flatMap(r => r.section.matches).filter(m => m.uff_late === 1);
  if (lateDone.length) { for (const m of lateDone) m.uff_late = 2; write(files.data,data); }
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT,`previsioni=${trisIds.join(',')}\nrevisioni=${revisedIds.join(',')}\n`);
  }
  console.log(`${changedIds.length} formazioni aggiornate, ${finished} esiti archiviati`);
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
