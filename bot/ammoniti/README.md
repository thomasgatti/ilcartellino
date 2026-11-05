# Bot ammoniti Serie A — prototipo v0 (storico)

> Questo file descrive la **prima versione** del modello (ottobre 2026, dati FBref). Lo stato attuale del progetto è nel `README.md` della radice; le procedure aggiornate sono in `RUNBOOK.md`.

Stima per ogni titolare la probabilità di essere ammonito e sceglie i 3 più probabili della partita.

## Dati usati (v0)
- FBref via archivio pubblico `JaseZiv/worldfootballR_data` (GitHub release):
  - `ITA_M_1st_misc_player_advanced_match_stats.csv`: falli fatti/subiti, gialli, minuti, per giocatore per partita (2017-18 → 2022-23 completi; 2023-24, 2024-25 e 2025-26 parziali)
  - `ITA_M_1st_match_summary.csv`: eventi (cambi → chi era titolare)
  - `data/match_results/ITA_match_results.rds`: arbitro della partita (fino al 2021-22)
- Nota: da gennaio 2026 FBref non ha più i dati avanzati Opta (falli per giocatore inclusi), quindi per la stagione in corso serve un'altra fonte.

## Script
```
python build_dataset.py data/raw data/player_match.parquet   # feature solo pre-partita
python hypotheses.py data/player_match.parquet                # verifica ipotesi
python backtest.py data/player_match.parquet                  # modello + backtest top-3
python referee_test.py                                        # valore aggiunto dell'arbitro
```

## Risultati principali (titolari di movimento, 53.229 righe, 2.611 partite)
| Variabile | P(ammonito) | Note |
|---|---|---|
| Media | 17,9% | ~3,6-4,5 gialli a partita |
| Trasferta / Casa | 19,0% / 16,9% | effetto netto confermato |
| Derby/rivalità | 21,4% | effetto netto forte |
| Ruolo DM / CM / CB | 22,8% / 22,1% / 20,7% | FW 12,1%, AM 13,4% |
| Falli/90 storici, quintile alto vs basso | 21,7% vs 14,1% | tra i predittori più forti |
| Gialli/90 storici, quintile alto vs basso | 24,3% vs 11,6% | il predittore più forte |
| Diffidato | 18,8% grezzo | **a parità di giocatore è NEGATIVO** (si trattiene) |
| Ritardo >20 presenze senza giallo | 9,8% | **il "ritardo" non funziona**: effetto netto nullo (p=0,47) |
| Arbitro severo vs permissivo | 20,3% vs 17,6% | alza tutti, non cambia *chi* |

## Backtest
- Modello logistico, AUC ~0,60, ben calibrato; la probabilità massima data a un giocatore è ~39%.
- Top-3 per partita: ~0,74 ammoniti azzeccati su 3 (2022-23) contro 0,67 della baseline "chi ha più gialli" e ~0,52 a caso.
- 3/3 esatti: tra lo 0,4% e il 3% delle partite a seconda della stagione testata. Almeno 2/3: 11-20%.

## v0.3 — pipeline Sofascore (gira nel browser, su una pagina www.sofascore.com)
- Dati: endpoint `api/v1` di Sofascore: `unique-tournament/23/season/{id}/events/round/{n}`, `event/{id}` (arbitro),
  `event/{id}/lineups` (statistiche giocatore), `event/{id}/incidents` (cartellini con motivo), `event/{id}/odds/1/all`
  (1X2 e "Cards in match"), `event/{id}/average-positions`, `team/{id}/events/last/{page}` (calendario tutte le competizioni).
- `features_v03.js`: costruzione cronologica delle variabili (solo informazioni pre-partita).
- `model_v03.js`: regressione logistica con ridge (IRLS), validazione incrociata per gruppi di variabili.
- `predict_v03.js`: modello finale (base + duelli + proteste + arbitro + quote) e previsione da formazioni/quote attuali.
- `live_module.js`: aggiornamento in partita.
- Risultati e tabelle: `previsioni_giornata10_2026-27.md`.

## Prossimi passi
1. Fonte per la stagione in corso (Sofascore/FotMob/Lega Serie A) con falli per giocatore.
2. Arbitri designati + storico per arbitro (AIA, pianetafanta, valuestats).
3. Duelli diretti (chi marca chi): ruolo e fascia del giocatore contro chi subisce più falli nella zona opposta.
4. Diffidati, squalificati, formazioni probabili (giudice sportivo, fantacalcio.it, sosfanta).
5. Contesto: classifica, posta in palio, risultato atteso (quote 1X2), meteo.
