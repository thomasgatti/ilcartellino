// Modello coppe v2: oltre allo storico del giocatore, studia l'AVVERSARIO.
// - facing: falli subiti (per 90', riportati alla scala del loro campionato) dagli avversari che giocano nella sua zona di campo,
//   pesati per vicinanza delle posizioni medie abituali (come la variabile "duelli" della Serie A)
// - opp_fd: falli subiti per partita dalla squadra avversaria (ultime 10, normalizzati per campionato)
// - own_f: falli commessi per partita dalla propria squadra (ultime 10, normalizzati)
// - gap: differenza di forza (Elo su tutte le competizioni, con partenza diversa per campionato); positivo = avversario più forte
(() => {
  const ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M';
  const L = x => Math.log(Math.max(.005, x));
  const CUPS = new Set([42, 73, 10216]);
  const ELO0 = { 47: 1720, 87: 1700, 54: 1680, 55: 1680, 53: 1620, 61: 1580, 57: 1580, 71: 1520, 40: 1520, 48: 1480, 135: 1480, 38: 1470, 122: 1470, 64: 1470, 69: 1460, 46: 1460, 441: 1460, 59: 1440, 176: 1400, 262: 1380 };
  window.cupBuild2 = (K = window.__CK || 1500) => {
    const A = cupAll(), LR = cupLeagueRates(A);
    // media falli per squadra e partita, per campionato (per normalizzare le statistiche di squadra)
    const TF = {}; for (const m of A) { const t = TF[m.lg] ||= { n: 0, f: 0 }; for (const r of m.pl) if (r[5]) t.f += r[6]; t.n += 2; }
    const tfm = lg => TF[lg] ? TF[lg].f / TF[lg].n : 12;
    const PS = {}, TS = {}, ELO = {}; const rows = [];
    const ps = id => PS[id] ||= { min: 0, y: 0, f: 0, fd: 0, ey: 0, ef: 0, efd: 0, cupmin: 0, role: null, xs: [], lgs: {} };
    const elo = (id, lg) => ELO[id] ??= (ELO0[lg] || 1450);
    const habit = id => { const p = PS[id]; if (!p || !p.xs.length) return null; const a = p.xs.slice(-8); return [a.reduce((s, x) => s + x[0], 0) / a.length, a.reduce((s, x) => s + x[1], 0) / a.length]; };
    const fdRate = (id, role, lr) => { const p = PS[id]; return ((p?.fd || 0) + lr.fd * K / 90) / ((p?.efd || 0) + lr.fd * K / 90) * lr.fd; };
    for (const m of A) {
      const booked = new Set(m.cards.filter(c => c[2] === 'Yellow' || c[2] === 'YellowRed').map(c => +c[0]));
      if (CUPS.has(m.lg)) {
        const st = m.pl.filter(r => r[4] === 1 && r[3] !== 0);
        const team = s => (TS[(s ? m.h : m.a)[0]] || []).slice(-10), tavg = (a, k) => a.length ? a.reduce((x, y) => x + y[k], 0) / a.length : 1;
        const eH = elo(m.h[0], null), eA = elo(m.a[0], null);
        for (const r of st) {
          const p = ps(r[0]); const role = p.role || ROLE(r[3]); const lr = LR[m.lg + '|' + role] || LR[m.lg + '|M'];
          const yi = (p.y + lr.y * K / 90) / (p.ey + lr.y * K / 90), fi = (p.f + lr.f * K / 90) / (p.ef + lr.f * K / 90);
          const h = habit(r[0]); let facing = null;
          if (h) { let sw = 0, s = 0; for (const o of st) { if (o[2] === r[2]) continue; const ho = habit(o[0]); if (!ho) continue; const d = Math.hypot(h[0] - (1 - ho[0]), h[1] - (1 - ho[1])); const w = Math.exp(-d / .12); const ro = PS[o[0]]?.role || ROLE(o[3]); const lo = LR[m.lg + '|' + ro] || lr; sw += w; s += w * fdRate(o[0], ro, { fd: lo.fd ?? 1.1 }); } if (sw > 0) facing = s / sw; }
          const own = r[2] ? eH : eA, opp = r[2] ? eA : eH;
          rows.push({ mid: m.id, lg: m.lg, season: m.season, name: r[1], pid: r[0], side: r[2], y: booked.has(+r[0]) ? 1 : 0, role, home: r[2],
            yc: yi * lr.y, fl: fi * lr.f, facing, opp_fd: tavg(team(1 - r[2]), 'fdn'), own_f: tavg(team(r[2]), 'fn'), gap: (opp - own + (r[2] ? -60 : 60)) / 100, min: p.min, cupmin: p.cupmin });
        }
      }
      // aggiorna giocatori
      const tF = [0, 0], tFD = [0, 0];
      for (const r of m.pl) {
        if (!r[5] || r[3] === 0) continue; const p = ps(r[0]); if (!p.role) p.role = ROLE(r[3]);
        const lr = LR[m.lg + '|' + p.role]; if (!lr) continue; const y = booked.has(+r[0]) ? 1 : 0;
        p.min += r[5]; p.y += y; p.f += r[6]; p.fd += r[7]; p.ey += lr.y * r[5] / 90; p.ef += lr.f * r[5] / 90; p.efd += (lr.fd ?? 1.1) * r[5] / 90; p.lgs[m.lg] = (p.lgs[m.lg] || 0) + r[5];
        if (CUPS.has(m.lg)) p.cupmin += r[5]; if (r[12] != null) p.xs.push([r[12], r[13]]);
        tF[r[2]] += r[6]; tFD[r[2]] += r[7];
      }
      const n = tfm(m.lg);
      (TS[m.h[0]] ||= []).push({ fn: tF[1] / n, fdn: tFD[1] / n }); (TS[m.a[0]] ||= []).push({ fn: tF[0] / n, fdn: tFD[0] / n });
      // Elo
      const eh = elo(m.h[0], m.lg), ea = elo(m.a[0], m.lg); const exp = 1 / (1 + 10 ** ((ea - eh - 60) / 400)); const res = m.hs > m.as ? 1 : m.hs === m.as ? .5 : 0;
      const kk = CUPS.has(m.lg) ? 30 : 20; ELO[m.h[0]] = eh + kk * (res - exp); ELO[m.a[0]] = ea - kk * (res - exp);
    }
    window.__CROWS2 = rows; window.__CST2 = { PS, LR, ELO, TS, tfm }; return rows.length;
  };
})();
// Previsione v2 per una partita (formazione FotMob) con avversario diretto ("vs") e differenza di forza; extra = [{id,name,side,pos}]
window.cupPredict2 = async (matchId, model, extra = []) => {
  const ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M'; const K = window.__CK || 1500;
  const j = await (await fetch('/api/data/matchDetails?matchId=' + matchId)).json(); const lu = j.content.lineup, H = j.header.teams;
  const { PS, LR, ELO } = window.__CST2; const lg = 42;
  const habit = id => { const p = PS[id]; if (!p || !p.xs.length) return null; const a = p.xs.slice(-8); return [a.reduce((s, x) => s + x[0], 0) / a.length, a.reduce((s, x) => s + x[1], 0) / a.length]; };
  const fdRate = (id, lfd) => { const p = PS[id]; return ((p?.fd || 0) + lfd * K / 90) / ((p?.efd || 0) + lfd * K / 90) * lfd; };
  const all = []; for (const [side, T] of [[1, lu.homeTeam], [0, lu.awayTeam]]) for (const p of (T.starters || [])) if (p.usualPlayingPositionId !== 0) all.push({ id: p.id, name: p.name, side, pos: p.usualPlayingPositionId, st: 1 });
  extra.forEach(e => all.push({ ...e, st: 0 }));
  const st = all.filter(x => x.st); const eH = ELO[H[0].id] ?? 1450, eA = ELO[H[1].id] ?? 1450;
  const out = all.map(x => { const p = PS[x.id], role = p?.role || ROLE(x.pos), lr = LR[lg + '|' + role];
    const yi = ((p?.y || 0) + lr.y * K / 90) / ((p?.ey || 0) + lr.y * K / 90), fi = ((p?.f || 0) + lr.f * K / 90) / ((p?.ef || 0) + lr.f * K / 90);
    const h = habit(x.id); let facing = null; const fac = [];
    if (h) { let sw = 0, s = 0; for (const o of st) { if (o.side === x.side) continue; const ho = habit(o.id); if (!ho) continue; const d = Math.hypot(h[0] - (1 - ho[0]), h[1] - (1 - ho[1])); const w = Math.exp(-d / .12); const ro = PS[o.id]?.role || ROLE(o.pos); const v = fdRate(o.id, LR[lg + '|' + ro].fd); sw += w; s += w * v; fac.push([o.name, w, v]); } if (sw > 0) facing = s / sw; }
    fac.sort((a, b) => b[1] - a[1]);
    const own = x.side ? eH : eA, opp = x.side ? eA : eH;
    const d = { role, home: x.side, yc: yi * lr.y, fl: fi * lr.f, facing, gap: (opp - own + (x.side ? -60 : 60)) / 100 };
    return { ...x, team: x.side ? H[0].name : H[1].name, role, p: +model.pred(d).toFixed(4), min: Math.round(p?.min || 0), lgs: p?.lgs || {}, vs: fac[0]?.[0] || '', vsfd: fac[0] ? +fac[0][2].toFixed(2) : null, gap: +d.gap.toFixed(2) }; });
  return { lineupType: lu.lineupType, ref: j.content.matchFacts?.infoBox?.Referee?.text, ko: j.general?.matchTimeUTCDate, teams: H.map(t => [t.id, t.name]), colors: j.general?.teamColors?.lightMode, elo: [Math.round(eH), Math.round(eA)], out };
};
// Esportazione compatta (solo titolari) per cup_to_data.py: [nome, lato, ruolo, p, minuti, campionato principale estero, di fronte]
window.cupExport2 = async ids => { const LGN = { 55: 'Serie A', 47: 'Premier League', 87: 'LaLiga', 54: 'Bundesliga', 53: 'Ligue 1', 57: 'Eredivisie', 61: 'Liga Portugal', 71: 'Süper Lig', 40: 'Pro League (BEL)', 135: 'Super League (GRE)', 38: 'Bundesliga (AUT)', 122: '1. Liga (CZE)', 59: 'Eliteserien', 64: 'Premiership (SCO)', 69: 'Super League (SUI)', 46: 'Superligaen', 441: 'Premier League (UKR)', 176: '1. Liga (SVK)', 262: 'Premier League (AZE)', 48: 'Championship' };
  const res = []; for (const id of ids) { const r = await cupPredict2(id, window.__CUPM2);
    res.push({ id, lt: r.lineupType, ko: r.ko, ref: r.ref, teams: r.teams, colors: r.colors, pl: r.out.filter(x => x.st).map(x => { const top = Object.entries(x.lgs).filter(([l]) => ![42, 73, 10216].includes(+l)).sort((a, b) => b[1] - a[1])[0]; return [x.name, x.side, x.role, +x.p.toFixed(3), x.min, top && +top[0] !== 55 ? (LGN[top[0]] || top[0]) + ' ' + Math.round(top[1]) : '', x.vs]; }) }); } return res; };
window.uclRoundIds = async rnd => { const j = await (await fetch('/api/data/leagues?id=42')).json(); return (j.fixtures.allMatches || []).filter(m => String(m.round) === String(rnd)).map(m => +m.id); };
