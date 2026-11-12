// Sonda OddsPapi (12/11): verifica se esistono quote "giocatore ammonito/cartellino" per Serie A e Champions e quanto storico c'è.
// Serve la chiave gratuita nel segreto ODDSPAPI_KEY (non va mai scritta nel codice). Stampa solo estratti nel log.
const K = process.env.ODDSPAPI_KEY, B = 'https://api.oddspapi.io/v4';
if (!K) { console.log('Manca il segreto ODDSPAPI_KEY'); process.exit(0); }
const get = async (p, q = {}) => { const u = new URL(B + p); for (const [k, v] of Object.entries({ ...q, apiKey: K })) u.searchParams.set(k, v);
  const r = await fetch(u); const t = await r.text(); let j = null; try { j = JSON.parse(t); } catch {} console.log(`\n=== ${r.status} ${p} ${JSON.stringify(q)} (${t.length} caratteri)`); return j ?? t; };
const find = (x, re, out = [], path = '') => { if (x && typeof x === 'object') { for (const [k, v] of Object.entries(x)) find(v, re, out, path + '/' + k); } else if (typeof x === 'string' && re.test(x)) out.push(path + ' = ' + x); return out; };
const sports = await get('/sports'); console.log(JSON.stringify(sports).slice(0, 1500));
const soccer = (Array.isArray(sports) ? sports : sports?.data || []).find(s => /soccer|football/i.test(JSON.stringify(s)));
const sid = soccer?.sportId ?? soccer?.id ?? 10; console.log('sportId calcio:', sid);
const mk = await get('/markets', { sportId: sid }); const hits = find(mk, /card|book|yellow|ammon/i); console.log('mercati cartellini:', hits.length, '\n' + hits.slice(0, 80).join('\n'));
const tn = await get('/tournaments', { sportId: sid }); console.log(find(tn, /serie a|champions league/i).slice(0, 20).join('\n'));
