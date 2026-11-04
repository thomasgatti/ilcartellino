// Bot nel cloud (GitHub Actions): stessi file di lib/ della scheda FotMob, dati dal ramo "dati" invece che da IndexedDB.
// node cloud/bot.mjs uff <cartella dati>   → controlla le partite di Champions che iniziano entro 100 minuti (o già iniziate da meno di 30):
//   se FotMob ha la formazione ufficiale ('standard') la ricalcola col modello, aggiorna bot/ammoniti/tmp/ex5.json e bot/webapp/lineups.txt
//   e scrive bot/ammoniti/tmp/uff_ids.txt (tutti gli id già ufficiali della giornata). Poi il workflow lancia cup_to_data.py, build.py, build_vercel.py.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { loadLib } from './lib_node.mjs';
const ROOT = path.join(path.dirname(new URL(import.meta.url).pathname), '..'), BOT = path.join(ROOT, 'bot');
const [cmd = 'uff', DATI = path.join(ROOT, 'dati', 'fotmob')] = process.argv.slice(2);
loadLib(['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js', 'deep_scrape.js', 'deep_feats.js', 'cup_x3.js', 'field_lineups.js', 'uff_lineup.js', 'sa_export.js', 'amm_boot.js', 'live_model.js']);
// dati dai file .json.gz del ramo dati
const ALL = {}; for (const f of fs.readdirSync(DATI).filter(f => f.endsWith('.json.gz'))) Object.assign(ALL, JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATI, f)))));
globalThis.idbAll = async (name) => { const out = {}; for (const [id, m] of Object.entries(ALL)) {
  if (name === 'amm' && m.lg === 55) out[id] = m; else if (name === 'amm_ucl' && m.lg === 42) out[id] = m; else if (name === 'amm_dom' && m.lg !== 55 && m.lg !== 42) out[id] = m; else if (name === (globalThis.XDB || 'amm_xs') && m.x) out[id] = m.x; }
  return out; };
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const dataJson = JSON.parse(fs.readFileSync(path.join(BOT, 'webapp', 'data.json'), 'utf8'));
if (cmd === 'uff') {
  const now = Date.now() / 1000, ucl = dataJson.cups?.ucl?.matches || [];
  const FORCE = (process.env.FORCE || '').split(',').filter(Boolean).map(Number);
  const win = FORCE.length ? ucl.filter(m => FORCE.includes(m.id)) : ucl.filter(m => !m.uff && m.ko - now < 100 * 60 && now - m.ko < 30 * 60);
  log('partite nella finestra:', win.map(m => m.h + '-' + m.a).join(', ') || 'nessuna');
  if (!win.length) process.exit(0);
  const ready = []; for (const m of win) { const j = await fetch('/api/data/matchDetails?matchId=' + m.id).then(r => r.json()); if (j.content?.lineup?.lineupType === 'standard') ready.push(m.id); }
  log('ufficiali adesso:', ready.join(',') || 'nessuna'); if (!ready.length) process.exit(0);
  log('modelli...', JSON.stringify((await ammBuild()).m4));
  const exPath = path.join(BOT, 'ammoniti', 'tmp', 'ex5.json'); const ex = JSON.parse(fs.readFileSync(exPath, 'utf8'));
  const fresh = await cupExport3(ready); for (const n of fresh) { const i = ex.findIndex(e => e.id === n.id); if (i >= 0) ex[i] = n; else ex.push(n); }
  fs.writeFileSync(exPath, JSON.stringify(ex));
  const luPath = path.join(BOT, 'webapp', 'lineups.txt'); const L = fieldExport(await fieldLineups(ready)).split('\n').filter(Boolean);
  const old = fs.existsSync(luPath) ? fs.readFileSync(luPath, 'utf8').split('\n').filter(Boolean) : []; const byId = Object.fromEntries(old.map(l => [l.split('|')[0], l]));
  for (const l of L) byId[l.split('|')[0]] = l; fs.writeFileSync(luPath, Object.values(byId).join('\n') + '\n');
  const uff = ex.filter(e => e.lt === 'standard').map(e => e.id); fs.writeFileSync(path.join(BOT, 'ammoniti', 'tmp', 'uff_ids.txt'), uff.join(','));
  log('aggiornate', ready.length, 'partite; ufficiali in tutto', uff.length);
}
