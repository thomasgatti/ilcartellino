// v0.3 — costruzione variabili pre-partita (cronologica) su dati Sofascore __H (5 stagioni) + calendari __TE
// Ogni riga = un titolare di movimento in una partita; tutte le variabili usano SOLO partite precedenti.
function buildV03(H, TE) {
  const FOUL = new Set(['Foul', 'Persistent fouling', 'Off the ball foul', 'Dangerous play', 'Handball']);
  const SUSP = n => n === 5 || n === 10 || n === 14 || n === 17 || n > 17;
  const DERBY = [['Milan', 'Inter'], ['Roma', 'Lazio'], ['Juventus', 'Torino'], ['Genoa', 'Sampdoria'], ['Juventus', 'Inter'], ['Napoli', 'Roma'], ['Fiorentina', 'Juventus']];
  const norm = s => s.replace(/^(AC|SSC|AS|ACF|US|FC|Hellas) /, '');
  const matches = [...H.matches].sort((a, b) => a[3] - b[3]);
  const byM = {}; for (const r of H.rows) (byM[r[0]] = byM[r[0]] || []).push(r);
  const cardR = {}; for (const [eid, cs] of Object.entries(H.cards)) for (const c of cs) if (c[1] === 'yellow' || c[1] === 'yellowRed') cardR[eid + '|' + c[0]] = c[2];
  // prior per ruolo
  const G = {};
  for (const r of H.rows) { if (r[4] === 'G') continue; const g = G[r[4]] = G[r[4]] || { min: 0, y: 0, f: 0, fd: 0, a: 0, ct: 0, sp: 0, ts: 0, n: 0 };
    g.min += r[6]; g.y += r[13]; g.f += r[7]; g.fd += r[8]; g.ct += r[9]; if (r[11] > 0) { g.ts += r[11]; g.n++; } g.sp += r[12];
    if (r[13] && !FOUL.has(cardR[r[0] + '|' + r[2]] || 'Foul')) g.a++; }
  for (const g of Object.values(G)) { g.ry = g.y / g.min; g.rf = g.f / g.min; g.rfd = g.fd / g.min; g.ra = g.a / g.min; g.rct = g.ct / g.min; g.rsp = g.sp / g.min; g.mts = g.ts / g.n; }
  const imp = o => { const s = o.reduce((a, x) => a + 1 / x, 0); return o.map(x => 1 / x / s); };
  const lamFrom = (L, ov, un) => { const po = (1 / ov) / (1 / ov + 1 / un); const k = Math.floor(L);
    const sf = l => { let c = 0, t = Math.exp(-l); for (let i = 0; i <= k; i++) { c += t; t *= l / (i + 1); } return 1 - c; };
    let lo = 0.5, hi = 12; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; sf(m) < po ? lo = m : hi = m; } return (lo + hi) / 2; };
  const PS = {}, TS = {}, RS = {}, H2H = {}, TAB = {}; const lgRef = { g: 0, y: 0 };
  const ps = pid => PS[pid] = PS[pid] || { min: 0, y: 0, f: 0, fd: 0, a: 0, ct: 0, sp: 0, ts: 0, tsn: 0, pos: [], teams: new Set(), syc: {}, pending: false, returning: false };
  const prevMatch = (tid, ts) => { const a = TE?.teams?.[tid]; if (!a) return null; let best = null; for (const x of a) { if (x[0] < ts - 3600) best = x; else break; } return best; };
  const data = []; let mi = 0;
  for (const m of matches) {
    const [eid, sid, round, ts, hT, aT, hs, as, ref, hid, aid] = m; const rows = byM[eid] || []; const od = H.odds[eid]; const ap = H.ap[eid];
    let lam = null, pH = null, pA = null;
    if (od?.ft?.every(x => x)) [pH, , pA] = imp(od.ft);
    if (od?.cards?.length) { const c = [...od.cards].filter(c => c[1] && c[2]).sort((a, b) => Math.abs(a[1] - a[2]) - Math.abs(b[1] - b[2]))[0]; if (c) lam = lamFrom(c[0], c[1], c[2]); }
    const lgR = lgRef.g ? lgRef.y / lgRef.g : 3.8; const rs = RS[ref]; const refF = ref && rs ? (rs.y + lgR * 8) / (rs.g + 8) : lgR;
    const pair = [hT, aT].sort().join('|'); const hh = H2H[pair] || { n: 0, y: 0 }; const h2h = (hh.y + lgR * 3) / (hh.n + 3);
    const derby = DERBY.some(([x, y]) => (norm(hT) === x && norm(aT) === y) || (norm(hT) === y && norm(aT) === x)) ? 1 : 0;
    // classifica prima della partita
    const tab = TAB[sid] = TAB[sid] || {}; const tb = t => tab[t] || { pts: 0, g: 0 };
    const ranked = Object.entries(tab).sort((a, b) => b[1].pts - a[1].pts); const rank = t => { const i = ranked.findIndex(x => x[0] === t); return i < 0 ? 10 : i + 1; };
    const pts18 = ranked[17]?.[1].pts ?? 0, pts4 = ranked[3]?.[1].pts ?? 0;
    const habit = pid => { const a = PS[pid]?.pos.slice(-8) || []; return a.length ? [a.reduce((s, x) => s + x[0], 0) / a.length, a.reduce((s, x) => s + x[1], 0) / a.length] : null; };
    const rate = (p, k, rk, pos, prior = 900) => { const g = G[pos] || G.M; return (p[k] + g[rk] * prior) / (p.min + prior) * 90; };
    const tm = t => { const a = (TS[t] || []).slice(-10); return a.length ? { y: a.reduce((s, x) => s + x.y, 0) / a.length, fd: a.reduce((s, x) => s + x.fd, 0) / a.length } : { y: 1.9, fd: 11 }; };
    const st = { 1: rows.filter(r => r[5] && r[4] !== 'G' && r[1] === 1), 0: rows.filter(r => r[5] && r[4] !== 'G' && r[1] === 0) };
    for (const home of [1, 0]) {
      const team = home ? hT : aT, opp = home ? aT : hT, tid = home ? hid : aid, oid = home ? aid : hid;
      const oppPos = st[1 - home].map(r => { const h = habit(r[2]); const p = PS[r[2]] || { min: 0, fd: 0, ct: 0, sp: 0, ts: 0, tsn: 0 }; const g = G[r[4]] || G.M;
        return h ? { x: 100 - h[0], y: 100 - h[1], fd: (p.fd + g.rfd * 450) / (p.min + 450) * 90, ct: (p.ct + g.rct * 450) / (p.min + 450) * 90,
          sp: (p.sp + g.rsp * 450) / (p.min + 450) * 90, ts: (p.ts + g.mts * 3) / (p.tsn + 3) } : null; }).filter(Boolean);
      const pm = prevMatch(tid, ts), pmo = prevMatch(oid, ts);
      const rest = pm ? Math.min(14, (ts - pm[0]) / 86400) : 7, restO = pmo ? Math.min(14, (ts - pmo[0]) / 86400) : 7;
      const cup = pm && pm[1] !== 23 && rest <= 4.5 ? 1 : 0;
      const T1 = tm(team), T2 = tm(opp); const t1 = tb(team), t2 = tb(opp);
      const ppg = t1.g ? t1.pts / t1.g : 1.4, ppgO = t2.g ? t2.pts / t2.g : 1.4;
      const salv = round >= 15 && t1.pts - pts18 <= 4 ? 1 : 0, europa = round >= 15 && Math.abs(t1.pts - pts4) <= 4 ? 1 : 0;
      for (const r of st[home]) {
        const p = PS[r[2]] || ps(r[2]); const pos = r[4];
        let faced = null, fct = null, fts = null, fsp = null; const h = habit(r[2]);
        if (h && oppPos.length >= 5) { const ds = oppPos.map(o => ({ d: Math.hypot(h[0] - o.x, h[1] - o.y), o })).sort((a, b) => a.d - b.d);
          let sw = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0; for (const q of ds.slice(0, 3)) { const w = Math.exp(-q.d / 8); sw += w; s1 += w * q.o.fd; s2 += w * q.o.ct; s3 += w * q.o.ts; s4 += w * q.o.sp; }
          faced = s1 / sw; fct = s2 / sw; fts = s3 / sw; fsp = s4 / sw; }
        const syc = p.syc[sid] || 0;
        const ex = p.teams.has(opp) ? 1 : 0;
        const back = p.returning ? 1 : 0;
        data.push({ eid, mi, sid, round, y: r[13], home, pos, ycr: rate(p, 'y', 'ry', pos), flr: rate(p, 'f', 'rf', pos), argr: rate(p, 'a', 'ra', pos),
          faced, fct, fts, fsp, tyc: T1.y, ofd: T2.fd, ref: refF, lam, pT: home ? pH : pA, pO: home ? pA : pH, h2h, derby,
          rest, restO, cup, ppg, ppgO, rankDiff: Math.abs(rank(team) - rank(opp)), salv, europa, late: round >= 30 ? 1 : 0,
          diff: SUSP(syc + 1) ? 1 : 0, syc, ex, back, apps: p.teams.size ? 1 : 0 });
      }
    }
    // ---- aggiornamento stati DOPO la partita
    const playedIds = new Set(rows.map(r => r[2]));
    for (const r of rows) { const p = ps(r[2]); p.min += r[6]; p.y += r[13]; p.f += r[7]; p.fd += r[8]; p.ct += r[9]; p.sp += r[12]; if (r[11] > 0) { p.ts += r[11]; p.tsn++; }
      if (r[13] && !FOUL.has(cardR[eid + '|' + r[2]] || 'Foul')) p.a++;
      p.teams.add(r[1] ? hT : aT); p.syc[sid] = (p.syc[sid] || 0) + r[13];
      p.returning = false; p.pending = !!(r[14] || (r[13] && SUSP(p.syc[sid]))); p.curTeam = r[1] ? hT : aT; }
    // chi aveva una squalifica in sospeso e salta una partita della sua squadra: alla prossima presenza è "di rientro"
    for (const [pid, p] of Object.entries(PS)) if (p.pending && (p.curTeam === hT || p.curTeam === aT) && !playedIds.has(+pid)) { p.pending = false; p.returning = true; }
    if (ap) for (const side of ['h', 'a']) for (const q of ap[side]) if (q[3] >= 10) ps(q[0]).pos.push([q[1], q[2]]);
    for (const [t, hm] of [[hT, 1], [aT, 0]]) { const rr = rows.filter(r => r[1] === hm); (TS[t] = TS[t] || []).push({ y: rr.reduce((s, r) => s + r[13], 0), fd: rr.reduce((s, r) => s + r[8], 0) }); }
    const tot = rows.reduce((s, r) => s + r[13], 0);
    if (ref) { const x = RS[ref] = RS[ref] || { g: 0, y: 0 }; x.g++; x.y += tot; } lgRef.g++; lgRef.y += tot;
    H2H[pair] = { n: hh.n + 1, y: hh.y + tot };
    if (hs != null && as != null) { const a = tab[hT] = tb(hT), b = tab[aT] = tb(aT); a.g++; b.g++; if (hs > as) a.pts += 3; else if (hs < as) b.pts += 3; else { a.pts++; b.pts++; } }
    mi++;
  }
  return { data, state: { PS, TS, RS, G, lgRef, H2H, TAB } };
}
