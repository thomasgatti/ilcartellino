// Ricostruisce in locale i modelli di produzione dall'archivio del ramo dati (nessuna chiamata a FotMob).
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadLib } from '../../../../cloud/lib_node.mjs';
export async function boot(dir = process.env.DATI || '/home/claude/datib/fotmob') {
  loadLib(['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js', 'deep_feats.js', 'cup_x3.js', 'sa_export.js', 'amm_boot.js']);
  const all = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))))));
  const ok = all.filter(m => m.ts && m.pl?.length > 20);
  globalThis.idbAll = async name => Object.fromEntries(ok.flatMap(m => {
    if (name === 'amm') return m.lg === 55 ? [[m.id, m]] : [];
    if (name === 'amm_ucl') return m.lg === 42 ? [[m.id, m]] : [];
    if (name === 'amm_dom') return ![55, 42].includes(m.lg) ? [[m.id, m]] : [];
    return m.x ? [[m.id, m.x]] : [];
  }));
  const st = await globalThis.ammBuild();
  return { st, all: ok };
}
