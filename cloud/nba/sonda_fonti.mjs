// Sonda NBA (13/11/2026): quali fonti di statistiche per giocatore rispondono dai runner di GitHub. Solo log.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const NBAH = { 'User-Agent': UA, Referer: 'https://www.nba.com/', Origin: 'https://www.nba.com', Accept: 'application/json, text/plain, */*', 'x-nba-stats-origin': 'stats', 'x-nba-stats-token': 'true', 'Accept-Language': 'en-US,en;q=0.9' };
const prova = async (nome, url, opt = {}, pick) => {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers: opt.h || { 'User-Agent': UA }, signal: AbortSignal.timeout(opt.ms || 25000), redirect: 'follow' });
    const buf = Buffer.from(await r.arrayBuffer()); let out = '';
    if (pick) { try { out = JSON.stringify(pick(JSON.parse(buf.toString('utf8')))); } catch (e) { out = 'estratto fallito: ' + e.message + ' · ' + buf.toString('utf8', 0, 200).replace(/\s+/g, ' '); } }
    else out = buf.toString('utf8', 0, 160).replace(/\s+/g, ' ');
    console.log(`\n[${r.status}] ${nome} · ${buf.length} byte · ${Date.now() - t0} ms\n    ${url}\n    ${String(out).slice(0, 1500)}`);
  } catch (e) { console.log(`\n[ERR] ${nome} · ${Date.now() - t0} ms · ${e.name}: ${e.message} ${e.cause?.code || ''}\n    ${url}`); }
};
const box = j => { const g = j.game, p = g.homeTeam.players; return { data: g.gameTimeUTC, casa: g.homeTeam.teamTricode, fuori: g.awayTeam.teamTricode, n: p.length, es: p.slice(0, 2).map(x => ({ nome: x.name, id: x.personId, tit: x.starter, pos: x.position, st: x.status, perche: x.notPlayingReason, s: x.statistics && { min: x.statistics.minutes, pts: x.statistics.points, reb: x.statistics.reboundsTotal, ast: x.statistics.assists, stl: x.statistics.steals, blk: x.statistics.blocks } })), fuoriRosa: p.filter(x => x.status !== 'ACTIVE').map(x => x.name + ':' + (x.notPlayingReason || '') + ':' + (x.notPlayingDescription || '')).slice(0, 4) }; };
// 1) stats.nba.com
await prova('stats.nba.com leaguegamelog', 'https://stats.nba.com/stats/leaguegamelog?Counter=0&Direction=ASC&LeagueID=00&PlayerOrTeam=P&Season=2025-26&SeasonType=Regular+Season&Sorter=DATE', { h: NBAH, ms: 30000 }, j => ({ col: j.resultSets[0].headers, righe: j.resultSets[0].rowSet.length, r0: j.resultSets[0].rowSet[0] }));
await prova('stats.nba.com boxscoretraditionalv3', 'https://stats.nba.com/stats/boxscoretraditionalv3?GameID=0022500001&StartPeriod=0&EndPeriod=14&StartRange=0&EndRange=0&RangeType=0', { h: NBAH, ms: 30000 }, j => Object.keys(j));
// 2) cdn.nba.com
for (const id of ['0021500001', '0021800001', '0021900001', '0022000001', '0022100001', '0022300001', '0022500001', '0042100401', '0052300101', '0022600150'])
  await prova('cdn.nba.com boxscore ' + id, `https://cdn.nba.com/static/json/liveData/boxscore/boxscore_${id}.json`, {}, box);
await prova('cdn.nba.com calendario stagione', 'https://cdn.nba.com/static/json/staticData/scheduleLeagueV2.json', {}, j => ({ stagione: j.leagueSchedule.seasonYear, giorni: j.leagueSchedule.gameDates.length, es: j.leagueSchedule.gameDates[40]?.games.slice(0, 1).map(g => [g.gameId, g.gameDateTimeUTC, g.homeTeam.teamTricode, g.awayTeam.teamTricode, g.gameStatus, g.gameLabel]) }));
await prova('cdn.nba.com tabellone di oggi', 'https://cdn.nba.com/static/json/liveData/scoreboard/todaysScoreboard_00.json', {}, j => ({ data: j.scoreboard.gameDate, n: j.scoreboard.games.length }));
await prova('nba.com referto infortuni (pdf)', 'https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-11-12_05PM.pdf');
await prova('nba.com referto infortuni (pdf, nuovo nome)', 'https://ak-static.cms.nba.com/referee/injury/Injury-Report_2026-11-12_05_00PM.pdf');
// 3) ESPN
await prova('ESPN tabellone 2021-10-19', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20211019&limit=100', {}, j => j.events.map(e => [e.id, e.date, e.shortName, e.season?.type, e.status?.type?.name]));
await prova('ESPN tabellone 2016-04-30 (playoff)', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20160430&limit=100', {}, j => j.events.map(e => [e.id, e.date, e.shortName, e.season?.type, e.competitions?.[0]?.notes?.[0]?.headline]));
await prova('ESPN partita 401360853', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=401360853', {}, j => { const t = j.boxscore.players[0], s = t.statistics[0]; return { chiavi: Object.keys(j), sq: t.team.abbreviation, col: s.names, es: s.athletes.slice(0, 2).map(a => ({ nome: a.athlete.displayName, id: a.athlete.id, pos: a.athlete.position?.abbreviation, tit: a.starter, dnp: a.didNotPlay, perche: a.reason, st: a.stats })), dnp: s.athletes.filter(a => a.didNotPlay).map(a => a.athlete.displayName + ':' + a.reason).slice(0, 4), inf: (j.injuries || []).map(x => x.injuries?.length) }; });
await prova('ESPN infortuni di oggi', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/injuries', {}, j => ({ squadre: j.injuries.length, es: j.injuries[0].injuries.slice(0, 2).map(x => [x.athlete.displayName, x.status, x.date, x.details?.type, x.details?.returnDate]) }));
await prova('ESPN tabellone intervallo 20260101-20260103', 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=20260101-20260103&limit=300', {}, j => ({ n: j.events.length }));
// 4) altre
await prova('basketball-reference boxscores', 'https://www.basketball-reference.com/boxscores/?month=11&day=11&year=2026');
await prova('basketball-reference gamelog', 'https://www.basketball-reference.com/players/j/jokicni01/gamelog/2026');
await prova('balldontlie senza chiave', 'https://api.balldontlie.io/v1/stats?seasons[]=2025&per_page=5');
for (const f of ['player_box_2025.parquet', 'player_box_2025.csv.gz', 'player_box_2026.parquet', 'player_box_2027.parquet', 'player_box_2025.rds'])
  await prova('hoopR ' + f, 'https://github.com/sportsdataverse/hoopR-nba-data/releases/download/espn_nba_player_boxscores/' + f);
await prova('hoopR elenco rilasci', 'https://api.github.com/repos/sportsdataverse/hoopR-nba-data/releases?per_page=30', { h: { 'User-Agent': UA, ...(process.env.GH_TOKEN ? { Authorization: 'Bearer ' + process.env.GH_TOKEN } : {}) } }, j => j.map(r => [r.tag_name, r.assets.length, r.assets.slice(-2).map(a => a.name + ':' + a.size + ':' + a.updated_at)]));
await prova('NocturneBear (GitHub, csv 2010-2024)', 'https://api.github.com/repos/NocturneBear/NBA-Data-2010-2024/contents', { h: { 'User-Agent': UA, ...(process.env.GH_TOKEN ? { Authorization: 'Bearer ' + process.env.GH_TOKEN } : {}) } }, j => j.map(x => x.name + ':' + x.size));
