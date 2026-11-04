// Modello v0.6 su dati FotMob (2020/21 → oggi, 2.379+ partite) (scheda https://www.fotmob.com, dopo fotmob_scrape.js).
// fmBuild(): righe giocatore-partita con variabili calcolate SOLO con dati precedenti al calcio d'inizio.
// fmEval(): verifica temporale (allena sulle stagioni passate, prova sulla successiva).
// fmPredict(list): probabilità per titolari dati (id FotMob, squadra, casa/fuori, arbitro).
const DERBY = [['Inter', 'AC Milan'], ['Roma', 'Lazio'], ['Juventus', 'Torino'], ['Genoa', 'Sampdoria'], ['Juventus', 'Inter'], ['Napoli', 'Roma'], ['Fiorentina', 'Juventus'], ['Atalanta', 'Brescia'], ['Hellas Verona', 'Chievo'], ['AC Milan', 'Juventus'], ['Napoli', 'Juventus'], ['Bologna', 'Fiorentina'], ['Parma', 'Bologna']];
const ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M';
const L = x => Math.log(Math.max(.005, x));
window.__K = window.__K || 1500; // shrinkage verso il ruolo (scelto: 1500 minuti)
window.__DERBY = DERBY; window.__ROLE = ROLE;
window.fmBuild = () => {
  const M = Object.values(window.__FMM).filter(m => m.pl && m.pl.length > 20 && m.ts).sort((a, b) => a.ts - b.ts);
  const PS = {}, TS = {}, RS = {}, TB = {}, G = { D: { m: 0, y: 0, f: 0, a: 0, fd: 0 }, M: { m: 0, y: 0, f: 0, a: 0, fd: 0 }, F: { m: 0, y: 0, f: 0, a: 0, fd: 0 } };
  const ps = id => PS[id] ||= { min: 0, y: 0, f: 0, fd: 0, a: 0, apps: 0, starts: 0, off: 0, last: [], xs: [], role: null };
  const rate = (p, k, gk, K = window.__K) => { const g = G[p.role || 'M']; const gr = g.m ? g[gk] / g.m * 90 : { y: .2, f: 1.2, a: .03, fd: 1.1 }[gk]; return (p[k] + gr * K / 90) / (p.min + K) * 90; };
  const lg = { m: 0, y: 0 };
  const rows = [];
  for (const m of M) {
    const isD = DERBY.some(([x, y]) => (m.h[1] === x && m.a[1] === y) || (m.h[1] === y && m.a[1] === x)) ? 1 : 0;
    const booked = new Set(m.cards.filter(c => c[2] === 'Yellow' || c[2] === 'YellowRed').map(c => +c[0]));
    const nonfoul = new Set(m.cards.filter(c => (c[2] === 'Yellow') && c[3] && c[3] !== 'card_desc_foul').map(c => +c[0]));
    const ref = m.ref ? (RS[m.ref[0]] ||= { n: 0, y: 0 }) : null; const lgY = lg.m ? lg.y / lg.m : 4.2;
    const refF = ref ? (ref.y + lgY * 6) / (ref.n + 6) / lgY : 1;
    const tb = side => { const t = TB[(side ? m.h : m.a)[0] + '|' + m.season] ||= { g: 0, pts: 0 }; return t.g >= 3 ? t.pts / t.g : null; };
    const ppgH = tb(1), ppgA = tb(0), gap = ppgH != null && ppgA != null ? Math.abs(ppgH - ppgA) : null;
    const team = side => (TS[(side ? m.h : m.a)[0]] ||= []).slice(-10), tavg = (a, k, d) => a.length ? a.reduce((s, x) => s + x[k], 0) / a.length : d;
    const starters = m.pl.filter(r => r[4] === 1 && r[3] !== 0);
    const habit = id => { const p = PS[id]; if (!p || !p.xs.length) return null; const a = p.xs.slice(-8); return [a.reduce((s, x) => s + x[0], 0) / a.length, a.reduce((s, x) => s + x[1], 0) / a.length]; };
    for (const r of starters) {
      const p = ps(r[0]); if (!p.role) p.role = ROLE(r[3]); const side = r[2];
      const opp = starters.filter(o => o[2] !== side);
      const h = habit(r[0]); let facing = null;
      if (h) { let sw = 0, s = 0; for (const o of opp) { const ho = habit(o[0]); if (!ho) continue; const d = Math.hypot(h[0] - (1 - ho[0]), h[1] - (1 - ho[1])); const w = Math.exp(-d / .12); sw += w; s += w * rate(ps(o[0]), 'fd', 'fd'); } if (sw > 0) facing = s / sw; }
      rows.push({ mid: m.id, ts: m.ts, season: m.season, pid: r[0], name: r[1], side, role: p.role, y: booked.has(+r[0]) ? 1 : 0, nf: nonfoul.has(+r[0]) ? 1 : 0, fouls: r[6], min: r[5],
        yc: rate(p, 'y', 'y'), fl: rate(p, 'f', 'f'), ar: rate(p, 'a', 'a', window.__K * 2), home: side, tyc: tavg(team(side), 'y', 2), ofd: tavg(team(1 - side), 'fd', 11), facing,
        ref: refF, gap, derby: isD, form: p.last.slice(-5).reduce((s, x) => s + x, 0), exp: Math.log1p(p.apps), sub: (p.off + .45 * 4) / (p.starts + 4) });
    }
    // aggiornamento stati DOPO la partita
    const tY = [0, 0], tF = [0, 0], tFD = [0, 0];
    for (const r of m.pl) { if (!r[5] || r[3] === 0) continue; const p = ps(r[0]); if (!p.role) p.role = ROLE(r[3]); const y = booked.has(+r[0]) ? 1 : 0, a = nonfoul.has(+r[0]) ? 1 : 0;
      p.min += r[5]; p.y += y; p.f += r[6]; p.fd += r[7]; p.a += a; p.apps++; p.last.push(y); if (r[4]) { p.starts++; if (r[5] < 85) p.off++; } if (r[12] != null) p.xs.push([r[12], r[13]]);
      const g = G[p.role]; g.m += r[5]; g.y += y; g.f += r[6]; g.a += a; g.fd += r[7]; tY[r[2]] += y; tF[r[2]] += r[6]; tFD[r[2]] += r[7]; }
    (TS[m.h[0]] ||= []).push({ y: tY[1], fd: tFD[1] }); (TS[m.a[0]] ||= []).push({ y: tY[0], fd: tFD[0] });
    const tot = m.cards.filter(c => c[2] === 'Yellow').length; if (ref) { ref.n++; ref.y += tot; } lg.m++; lg.y += tot;
    const th = TB[m.h[0] + '|' + m.season] ||= { g: 0, pts: 0 }, ta = TB[m.a[0] + '|' + m.season] ||= { g: 0, pts: 0 };
    th.g++; ta.g++; th.pts += m.hs > m.as ? 3 : m.hs === m.as ? 1 : 0; ta.pts += m.as > m.hs ? 3 : m.hs === m.as ? 1 : 0;
  }
  window.__FMST = { PS, TS, RS, TB, G, lg }; window.__ROWS = rows; addLgr(3000); return rows.length;
};
// tasso gialli dei titolari nelle ultime W righe prima della partita (la Serie A ammonisce meno ogni anno)
window.addLgr = (W = 3000) => { const R = window.__ROWS; const q = []; let s = 0, cur = null; const byM = []; for (const d of R) { if (d.mid !== cur) { byM.push([]); cur = d.mid; } byM[byM.length - 1].push(d); }
  for (const g of byM) { const r = q.length > 500 ? s / q.length : .17; g.forEach(d => d.lgr = r); for (const d of g) { q.push(d.y); s += d.y; if (q.length > W) s -= q.shift(); } } return byM.length; };
