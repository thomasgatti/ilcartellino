// amm_boot.js — ricostruzione completa del bot nella scheda fotmob.com dopo una chiusura del browser.
// Caricamento di tutto il codice (una riga, nella console della scheda FotMob):
//   for (const f of AMM_FILES) (0, eval)('{' + await (await fetch('https://ilcartellino.vercel.app/lib/' + f + '?v=' + Date.now())).text() + '\n}');
// poi:  await ammBuild()  → dati da IndexedDB, modelli Serie A v0.7 (__SAM3) e coppe v3 (__CUPM3 = __CUPM4), funzioni di previsione.
window.AMM_FILES = ['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js', 'deep_scrape.js', 'deep_feats.js', 'cup_x3.js', 'hot_feats.js', 'field_lineups.js', 'uff_lineup.js', 'sa_export.js', 'oc_scrape.js', 'amm_boot.js'];
window.idbAll = (name, store) => new Promise((res, rej) => { const r = indexedDB.open(name); r.onerror = () => rej(r.error);
  r.onsuccess = () => { const db = r.result; if (!db.objectStoreNames.contains(store)) { db.close(); return res({}); } const out = {}; const c = db.transaction(store).objectStore(store).openCursor();
    c.onsuccess = e => { const cur = e.target.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else { db.close(); res(out); } }; c.onerror = () => rej(c.error); }; });
window.ammLoad = async () => { window.__FMM = await idbAll('amm', 'fm'); window.__UCL = await idbAll('amm_ucl', 'm'); window.__DOM = await idbAll('amm_dom', 'm');
  return { serieA: Object.keys(__FMM).length, ucl: Object.keys(__UCL).length, altri: Object.keys(__DOM).length }; };
// quote FotMob (bet365 Spagna): 1X2 in percentuale senza margine e "Player to be Booked" (i 2 giocatori quotati)
window.fmOdds = async ids => { const out = {};
  for (const id of ids) { try { const j = await fetch('/api/data/matchOdds?matchId=' + id + '&ccode3=ESP').then(r => r.json());
    const mk = (j.odds?.oddsTabMarkets || []).flatMap(c => c.markets || []);
    const r1 = mk.find(m => m.headerTranslationKey === 'who_will_win'), bk = mk.find(m => m.headerTranslationKey === 'odds_player_to_be_booked');
    let p = null; if (r1 && r1.selections?.length === 3) { const q = r1.selections.map(s => 1 / +s.oddsDecimal), t = q.reduce((a, b) => a + b, 0); p = q.map(x => Math.round(x / t * 100)); }
    out[id] = { p, booked: (bk?.selections || []).map(s => [s.name, +s.oddsDecimal]) }; } catch (e) { out[id] = { p: null, booked: [] }; } }
  return out; };
// variabili del modello coppe v2 (RUNBOOK: ruolo M, ruolo F, casa, L(gialli/90), L(falli/90), L(falli subiti dall'avversario di fronte), |divario forza|)
window.cupFS2 = () => { const L = x => Math.log(Math.max(.005, x));
  return [d => d.role === 'M' ? 1 : 0, d => d.role === 'F' ? 1 : 0, d => d.home, d => L(d.yc), d => L(d.fl), d => L(d.facing ?? 1.1), d => Math.abs(d.gap ?? 0)]; };
