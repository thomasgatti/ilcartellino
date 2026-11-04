// Carica i file della cartella lib/ (scritti per la scheda del browser) dentro Node: window = globalThis,
// fetch con indirizzi relativi → https://www.fotmob.com, localStorage finto. Usato da scrape.mjs e dagli script del bot nel cloud.
import fs from 'node:fs'; import path from 'node:path'; import vm from 'node:vm';
const LIB = path.join(path.dirname(new URL(import.meta.url).pathname), '..', 'lib');
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36';
const _fetch = globalThis.fetch;
globalThis.window = globalThis;
globalThis.fetch = (u, o = {}) => _fetch(String(u).startsWith('/') ? 'https://www.fotmob.com' + u : u, { redirect: 'follow', ...o, headers: { 'user-agent': UA, ...(o.headers || {}) } });
const store = {}; globalThis.localStorage = { getItem: k => store[k] ?? null, setItem: (k, v) => { store[k] = String(v); }, removeItem: k => { delete store[k]; }, key: i => Object.keys(store)[i], get length() { return Object.keys(store).length; } };
export function loadLib(files) { for (const f of files) vm.runInThisContext('{' + fs.readFileSync(path.join(LIB, f), 'utf8') + '\n}', { filename: f }); }
