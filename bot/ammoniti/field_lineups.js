// field_lineups.js — formazioni in campo per la scheda "Formazioni" dell'app (scheda FotMob).
// Uso: const L = await fieldLineups([id,...]); poi esporta con fieldExport(L) e sostituisci/aggiungi le righe in webapp/lineups.txt
// (una riga per partita: id|tipo|modulo casa/modulo ospite|giocatori casa^giocatori ospite, giocatore = nome~numero~x~y~portiere).
// build.py legge lineups.txt e mette m.lu in ogni partita. tipo: standard = ufficiale, predicted = probabile, lastStarting11 = ultima schierata.
window.fieldLineups = async ids => { const out = [];
  for (const id of ids) { try { const j = await (await fetch('/api/data/matchDetails?matchId=' + id)).json(); const lu = j.content.lineup || {};
    const side = T => (T?.starters || []).map(p => [p.name, p.shirtNumber || '', +(p.verticalLayout?.x ?? .5).toFixed(3), +(p.verticalLayout?.y ?? .5).toFixed(3), p.usualPlayingPositionId === 0 || p.positionId === 11 ? 1 : 0]);
    out.push({ id, t: lu.lineupType || 'unavailable', f: [lu.homeTeam?.formation || '', lu.awayTeam?.formation || ''], h: side(lu.homeTeam), a: side(lu.awayTeam) }); } catch (e) { out.push({ id, t: 'err' }); } }
  return out; };
window.fieldExport = L => L.filter(m => m.h?.length).map(m => m.id + '|' + m.t + '|' + m.f.join('/') + '|' + ['h', 'a'].map(s => m[s].map(r => r.join('~')).join(';')).join('^')).join('\n');