// modelli finali con variabili extra (come in produzione dal 3/11: SA + posizione_partita + forza_ruolo, coppe + posizione_partita)
window.extMakeModels2 = (exSA = ['posizione_partita', 'forza_ruolo'], exC = ['posizione_partita']) => {
  window.__CFS2 = window.__CFS2 || cupFS2();
  for (const r of __ROWS) r.ex = __EX[r.mid + '|' + r.pid]; for (const r of __CROWS2) r.ex = __EX[r.mid + '|' + r.pid];
  const C = EXT_CANDS;
  window.__FS_SA = fmGroups(__ROWS).filter(g => ['base', 'lega', 'squadre', 'duelli'].includes(g[0])).flatMap(g => g[1]);
  window.__FS_SA3 = [...__FS_SA, ...C.arbitro, ...C.precedenti, ...exSA.flatMap(k => C[k])];
  window.__CFS3 = [...__CFS2, ...C.arbitro, ...C.precedenti, ...C.diffida, ...exC.flatMap(k => C[k])];
  window.__SAM3 = fitLogit(__ROWS.filter(d => d.season >= '2021/2022'), __FS_SA3, 2);
  const U = __CROWS2.filter(d => d.lg === 42), mC = fitLogit(U, __CFS3, 2), cal = U.filter(d => d.season >= '2025/2026');
  let lo = -1, hi = 1; const obs = cal.reduce((a, d) => a + d.y, 0);
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; const s = cal.reduce((a, d) => { const p = mC.pred(d); return a + 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + mid))); }, 0); if (s > obs) hi = mid; else lo = mid; }
  const shift = (lo + hi) / 2, pr = mC.pred; mC.pred = d => { const p = pr(d); return 1 / (1 + Math.exp(-(Math.log(p / (1 - p)) + shift))); }; mC.shift = shift;
  window.__CUPM3 = mC; window.__CUPM3_OLD = mC; return { shift, nSA: __FS_SA3.length, nC: __CFS3.length };
};
// peso della storia personale nel modello coppe: shrink verso la media del ruolo di 600 minuti (prima 1500).
// Test 4/11 su 16.140 titolari UCL: log loss 300 .41868, 600 .41854, 900 .41857, 1500 .41873, 3000 .41910; top3 uguale nel rumore.
window.__CK = window.__CK || 600;
// confronto temporale: allena sulle stagioni precedenti e prova sulla successiva (log loss e ammoniti tra i primi 3 per partita)
window.extCV2 = (rows, fs, tests) => { let ll = 0, n = 0, t3 = 0, nm = 0;
  for (const s of tests) { const tr = rows.filter(d => d.season < s), te = rows.filter(d => d.season === s); if (!tr.length || !te.length) continue;
    const m = fitLogit(tr, fs, 2), P = te.map(m.pred); te.forEach((d, i) => { const p = Math.min(.999, Math.max(.001, P[i])); ll -= d.y * Math.log(p) + (1 - d.y) * Math.log(1 - p); n++; });
    const byM = {}; te.forEach((d, i) => (byM[d.mid] ||= []).push([P[i], d.y])); for (const a of Object.values(byM)) { a.sort((x, y) => y[0] - x[0]); t3 += a.slice(0, 3).reduce((x, q) => x + q[1], 0); nm++; } }
  return { ll: ll / n, t3: t3 / nm, n }; };
// confronto appaiato di due insiemi di variabili: dll < 0 = B migliore; dt3 = ammoniti in più tra i primi 3 per partita, con errore standard
window.extPair = (rows, fsA, fsB, tests) => { const H = {}; let llA = 0, llB = 0, n = 0;
  for (const s of tests) { const tr = rows.filter(d => d.season < s), te = rows.filter(d => d.season === s); if (!tr.length || !te.length) continue;
    const mA = fitLogit(tr, fsA, 2), mB = fitLogit(tr, fsB, 2), byM = {};
    te.forEach(d => { const a = mA.pred(d), b = mB.pred(d); llA -= d.y * Math.log(a) + (1 - d.y) * Math.log(1 - a); llB -= d.y * Math.log(b) + (1 - d.y) * Math.log(1 - b); n++; (byM[d.mid] ||= []).push([a, b, d.y]); });
    for (const [mid, a] of Object.entries(byM)) { const ta = [...a].sort((x, y) => y[0] - x[0]).slice(0, 3).reduce((s, x) => s + x[2], 0), tb = [...a].sort((x, y) => y[1] - x[1]).slice(0, 3).reduce((s, x) => s + x[2], 0); H[mid] = tb - ta; } }
  const v = Object.values(H), mu = v.reduce((a, b) => a + b, 0) / v.length, sd = Math.sqrt(v.reduce((a, b) => a + (b - mu) ** 2, 0) / (v.length - 1));
  return { dll: +((llB - llA) / n).toFixed(5), dt3: +mu.toFixed(3), se: +(sd / Math.sqrt(v.length)).toFixed(3), nm: v.length }; };
