// Prova della catena del modello nel cloud senza pubblicare: costruisce i modelli come cloud/giornata.mjs (startModel)
// e stima le partite indicate con saExport (Serie A) e cupExport3 (Champions/Nazionali). Uso: node cloud/prova_modello.mjs "<id SA>" "<id coppe>"
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadLib } from './lib_node.mjs';
import { loadContesto } from './contesto.mjs';
const historic = 'dati/fotmob', sa = (process.argv[2] || '').split(/\s+/).filter(Boolean).map(Number), cup = (process.argv[3] || '').split(/\s+/).filter(Boolean).map(Number);
loadLib(['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js', 'deep_feats.js', 'cup_x3.js', 'hot_feats.js', 'ctx_feats.js', 'sa_export.js', 'amm_boot.js']);
const all = fs.readdirSync(historic).filter(f => f.endsWith('.json.gz')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(historic, f))))));
const cutoff = Date.now() / 1000 - 3 * 86400, before = all.filter(m => m.ts && m.ts < cutoff && m.pl?.length > 20 && ![...sa, ...cup].includes(+m.id));
globalThis.idbAll = async name => Object.fromEntries(before.flatMap(m => name === 'amm' ? (m.lg === 55 ? [[m.id, m]] : []) : name === 'amm_ucl' ? (m.lg === 42 ? [[m.id, m]] : []) : name === 'amm_dom' ? (![55, 42].includes(m.lg) ? [[m.id, m]] : []) : (m.x ? [[m.id, m.x]] : [])));
globalThis.__CTX = loadContesto(path.dirname(historic), before); console.log('contesto', globalThis.__CTX.quote.size, globalThis.__CTX.poss.size);
const odds = globalThis.fmOdds; globalThis.fmOdds = async ids => Object.fromEntries(Object.entries(await odds(ids)).filter(([, v]) => v.p));
const st = await globalThis.ammBuild(); console.log('ammBuild', st.fase, JSON.stringify(st.hot), JSON.stringify(st.ctx));
globalThis.saPatchVs();
if (sa.length) { const ex = await globalThis.saExport(sa); for (const m of ex) console.log('SA', m.id, m.teams?.map(t => t[1]).join(' - '), 'quote', m.odds, 'ODDSNOW', JSON.stringify(globalThis.__ODDSNOW[m.id]), 'ctx casa', JSON.stringify(globalThis.ctxOddsNow(m.id, 1)), '\n  ', (m.pl || []).slice(0, 8).map(r => r[0] + ' ' + r[4]).join(' · ')); }
if (cup.length) { const ex = await globalThis.cupExport3(cup); for (const m of ex) console.log('COPPA', m.id, m.err || '', m.teams?.map(t => t[1]).join(' - '), 'quote', m.odds, m.teams ? 'poss casa ' + globalThis.ctxPossNow(m.teams[0][0], m.teams[1][0], 1).toFixed(2) : '', '\n  ', (m.pl || []).slice(0, 8).map(r => r[0] + ' ' + r[3]).join(' · ')); }
