// Sonda: scarica indirizzi FotMob (o altri) e li salva in sonda/ per controllarne la struttura. Uso: node cloud/sonda.mjs "<url1> <url2> ..."
import fs from 'node:fs';
import './lib_node.mjs';
fs.mkdirSync('sonda', { recursive: true });
const urls = (process.argv[2] || '').split(/\s+/).filter(Boolean);
for (const [i, u] of urls.entries()) {
  try {
    const r = await fetch(u);
    const t = await r.text();
    fs.writeFileSync(`sonda/${i}.txt`, `${r.status} ${u}\n${t}`);
    console.log(r.status, t.length, u);
  } catch (e) { console.log('ERR', u, e.message); }
}