// regressione logistica con IRLS e ridge
window.fitLogit = (D, fs, lam = 1) => {
  const X = D.map(d => [1, ...fs.map(f => f(d))]), y = D.map(d => d.y), k = X[0].length; let b = new Array(k).fill(0); b[0] = -1.5;
  for (let it = 0; it < 25; it++) { const H = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (let i = 0; i < X.length; i++) { const z = X[i].reduce((s, x, j) => s + x * b[j], 0), p = 1 / (1 + Math.exp(-z)), w = p * (1 - p);
      for (let a = 0; a < k; a++) { g[a] += (y[i] - p) * X[i][a]; for (let c = 0; c < k; c++) H[a][c] += w * X[i][a] * X[i][c]; } }
    for (let a = 1; a < k; a++) { H[a][a] += lam; g[a] -= lam * b[a]; }
    const A = H.map((r, i) => [...r, g[i]]); for (let i = 0; i < k; i++) { let mx = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]];
      for (let r = 0; r < k; r++) if (r !== i) { const f = A[r][i] / A[i][i]; for (let c = i; c <= k; c++) A[r][c] -= f * A[i][c]; } }
    const step = A.map((r, i) => r[k] / r[i]); b = b.map((x, i) => x + step[i]); if (Math.max(...step.map(Math.abs)) < 1e-6) break; }
  return { b, pred: d => 1 / (1 + Math.exp(-[1, ...fs.map(f => f(d))].reduce((s, x, j) => s + x * b[j], 0))) };
};
window.fmMetrics = (D, P) => { let ll = 0, br = 0; D.forEach((d, i) => { const p = Math.min(.999, Math.max(.001, P[i])); ll -= d.y * Math.log(p) + (1 - d.y) * Math.log(1 - p); br += (p - d.y) ** 2; });
  const pos = D.map((d, i) => [P[i], d.y]).sort((a, b) => a[0] - b[0]); let rk = 0, sp = 0, np = 0; pos.forEach(([p, y], i) => { if (y) { sp += i + 1; np++; } }); const nn = pos.length - np; const auc = (sp - np * (np + 1) / 2) / (np * nn);
  const byM = {}; D.forEach((d, i) => (byM[d.mid] ||= []).push([P[i], d.y])); let t3 = 0, nm = 0; for (const a of Object.values(byM)) { a.sort((x, y) => y[0] - x[0]); t3 += a.slice(0, 3).reduce((s, x) => s + x[1], 0); nm++; }
  const dec = [0, .1, .15, .2, .25, 1].map((lo, i, A) => { if (i === A.length - 1) return null; const s = D.map((d, j) => [P[j], d.y]).filter(([p]) => p >= lo && p < A[i + 1]); return s.length ? [lo, s.length, +(s.reduce((a, x) => a + x[0], 0) / s.length).toFixed(3), +(s.reduce((a, x) => a + x[1], 0) / s.length).toFixed(3)] : [lo, 0]; }).filter(Boolean);
  return { n: D.length, logloss: +(ll / D.length).toFixed(5), brier: +(br / D.length).toFixed(5), auc: +auc.toFixed(4), top3_per_partita: +(t3 / nm).toFixed(3), fasce: dec };
};
window.fmGroups = D => { const mean = k => { const a = D.filter(d => d[k] != null); return a.reduce((s, d) => s + d[k], 0) / a.length; }; const M = { facing: mean('facing'), gap: mean('gap') }; const v = (d, k) => d[k] ?? M[k];
  return [
    ['base', [d => L(d.yc), d => L(d.fl), d => d.role === 'M' ? 1 : 0, d => d.role === 'F' ? 1 : 0, d => d.home]],
    ['lega', [d => Math.log(d.lgr / (1 - d.lgr))]],
    ['proteste', [d => L(d.ar)]],
    ['squadre', [d => d.tyc, d => d.ofd]],
    ['duelli', [d => v(d, 'facing')]],
    ['arbitro', [d => L(d.ref)]],
    ['partita_squilibrata', [d => v(d, 'gap')]],
    ['derby', [d => d.derby]],
    ['forma', [d => d.form]],
    ['esperienza', [d => d.exp]],
  ]; };
