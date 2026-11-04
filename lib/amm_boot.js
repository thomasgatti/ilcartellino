// amm_boot.js — ricostruzione completa del bot nella scheda fotmob.com dopo una chiusura del browser.
// Caricamento di tutto il codice (una riga, nella console della scheda FotMob):
//   for (const f of AMM_FILES) (0, eval)('{' + await (await fetch('https://ilcartellino.vercel.app/lib/' + f + '?v=' + Date.now())).text() + '\n}');
// poi:  await ammBuild()  → dati da IndexedDB, modelli Serie A v0.7 (__SAM3) e coppe v3 (__CUPM3 = __CUPM4), funzioni di previsione.
window.AMM_FILES = ['fotmob_scrape.js', 'fm_model.js', 'cup_model.js', 'cup_model2.js', 'ext_model.js', 'cup_x2.js', 'field_lineups.js', 'uff_lineup.js', 'sa_export.js', 'oc_scrape.js', 'amm_boot.js'];
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
window.ammBuild = async () => { const st = window.__AMMB = { fase: 'dati' }; const sleep = ms => new Promise(r => setTimeout(r, ms));
  st.dati = await ammLoad(); await sleep(10);
  st.fase = 'serie A'; fmBuild(); addLgr(); await sleep(10);
  st.fase = 'coppe'; cupBuild2(); await sleep(10);
  st.fase = 'extra'; extBuild(); await sleep(10);
  st.fase = 'modelli'; st.m3 = extMakeModels2(); extPatchPredict(); await sleep(10);
  st.fase = 'coppe v3'; st.m4 = cupX2Build(); st.fase = 'fatto'; return st; };
