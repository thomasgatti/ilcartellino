// Modello ammoniti Serie A (fm_model.js) applicato ai grandi campionati esteri: verifica temporale per lega.
import fs from 'node:fs'; import zlib from 'node:zlib'; import path from 'node:path';
const { loadLib } = await import('../../../../cloud/lib_node.mjs');
loadLib(['fm_model.js']);
const H = '../../../../dati/fotmob';
const NAMES = { 55: 'Serie A', 87: 'LaLiga', 47: 'Premier League', 54: 'Bundesliga', 53: 'Ligue 1' };
for (const lg of [55, 87, 47, 54, 53]) {
  const all = fs.readdirSync(H).filter(f => f.startsWith(lg + '_')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(H, f))))));
  window.__FMM = Object.fromEntries(all.map(m => [m.id, m])); fmBuild();
  const R = window.__ROWS, seasons = [...new Set(R.map(d => d.season))].sort();
  const rate = s => { const a = R.filter(d => d.season === s); return (a.reduce((x, d) => x + d.y, 0) / a.length * 100).toFixed(1); };
  const out = [];
  for (const te of seasons.slice(-2)) {
    const tr = seasons.filter(s => s < te);
    const base = fmFinal(['base'], tr, te).test, full = fmFinal(['base', 'lega', 'squadre', 'duelli'], tr, te).test;
    const te_rows = R.filter(d => d.season === te), nm = new Set(te_rows.map(d => d.mid)).size;
    out.push(`${te} (${nm} gare): ll base ${base.logloss} → completo ${full.logloss}, AUC ${full.auc}, gialli nei primi 3 ${full.top3_per_partita}`);
  }
  console.log(`${NAMES[lg]}: stagioni ${seasons[0]}…${seasons.at(-1)}, tasso titolari ammoniti ${seasons.map(rate).join(' / ')}%\n  ` + out.join('\n  '));
}