window.fmEval = (trainSeasons, testSeason, keep) => {
  const R = window.__ROWS, tr = R.filter(d => trainSeasons.includes(d.season)), te = R.filter(d => d.season === testSeason), G = fmGroups(R); const out = {}; let fs = [];
  for (const [name, f] of G) { if (keep && !keep.includes(name)) continue; const cand = [...fs, ...f]; const m = fitLogit(tr, cand); out[name] = fmMetrics(te, te.map(m.pred)); out[name].coef = m.b.slice(-f.length).map(x => +x.toFixed(3)); fs = cand; }
  return out;
};
// selezione in avanti: un gruppo resta solo se migliora la log loss sulla stagione di verifica
window.fmSelect = (trainSeasons, valSeason) => {
  const R = window.__ROWS, tr = R.filter(d => trainSeasons.includes(d.season)), va = R.filter(d => d.season === valSeason), G = fmGroups(R);
  let fs = G[0][1], kept = ['base'], best = fmMetrics(va, va.map(fitLogit(tr, fs).pred)); const log = { base: best.logloss };
  for (const [name, f] of G.slice(1)) { const m = fitLogit(tr, [...fs, ...f]); const r = fmMetrics(va, va.map(m.pred)); log[name] = r.logloss;
    if (r.logloss < best.logloss - 0.0002) { fs = [...fs, ...f]; kept.push(name); best = r; } }
  return { kept, log, best };
};
window.fmFinal = (kept, trainSeasons, testSeason) => {
  const R = window.__ROWS, G = fmGroups(R), fs = G.filter(g => kept.includes(g[0])).flatMap(g => g[1]);
  const tr = R.filter(d => trainSeasons.includes(d.season)), te = R.filter(d => d.season === testSeason);
  const m = fitLogit(tr, fs), P = te.map(m.pred);
  // ricalibrazione della dispersione: logit(y) ~ a + b*logit(p) stimata sulla stagione di allenamento più recente (fuori campione con modello allenato sulle precedenti)
  return { model: m, fs, test: fmMetrics(te, P), te, P };
};
// previsione per una partita FotMob (formazione probabile o ufficiale) + giocatori extra [{id,name,side(1=casa),pos}]: p di giallo SE titolare
window.fmPredictMatch = async (matchId, model, extra = []) => {
  const j = await (await fetch('/api/data/matchDetails?matchId=' + matchId)).json(); const c = j.content, lu = c.lineup, H = j.header.teams, info = c.matchFacts?.infoBox || {};
  const { PS, TS, RS, G, lg } = window.__FMST; const K = window.__K;
  const rate = (p, k, gk, role, KK = K) => { const g = G[role]; const gr = g[gk] / g.m * 90; return ((p?.[k] || 0) + gr * KK / 90) / ((p?.min || 0) + KK) * 90; };
  const lgY = lg.y / lg.m; const ref = info.Referee ? RS[info.Referee.id] : null; const refF = ref ? (ref.y + lgY * 6) / (ref.n + 6) / lgY : 1;
  const tavg = (id, k, d) => { const a = (TS[id] || []).slice(-10); return a.length ? a.reduce((s, x) => s + x[k], 0) / a.length : d; };
  const last = window.__ROWS.slice(-3000), lgr = last.reduce((s, d) => s + d.y, 0) / last.length;
  const habit = id => { const p = PS[id]; if (!p || !p.xs.length) return null; const a = p.xs.slice(-8); return [a.reduce((s, x) => s + x[0], 0) / a.length, a.reduce((s, x) => s + x[1], 0) / a.length]; };
  const all = []; for (const [side, T] of [[1, lu.homeTeam], [0, lu.awayTeam]]) for (const [st, arr] of [[1, T.starters || []], [0, T.subs || []]]) for (const p of arr) if (p.usualPlayingPositionId !== 0 && p.usualPlayingPositionId != null) all.push({ id: p.id, name: p.name, side, st, pos: p.usualPlayingPositionId, team: side ? H[0].name : H[1].name });
  extra.forEach(e => all.push({ ...e, st: 0, ex: 1, team: e.side ? H[0].name : H[1].name }));
  const opp = side => all.filter(x => x.st && x.side !== side);
  const out = all.map(x => { const p = PS[x.id], role = p?.role || ROLE(x.pos); const h = habit(x.id); let facing = null;
    if (h) { let sw = 0, s = 0; for (const o of opp(x.side)) { const ho = habit(o.id); if (!ho) continue; const d = Math.hypot(h[0] - (1 - ho[0]), h[1] - (1 - ho[1])); const w = Math.exp(-d / .12); sw += w; s += w * rate(PS[o.id], 'fd', 'fd', PS[o.id]?.role || ROLE(o.pos)); } if (sw > 0) facing = s / sw; }
    const d = { role, yc: rate(p, 'y', 'y', role), fl: rate(p, 'f', 'f', role), ar: rate(p, 'a', 'a', role, 2 * K), home: x.side, tyc: tavg(x.side ? H[0].id : H[1].id, 'y', 2), ofd: tavg(x.side ? H[1].id : H[0].id, 'fd', 11), facing, ref: refF, lgr, derby: 0, form: 0, exp: 0, gap: null };
    return { ...x, role, min: Math.round(p?.min || 0), y: p?.y || 0, p: +model.pred(d).toFixed(4) }; });
  return { lineupType: lu.lineupType, ref: info.Referee?.text, out };
};
// Uso: fmBuild(); const f = fmFinal(['base','lega','squadre','duelli'], ['2021/2022','2022/2023','2023/2024','2024/2025','2025/2026'], '2026/2027'); window.__FIN = f;
//      const r = await fmPredictMatch(<id FotMob>, f.model);
// rosa completa: gli 11 FotMob + chi ha giocato nelle ultime 6 partite di campionato di ciascuna squadra (per i titolari a sorpresa)
window.fmSquadPredict = async (matchId, model) => {
  const j = await (await fetch('/api/data/matchDetails?matchId=' + matchId)).json(); const H = j.header.teams;
  const ms = Object.values(window.__FMM).filter(m => m.season === '2026/2027').sort((a, b) => b.ts - a.ts); const extra = [], seen = new Set();
  for (const [side, T] of [[1, H[0]], [0, H[1]]]) { const mine = ms.filter(m => m.h[0] === T.id || m.a[0] === T.id).slice(0, 6);
    for (const m of mine) { const s = m.h[0] === T.id ? 1 : 0; for (const r of m.pl) if (r[2] === s && r[3] !== 0 && r[5] > 0 && !seen.has(r[0])) { seen.add(r[0]); extra.push({ id: r[0], name: r[1], side, pos: r[3] }); } } }
  const res = await window.fmPredictMatch(matchId, model, []); const inXI = new Set(res.out.map(x => x.id));
  return window.fmPredictMatch(matchId, model, extra.filter(e => !inXI.has(e.id)));
};
// fotografie live (falli per giocatore, cartellini, punteggio) ogni 3 minuti in localStorage 'live_<id>' per costruire il modulo live
window.fmLiveSnap = async (id) => { const j = await (await fetch('/api/data/matchDetails?matchId=' + id)).json(); const c = j.content, s = j.header.status || {}; if (!s.started || s.finished) return s.finished ? 'fine' : 'non iniziata';
  const st = (p, k) => { for (const g of p.stats || []) { const v = g.stats?.[k]; if (v) return v.stat?.value; } return 0; };
  const pl = Object.values(c.playerStats || {}).map(p => [p.id, p.name, st(p, 'Fouls committed') || 0, st(p, 'Was fouled') || 0]).filter(x => x[2] || x[3]);
  const ev = (c.matchFacts?.events?.events || []).filter(e => e.type === 'Card').map(e => [e.time, e.player?.id, e.card]);
  const snap = { id, t: Date.now(), min: s.liveTime?.short, score: j.header.teams.map(t => t.score), pl, ev };
  const k = 'live_' + id; const a = JSON.parse(localStorage.getItem(k) || '[]'); a.push(snap); localStorage.setItem(k, JSON.stringify(a)); return snap.min; };
