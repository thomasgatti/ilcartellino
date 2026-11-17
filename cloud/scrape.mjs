// Scaricamento dati FotMob nel cloud (GitHub Actions). Un file per campionato e stagione: dati/<lg>_<stagione>.json.gz
// = { "<id partita>": partita in formato fmParse (+ lg) con x = statistiche extra per giocatore [dribbling riusciti, tentati, tocchi, intercetti, recuperi, palloni persi] }.
// Salta le partite già presenti. Uso: node cloud/scrape.mjs <cartella dati> [minuti massimi]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib'; import { loadLib } from './lib_node.mjs';
loadLib(['fotmob_scrape.js', 'deep_scrape.js']);
const OUT = process.argv[2] || 'dati', MAXMIN = +(process.argv[3] || 300), T0 = Date.now(); fs.mkdirSync(OUT, { recursive: true });
const S = (a, b) => { const r = []; for (let y = a; y <= b; y++) r.push(y + '/' + (y + 1)); return r; };
export const SPEC = { 55: S(2020, 2026), 42: S(2021, 2026), 73: S(2023, 2026), 10216: S(2023, 2026),
  47: S(2021, 2026), 87: S(2021, 2026), 54: S(2021, 2026), 53: S(2021, 2026), 57: S(2022, 2026), 61: S(2022, 2026),
  71: S(2023, 2026), 40: S(2023, 2026), 135: S(2024, 2026), 38: S(2024, 2026), 122: S(2024, 2026), 64: S(2024, 2026), 69: S(2024, 2026), 46: S(2024, 2026), 441: S(2024, 2026),
  176: S(2025, 2026), 262: S(2025, 2026), 48: S(2025, 2026), 59: ['2025', '2026'] };
// Nazionali (cartella a parte, dati/nazionali): Nations League A-D, Europei, Mondiali e qualificazioni UEFA. Uso: SCRAPE_SET=naz node cloud/scrape.mjs dati/nazionali 60
export const SPEC_NAZ = { 9806: ['2022/2023', '2024/2025', '2026/2027'], 9807: ['2022/2023', '2024/2025', '2026/2027'], 9808: ['2022/2023', '2024/2025', '2026/2027'],
  9809: ['2022/2023', '2024/2025', '2026/2027'], 50: ['2024'], 77: ['2022', '2026'], 10607: ['2022/2023', '2023'], 10195: ['2021/2022', '2025/2026'] };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { for (let k = 0; k < 4; k++) { try { const r = await fetch(u); if (r.status === 200) return await r.json(); if (r.status === 429) await sleep(5000); } catch (e) {} await sleep(1000); } return null; };
const file = (lg, s) => path.join(OUT, lg + '_' + s.replace('/', '-') + '.json.gz');
const load = f => fs.existsSync(f) ? JSON.parse(zlib.gunzipSync(fs.readFileSync(f))) : {};
const save = (f, o) => fs.writeFileSync(f, zlib.gzipSync(JSON.stringify(o)));
let tot = 0, calOk = 0, calKo = 0, detKo = 0, parseKo = 0, incompleti = 0;   // 17/11: conteggi per non far passare un giro vuoto per errore come riuscito
outer: for (const [lg, seasons] of Object.entries(process.env.SCRAPE_SET === 'naz' ? SPEC_NAZ : SPEC)) for (const s of seasons) {
  const f = file(lg, s), have = load(f);
  const L = await get('/api/data/leagues?id=' + lg + '&season=' + encodeURIComponent(s)); if (!Array.isArray(L?.fixtures?.allMatches)) { calKo++; console.log(L ? 'calendario senza partite (risposta incompleta)' : 'niente calendario', lg, s); continue; } calOk++;   // 17/11: un JSON senza calendario non conta come arrivato
  const todo = (L.fixtures?.allMatches || []).filter(m => m.status?.finished && !m.status?.cancelled && !have[m.id]).map(m => +m.id);
  let i = 0, n = 0;
  await Promise.all([0, 1, 2, 3].map(async () => { while (i < todo.length) { const id = todo[i++]; const j = await get('/api/data/matchDetails?matchId=' + id); if (!j) { detKo++; continue; }
    try { const m = fmParse(j, s); m.lg = +lg; m.x = deepExtra(j);
      // 17/11: nelle 48 ore dopo la partita si salva solo un tabellino completo (punteggi, cronaca, minuti dei titolari), altrimenti
      // si riprova al prossimo giro, perché una partita salvata non viene più riscaricata. Dopo si salva com'è: per alcuni campionati
      // (id 441 e 122) FotMob non pubblica mai i minuti (853 partite su 21.765 in archivio al 17/11).
      // L'eccezione dopo 48 ore vale solo per i minuti: punteggi e cronaca sono sempre obbligatori (anche nei campionati senza minuti
      // FotMob li dà; in archivio 0 partite senza punteggio). Una partita senza esito valido si riprova e non viene mai salvata a metà.
      const esitoOk = Number.isFinite(m.hs) && Number.isFinite(m.as) && Array.isArray(j.content?.matchFacts?.events?.events);
      const minuti = m.pl.some(r => r[4] === 1 && r[5] > 0);
      if (m.pl.length > 20 && esitoOk && (minuti || Date.now() / 1000 - m.ts > 2 * 86400)) { have[id] = m; n++; } else incompleti++; } catch (e) { parseKo++; } await sleep(80); } }));
  if (n) save(f, have); tot += n; console.log(lg, s, 'nuove', n, 'totale', Object.keys(have).length);
  if ((Date.now() - T0) / 60000 > MAXMIN) { console.log('tempo massimo raggiunto: riprende al prossimo giro'); break outer; }
}
console.log('partite nuove in tutto:', tot, '· calendari arrivati', calOk, 'mancati', calKo, '· tabellini non arrivati', detKo, 'illeggibili', parseKo, 'incompleti', incompleti);
if (!calOk) { console.log('::error title=FotMob irraggiungibile::nessun calendario arrivato'); process.exit(1); }
if (calKo || detKo || parseKo || incompleti) console.log(`::warning title=FotMob incompleto::calendari mancati ${calKo}, tabellini non arrivati ${detKo}, illeggibili ${parseKo}, incompleti ${incompleti}: riprende al prossimo giro`);
