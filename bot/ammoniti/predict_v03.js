// v0.3 — modello finale (solo gruppi utili) + previsione per partite future da formazioni/quote Sofascore
function finalFeatures(D) {
  const g = featureGroups(D); const keep = ['base', 'duelli', 'duelli_estesi', 'proteste', 'arbitro', 'quota_cartellini', 'quote_1x2'];
  return g.filter(x => keep.includes(x[0])).flatMap(x => x[1]);
}
async function predictV03(eventIds, model, S) {
  const B = 'https://www.sofascore.com/api/v1';
  const { PS, TS, RS, G, lgRef } = S;
  const frac = s => { if (!s) return null; const [a, b] = s.split('/').map(Number); return 1 + a / b; };
  const imp = o => { const s = o.reduce((a, x) => a + 1 / x, 0); return o.map(x => 1 / x / s); };
  const lamFrom = (L, ov, un) => { const po = (1 / ov) / (1 / ov + 1 / un); const k = Math.floor(L); const sf = l => { let c = 0, t = Math.exp(-l); for (let i = 0; i <= k; i++) { c += t; t *= l / (i + 1); } return 1 - c; }; let lo = 0.5, hi = 12; for (let i = 0; i < 50; i++) { const m = (lo + hi) / 2; sf(m) < po ? lo = m : hi = m; } return (lo + hi) / 2; };
  const habit = pid => { const a = PS[pid]?.pos.slice(-8) || []; return a.length ? [a.reduce((s, x) => s + x[0], 0) / a.length, a.reduce((s, x) => s + x[1], 0) / a.length] : null; };
  const rate = (p, k, rk, pos) => { const g = G[pos] || G.M; return (p[k] + g[rk] * 900) / (p.min + 900) * 90; };
  const tm = t => { const a = (TS[t] || []).slice(-10); return a.length ? { y: a.reduce((s, x) => s + x.y, 0) / a.length, fd: a.reduce((s, x) => s + x.fd, 0) / a.length } : { y: 1.9, fd: 11 }; };
  const lgR = lgRef.y / lgRef.g; const out = {};
  for (const id of eventIds) {
    const [ev, lu, od] = await Promise.all([fetch(B + `/event/${id}`).then(r => r.json()), fetch(B + `/event/${id}/lineups`).then(r => r.ok ? r.json() : null), fetch(B + `/event/${id}/odds/1/all`).then(r => r.ok ? r.json() : null)]);
    const e = ev.event, hT = e.homeTeam.name, aT = e.awayTeam.name, ref = e.referee?.name;
    let pH = null, pA = null, lam = null, line = null;
    if (od) { const ft = od.markets.find(m => m.marketName === 'Full time'); if (ft) [pH, , pA] = imp(ft.choices.map(c => frac(c.fractionalValue)));
      const cm = od.markets.filter(m => m.marketName === 'Cards in match').map(m => [+m.choiceGroup, ...m.choices.map(c => frac(c.fractionalValue))]).filter(c => c[1] && c[2]).sort((a, b) => Math.abs(a[1] - a[2]) - Math.abs(b[1] - b[2]));
      if (cm.length) { lam = lamFrom(...cm[0]); line = cm[0][0]; } }
    const rs = RS[ref]; const refF = ref && rs ? (rs.y + lgR * 8) / (rs.g + 8) : lgR;
    if (!lu) continue;
    const st = { 1: lu.home.players.filter(p => !p.substitute && p.position !== 'G'), 0: lu.away.players.filter(p => !p.substitute && p.position !== 'G') };
    const list = [];
    for (const home of [1, 0]) {
      const team = home ? hT : aT, opp = home ? aT : hT;
      const oppPos = st[1 - home].map(q => { const h = habit(q.player.id); const p = PS[q.player.id] || { min: 0, fd: 0, ct: 0, sp: 0, ts: 0, tsn: 0 }; const g = G[q.position] || G.M;
        return h ? { n: q.player.shortName, x: 100 - h[0], y: 100 - h[1], fd: (p.fd + g.rfd * 450) / (p.min + 450) * 90, ct: (p.ct + g.rct * 450) / (p.min + 450) * 90, sp: (p.sp + g.rsp * 450) / (p.min + 450) * 90, ts: (p.ts + g.mts * 3) / (p.tsn + 3) } : null; }).filter(Boolean);
      for (const q of st[home]) {
        const pos = ['D', 'M', 'F'].includes(q.position) ? q.position : 'M'; const p = PS[q.player.id] || { min: 0, y: 0, f: 0, fd: 0, a: 0, ct: 0, sp: 0, ts: 0, tsn: 0, syc: {} };
        let faced = null, fct = null, fts = null, fsp = null, vs = ''; const h = habit(q.player.id);
        if (h && oppPos.length >= 5) { const ds = oppPos.map(o => ({ d: Math.hypot(h[0] - o.x, h[1] - o.y), o })).sort((a, b) => a.d - b.d);
          let sw = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0; for (const x of ds.slice(0, 3)) { const w = Math.exp(-x.d / 8); sw += w; s1 += w * x.o.fd; s2 += w * x.o.ct; s3 += w * x.o.ts; s4 += w * x.o.sp; }
          faced = s1 / sw; fct = s2 / sw; fts = s3 / sw; fsp = s4 / sw; vs = ds[0].o.n; }
        const T1 = tm(team), T2 = tm(opp);
        const d = { home, pos, ycr: rate(p, 'y', 'ry', pos), flr: rate(p, 'f', 'rf', pos), argr: rate(p, 'a', 'ra', pos), faced, fct, fts, fsp, tyc: T1.y, ofd: T2.fd, ref: refF, lam, pT: home ? pH : pA, pO: home ? pA : pH };
        list.push({ id: q.player.id, n: q.player.shortName, t: team.replace(/^(AC|SSC|AS) /, ''), p: model.pred(d), y: p.y, f: p.f, a: p.a, min: p.min, vs, fls90: p.min ? p.f / p.min * 90 : 1.3 });
      }
    }
    list.sort((a, b) => b.p - a.p);
    out[id] = { partita: `${hT} - ${aT}`, ufficiali: lu.confirmed, arbitro: ref || 'n/d', p1x2: pH ? `${(pH * 100).toFixed(0)}/${(pA * 100).toFixed(0)}` : 'n/d', linea: line, lam: lam ? +lam.toFixed(2) : null, list };
  }
  return out;
}
