// Prima metà della prova «miscela col mercato in Champions» (17/11/2026, rifatta dopo la revisione di ChatGPT).
// Ricostruisce il modello v4 di produzione e scrive una riga per titolare delle partite 2026/27: id, data, nome, lato, esito, p del modello.
// Medie di lega e di ruolo (cupLeagueRates, cupX2Build, deepFeatBuild) solo sulle partite prima della prima gara di prova (window.__MEDIE_FINO);
// allenamento e spostamento di livello sulle stagioni precedenti. ARCHIVIO_FINO=<unix> taglia l'archivio (controllo: le previsioni di prima non devono cambiare).
// La miscela la fa miscela_confronto.py con le funzioni di produzione di market_blend.py.
// Uso: node --max-old-space-size=6500 miscela_righe.mjs righe.json
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadLib } from '../../../../cloud/lib_node.mjs';
const DATI = process.env.DATI || '/home/claude/datib/fotmob';
const all = fs.readdirSync(DATI).filter(f => f.endsWith('.json.gz')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(DATI, f))))));
const ok = all.filter(m => m.ts && m.pl?.length > 20 && !(m.ts > +process.env.ARCHIVIO_FINO));
const T0 = Math.min(...ok.filter(m => m.lg === 42 && m.season === '2026/2027').map(m => m.ts));
loadLib(['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js', 'deep_feats.js', 'cup_x3.js', 'hot_feats.js', 'ctx_feats.js', 'sa_export.js', 'amm_boot.js']);
globalThis.__MEDIE_FINO = T0;
globalThis.idbAll = async name => Object.fromEntries(ok.flatMap(m => {
  if (name === 'amm') return m.lg === 55 ? [[m.id, m]] : [];
  if (name === 'amm_ucl') return m.lg === 42 ? [[m.id, m]] : [];
  if (name === 'amm_dom') return ![55, 42].includes(m.lg) ? [[m.id, m]] : [];
  return m.x ? [[m.id, m.x]] : [];
}));
const { loadContesto } = await import('../../../../cloud/contesto.mjs');
globalThis.__CTX = loadContesto(path.dirname(DATI), ok);
const st = await globalThis.ammBuild();
console.error('moduli:', JSON.stringify({ hot: st.hot?.errore || st.hot?.saltato || { patch: st.hot?.patch }, ctx: st.ctx?.errore || st.ctx?.saltato || { sa: st.ctx?.sa?.patch, ucl: st.ctx?.ucl?.patch } }), '· medie fino a', new Date(T0 * 1000).toISOString().slice(0, 10));
const lg = p => { p = Math.min(Math.max(p, 1e-4), 1 - 1e-4); return Math.log(p / (1 - p)); }, sg = z => 1 / (1 + Math.exp(-z));
const UC = globalThis.__CROWS2.filter(d => d.lg === 42 && d.ex && d.x2 && d.x3);
const tr = UC.filter(d => d.season < '2026/2027'), te = UC.filter(d => d.season === '2026/2027');
const mdl = globalThis.fitLogit(tr, globalThis.__CFS5, 2);
const cal = tr.filter(d => d.season === '2025/2026'); let sh = 0;
for (let i = 0; i < 40; i++) { const mu = cal.reduce((a, d) => a + sg(lg(mdl.pred(d)) + sh), 0) / cal.length, y = cal.reduce((a, d) => a + d.y, 0) / cal.length; sh = Math.max(-1, Math.min(1, sh + lg(y) - lg(mu))); }
const ts = new Map(ok.map(m => [String(m.id), m.ts]));
const righe = te.map(d => ({ id: d.mid, ts: ts.get(String(d.mid)), n: d.name, y: d.y, p: sg(lg(mdl.pred(d)) + sh) }));
fs.writeFileSync(process.argv[2], JSON.stringify({ spostamento: sh, righe }));
console.error('righe:', righe.length, 'partite:', new Set(righe.map(r => r.id)).size, 'spostamento:', sh.toFixed(4));
