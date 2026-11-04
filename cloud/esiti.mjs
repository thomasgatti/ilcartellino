// Esiti delle partite finite (stesso formato di fmResult nella scheda FotMob): node cloud/esiti.mjs <id,id,...>
import { loadLib } from './lib_node.mjs';
loadLib(['fm_model.js']);
const ids = (process.argv[2] || '').split(',').filter(Boolean).map(Number);
const out = []; for (const id of ids) { try { out.push(await fmResult(id)); } catch (e) { out.push({ id, err: String(e) }); } }
console.log('ESITI_JSON_START'); console.log(JSON.stringify(out)); console.log('ESITI_JSON_END');
