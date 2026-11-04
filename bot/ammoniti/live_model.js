// live_model.js — probabilità che un titolare ancora in campo e non ammonito venga ammonito da qui alla fine.
// Allenato il 3/11/2026 su Serie A 2021/22→oggi (172.408 casi, controlli a 15', 30', 45', 60', 75') e Champions (70.648).
// Variabili: p pre-partita riscalata sul tempo che resta, ritmo dei gialli fin lì rispetto all'atteso, gialli della propria
// squadra e dell'avversaria, differenza reti, secondo tempo.
// Risultato onesto: oltre al tempo che passa, cartellini e punteggio aggiungono pochissimo
// (log loss SA .33008 → .32995, UCL .32117 → .32086). Il segnale vero durante la partita sono i falli del giocatore,
// che nello storico non hanno il minuto: li stiamo raccogliendo con fmLiveStart (localStorage live_<id>) per allenarli.
// Coefficienti: [intercetta, logit(base), tempo, gialli propri, gialli avversari, diff. reti, |diff. reti|, secondo tempo]
const LIVE_B = {
  sa:  [-0.103, 0.891, -0.198, 0.034, 0.103, -0.015, -0.066, -0.023],
  ucl: [ 0.090, 0.894,  0.025, 0.006, 0.086, -0.063, -0.117,  0.020],
};
function liveProb(p0, t, cardsAll, ownCards, oppCards, scoreDiff, comp = 'ucl') {
  const lgY = comp === 'sa' ? 4.2 : 3.6, rem = Math.max(0, (95 - t) / 95);
  const base = 1 - Math.pow(1 - p0, rem), L = x => Math.log(Math.max(1e-4, x) / (1 - Math.min(.9999, x)));
  const sd = Math.max(-2, Math.min(2, scoreDiff)), b = LIVE_B[comp];
  const x = [1, L(base), Math.log((cardsAll + 1) / (lgY * t / 95 + 1)), ownCards, oppCards, sd, Math.abs(sd), t >= 45 ? 1 : 0];
  return 1 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * b[i], 0)));
}
if (typeof module !== 'undefined') module.exports = { liveProb, LIVE_B };
