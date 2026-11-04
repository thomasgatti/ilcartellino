// Modulo LIVE ammoniti (da eseguire nella console di una pagina www.sofascore.com)
// Uso: await liveAmmoniti(EVENT_ID, PREMATCH)  dove PREMATCH = {playerId: probabilità pre-partita}
// Modello EURISTICO, non ancora validato su dati minuto per minuto (Sofascore non dà l'orario dei falli):
//  - ogni fallo futuro diventa giallo con probabilità c * m * (1 + 0.25 * falli già fatti)  (falli reiterati)
//  - c'è un rischio "non da fallo" (proteste, perdite di tempo) b * m, proporzionale al tempo che resta
//  - m (moltiplicatore del giocatore) è scelto in modo che a inizio partita il modello restituisca la P pre-partita
//  - il ritmo falli del giocatore si aggiorna con quanto visto in campo (peso: una partita intera di prior)
//  - l'arbitro: se sta ammonendo più/meno del previsto, tutte le probabilità salgono/scendono (con prudenza)
const LIVE_C = 0.128, LIVE_B = 0.03, LIVE_ESC = 0.25;

function _pBooked(m, foulRatePerMin, remMin, foulsSoFar, refFactor) {
  // P(almeno un giallo nel tempo restante), somma su numero di falli futuri ~ Poisson
  const mu = foulRatePerMin * remMin;
  let pNone = 0, pk = Math.exp(-mu), surv = 1;
  for (let k = 0; k < 15; k++) {
    pNone += pk * surv;
    const ck = Math.min(0.9, LIVE_C * m * refFactor * (1 + LIVE_ESC * (foulsSoFar + k)));
    surv *= (1 - ck);
    pk *= mu / (k + 1);
  }
  const pNonFoul = Math.min(0.5, LIVE_B * m * refFactor * remMin / 90);
  return 1 - pNone * (1 - pNonFoul);
}

function _calibrateM(p0, foulRatePerMin, expMin) {
  let lo = 0.05, hi = 6;
  for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; (_pBooked(mid, foulRatePerMin, expMin, 0, 1) < p0) ? lo = mid : hi = mid; }
  return (lo + hi) / 2;
}

async function liveAmmoniti(eventId, PREMATCH, preFoulRate = {}, expectedCards = 4) {
  const B = 'https://www.sofascore.com/api/v1';
  const [ev, lu, inc] = await Promise.all([`/event/${eventId}`, `/event/${eventId}/lineups`, `/event/${eventId}/incidents`]
    .map(u => fetch(B + u).then(r => r.json())));
  const e = ev.event;
  const nowSec = Date.now() / 1000;
  let minute = 0;
  if (e.status.type === 'inprogress') {
    const startP = e.time?.currentPeriodStartTimestamp || nowSec;
    minute = Math.min(e.status.description?.includes('2nd') ? 45 + (nowSec - startP) / 60 : (nowSec - startP) / 60, 95);
  } else if (e.status.type === 'finished') minute = 95;
  const booked = new Set(), cardsSoFar = (inc.incidents || []).filter(x => x.incidentType === 'card');
  cardsSoFar.forEach(x => x.player && booked.add(x.player.id));
  const subbedOff = new Set((inc.incidents || []).filter(x => x.incidentType === 'substitution').map(x => x.playerOut?.id));
  // fattore arbitro: cartellini visti vs attesi fino a questo minuto (shrink con 2 cartellini di prior)
  const expSoFar = expectedCards * minute / 95;
  const refFactor = minute > 10 ? (cardsSoFar.length + 2) / (expSoFar + 2) : 1;
  const out = [];
  for (const side of ['home', 'away']) for (const p of lu[side].players) {
    const id = p.player.id, s = p.statistics || {};
    if (p.position === 'G' || booked.has(id) || subbedOff.has(id)) continue;
    const onPitch = !p.substitute || (s.minutesPlayed || 0) > 0;
    if (!onPitch) continue;
    const p0 = PREMATCH[id] ?? 0.12;
    const r0 = (preFoulRate[id] ?? 1.3) / 90;               // falli per minuto pre-partita
    const played = s.minutesPlayed || minute;
    const f = s.fouls || 0;
    const r = (f + r0 * 90) / (played + 90);                 // ritmo falli aggiornato
    const m = _calibrateM(p0, r0, 80);
    // minuti che restano a questo giocatore: un titolare gioca in media ~80', un subentrato fino alla fine
    const rem = p.substitute ? Math.max(0, 95 - minute) : Math.max(0, 80 - minute);
    const pNow = _pBooked(m, r, rem, f, refFactor);
    out.push({ giocatore: p.player.shortName, squadra: side === 'home' ? e.homeTeam.shortName : e.awayTeam.shortName,
      falli: f, pre: +(p0 * 100).toFixed(0), live: +(pNow * 100).toFixed(0) });
  }
  out.sort((a, b) => b.live - a.live);
  return { minuto: Math.round(minute), punteggio: `${e.homeScore?.current ?? 0}-${e.awayScore?.current ?? 0}`,
    gialli_finora: cardsSoFar.map(x => `${x.player?.shortName} ${x.time}'`), fattore_arbitro: +refFactor.toFixed(2), classifica: out.slice(0, 10) };
}
