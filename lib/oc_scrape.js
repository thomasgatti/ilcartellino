// oc_scrape.js — quote "+ Cartellino" (To Be Shown A Card) da Oddschecker, da iniettare nella scheda oddschecker.com.
// Fetch normale della pagina partita; i dati sono incorporati (query "odds-grid"). Nessun login, nessuna chiave.
window.ocParseCards = (raw) => {
  const t = raw.replace(/&quot;/g, '"').replace(/&amp;/g, '&');
  const mm = t.match(/"ocMarketId":\[0,(\d+)\],"ocBetTypeId":\[0,\d+\],"marketName":\[0,"[^"]*#To Be Shown A Card"/);
  if (!mm) return { err: 'no market' };
  const id = mm[1], start = t.indexOf('"' + id + '":[0,{"mutations"'); if (start < 0) return { err: 'no data', id };
  const end = t.indexOf('"queryKey"', start); const seg = t.slice(start, end);
  const bets = []; const re = /\{"id":\[0,\d+\],"name":\[0,"([^"]+)"\](?:,"aiProbability":\[0,([\d\.]+)\])?,"odds":\[1,\[(.*?)\]\]\]\}/g; let m;
  while ((m = re.exec(seg))) { const dec = [...m[3].matchAll(/"decimal":\[0,([\d\.]+)\]/g)].map(x => +x[1]); const bk = [...m[3].matchAll(/"bookmakerCode":\[0,"([A-Z0-9]+)"\]/g)].map(x => x[1]); if (dec.length) bets.push({ n: m[1], ai: m[2] ? +m[2] : null, dec, bk }); }
  return { id, bets };
};
window.ocCards = async path => { const r = await fetch(path); if (r.status !== 200) return { err: 'status ' + r.status }; return ocParseCards(await r.text()); };
// Elenco partite: fetch('/it/calcio/coppe-e-amichevoli-per-club/champions-league') e regex sui link /champions-league/<slug>.
// Serie A: /it/calcio/italia/serie-a/<slug>.
// Esporta: Object.entries(__OC).map(([k,v])=>k+'|'+v.bets.map(b=>b.n+':'+b.dec[0]).join(';')).join('\n')
