// Raccolta ripetibile in sola lettura: scoreboard e resoconti ESPN pubblici.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const config = JSON.parse(await readFile(path.join(root, 'pilot.config.json'), 'utf8'));
const cache = path.resolve(process.argv[2] || path.join(root, 'cache'));
await mkdir(cache, { recursive: true });
const receipts = [];
async function get(url, file) {
  const target = path.join(cache, file);
  let raw;
  try { raw = await readFile(target, 'utf8'); JSON.parse(raw); }
  catch {
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(url, { signal: AbortSignal.timeout(25000) });
        if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`);
        raw = await res.text(); JSON.parse(raw);
        await writeFile(target, raw, 'utf8'); break;
      } catch (err) { if (attempt === 2) throw err; await new Promise(r => setTimeout(r, 750 * (attempt + 1))); }
    }
  }
  receipts.push({ file, url, sha256: createHash('sha256').update(raw).digest('hex') });
  return JSON.parse(raw);
}
const fixtures = [];
for (const group of config.groups) {
  const found = new Map();
  for (const date of group.dates) {
    const url = `https://site.api.espn.com/apis/site/v2/sports/soccer/${group.league}/scoreboard?dates=${date}`;
    const board = await get(url, `scoreboard-${group.league}-${date}.json`);
    for (const e of board.events || []) if (e.status?.type?.completed || e.status?.type?.name === 'STATUS_FULL_TIME') {
      found.set(e.id, { id: String(e.id), league: group.league, season: group.season, date: e.date, name: e.name });
    }
  }
  const chosen = [...found.values()].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).slice(0, group.take);
  if (chosen.length !== group.take) throw new Error(`Campione incompleto ${group.league} ${group.season}: ${chosen.length}/${group.take}`);
  fixtures.push(...chosen);
}
await writeFile(path.join(cache, 'fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n');
let next = 0, done = 0;
await Promise.all(Array.from({ length: 3 }, async () => {
  while (next < fixtures.length) {
    const f = fixtures[next++];
    f.source = `https://site.api.espn.com/apis/site/v2/sports/soccer/${f.league}/summary?event=${f.id}`;
    await get(f.source, `summary-${f.id}.json`);
    done++;
    if (done % 5 === 0 || done === fixtures.length) console.log(`Resoconti raccolti: ${done}/${fixtures.length}`);
  }
}));
await writeFile(path.join(cache, 'fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n');
await writeFile(path.join(cache, 'receipts.json'), JSON.stringify({ collectedAt: new Date().toISOString(), config, sources: receipts }, null, 2) + '\n');
console.log(`Campione pronto: ${fixtures.length} partite, ${receipts.length} fonti archiviate.`);
