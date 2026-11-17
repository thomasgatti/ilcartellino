// Modello coppe europee (Champions, Europa League, Conference) su dati FotMob.
// Storico di ogni giocatore su TUTTE le competizioni scaricate (Serie A, campionati esteri, coppe),
// con gialli e falli riportati alla scala di ogni campionato: quanto il giocatore ammonisce/fa falli
// rispetto alla media del suo ruolo nel campionato in cui ha giocato.
// Richiede in pagina: window.__FMM (Serie A), window.__UCL (Champions), window.__DOM (campionati esteri, EL, UECL), fitLogit, fmMetrics.
(() => {
  const ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M';
  const L = x => Math.log(Math.max(.005, x));
  const CUPS = new Set([42, 73, 10216]);
  window.cupAll = () => [
    ...Object.values(window.__FMM || {}).map(m => ({ ...m, lg: 55 })),
    ...Object.values(window.__UCL || {}).map(m => ({ ...m, lg: 42 })),
    ...Object.values(window.__DOM || {}),
  ].filter(m => m.pl && m.pl.length > 20 && m.ts).sort((a, b) => a.ts - b.ts);

  // media per campionato e ruolo (gialli e falli ogni 90')
  window.cupLeagueRates = A => {
    const T = {};
    for (const m of A) {
      if (m.ts >= window.__MEDIE_FINO) continue;   // limite di data per le medie (solo ricerca)
      const booked = new Set(m.cards.filter(c => c[2] === 'Yellow' || c[2] === 'YellowRed').map(c => +c[0]));
      for (const r of m.pl) { if (!r[5] || r[3] === 0) continue; const k = m.lg + '|' + ROLE(r[3]); const t = T[k] ||= { m: 0, y: 0, f: 0 }; t.m += r[5]; t.y += booked.has(+r[0]) ? 1 : 0; t.f += r[6]; t.fd = (t.fd || 0) + r[7]; }
    }
    const R = {}; for (const k in T) R[k] = { y: T[k].y / T[k].m * 90, f: T[k].f / T[k].m * 90, fd: T[k].fd / T[k].m * 90, m: T[k].m };
    return R;
  };

  window.cupBuild = (K = 1500) => {
    const A = cupAll(), LR = cupLeagueRates(A); const PS = {}, TS = {}, RS = {}; const lgCup = {};
    const ps = id => PS[id] ||= { min: 0, y: 0, f: 0, ey: 0, ef: 0, cupmin: 0, role: null, lgs: {} };
    const rows = [];
    for (const m of A) {
      const booked = new Set(m.cards.filter(c => c[2] === 'Yellow' || c[2] === 'YellowRed').map(c => +c[0]));
      if (CUPS.has(m.lg)) {
        const base = LR[m.lg + '|M'];
        for (const r of m.pl.filter(r => r[4] === 1 && r[3] !== 0)) {
          const p = ps(r[0]); const role = p.role || ROLE(r[3]); const lr = LR[m.lg + '|' + role] || base;
          // indice personale: gialli (falli) osservati / attesi per ruolo e campionato, con prior di K minuti
          const yi = (p.y + lr.y * K / 90) / (p.ey + lr.y * K / 90), fi = (p.f + lr.f * K / 90) / (p.ef + lr.f * K / 90);
          rows.push({ mid: m.id, lg: m.lg, season: m.season, name: r[1], pid: r[0], side: r[2], team: (r[2] ? m.h : m.a)[1], y: booked.has(+r[0]) ? 1 : 0,
            role, home: r[2], yi, fi, yc: yi * lr.y, fl: fi * lr.f, min: p.min, cupmin: p.cupmin, ko: isNaN(+m.round) ? 1 : 0 });
        }
      }
      for (const r of m.pl) {
        if (!r[5] || r[3] === 0) continue; const p = ps(r[0]); if (!p.role) p.role = ROLE(r[3]);
        const lr = LR[m.lg + '|' + p.role]; if (!lr) continue; const y = booked.has(+r[0]) ? 1 : 0;
        p.min += r[5]; p.y += y; p.f += r[6]; p.ey += lr.y * r[5] / 90; p.ef += lr.f * r[5] / 90; p.lgs[m.lg] = (p.lgs[m.lg] || 0) + r[5];
        if (CUPS.has(m.lg)) p.cupmin += r[5];
      }
    }
    window.__CROWS = rows; window.__CST = { PS, LR }; return { rows: rows.length, players: Object.keys(PS).length };
  };

  window.cupFS = {
    ruolo: [d => d.role === 'M' ? 1 : 0, d => d.role === 'F' ? 1 : 0, d => d.home],
    storico: [d => d.role === 'M' ? 1 : 0, d => d.role === 'F' ? 1 : 0, d => d.home, d => L(d.yc), d => L(d.fl)],
    storico_coppa: [d => d.role === 'M' ? 1 : 0, d => d.role === 'F' ? 1 : 0, d => d.home, d => L(d.yc), d => L(d.fl), d => d.lg === 73 ? 1 : 0, d => d.lg === 10216 ? 1 : 0, d => d.ko],
  };

  // probabilità per una partita di coppa (formazione FotMob probabile o ufficiale) + giocatori extra [{id,name,side,pos}]
  window.cupPredict = async (matchId, model, extra = []) => {
    const j = await (await fetch('/api/data/matchDetails?matchId=' + matchId)).json(); const lu = j.content.lineup, H = j.header.teams;
    const { PS, LR } = window.__CST; const lg = j.general?.leagueId || j.general?.parentLeagueId || 42; const K = 1500;
    const all = []; for (const [side, T] of [[1, lu.homeTeam], [0, lu.awayTeam]]) for (const p of (T.starters || [])) if (p.usualPlayingPositionId !== 0) all.push({ id: p.id, name: p.name, side, pos: p.usualPlayingPositionId, st: 1 });
    extra.forEach(e => all.push({ ...e, st: 0 }));
    const out = all.map(x => { const p = PS[x.id], role = p?.role || ROLE(x.pos), lr = LR[(CUPS.has(lg) ? lg : 42) + '|' + role] || LR['42|' + role];
      const yi = ((p?.y || 0) + lr.y * K / 90) / ((p?.ey || 0) + lr.y * K / 90), fi = ((p?.f || 0) + lr.f * K / 90) / ((p?.ef || 0) + lr.f * K / 90);
      const d = { role, home: x.side, yc: yi * lr.y, fl: fi * lr.f, lg, ko: 0 };
      return { ...x, team: x.side ? H[0].name : H[1].name, role, p: +model.pred(d).toFixed(4), min: Math.round(p?.min || 0), lgs: p?.lgs || {} }; });
    return { lineupType: lu.lineupType, ref: j.content.matchFacts?.infoBox?.Referee?.text, ko: j.general?.matchTimeUTCDate, teams: H.map(t => [t.id, t.name]), colors: j.general?.teamColors?.lightMode, out };
  };
})();
