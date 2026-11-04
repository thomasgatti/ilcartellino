// ext_model.js — variabili aggiuntive (contesto partita, forma, diffide, arbitro, precedenti, rotazioni, classifica)
// Da caricare nella pagina FotMob dopo fm_model.js, cup_model.js, cup_model2.js.
// extBuild() scorre TUTTE le partite (Serie A + campionati esteri + coppe) in ordine cronologico
// e per ogni titolare calcola, PRIMA della partita, le variabili in window.__EX[mid|pid].
(() => {
  const CUPL = new Set([42, 73, 10216]);
  const BAN = lg => lg === 55 ? [5, 10, 14, 17, 19] : CUPL.has(lg) ? [3, 5, 7, 9] : [5, 10, 15];
  const isY = c => c[2] === 'Yellow' || c[2] === 'YellowRed';
  const isR = c => c[2] === 'Red' || c[2] === 'YellowRed';
  const rkey = m => m.ref && m.ref[1] ? String(m.ref[1]).toLowerCase().normalize('NFD').replace(/[^a-z ]/g, '').trim() : null;
  const LGROUNDS = lg => lg === 55 || lg === 87 || lg === 47 || lg === 53 || lg === 61 ? 38 : lg === 54 ? 34 : CUPL.has(lg) ? 8 : 34;

  window.extState = () => ({ P: {}, T: {}, REF: {}, LG: {}, TAB: {}, H2H: {}, ELO: {}, TSCH: {} });

  // calcolo variabili per una partita (senza aggiornare lo stato)
  window.extFx = (m, S, opt = {}) => {
    const out = {}; const lg = m.lg; const L = S.LG[lg] || { n: 0, y: 0, f: 0 };
    const lgY = L.n > 20 ? L.y / L.n : 4.2, lgF = L.n > 20 ? L.f / L.n / 2 : 12;
    const days = (a, b) => (a - b) / 86400;
    const nextGap = (tid) => { if (opt.next && opt.next[tid] != null) return opt.next[tid]; const a = S.TSCH[tid]; if (!a) return null; let lo = 0, hi = a.length; while (lo < hi) { const md = (lo + hi) >> 1; if (a[md] <= m.ts + 3600) lo = md + 1; else hi = md; } return lo < a.length ? (a[lo] - m.ts) / 86400 : null; };
    const rk = rkey(m), R = rk ? S.REF[rk] : null;
    const ref = R ? (R.y + 8 * lgY) / (R.e + 8 * lgY) : 1, refN = R ? R.n : 0;
    const pair = [m.h[0], m.a[0]].sort().join('-'), HH = (S.H2H[pair] || []).slice(-3);
    const h2h = (HH.reduce((s, x) => s + x.y / x.ly, 0) + 2) / (HH.length + 2);
    const h2hRed = HH.length && HH[HH.length - 1].red ? 1 : 0;
    const prevLeg = (S.H2H[pair] || []).filter(x => x.lg === lg && days(m.ts, x.ts) < 45 && days(m.ts, x.ts) > 2).slice(-1)[0];
    const sideInfo = s => {
      const tid = (s ? m.h : m.a)[0], t = S.T[tid] || { xi: [], res: [], ts: [], y: [], f: [], lu: [] }, e = S.ELO[tid] ?? null;
      const XI = new Set(m.pl.filter(r => r[2] === s && r[4] === 1).map(r => +r[0]));
      const rot = t.xi.length ? t.xi.filter(id => !XI.has(id)).length : null;
      const mins = {}; for (const lu of t.lu.slice(-5)) for (const [id, mn] of lu) mins[id] = (mins[id] || 0) + mn;
      const reg = Object.entries(mins).sort((a, b) => b[1] - a[1]).slice(0, 11).map(x => +x[0]);
      const miss = reg.length >= 11 ? reg.filter(id => !XI.has(id)).length : null;
      const tab = S.TAB[lg + '|' + m.season] || {}, me = tab[tid];
      let rank = null, late = null; if (me && me.g >= 3) { const arr = Object.values(tab).filter(x => x.g >= 1).map(x => x.pts / x.g).sort((a, b) => b - a); rank = arr.indexOf(me.pts / me.g) / Math.max(1, arr.length - 1); late = Math.min(1, me.g / LGROUNDS(lg)); }
      const cong = t.ts.filter(x => days(m.ts, x) < 15).length;
      const trest = t.ts.length ? Math.min(14, days(m.ts, t.ts[t.ts.length - 1])) : null;
      const r3 = t.res.slice(-3), form = r3.length === 3 ? r3.reduce((a, b) => a + b, 0) : null, lost = t.res.length ? (t.res[t.res.length - 1] === 0 ? 1 : 0) : null;
      const f8 = t.f.slice(-8), y8 = t.y.slice(-8);
      const tf = f8.length >= 3 ? f8.reduce((a, b) => a + b, 0) / f8.length / lgF : null;
      const ty = y8.length >= 3 ? y8.reduce((a, b) => a + b, 0) / y8.length / (lgY / 2) : null;
      return { tid, e, rot, miss, rank, late, cong, trest, form, lost, tf, ty, next: nextGap(tid) };
    };
    const SI = [sideInfo(0), sideInfo(1)];
    let leg2 = 0, aggClose = 0, aggDiff = null;
    if (prevLeg && CUPL.has(lg)) { leg2 = 1; const hFirst = prevLeg.h === m.a[0]; const gH = (hFirst ? prevLeg.as : prevLeg.hs), gA = (hFirst ? prevLeg.hs : prevLeg.as); aggDiff = gH - gA; aggClose = Math.abs(aggDiff) <= 1 ? 1 : 0; }
    for (const r of m.pl) {
      if (r[4] !== 1 || r[3] === 0) continue;
      const s = r[2], me = SI[s], op = SI[1 - s], pid = +r[0], p = S.P[pid];
      const ap = p ? p.apps : [];
      const last = ap.length ? ap[ap.length - 1] : null;
      const rest = last ? Math.min(21, days(m.ts, last[0])) : null;
      const m14 = ap.filter(a => days(m.ts, a[0]) < 14).reduce((x, a) => x + a[1], 0);
      const m30 = ap.filter(a => days(m.ts, a[0]) < 30).reduce((x, a) => x + a[1], 0);
      const cy = p ? (p.cy[lg + '|' + m.season] || 0) : 0;
      const diff = BAN(lg).includes(cy + 1) ? 1 : 0;
      const l5 = ap.slice(-5), rform = l5.reduce((x, a) => x + a[2], 0);
      const l5m = l5.reduce((x, a) => x + a[1], 0), l5f = l5.reduce((x, a) => x + a[3], 0);
      const cf = p && p.min > 0 ? (p.f + 1.2 * 10) / (p.min + 900) * 90 : 1.2;
      const hot = l5m >= 150 ? ((l5f + cf * 2) / (l5m / 90 + 2)) / cf : 1;
      const red60 = p && p.red && days(m.ts, p.red) < 60 ? 1 : 0;
      const yr = p && p.n ? (p.y + .15 * 5) / (p.n + 5) : .15;
      const vv = p ? p.vs[op.tid] : null;
      const vs = vv ? ((vv.y + yr * 3) / (vv.n + 3)) / yr : 1, vsN = vv ? vv.n : 0, vsAny = vv && vv.y > 0 ? 1 : 0;
      const xs = p ? p.xs.slice(-8) : [];
      const hx = xs.length ? xs.reduce((a, x) => a + x[0], 0) / xs.length : null, hy = xs.length ? xs.reduce((a, x) => a + x[1], 0) / xs.length : null;
      const age = r[14] ?? (p ? p.age : null);
      out[pid] = {
        rest, m14, m30, cy, diff, rform, hot, red60, vs, vsN, vsAny, hx, hy, age,
        rot: me.rot, miss: me.miss, omiss: op.miss, rank: me.rank, orank: op.rank, late: me.late,
        cong: me.cong, trest: me.trest, ocong: op.cong, next: me.next, onext: op.next,
        form: me.form, oform: op.form, lost: me.lost, tf: me.tf, otf: op.tf, ty: me.ty, oty: op.ty,
        lvl: me.e != null && op.e != null ? ((me.e + op.e) / 2 - 1550) / 100 : null, elo: me.e != null ? (me.e - 1550) / 100 : null,
        ref, refN, h2h, h2hN: HH.length, h2hRed, leg2, aggClose, aggDiff: aggDiff == null ? null : (s ? aggDiff : -aggDiff), lg,
        plat: r[12] != null ? Math.abs(r[12] - .5) : null, pdep: r[13] ?? null,
      };
    }
    return out;
  };

  window.extUpd = (m, S) => {
    const lg = m.lg, L = S.LG[lg] ||= { n: 0, y: 0, f: 0 };
    const lgY = L.n > 20 ? L.y / L.n : 4.2;
    const booked = new Set(m.cards.filter(isY).map(c => +c[0])), reds = new Set(m.cards.filter(isR).map(c => +c[0]));
    const totY = m.cards.filter(c => c[2] === 'Yellow').length;
    const tY = [0, 0], tF = [0, 0], lu = [[], []];
    for (const r of m.pl) {
      if (!r[5]) continue; const pid = +r[0], s = r[2];
      const p = S.P[pid] ||= { apps: [], cy: {}, vs: {}, red: null, xs: [], f: 0, min: 0, y: 0, n: 0, age: null };
      const y = booked.has(pid) ? 1 : 0; const oid = (s ? m.a : m.h)[0];
      p.apps.push([m.ts, r[5], y, r[6] || 0]); if (p.apps.length > 12) p.apps.shift();
      p.cy[lg + '|' + m.season] = (p.cy[lg + '|' + m.season] || 0) + y;
      const v = p.vs[oid] ||= { n: 0, y: 0 }; v.n++; v.y += y;
      if (reds.has(pid)) p.red = m.ts;
      if (r[12] != null) { p.xs.push([r[12], r[13]]); if (p.xs.length > 10) p.xs.shift(); }
      if (r[3] !== 0) { p.f += r[6] || 0; p.min += r[5]; p.y += y; p.n++; }
      if (r[14] != null) p.age = r[14];
      tY[s] += y; tF[s] += r[6] || 0; lu[s].push([pid, r[5]]);
    }
    for (const s of [0, 1]) {
      const tid = (s ? m.h : m.a)[0], t = S.T[tid] ||= { xi: [], res: [], ts: [], y: [], f: [], lu: [] };
      t.xi = m.pl.filter(r => r[2] === s && r[4] === 1).map(r => +r[0]);
      const gf = s ? m.hs : m.as, ga = s ? m.as : m.hs; t.res.push(gf > ga ? 3 : gf === ga ? 1 : 0);
      t.ts.push(m.ts); t.y.push(tY[s]); t.f.push(tF[s]); t.lu.push(lu[s]);
      for (const k of ['res', 'ts', 'y', 'f', 'lu']) if (t[k].length > 12) t[k].shift();
      const tb = (S.TAB[lg + '|' + m.season] ||= {})[tid] ||= { g: 0, pts: 0 }; tb.g++; tb.pts += gf > ga ? 3 : gf === ga ? 1 : 0;
    }
    const rk = rkey(m); if (rk) { const R = S.REF[rk] ||= { n: 0, y: 0, e: 0 }; R.n++; R.y += totY; R.e += lgY; }
    const pair = [m.h[0], m.a[0]].sort().join('-');
    (S.H2H[pair] ||= []).push({ ts: m.ts, lg, y: totY, ly: lgY, red: m.cards.some(isR) ? 1 : 0, h: m.h[0], hs: m.hs, as: m.as });
    L.n++; L.y += totY; L.f += tF[0] + tF[1];
    const E0 = typeof ELO0 !== 'undefined' ? ELO0 : (window.ELO0 || {}); const e0 = E0[lg] || 1450;
    const eh = S.ELO[m.h[0]] ??= e0, ea = S.ELO[m.a[0]] ??= e0;
    const exp = 1 / (1 + 10 ** ((ea - eh - 60) / 400)), res = m.hs > m.as ? 1 : m.hs === m.as ? .5 : 0, kk = CUPL.has(lg) ? 30 : 20;
    S.ELO[m.h[0]] = eh + kk * (res - exp); S.ELO[m.a[0]] = ea - kk * (res - exp);
  };

  window.extBuild = () => {
    const A = cupAll(), S = extState();
    for (const m of A) { (S.TSCH[m.h[0]] ||= []).push(m.ts); (S.TSCH[m.a[0]] ||= []).push(m.ts); }
    const EX = {};
    for (const m of A) { const F = extFx(m, S); for (const pid in F) EX[m.id + '|' + pid] = F[pid]; extUpd(m, S); }
    window.__EX = EX; window.__EXS = S; return Object.keys(EX).length;
  };

  // candidati: gruppi di variabili (null → valore neutro)
  const nz = (v, d) => v == null || Number.isNaN(v) ? d : v;
  window.extDif = d => (d.ex?.elo != null && d.ex?.lvl != null) ? 2 * (d.ex.elo - d.ex.lvl) + (d.home ? .6 : -.6) : 0;
  window.EXT_CANDS = {
    diffida: [d => nz(d.ex?.diff, 0)],
    gialli_stagione: [d => Math.log1p(nz(d.ex?.cy, 0))],
    fatica: [d => nz(d.ex?.m14, 0) / 180, d => Math.min(nz(d.ex?.rest, 7), 14) / 7],
    congestione: [d => nz(d.ex?.cong, 2) / 3, d => Math.min(nz(d.ex?.next, 7), 10) / 7],
    forma_cartellini: [d => nz(d.ex?.rform, 0)],
    falli_recenti: [d => Math.log(nz(d.ex?.hot, 1))],
    rosso_recente: [d => nz(d.ex?.red60, 0)],
    conti_personali: [d => Math.log(nz(d.ex?.vs, 1)), d => nz(d.ex?.vsAny, 0)],
    eta: [d => d.ex?.age != null && d.ex.age <= 21 ? 1 : 0, d => d.ex?.age != null && d.ex.age >= 32 ? 1 : 0],
    posizione: [d => Math.abs(nz(d.ex?.hx, .5) - .5), d => nz(d.ex?.hy, .5)],
    turnover: [d => nz(d.ex?.rot, 3) / 11],
    assenze: [d => nz(d.ex?.miss, 2) / 11, d => nz(d.ex?.omiss, 2) / 11],
    classifica: [d => nz(d.ex?.late, .5) * (nz(d.ex?.rank, .5) > .7 ? 1 : 0), d => nz(d.ex?.late, .5) * (nz(d.ex?.rank, .5) < .25 ? 1 : 0)],
    forma_squadra: [d => nz(d.ex?.form, 4) / 9, d => nz(d.ex?.lost, 0)],
    mentale_avversario: [d => nz(d.ex?.oform, 4) / 9],
    intensita: [d => Math.log(nz(d.ex?.tf, 1)), d => Math.log(nz(d.ex?.otf, 1))],
    cattiveria_squadre: [d => Math.log(nz(d.ex?.ty, 1)), d => Math.log(nz(d.ex?.oty, 1))],
    livello: [d => nz(d.ex?.lvl, 0)],
    arbitro: [d => Math.log(nz(d.ex?.ref, 1))],
    precedenti: [d => Math.log(nz(d.ex?.h2h, 1)), d => nz(d.ex?.h2hRed, 0)],
    ritorno_eliminazione: [d => nz(d.ex?.aggClose, 0), d => nz(d.ex?.leg2, 0)],
    posizione_partita: [d => nz(d.ex?.plat, .25), d => nz(d.ex?.pdep, .5)],
    // forza relativa per ruolo (Elo propria − avversaria in centinaia, ±0,6 per casa/trasferta): i difensori e i centrocampisti
    // della squadra nettamente favorita prendono molti meno gialli (oss/att 0,77 e 0,75), gli attaccanti no (1,01)
    forza_ruolo: [d => d.role === 'D' ? Math.max(0, extDif(d)) : 0, d => d.role === 'M' ? Math.max(0, extDif(d)) : 0,
                  d => d.role === 'D' ? Math.min(0, extDif(d)) : 0, d => d.role === 'M' ? Math.min(0, extDif(d)) : 0, d => d.role === 'F' ? extDif(d) : 0],
  };

  // valutazione temporale: per ogni stagione di test si allena sulle precedenti
  window.extCV = (rows, fs, tests) => {
    let ll = 0, n = 0, t3 = 0, nm = 0; const out = {};
    for (const s of tests) {
      const tr = rows.filter(d => d.season < s), te = rows.filter(d => d.season === s);
      if (!tr.length || !te.length) continue;
      const mdl = fitLogit(tr, fs, 2), P = te.map(mdl.pred), M = fmMetrics(te, P);
      ll += M.ll * te.length; n += te.length;
      const byM = {}; te.forEach((d, i) => (byM[d.mid] ||= []).push([P[i], d.y]));
      for (const a of Object.values(byM)) { a.sort((x, y) => y[0] - x[0]); t3 += a.slice(0, 3).reduce((x, q) => x + q[1], 0); nm++; }
    }
    return { ll: ll / n, t3: t3 / nm, n };
  };

  // selezione in avanti in background; stato in window.__XSEL
  window.extSelect = async (rows, base, tests, cands = Object.keys(EXT_CANDS), thr = 0.0002) => {
    const st = window.__XSEL = { status: 'avvio', log: [], kept: [] };
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    let fs = [...base], cur = extCV(rows, fs, tests); st.base = cur; let left = [...cands];
    while (left.length) {
      let best = null;
      for (const c of left) { await sleep(5); const r = extCV(rows, [...fs, ...EXT_CANDS[c]], tests); st.log.push([c, +r.ll.toFixed(5), +r.t3.toFixed(3)]); if (!best || r.ll < best.r.ll) best = { c, r }; st.status = 'prova ' + c; }
      if (cur.ll - best.r.ll > thr) { fs = [...fs, ...EXT_CANDS[best.c]]; cur = best.r; st.kept.push([best.c, +cur.ll.toFixed(5), +cur.t3.toFixed(3)]); left = left.filter(x => x !== best.c); st.log.push(['TENUTO', best.c]); }
      else break;
    }
    st.final = cur; st.status = 'fatto'; st.fsNames = st.kept.map(k => k[0]); return st;
  };
})();

