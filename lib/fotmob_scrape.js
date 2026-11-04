// Scraper FotMob per il bot ammoniti (da eseguire in una scheda https://www.fotmob.com del browser integrato).
// Salva una riga compatta per partita in IndexedDB (db 'amm', store 'fm') e in window.__FMM.
// Uso: await fmScrape(['2024/2025','2025/2026','2026/2027'])  → poi window.__FMM contiene tutte le partite.
window.fmIDB = () => new Promise((res, rej) => { const r = indexedDB.open('amm', 1); r.onupgradeneeded = () => r.result.createObjectStore('fm'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
window.fmPut = async (k, v) => { const db = await fmIDB(); return new Promise(res => { const t = db.transaction('fm', 'readwrite'); t.objectStore('fm').put(v, k); t.oncomplete = () => res(true); t.onerror = () => res(false); }); };
window.fmAll = async () => { const db = await fmIDB(); return new Promise(res => { const out = {}; const t = db.transaction('fm'); const c = t.objectStore('fm').openCursor(); c.onsuccess = e => { const cur = e.target.result; if (cur) { out[cur.key] = cur.value; cur.continue(); } else res(out); }; }); };
window.fmParse = (j, season) => {
  const c = j.content || {}, info = c.matchFacts?.infoBox || {}, ev = c.matchFacts?.events?.events || [];
  const H = j.header?.teams || [], lu = c.lineup || {};
  const st = s => s ? Object.fromEntries(Object.entries(s).map(([k, v]) => [k, v.stat?.value ?? null])) : {};
  const pl = [];
  for (const [side, T] of [[1, lu.homeTeam], [0, lu.awayTeam]]) {
    if (!T) continue;
    for (const [starter, arr] of [[1, T.starters || []], [0, T.subs || []]]) for (const p of arr) {
      const S = c.playerStats?.[p.id]; const flat = {}; for (const g of (S?.stats || [])) Object.assign(flat, st(g.stats));
      const min = flat['Minutes played'] || 0; if (!min && !starter) continue;
      const vl = p.verticalLayout || {};
      pl.push([p.id, p.name, side, p.usualPlayingPositionId ?? S?.usualPosition ?? null, starter, min, flat['Fouls committed'] ?? 0, flat['Was fouled'] ?? 0,
        flat['Duels won'] ?? 0, flat['Duels lost'] ?? 0, flat['Tackles'] ?? 0, flat['Dribbled past'] ?? 0, vl.x ?? null, vl.y ?? null, p.age ?? null]);
    }
  }
  return {
    id: +j.general?.matchId || +lu.matchId, ts: Date.parse(j.general?.matchTimeUTCDate || info['Match Date']?.utcTime) / 1000, season, round: +(j.general?.matchRound || info.Tournament?.round || 0),
    h: [H[0]?.id, H[0]?.name], a: [H[1]?.id, H[1]?.name], hs: H[0]?.score, as: H[1]?.score, ref: info.Referee ? [info.Referee.id, info.Referee.text] : null,
    goals: ev.filter(e => e.type === 'Goal').map(e => [e.time, e.isHome ? 1 : 0]),
    cards: ev.filter(e => e.type === 'Card').map(e => [e.player?.id ?? e.playerId, e.time, e.card, e.cardReason?.localizedKey || '', e.isHome ? 1 : 0]),
    subs: ev.filter(e => e.type === 'Substitution').map(e => [+(e.swap?.[0]?.id || 0), +(e.swap?.[1]?.id || 0), e.time, e.isHome ? 1 : 0]),
    pl
  };
};
window.fmScrape = async (seasons, conc = 3) => {
  const S = window.__FMS = { status: 'avvio', done: 0, tot: 0, err: 0 }, sleep = ms => new Promise(r => setTimeout(r, ms));
  const get = async u => { for (let k = 0; k < 4; k++) { try { const r = await fetch(u); if (r.status === 200) return await r.json(); if (r.status === 429) await sleep(4000); } catch (e) {} await sleep(900); } S.err++; return null; };
  const have = await fmAll(); window.__FMM = have; const jobs = [];
  for (const s of seasons) {
    const L = await get('/api/data/leagues?id=55&season=' + encodeURIComponent(s));
    const fx = (L?.fixtures?.allMatches || []).filter(m => m.status?.finished && !m.status?.cancelled);
    for (const m of fx) if (!have[m.id]) jobs.push([m.id, s]);
  }
  S.tot = jobs.length; S.status = 'partite'; let i = 0;
  await Promise.all(Array.from({ length: conc }, async () => { while (i < jobs.length) { const [id, s] = jobs[i++]; const j = await get('/api/data/matchDetails?matchId=' + id);
    if (j) { try { const r = fmParse(j, s); window.__FMM[id] = r; await fmPut(id, r); } catch (e) { S.err++; } } S.done++; await sleep(150); } }));
  S.status = 'fatto'; return S;
};
