// Sonda: scarica indirizzi FotMob (o altri) e stampa nel log un estratto, per controllarne la struttura.
// Uso: node cloud/sonda.mjs "<url1> <url2> ..." "<espressione JS su j e u>"   (senza espressione: chiavi e primi 3000 caratteri)
import fs from 'node:fs';
import './lib_node.mjs';
fs.mkdirSync('sonda', { recursive: true });
const urls = (process.argv[2] || '').split(/\s+/).filter(Boolean);
const pick = process.argv[3] ? new Function('j', 'u', 'return (' + process.argv[3] + ')') : null;
for (const [i, u] of urls.entries()) {
  try {
    const r = await fetch(u), t = await r.text();
    fs.writeFileSync(`sonda/${i}.txt`, `${r.status} ${u}\n${t}`);
    console.log(`\n=== ${r.status} ${t.length} ${u}`);
    let j = null; try { j = JSON.parse(t); } catch {}
    const out = pick && j ? pick(j, u) : j ? { chiavi: Object.keys(j), testo: t.slice(0, 3000) } : t.slice(0, 3000);
    console.log(JSON.stringify(out).slice(0, 60000));
  } catch (e) { console.log('ERR', u, e.message); }
}