// aggiunge gli id a quelli già seguiti (non ferma le partite precedenti)
window.fmLiveStart = ids => { window.__LIVEIDS = [...new Set([...(window.__LIVEIDS || []), ...ids])]; clearInterval(window.__LIVEI);
  window.__LIVEI = setInterval(() => window.__LIVEIDS.forEach(id => window.fmLiveSnap(id).catch(() => {})), 180000); return window.__LIVEIDS; };

// situazione live per il riquadro dell'app (ammoniti, cambi, falli fatti/subiti) → tmp/live.json → live_update.py
window.fmLiveExport = async ids => { const out = {};
  for (const id of ids) {
    const d = await fetch('/api/data/matchDetails?matchId=' + id).then(r => r.json());
    const g = d.general, h = d.header, E = d.content?.matchFacts?.events?.events || [];
    const ev = E.filter(e => e.type === 'Card').map(e => [e.time, e.card, e.player?.name || e.nameStr, e.isHome ? 'h' : 'a']);
    const subs = E.filter(e => e.type === 'Substitution').map(e => [e.time, (e.swap || [])[1]?.name || '', e.isHome ? 'h' : 'a']);
    const fl = Object.values(d.content?.playerStats || {}).map(p => { const st = {};
      (p.stats || []).forEach(s => Object.entries(s.stats || {}).forEach(([k, v]) => st[k] = v?.stat?.value));
      return [p.name, p.teamId === g.homeTeam.id ? 'h' : 'a', st['Fouls committed'] || 0, st['Was fouled'] || 0]; }).filter(r => r[2] || r[3]);
    out[id] = { t: (h.status?.liveTime?.short || '').replace(/[‎’]/g, "'"), sc: h.status?.scoreStr, fin: !!h.status?.finished, ev, subs, fl };
  } return out; };

