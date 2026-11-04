// uff_lineup.js — formazioni ufficiali da FotMob per cloud_lineup.py (non serve il modello nella pagina).
// JSON.stringify(await fmUff([ids])) → {"<id>": {"h": [portiere, ...10], "a": [...], "fonti": ["fotmob standard"]}} solo per le partite 'standard'.
window.fmUff = async ids => { const out = {};
  for (const id of ids) { const j = await fetch('/api/data/matchDetails?matchId=' + id).then(r => r.json()); const lu = j.content?.lineup;
    if (!lu || lu.lineupType !== 'standard') continue;
    const xi = T => { const s = T?.starters || []; const gk = s.filter(p => p.usualPlayingPositionId === 0 || p.positionId === 11); const rest = s.filter(p => !gk.includes(p)); return [...gk, ...rest].map(p => p.name); };
    out[id] = { h: xi(lu.homeTeam), a: xi(lu.awayTeam), fonti: ['fotmob standard'] }; }
  return out; };
