// sa_export.js — giornata di Serie A dalla scheda FotMob (dopo fm_model.js, cup_model*.js, ext_model.js e
// fmBuild(); addLgr(); cupBuild2(); extBuild(); extMakeModels(['posizione_partita','forza_ruolo'], ['posizione_partita']); extPatchPredict();)
// Uso: await saPatchVs(); window.__SAX = await saExport([id FotMob,...]); poi saFinal() → JSON per sa_to_data.py (tmp/saNN.json).
// Titolare %: ultima formazione FotMob (lastStarting11 / predicted / standard) + titolarità nelle ultime 5 giornate di Serie A,
// normalizzate a 10 titolari di movimento per squadra, massimo 92% finché non c'è la formazione ufficiale ('standard' → 100% per gli 11).
// Con le probabili dei giornali (consenso Fantacalcio-Online) sostituire st con la percentuale di consenso.
window.saPatchVs = () => {
  let f = fmPredict3.toString();
  const a = "sw += w; s += w * rate(PS[o.id], 'fd', 'fd', PS[o.id]?.role || ROLE(o.pos));";
  if (!f.includes('x._vs')) f = f.replace(a, a + " if (!x._bw || w > x._bw) { x._bw = w; x._vs = o.name; }").replace("refx: d.ex?.ref,", "vs: x._vs || '', refx: d.ex?.ref,");
  window.fmPredict3 = eval('(' + f + ')');
};
window.saExport = async (ids) => {
  const OD = await fmOdds(ids); const res = [];
  const SAm = Object.values(__FMM).filter(m => m.season === '2026/2027').sort((a, b) => b.ts - a.ts);
  const { PS: CPS, LR } = window.__CST2; const K = 1500;
  for (const id of ids) {
    const j = await (await fetch('/api/data/matchDetails?matchId=' + id)).json(); const H = j.header.teams;
    const lu = j.content.lineup; const xi = new Set([...(lu.homeTeam?.starters || []), ...(lu.awayTeam?.starters || [])].map(p => +p.id));
    const extra = [], seen = new Set(xi), share = {};
    for (const [side, T] of [[1, H[0]], [0, H[1]]]) { const mine = SAm.filter(m => m.h[0] === T.id || m.a[0] === T.id);
      for (const m of mine.slice(0, 5)) { const s = m.h[0] === T.id ? 1 : 0; for (const r of m.pl) if (r[2] === s && r[4] === 1) share[+r[0]] = (share[+r[0]] || 0) + 1; }
      for (const m of mine.slice(0, 6)) { const s = m.h[0] === T.id ? 1 : 0; for (const r of m.pl) if (r[2] === s && r[3] !== 0 && r[5] > 0 && !seen.has(+r[0])) { seen.add(+r[0]); extra.push({ id: r[0], name: r[1], side, pos: r[3] }); } } }
    const R = await fmPredict3(id, __SAM3, extra);
    const od = OD[id];
    res.push({ id, lt: R.lineupType, ko: j.general?.matchTimeUTCDate, ref: R.ref || '', teams: H.map(t => [t.id, t.name]), colors: j.general?.teamColors?.lightMode, odds: od ? od.p.join('/') : null,
      pl: R.out.filter(x => x.pos !== 0).map(x => { const st = Math.round(100 * ((share[+x.id] || 0) + (xi.has(+x.id) ? 1 : 0)) / 6);
        const cp = CPS[x.id]; let yiAll = null, allMin = 0, top = '';
        if (cp) { allMin = Math.round(cp.min); const lr = LR['55|' + (cp.role || x.role)] || LR['55|M']; yiAll = (cp.y + lr.y * K / 90) / (cp.ey + lr.y * K / 90);
          const t = Object.entries(cp.lgs || {}).filter(([l]) => ![42, 73, 10216, 55].includes(+l)).sort((a, b) => b[1] - a[1])[0]; if (t && t[1] >= 300) top = (LGN[t[0]] || t[0]) + ' ' + Math.round(t[1]); }
        return [x.name, x.side, x.role, +x.p.toFixed(3), st, x.min, allMin, yiAll ? +yiAll.toFixed(2) : null, top, x.vs, x.diff || 0, x.cy || 0, xi.has(+x.id) ? 1 : 0]; }),
      refx: R.out[0]?.refx != null ? +R.out[0].refx.toFixed(2) : null, h2h: R.out[0]?.h2h != null ? +R.out[0].h2h.toFixed(2) : null });
  }
  return res;
};
// Trasformazione finale (titolare %, storico estero per chi ha < 900' in Serie A, etichette) → JSON compatto per sa_to_data.py
window.saFinal = () => {
  const L = x => Math.log(x / (1 - x)), E = z => 1 / (1 + Math.exp(-z));
  const shortN = n => { const p = n.split(' '); return p.length === 1 ? n : p[0][0] + '. ' + p.slice(1).join(' '); };
  return __SAX.map(m => {
    const seen = new Set(); let rows = m.pl.filter(r => { if (seen.has(r[0])) return false; seen.add(r[0]); return true; });
    const unav = m.lt === 'unavailable', official = m.lt === 'standard';
    rows = rows.map(r => { const share = Math.round(r[4] * 6 / 100) - r[12]; let st = official ? (r[12] ? 1 : 0) : unav ? share / 5 : (share + r[12]) / 6; return { r, st }; });
    if (!official) for (const s of [0, 1]) { const T = rows.filter(x => x.r[1] === s); let k = 1; for (let it = 0; it < 30; it++) { const tot = T.reduce((a, x) => a + Math.min(.92, x.st * k), 0); k *= 10 / tot; } T.forEach(x => x.st = Math.min(.92, x.st * k)); }
    const out = rows.filter(x => x.st >= .2).map(({ r, st }) => {
      let pt = r[3]; const saMin = r[5], allMin = r[6], yi = r[7]; const tag = [];
      if (saMin < 900 && allMin >= 900 && yi) pt = E(L(pt) + .9 * Math.log(Math.min(2.5, Math.max(.4, yi))));
      if (r[8] && saMin < 900) tag.push('Storico: ' + r[8].replace(/ (\d+)$/, (a, b) => ' ' + (+b).toLocaleString('it-IT') + "'"));
      if (allMin < 900) tag.push("Poca esperienza: " + allMin + "' nello storico");
      if (r[10]) tag.push('Diffidato: al prossimo giallo salta una partita');
      return [shortN(r[0]), r[1] ? 'h' : 'a', r[2], '', +(pt * st).toFixed(3), r[9] || '', Math.round(st * 100), +pt.toFixed(3), tag];
    });
    return { id: m.id, ko: m.ko, teams: m.teams, colors: m.colors, odds: m.odds, lt: m.lt, h2h: m.h2h, pl: out };
  });
};
