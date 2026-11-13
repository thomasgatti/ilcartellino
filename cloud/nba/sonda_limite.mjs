// Sonda OddsPapi: consumo e data di azzeramento della quota (/v4/account è sempre consentito e non conta). Solo log, senza dati personali.
const r = await fetch('https://api.oddspapi.io/v4/account?apiKey=' + process.env.ODDSPAPI_KEY), j = await r.json().catch(() => null);
const vedi = (o, p = '') => { for (const [k, v] of Object.entries(o || {})) { if (v && typeof v === 'object') vedi(v, p + k + '.'); else if (/request|limit|count|reset|period|start|end|plan|tier|status|renew/i.test(k) && !/key|mail|name|token|id$/i.test(k)) console.log(p + k + ' = ' + v); } };
console.log(r.status); vedi(j);
