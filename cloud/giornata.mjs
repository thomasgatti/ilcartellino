// Aggiorna le ufficiali e gli esiti delle partite presenti nell'app. Avanza anche il turno di Serie A.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { loadLib } from './lib_node.mjs';

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
const now = Date.now() / 1000;
const hour = 3600;
const historic = process.argv[2] || path.join(root, 'dati/fotmob');
const python = process.env.PYTHON || 'python3';
const data = read(files.data);
const results = read(files.results);
const tris = read(files.tris);
const seen = new Set(results.map(r => r.matchId));
const rounds = [{comp:'sa', section:data, matches:data.matches}];
if (data.cups?.ucl?.matches?.length) {
  rounds.push({comp:'ucl', section:data.cups.ucl, matches:data.cups.ucl.matches});
}
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'cartellino-'));
const cache = new Map();
const request = globalThis.fetch;
// Modello, campo e statistiche leggono lo stesso tabellino per tutta l'esecuzione.
globalThis.fetch = (url, opts) => {
  const key = String(url);
  if (!key.startsWith('/api/data/matchDetails?')) return request(url, {...opts, signal:AbortSignal.timeout(15000)});
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

function startModel(cutoff) {
  loadLib(['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js',
    'deep_feats.js', 'cup_x3.js', 'field_lineups.js', 'sa_export.js', 'amm_boot.js']);
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
  const odds = globalThis.fmOdds;
  globalThis.fmOdds = async ids => Object.fromEntries(Object.entries(await odds(ids)).filter(([,v]) => v.p));
  return globalThis.ammBuild();
}

async function advanceSerieA(round, archived) {
  if (!round.matches.length || round.matches.some(m => !archived.has(m.id))) return;
  const season = round.section.season?.replace(/^(\d{4})-(\d{2})$/, '$1/20$2');
  if (!season) return;
  const response = await fetch('/api/data/leagues?id=55&season=' + encodeURIComponent(season));
  if (!response.ok) throw new Error(`Calendario Serie A: FotMob ${response.status}`);
  const list = (await response.json()).fixtures?.allMatches || [];
  const next = Number(round.section.round) + 1;
  const fixtures = list.filter(m => Number(m.round) === next && !m.status?.cancelled);
  const first = Math.min(...fixtures.map(m => Date.parse(m.status.utcTime) / 1000));
  if (fixtures.length !== 10 || first <= now || first > now + 72 * hour) return;
  const loaded = await Promise.allSettled(fixtures.map(m => matchDetails(+m.id)));
  const ready = loaded.flatMap((r, i) => {
    if (r.status !== 'fulfilled') { warn(fixtures[i], r.reason); return []; }
    const j = r.value, lu = j.content?.lineup;
    return ['lastStarting11','predicted','standard'].some(t => validLineup(lu,t)) ? [{id:+fixtures[i].id, j}] : [];
  });
  if (ready.length === fixtures.length) {
    round.advance = next;
    round.pending = ready;
  }
}

async function inspect(round) {
  const preMatch = m => !m.uff && now < m.ko + 30 * 60;
  const window = round.matches.filter(m =>
    (preMatch(m) && now >= m.ko - (m.src === 'provv' ? 36 * hour : 100 * 60)) ||
    (now >= m.ko + 75 * 60 && !seen.has(m.id) && now < m.ko + 7 * 24 * hour));
  round.pending = [];
  round.finished = [];
  for (const m of window) {
    try {
      const j = await matchDetails(m.id), status = j.header.status;
      if (status.finished && !status.cancelled && !status.awarded && !seen.has(m.id)) round.finished.push({m,j});
      else if (!status.started && !status.cancelled && preMatch(m)) {
        const lineup = j.content?.lineup;
        if (validLineup(lineup,'standard') || (m.src === 'provv' && validLineup(lineup,'predicted'))) round.pending.push({id:m.id,j});
      }
    } catch (e) { warn(m,e); }
  }
}

function applyForecast(round, exportRows) {
  const sa = round.comp === 'sa', day = round.advance || round.section.round;
  const filename = path.join(temp, round.comp + '.json');
  write(filename, exportRows);
  const args = [path.join(bot, sa ? 'sa_to_data.py' : 'cup_to_data.py'), filename, String(day)];
  if (!sa) args.push(exportRows.map(x => x.id).join(','));
  const prefix = sa ? 'oc_sa' : 'oc_ucl';
  const qdir = path.join(bot,'data/quote');
  const quote = fs.readdirSync(qdir).filter(f => new RegExp(`^${prefix}${day}(?:_|\\.)`).test(f) && !f.includes('live')).sort().at(-1);
  if (quote) args.push(path.join(qdir,quote));
  const previous = fs.readFileSync(files.data);
  let newMatches;
  try {
    execFileSync(python,args,{stdio:'inherit',env:{...process.env,PYTHONUTF8:'1'}});
    const generated = read(files.data);
    newMatches = sa ? generated.matches : generated.cups.ucl.matches;
  } finally {
    fs.writeFileSync(files.data,previous);
  }
  const former = new Map(round.matches.map(m => [m.id,m]));
  for (const m of newMatches) {
    const e = exportRows.find(e => e.id === m.id);
    const old = former.get(m.id);
    m.uff = Number(e.lt === 'standard');
    m.src = e.lt === 'lastStarting11' ? 'provv' : 'fotmob';
    if (m.uff && (m.pl.filter(p => p[1] === 'h' && p[6] === 100).length !== 10 ||
        m.pl.filter(p => p[1] === 'a' && p[6] === 100).length !== 10)) {
      throw new Error(`Pronostico incompleto per la formazione ufficiale: ${m.id}`);
    }
    if (!old) continue;
    for (const key of ['line','derby','hc','ac']) if (old[key] != null) m[key] = old[key];
    if (!m.odds) m.odds = old.odds;
    if (m.ref === '–') m.ref = old.ref;
    if (old.ref === m.ref && old.refnote) m.refnote = old.refnote;
    if (old.live) m.live = old.live;
  }
  const changed = new Map(newMatches.map(m => [m.id,m]));
  round.section.matches = round.advance ? newMatches : round.matches.map(m => changed.get(m.id) || m);
  if (round.advance) {
    round.section.round = day;
    round.section.lineups_note = 'Le schede distinguono l’ultima formazione disponibile, le probabili e gli undici ufficiali di FotMob. La titolarità degli undici ufficiali è al 100%.';
  }
  round.section.updated = new Date().toISOString().slice(0,16) + '+00:00';
  return [...changed.keys()];
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
  const cards = [], ammoniti = new Set(), sub = {};
  for (const e of events) {
    const side = e.isHome ? 'h' : 'a';
    if (e.type === 'Card' && e.player?.name && ['Yellow','YellowRed','Red'].includes(e.card)) {
      const name = n(e.player.name,side);
      if (Object.hasOwn(fl,name)) ammoniti.add(name);
      cards.push([e.overloadTime > 0 ? `${e.time}+${e.overloadTime}` : e.time,name,e.card === 'Yellow' ? 'G' : 'R']);
    }
    if (e.type === 'Substitution' && e.swap?.[0]?.name && e.swap?.[1]?.name) sub[n(e.swap[1].name,side)] = n(e.swap[0].name,side);
  }
  const prior = tris.find(t => t.id === m.id);
  if (!prior?.trio?.length) throw new Error('Tris prepartita assente');
  m.live = {t:'FT',sc:rawScore,fin:true,cards,fl,p:{},out:Object.keys(sub),sub,src:'fotmob'};
  results.push({
    matchId:m.id,comp:round.comp,partita:`${m.h} - ${m.a}`,giornata:round.section.round,ko:m.ko,
    finale:rawScore.replace(/\s/g,''),p3_app:prior.p3,ammoniti:[...ammoniti],
    falli:Object.fromEntries(Object.entries(fl).map(([p,row]) => [p,row[0]])),
    falli_subiti:Object.fromEntries(Object.entries(fl).map(([p,row]) => [p,row[1]])),
    sostituzioni:sub,tris_app:prior.trio.map(({n,p}) => ({n,p})),aggiornato:new Date().toISOString(),
  });
  seen.add(m.id);
  console.log('Archiviata',m.h,m.a,rawScore);
}

try {
  const changedIds = [];
  let finished = 0;
  for (const round of rounds) {
    await inspect(round);
    for (const {m,j} of round.finished) {
      try { archiveResult(round,m,j); finished++; } catch (e) { warn(m,e); }
    }
  }
  await advanceSerieA(rounds[0],seen).catch(e => console.warn(e.message));
  const all = rounds.flatMap(r => r.pending);
  if (all.length) {
    await startModel(Math.min(now,...all.map(({j}) => Date.parse(j.general.matchTimeUTCDate) / 1000)));
    const field = new Map(fs.readFileSync(files.lineups,'utf8').trim().split('\n').filter(Boolean).map(l => [+l.split('|')[0],l]));
    for (const round of rounds.filter(r => r.pending.length)) {
      const ids = round.pending.map(x => x.id);
      let exported;
      if (round.comp === 'sa') {
        globalThis.saPatchVs();
        globalThis.__SAX = await globalThis.saExport(ids);
        exported = globalThis.saFinal();
      } else {
        exported = await globalThis.cupExport3(ids);
      }
      if (exported.length !== ids.length || exported.some(m => !m.pl?.length)) throw new Error('Il modello non ha prodotto tutte le stime');
      changedIds.push(...applyForecast(round,exported));
      const lines = globalThis.fieldExport(await globalThis.fieldLineups(ids)).split('\n').filter(Boolean);
      if (lines.length !== ids.length) throw new Error('Formazione in campo mancante');
      for (const line of lines) {
        field.set(+line.split('|')[0],line);
      }
    }
    const currentIds = new Set(rounds.flatMap(r => r.section.matches.map(m => m.id)));
    fs.writeFileSync(files.lineups,[...field].filter(([id]) => currentIds.has(id)).map(([,line]) => line).join('\n')+'\n');
  }
  if (finished || changedIds.length) {
    write(files.data,data);
    if (finished) write(files.results,results);
  }
  if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT,`previsioni=${changedIds.join(',')}\n`);
  console.log(`${changedIds.length} formazioni aggiornate, ${finished} esiti archiviati`);
} finally {
  fs.rmSync(temp,{recursive:true,force:true});
}
