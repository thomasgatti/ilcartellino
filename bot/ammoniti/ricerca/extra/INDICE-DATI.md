# Dati per la ricerca EXTRA

Leggi `EXTRA-brief-per-Claude.md` e `analisi-extra-coppe-europee.md` per il contesto, i limiti e le decisioni. Per esaminare i dati o eseguire gli script, estrai il pacchetto di lavoro. Per ricostruire l'estrazione, estrai anche l'archivio delle fonti nella stessa cartella.

## Pacchetto di lavoro

| File | Contenuto |
|---|---|
| `extra-analisi/matches.json` | 815 gare Europa League e Conference con angoli, totali e cronologia strutturata quando disponibile. `hc` e `ac` sono angoli casa e trasferta. `hg`, `ag`, `hy`, `ay` sono gol e gialli per lato. `timelineComplete` indica concordanza del numero di eventi con il totale, con orari e periodo presenti. |
| `extra-analisi/angoli-serie-a-champions.json` | 2.717 gare di Serie A e Champions con angoli per squadra dopo il controllo sugli zeri contraddetti dalla cronaca. Stesso formato di base dei totali. |
| `extra-analisi/round-results.json` | 36 gare del turno 4–5 novembre 2026, due cronologie, conteggi per stagione ed esclusioni angoli. |
| `extra-analisi/scorer-matches.json` | 673 gare collegate a FotMob. `players` contiene ID, ruolo, lato (1 casa, 0 trasferta), titolarità, minuti effettivi e gol individuali. Gli autogol contano solo per riconciliare il risultato. I minuti effettivi servono per aggiornare lo storico delle gare precedenti. |
| `extra-analisi/scorer-input-audit.json` | Copertura, riscontri di identità ed esclusioni dei marcatori. |
| `extra-analisi/corners-results.json`, `cards-results.json`, `scorer-results.json` | Protocolli e metriche per competizione e periodo. |
| `extra-analisi/audit.json` | Tabellini sintetizzati, manifesti SHA-256 delle risposte ESPN e scarti. |
| `extra-analisi/domestic-probe-results.json` | Verifica a campione delle fonti nazionali per le quattro squadre citate. |
| `studio-duelli/PASSAGGIO_CLAUDE.md` | Contesto della ricerca precedente sui duelli e dello stato della webapp al 5 novembre. |

Per le gare `id` identifica la partita nel fornitore di origine. `league` è la competizione ESPN, `season` l'anno iniziale e `ts` il calcio d'inizio in secondi Unix. Gli ID del file marcatori sono FotMob, quelli dei due dataset angoli sono ESPN. Unire gli ID fra fonti con un ponte verificato.

## Archivio delle fonti

- `extra-analisi/cache/` conserva le 822 cronache originali ESPN Europa League e Conference e gli otto calendari annuali, in JSON compresso gzip.
- `studio-duelli/cache-archive/` conserva le 2.816 cronache originali ESPN Serie A e Champions, i 12 calendari, `fixtures.json` e `receipts.json`.
- `studio-duelli/input/fotmob/` conserva i 90 archivi compressi FotMob in base64 e il manifesto. Il commit dei dati è `cdcd037ab30cc8e578b69b690dd11aa04c065b61`. I file `.b64` contengono i byte gzip originali in codifica testuale.

## Ripetere le prove

Dalla cartella estratta, con Node 22 o successivo:

```sh
node extra-analisi/corners-test.mjs
node extra-analisi/scorer-test.mjs
```

Con i file dell'archivio delle fonti estratti nella stessa cartella:

```sh
node extra-analisi/round-audit.mjs
node extra-analisi/scorer-input.mjs
node extra-analisi/cards-test.mjs
```

Gli script salvano i risultati accanto ai dati del pacchetto. I due test angoli e marcatori usano già i dati preparati. Gli script di raccolta e il probe nazionale sono inclusi come riferimento per eventuali aggiornamenti.