// esito completo di una partita finita per area e storico (ammoniti, cambi entrato/uscito, falli fatti/subiti di chi ha giocato)
window.fmResult = async id => {
  const d = await fetch('/api/data/matchDetails?matchId=' + id).then(r => r.json());
  const g = d.general, E = d.content?.matchFacts?.events?.events || [], side = t => t === g.homeTeam.id ? 'h' : 'a';
  const cards = E.filter(e => e.type === 'Card').map(e => [e.time, e.card, e.player?.name || e.nameStr, e.isHome ? 'h' : 'a']);
  const subs = E.filter(e => e.type === 'Substitution').map(e => [e.time, (e.swap || [])[1]?.name || '', (e.swap || [])[0]?.name || '', e.isHome ? 'h' : 'a']);
  const played = [];
  Object.values(d.content?.playerStats || {}).forEach(p => { const st = {};
    (p.stats || []).forEach(s => Object.entries(s.stats || {}).forEach(([k, v]) => st[k] = v?.stat?.value));
    if (st['Minutes played']) played.push([p.name, side(p.teamId), st['Fouls committed'] || 0, st['Was fouled'] || 0, st['Minutes played'], p.isGoalkeeper ? 1 : 0]); });
  return { id, sc: d.header?.status?.scoreStr, fin: !!d.header?.status?.finished, cards, subs, played };
};