// ---- Uso in produzione (3 nov 2026) ----
// Dopo extBuild():
//   for (const r of __ROWS) r.ex = __EX[r.mid+'|'+r.pid]; for (const r of __CROWS2) r.ex = __EX[r.mid+'|'+r.pid];
//   __FS_SA3 = [...feature Serie A (base, lega, squadre, duelli), ...EXT_CANDS.arbitro, ...EXT_CANDS.precedenti]
//   __CFS3   = [...__CFS2, ...EXT_CANDS.arbitro, ...EXT_CANDS.precedenti, ...EXT_CANDS.diffida]
//   __SAM3   = fitLogit(Serie A 2021/22→oggi, __FS_SA3, 2)
//   __CUPM3  = fitLogit(righe UCL, __CFS3, 2) + spostamento intercetta (−0,073) per la media gialli UCL 2025/26–2026/27
// Previsioni: cupExport3(await uclRoundIds(n)) per la Champions, fmPredict3(id, __SAM3) per la Serie A.
window.ROLE = window.ROLE || (p => p === 1 ? 'D' : p === 3 ? 'F' : 'M');
window.LGN = {38:'Bundesliga (AUT)',40:'Pro League (BEL)',46:'Superliga (DEN)',47:'Premier League',48:'Championship',53:'Ligue 1',54:'Bundesliga',57:'Eredivisie',59:'Eliteserien',61:'Liga Portugal',64:'Premiership (SCO)',69:'Super League (SUI)',71:'Süper Lig',87:'LaLiga',122:'1. Liga (CZE)',135:'Super League (GRE)',176:'1. Liga (SVK)',262:'Premyer Liqa (AZE)',441:'Premier Liga (UKR)'};
window.extForMatch = (j, lg, season, all) => {
  const H = j.header.teams, info = j.content?.matchFacts?.infoBox || {};
  const ts = Date.parse(j.general?.matchTimeUTCDate) / 1000;
  const mk = (list) => ({ id: +j.general.matchId, ts, lg, season, h: [H[0].id, H[0].name], a: [H[1].id, H[1].name], ref: info.Referee ? [null, info.Referee.text] : null,
    pl: list.map(x => [x.id, x.name, x.side, x.pos ?? 2, 1, 90, 0, 0, 0, 0, 0, 0, x.vx ?? null, x.vy ?? null, x.age ?? null]) });
  const st = all.filter(x => x.st), F = extFx(mk(st), __EXS);
  for (const x of all.filter(x => !x.st)) { const G = extFx(mk([...st, x]), __EXS); F[x.id] = G[x.id]; }
  return F;
};
window.extMakeModels = () => {
  for (const r of __ROWS) r.ex = __EX[r.mid + '|' + r.pid]; for (const r of __CROWS2) r.ex = __EX[r.mid + '|' + r.pid];
  const C = EXT_CANDS;
  window.__FS_SA = fmGroups(__ROWS).filter(g => ['base', 'lega', 'squadre', 'duelli'].includes(g[0])).flatMap(g => g[1]);
  window.__FS_SA3 = [...__FS_SA, ...C.arbitro, ...C.precedenti];
  window.__CFS3 = [...__CFS2, ...C.arbitro, ...C.precedenti, ...C.diffida];
  window.__SAM3 = fitLogit(__ROWS.filter(d => d.season >= '2021/2022'), __FS_SA3, 2);
  const U = __CROWS2.filter(d => d.lg === 42), mC = fitLogit(U, __CFS3, 2), cal = U.filter(d => d.season >= '2025/2026');
  let lo = -1, hi = 1; const obs = cal.reduce((a, d) => a + d.y, 0);
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; const s = cal.reduce((a, d) => { const p = mC.pred(d); return a + 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + mid))); }, 0); if (s > obs) hi = mid; else lo = mid; }
  const shift = (lo + hi) / 2, pr = mC.pred; mC.pred = d => { const p = pr(d); return 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + shift))); }; mC.shift = shift;
  window.__CUPM3 = mC; return { shift, bS: __SAM3.b, bC: mC.b };
};
// cupPredict3 / fmPredict3: stesse funzioni di cupPredict2 / fmPredictMatch con d.ex = extForMatch(...)
window.extPatchPredict = () => {
  let s = cupPredict2.toString();
  s = s.replace("all.push({ id: p.id, name: p.name, side, pos: p.usualPlayingPositionId, st: 1 })", "all.push({ id: p.id, name: p.name, side, pos: p.usualPlayingPositionId, st: 1, vx: p.verticalLayout?.x, vy: p.verticalLayout?.y })");
  s = s.replace("const st = all.filter(x => x.st);", "const st = all.filter(x => x.st); const EXM = extForMatch(j, 42, '2026/2027', all);")
       .replace("const d = { role, home: x.side,", "const d = { ex: EXM[x.id] || EXM[+x.id], role, home: x.side,")
       .replace("vsfd: fac[0] ? +fac[0][2].toFixed(2) : null,", "vsfd: fac[0] ? +fac[0][2].toFixed(2) : null, ref: d.ex?.ref, diff: d.ex?.diff, cy: d.ex?.cy, h2h: d.ex?.h2h,");
  window.cupPredict3 = eval('(' + s + ')');
  let f = fmPredictMatch.toString();
  f = f.replace("all.push({ id: p.id, name: p.name, side, st, pos: p.usualPlayingPositionId,", "all.push({ id: p.id, name: p.name, side, st, pos: p.usualPlayingPositionId, vx: p.verticalLayout?.x, vy: p.verticalLayout?.y,");
  f = f.replace("const opp = side => all.filter(x => x.st && x.side !== side);", "const opp = side => all.filter(x => x.st && x.side !== side); const EXM = extForMatch(j, 55, '2026/2027', all);")
       .replace("const d = { role, yc:", "const d = { ex: EXM[x.id] || EXM[+x.id], role, yc:")
       .replace("p: +model.pred(d).toFixed(4) }", "p: +model.pred(d).toFixed(4), refx: d.ex?.ref, h2h: d.ex?.h2h, diff: d.ex?.diff }");
  window.fmPredict3 = eval('(' + f + ')');
};
window.cupExport3 = async ids => { const OD = await fmOdds(ids); const res = []; for (const id of ids) { const od = OD[id]; let r; try { r = await cupPredict3(id, window.__CUPM3, [], od?.p || null); } catch (e) { res.push({ id, err: String(e) }); continue; }
  const st = r.out.filter(x => x.st); const any = st[0] || {};
  res.push({ id, lt: r.lineupType, ko: r.ko, ref: r.ref, refx: any.ref != null ? +any.ref.toFixed(2) : null, h2h: any.h2h != null ? +any.h2h.toFixed(2) : null, teams: r.teams, colors: r.colors, odds: od ? od.p.join('/') : null, booked: od?.booked || [], pl: st.map(x => { const top = Object.entries(x.lgs).filter(([l]) => ![42, 73, 10216].includes(+l)).sort((a, b) => b[1] - a[1])[0]; return [x.name, x.side, x.role, +x.p.toFixed(3), x.min, top && +top[0] !== 55 ? (LGN[top[0]] || top[0]) + ' ' + Math.round(top[1]) : '', x.vs, x.diff || 0, x.cy || 0]; }) }); } return res; };
// Delta compatto da riportare nel container (evita di copiare tutto il JSON):
window.extDelta = ex => ex.map(m => [m.id, m.refx, m.h2h, m.pl.map(r => r[0].slice(0, 3)).join(''), m.pl.map(r => Math.round(r[3] * 1000) + (r[7] ? 'd' : '')).join(',')].join('|')).join('\n');
