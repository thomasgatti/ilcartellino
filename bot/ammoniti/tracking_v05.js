// v0.5 — modello finale, ricalibrazione, previsione e registro esiti (da eseguire su una pagina www.sofascore.com
// dopo aver caricato features_v03.js, model_v03.js, predict_v03.js, model_v04.js, model_v05.js)
//
// const R5 = patchBuild5()(__H, __TE);                     // __H = dati scaricati (vedi RUNBOOK), __TE = calendari
// const D = R5.data.filter(d => d.mi >= 150);
// const F5 = [...finalFeatures(D), ...roleFeats({hx: 49.4}), ...extraFeats().forma_recente];
// const base = fitLogitW(D, F5, null);  -> poi offset sul logit per allineare la media alle ultime 1,5 stagioni
// const predictV05 = eval('(' + predictV03.toString().replace('const d = { home, pos,',
//   'const d = { hx: h ? h[0] : null, hy: h ? h[1] : null, hist: (PS[q.player.id]?.hist || []).slice(-8), home, pos,') + ')');
// const P = await predictV05([eventIds], MODEL, R5.state);

function logPredictions(P, label) {
  const log = JSON.parse(localStorage.getItem('amm_pred_log') || '[]');
  for (const [eid, o] of Object.entries(P)) {
    const t = o.list.slice(0, 3);
    log.push({ eid: +eid, label, partita: o.partita, uff: o.ufficiali, quando: new Date().toISOString(),
      top3: t.map(x => [x.id, x.n, +x.p.toFixed(3)]), tutti: o.list.map(x => [x.id, +x.p.toFixed(3)]) });
  }
  localStorage.setItem('amm_pred_log', JSON.stringify(log)); return log.length;
}

async function checkResults(label) {
  const log = JSON.parse(localStorage.getItem('amm_pred_log') || '[]').filter(x => !label || x.label === label);
  const latest = {}; for (const x of log) latest[x.eid] = x;      // vale l'ultima previsione salvata per ogni partita
  const out = [];
  for (const x of Object.values(latest)) {
    const ev = await fetch(`https://www.sofascore.com/api/v1/event/${x.eid}`).then(r => r.json());
    if (ev.event.status.type !== 'finished') { out.push({ partita: x.partita, stato: ev.event.status.description }); continue; }
    const inc = await fetch(`https://www.sofascore.com/api/v1/event/${x.eid}/incidents`).then(r => r.json());
    const booked = new Set((inc.incidents || []).filter(c => c.incidentType === 'card' && c.player && (c.incidentClass === 'yellow' || c.incidentClass === 'yellowRed')).map(c => c.player.id));
    const hits = x.top3.filter(t => booked.has(t[0])).length;
    const ll = -x.tutti.reduce((s, [id, p]) => s + (booked.has(id) ? Math.log(p) : Math.log(1 - p)), 0) / x.tutti.length;
    out.push({ partita: x.partita, top3: x.top3.map(t => `${t[1]} ${(t[2] * 100).toFixed(0)}%${booked.has(t[0]) ? ' ✔' : ''}`), azzeccati: hits,
      ammoniti_titolari: x.tutti.filter(([id]) => booked.has(id)).length, attesi: +x.tutti.reduce((s, [, p]) => s + p, 0).toFixed(2), logloss: +ll.toFixed(3) });
  }
  return out;
}

// Fusione modello + quote "+ Cartellino" del bookmaker. odds = {"Nome Cognome": quota}
// Allinea i livelli (margine del bookmaker sconosciuto) e fa la media dei logit con peso wMarket.
function blendMarket(list, odds, wMarket = 0.5) {
  const norm = s => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const found = list.map(x => { const k = Object.keys(odds).find(n => norm(n).split(' ').pop() === norm(x.n).split(' ').pop()); return k ? { x, imp: 1 / odds[k], name: k } : null; }).filter(Boolean);
  if (found.length < 3) return { nota: 'troppo pochi giocatori in comune', list };
  const kf = found.reduce((s, f) => s + f.imp, 0) / found.reduce((s, f) => s + f.x.p, 0);
  const lg = p => Math.log(p / (1 - p)), sg = z => 1 / (1 + Math.exp(-z));
  const out = list.map(x => { const f = found.find(f => f.x === x); if (!f) return { ...x, pm: null, pb: x.p };
    const pm = Math.min(0.9, f.imp / kf); return { ...x, pm, pb: sg((1 - wMarket) * lg(x.p) + wMarket * lg(pm)) }; });
  out.sort((a, b) => b.pb - a.pb); return { margine_stimato: +kf.toFixed(2), list: out };
}

// Esporta i dati per la web app "I miei ammoniti" (webapp/data.json) da un oggetto P = await predictV05(...)
async function exportAppData(P, round, season = '2026-27', model = 'v0.5') {
  const B = 'https://www.sofascore.com/api/v1'; const matches = [];
  for (const [eid, o] of Object.entries(P)) {
    const [ev, lu] = await Promise.all([fetch(B + `/event/${eid}`).then(r => r.json()), fetch(B + `/event/${eid}/lineups`).then(r => r.json())]);
    const e = ev.event; const num = {}, posd = {};
    for (const s of ['home', 'away']) for (const p of lu[s].players) { num[p.player.id] = p.jerseyNumber || p.shirtNumber || ''; posd[p.player.id] = p.position; }
    const homeShort = e.homeTeam.name.replace(/^(AC|SSC|AS) /, '');
    matches.push({ id: +eid, ko: e.startTimestamp, h: e.homeTeam.shortName || e.homeTeam.name, a: e.awayTeam.shortName || e.awayTeam.name,
      hc: [e.homeTeam.teamColors?.primary, e.homeTeam.teamColors?.secondary], ac: [e.awayTeam.teamColors?.primary, e.awayTeam.teamColors?.secondary],
      ref: o.arbitro, odds: o.p1x2, line: o.linea, uff: lu.confirmed ? 1 : 0,
      pl: o.list.map(x => [x.n, x.t === homeShort ? 'h' : 'a', posd[x.id] || '', String(num[x.id] || ''), +x.p.toFixed(3), x.vs || '']) });
  }
  matches.sort((a, b) => a.ko - b.ko);
  return { round, season, updated: new Date().toISOString(), model, matches };
}