// regola del sostituto per la Champions: q = prob. di uscire (ultime 2 stagioni, shrink 4 titolarità verso il ruolo) × giallo del subentrato UCL per ruolo.
// cupExport3 viene avvolta: ogni riga riceve q in posizione 9 (cup_to_data.py la mette nell'ottavo campo di pl).
window.subqBuild = () => { const A = cupAll(), ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M', now = Date.now() / 1000;
  const P = {}, NM = {}, R = { D: [0, 0], M: [0, 0], F: [0, 0] }, PR = { D: [0, 0], M: [0, 0], F: [0, 0] };
  for (const m of A) { const recent = now - m.ts < 730 * 86400, off = new Map(m.subs.map(s => [+s[1], +s[0]])), bk = new Set(m.cards.filter(c => /Yellow/.test(c[2])).map(c => +c[0]));
    for (const r of m.pl) { if (r[4] !== 1 || r[3] === 0) continue; NM[r[0]] = r[1]; const role = ROLE(r[3]);
      if (recent) { const p = P[r[0]] ||= { s: 0, o: 0, role }; p.s++; if (off.has(+r[0])) p.o++; PR[role][0]++; if (off.has(+r[0])) PR[role][1]++; }
      if (m.lg === 42 && off.has(+r[0])) { R[role][0]++; if (bk.has(off.get(+r[0]))) R[role][1]++; } } }
  const pr = Object.fromEntries(Object.entries(PR).map(([k, v]) => [k, v[1] / v[0]])), rr = Object.fromEntries(Object.entries(R).map(([k, v]) => [k, v[1] / v[0]]));
  window.__SUBQ = {}; for (const [id, p] of Object.entries(P)) window.__SUBQ[NM[id]] = +(((p.o + 4 * pr[p.role]) / (p.s + 4)) * rr[p.role]).toFixed(4);
  if (!window.__CEX3) { window.__CEX3 = window.cupExport3; window.cupExport3 = async ids => { const ex = await window.__CEX3(ids); for (const m of ex) for (const r of (m.pl || [])) { while (r.length < 9) r.push(0); r[9] = window.__SUBQ[r[0]] ?? null; } return ex; }; }
  return { giallo_subentrato: rr, giocatori: Object.keys(__SUBQ).length }; };
window.ammBuild = async () => { const st = window.__AMMB = { fase: 'dati' }; const sleep = ms => new Promise(r => setTimeout(r, ms));
  st.dati = await ammLoad(); await sleep(10);
  st.fase = 'serie A'; fmBuild(); addLgr(); await sleep(10);
  st.fase = 'coppe'; cupBuild2(); await sleep(10);
  st.fase = 'extra'; extBuild(); await sleep(10);
  st.fase = 'modelli'; st.m3 = extMakeModels2(); extPatchPredict(); await sleep(10);
  st.fase = 'coppe v3'; st.m4 = cupX2Build(); st.subq = subqBuild();
  if (typeof deepFeatBuild === 'function' && typeof cupX3Build === 'function') { st.fase = 'coppe v4'; st.x3 = await deepFeatBuild(); st.m5 = cupX3Build(); }
  if (typeof hotBuild === 'function') { st.fase = 'testa calda'; try { st.hot = hotBuild(); } catch (e) { st.hot = { errore: String(e) }; console.warn('hotBuild:', e); } }
  st.fase = 'fatto'; return st; };
