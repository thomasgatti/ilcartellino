// Attesa delle formazioni ufficiali (16/11/2026): controllo ravvicinato senza moltiplicare i giri del workflow.
// La Giornata automatica parte ogni 20 minuti: una formazione uscita subito dopo un giro restava fuori dal sito fino al giro dopo.
// Questo passo gira prima di giornata.mjs. Se una partita di Serie A, Champions o Nazionali è fra 66 e 25 minuti dal via e non ha
// ancora le ufficiali, interroga FotMob ogni 60 secondi e si ferma appena ne esce una (o dopo 17 minuti: il giro successivo, già in
// coda, riprende l'attesa). Così le ufficiali arrivano in pagina 1-3 minuti dopo l'uscita. Fuori da quella finestra esce subito.
// Costa minuti di Actions solo mentre aspetta (repository privato: finestra stretta apposta). ATTESA_NO=1 lo salta (prove).
import fs from 'node:fs';
import './lib_node.mjs';

const now = () => Date.now() / 1000, MAX = 17 * 60, PASSO = 60;
if (process.env.ATTESA_NO === '1') process.exit(0);
const data = JSON.parse(fs.readFileSync('bot/webapp/data.json', 'utf8'));
const all = [...(data.matches || []), ...(data.cups?.ucl?.matches || []), ...(data.cups?.naz?.matches || [])];
const vicine = () => all.filter(m => !m.uff && now() >= m.ko - 66 * 60 && now() <= m.ko - 25 * 60);
if (!vicine().length) { console.log('Attesa: nessuna partita vicina senza ufficiali'); process.exit(0); }

const ok = lu => lu?.lineupType === 'standard' && [lu.homeTeam, lu.awayTeam].every(t => t?.starters?.length === 11);
const t0 = now();
console.log('Attesa delle ufficiali per:', vicine().map(m => `${m.h}-${m.a}`).join(', '));
while (now() - t0 < MAX) {
  const list = vicine(); if (!list.length) break;
  for (const m of list) {
    try {
      const r = await fetch('/api/data/matchDetails?matchId=' + m.id, { signal: AbortSignal.timeout(15000) });
      if (r.ok && ok((await r.json()).content?.lineup)) { console.log(`Attesa: ufficiali uscite per ${m.h}-${m.a} dopo ${Math.round((now() - t0) / 60)} minuti`); process.exit(0); }
    } catch {}
  }
  await new Promise(r => setTimeout(r, PASSO * 1000));
}
console.log('Attesa: ancora nessuna ufficiale, si prosegue');
