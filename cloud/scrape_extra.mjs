// Dati EXTRA da FotMob (GitHub Actions): statistiche di squadra e per giocatore che l'archivio del modello ammoniti non tiene.
// Per ogni partita già presente in dati/fotmob/<lg>_<stagione>.json.gz scarica matchDetails e salva in dati/extra/<lg>_<stagione>.json.gz:
//   { "<id partita>": { ts, h:[id,nome], a:[id,nome], t: { <statistica>: [casa, trasferta] }, p: [[id, lato(1 casa), titolare, minuti, gol, xG, xG senza rigori, tiri, tiri in porta, xA, tocchi in area, assist, rigori segnati]], g: [[minuto, id marcatore, lato, rigore, autogol]] } }
// Statistiche di squadra: angoli, tiri, tiri in porta, xG, xG su azione/palla inattiva, grandi occasioni, possesso, fuorigioco, cross riusciti, tocchi in area, falli, parate.
// Uso: node cloud/scrape_extra.mjs <cartella archivio fotmob> <cartella extra> <minuti massimi>
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import './lib_node.mjs';

const SRC = process.argv[2] || 'dati/fotmob', OUT = process.argv[3] || 'dati/extra', MAXMIN = +(process.argv[4] || 60), T0 = Date.now();
fs.mkdirSync(OUT, { recursive: true });
const load = f => fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f))) : {};
const save = (f, o) => fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(o)));
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { for (let k = 0; k < 4; k++) { try { const r = await fetch(u); if (r.status === 200) return await r.json(); if (r.status === 429) await sleep(5000); } catch {} await sleep(1000); } return null; };

const TEAM = { corners: 'angoli', total_shots: 'tiri', ShotsOnTarget: 'tiri_porta', expected_goals: 'xg', expected_goals_open_play: 'xg_azione',
  expected_goals_set_play: 'xg_inattiva', big_chance: 'grandi_occasioni', BallPossesion: 'possesso', Offsides: 'fuorigioco', accurate_crosses: 'cross',
  touches_opp_box: 'tocchi_area', fouls: 'falli', keeper_saves: 'parate', yellow_cards: 'gialli', red_cards: 'rossi' };
const num = v => { if (v == null) return null; const n = parseFloat(String(v)); return Number.isFinite(n) ? n : null; };

export function parseExtra(j) {
  const c = j.content || {}, H = j.header?.teams || [];
  const t = {};
  for (const s of (c.stats?.Periods?.All?.stats || []).flatMap(g => g.stats || [])) {
    const k = TEAM[s.key]; if (!k || t[k] || !Array.isArray(s.stats) || s.stats.some(v => v == null)) continue;
    t[k] = s.stats.map(num);
  }
  const homeId = H[0]?.id, starters = new Set(), lu = c.lineup;
  for (const T of [lu?.homeTeam, lu?.awayTeam]) for (const p of (T?.starters || [])) starters.add(p.id);
  const goalsBy = {}, pens = {};
  const g = (c.matchFacts?.events?.events || []).filter(e => e.type === 'Goal').map(e => {
    const id = e.player?.id ?? e.playerId, pen = e.goalDescriptionKey === 'penalty' || /penalty/i.test(e.goalDescription || '') ? 1 : 0, own = e.ownGoal ? 1 : 0;
    if (id && !own) { goalsBy[id] = (goalsBy[id] || 0) + 1; if (pen) pens[id] = (pens[id] || 0) + 1; }
    return [e.time, id ?? null, e.isHome ? 1 : 0, pen, own];
  });
  const p = [];
  for (const [id, S] of Object.entries(c.playerStats || {})) {
    const f = {}; for (const grp of (S.stats || [])) for (const v of Object.values(grp.stats || {})) if (v?.key) f[v.key] = v.stat?.value;
    const min = num(f.minutes_played) || 0; if (!min) continue;
    p.push([+id, S.teamId === homeId ? 1 : 0, starters.has(+id) ? 1 : 0, min, num(f.goals) ?? goalsBy[id] ?? 0, num(f.expected_goals), num(f.expected_goals_non_penalty),
      num(f.total_shots) ?? 0, num(f.ShotsOnTarget) ?? 0, num(f.expected_assists), num(f.touches_opp_box), num(f.assists) ?? 0, pens[id] || 0]);
  }
  return { t, p, g };
}

if (import.meta.url === 'file://' + process.argv[1]) {
  // ordine: prima Serie A, Champions e i 4 grandi campionati, dalla stagione più recente
  const PRI = ['55', '42', '87', '47', '54', '53', '73', '10216'];
  const files = fs.readdirSync(SRC).filter(f => f.endsWith('.json.gz')).sort((a, b) => {
    const [la, sa] = a.split('_'), [lb, sb] = b.split('_'), pa = PRI.indexOf(la), pb = PRI.indexOf(lb);
    return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb) || sb.localeCompare(sa);
  });
  let tot = 0, left = 0;
  outer: for (const f of files) {
    const arch = load(path.join(SRC, f)), out = path.join(OUT, f), have = load(out);
    const todo = Object.values(arch).filter(m => !have[m.id]).map(m => m.id);
    let i = 0, n = 0;
    await Promise.all([0, 1, 2, 3].map(async () => { while (i < todo.length) {
      if ((Date.now() - T0) / 60000 > MAXMIN) return;
      const id = todo[i++], m = arch[id], j = await get('/api/data/matchDetails?matchId=' + id); if (!j) continue;
      try { have[id] = { ts: m.ts, h: m.h, a: m.a, ...parseExtra(j) }; n++; if (n % 200 === 0) save(out, have); } catch {}
      await sleep(80);
    } }));
    if (n) save(out, have); tot += n; left += todo.length - n;
    console.log(f, 'nuove', n, 'totale', Object.keys(have).length, 'mancano', todo.length - n);
    if ((Date.now() - T0) / 60000 > MAXMIN) { console.log('tempo massimo raggiunto: riprende al prossimo giro'); break outer; }
  }
  console.log('partite nuove in tutto:', tot);
}
