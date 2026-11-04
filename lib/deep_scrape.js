// deep_scrape.js — (4/11/2026) più storia e statistiche di stile per il modello coppe.
// 1) Statistiche extra per TUTTE le partite già salvate (Serie A, Champions, campionati esteri): per giocatore
//    [dribbling riusciti, dribbling tentati, tocchi, intercetti, palloni recuperati, palloni persi] → IndexedDB 'amm_x'/'x' {id: {pid: [...]}}.
// 2) Stagioni più vecchie dei campionati esteri (partite intere, formato di fmParse + lg) → IndexedDB 'amm_dom'/'m' (come domScrape) + extra.
// Uso: await deepPlan() → window.__DSJOBS; deepScrape() parte in sottofondo, stato in window.__DS. Riprende da dove era (salta gli id già in amm_x).
window.idbOpen = (name, store) => new Promise((res, rej) => { const r = indexedDB.open(name, 1); r.onupgradeneeded = () => r.result.createObjectStore(store); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.idbPutMany = async (name, store, entries) => { const db = await idbOpen(name, store); await new Promise(res => { const t = db.transaction(store, 'readwrite'); const s = t.objectStore(store); for (const [k, v] of entries) s.put(v, k); t.oncomplete = res; t.onerror = res; }); db.close(); };
window.deepExtra = j => { const out = {}; const st = s => s?.stat?.value ?? 0;
  for (const p of Object.values(j.content?.playerStats || {})) { const f = {}; for (const g of (p.stats || [])) Object.assign(f, g.stats || {});
    const d = f['Successful dribbles']?.stat || {}; out[p.id] = [d.value ?? 0, d.total ?? 0, st(f['Touches']), st(f['Interceptions']), st(f['Recoveries']), st(f['Dispossessed'])]; }
  return out; };
window.DEEP_SPEC = { 47: ['2021/2022', '2022/2023', '2023/2024'], 87: ['2021/2022', '2022/2023', '2023/2024'], 54: ['2021/2022', '2022/2023', '2023/2024'],
  53: ['2021/2022', '2022/2023', '2023/2024'], 57: ['2022/2023', '2023/2024'], 61: ['2022/2023', '2023/2024'],
  71: ['2023/2024', '2024/2025'], 40: ['2023/2024', '2024/2025'], 135: ['2024/2025'], 38: ['2024/2025'], 122: ['2024/2025'], 64: ['2024/2025'], 69: ['2024/2025'], 46: ['2024/2025'],
  441: ['2024/2025'], 73: ['2023/2024', '2024/2025'], 10216: ['2023/2024', '2024/2025'] };
window.deepPlan = async () => { const have = await idbAll('amm_x', 'x'); const jobs = []; const known = new Set();
  for (const src of [window.__FMM || {}, window.__UCL || {}, window.__DOM || {}]) for (const m of Object.values(src)) { known.add(+m.id); if (!have[m.id]) jobs.push({ id: +m.id, full: 0 }); }
  for (const [lg, seasons] of Object.entries(DEEP_SPEC)) for (const s of seasons) { try {
      const L = await fetch('/api/data/leagues?id=' + lg + '&season=' + encodeURIComponent(s)).then(r => r.json());
      for (const m of (L.fixtures?.allMatches || [])) if (m.status?.finished && !m.status?.cancelled && !known.has(+m.id)) { known.add(+m.id); jobs.push({ id: +m.id, full: 1, lg: +lg, season: s }); }
    } catch (e) {} }
  window.__DSJOBS = jobs; return { tot: jobs.length, nuove: jobs.filter(j => j.full).length }; };
window.deepScrape = (conc = 4) => { const S = window.__DS = { done: 0, err: 0, nuove: 0, tot: __DSJOBS.length, stato: 'in corso' }; const sleep = ms => new Promise(r => setTimeout(r, ms));
  const bufX = [], bufM = []; const flush = async () => { if (bufX.length) await idbPutMany('amm_x', 'x', bufX.splice(0)); if (bufM.length) await idbPutMany('amm_dom', 'm', bufM.splice(0)); };
  const get = async id => { for (let k = 0; k < 4; k++) { try { const r = await fetch('/api/data/matchDetails?matchId=' + id); if (r.status === 200) return await r.json(); if (r.status === 429) await sleep(5000); } catch (e) {} await sleep(800); } return null; };
  let i = 0; (async () => { await Promise.all([...Array(conc)].map(async () => { while (i < __DSJOBS.length && S.stato !== 'fermo') { const job = __DSJOBS[i++]; const j = await get(job.id);
      if (!j) { S.err++; continue; } bufX.push([job.id, deepExtra(j)]);
      if (job.full) { const m = fmParse(j, job.season); m.lg = job.lg; if (m.pl.length > 20) { bufM.push([job.id, m]); S.nuove++; } }
      S.done++; if (bufX.length >= 100) await flush(); await sleep(60); } }));
    await flush(); S.stato = 'fatto'; })();
  return S; };
