# EXTRA nelle coppe europee

Analisi del turno del 4 e 5 novembre 2026 e delle fasi a gironi o campionato dal 2023/24. Ho controllato 822 tabellini ESPN di Europa League e Conference League e ho usato 815 gare per il confronto sugli angoli. In sette tabellini entrambe le squadre risultavano a zero angoli pur avendo da sei a undici episodi di corner in cronaca. Ho escluso quei totali e rieseguito il confronto con gli stessi parametri.

## Il turno del 4 e 5 novembre

| Competizione | Gare | Angoli totali | Media angoli | Almeno 10 | Almeno 15 | Gol | Gialli da tabellino |
|---|---:|---:|---:|---:|---:|---:|---:|
| Europa League | 18 | 165 | 9,17 | 7 | 0 | 48 | 78 |
| Conference League | 18 | 175 | 9,72 | 10 | 1 | 42 | 71 |

Il turno di Europa League include Rennes–Olympiacos, giocata il 4 novembre. Il turno di Conference si è giocato tutto il 5 novembre. Le due partite citate sono iniziate alle 21:00 italiane. [Risultati UEFA Europa League](https://www.uefa.com/uefaeuropaleague/news/02ab-22004d716327-dd7c42bc0d91-1000--europa-league-matchday-4-round-up-ferencvaros-triumphant-/) · [Risultati UEFA Conference League](https://www.uefa.com/uefaconferenceleague/news/02ab-220049e7e20f-44ef5f39bc84-1000--uefa-conference-league-matchday-3-round-up-brighton-win-m/)

- **Celtic–Besiktas.** 10 angoli allo scoccare del 65:00 e 12 finali. Gli angoli successivi sono al 66′, 67′. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/401915522/besiktas-celtic)
- **Panathinaikos–CSKA Sofia.** 13 angoli allo scoccare del 65:00 e 16 finali. Gli angoli successivi sono al 74′, 90′, 90′+2′. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/401915819/cska-sofia-panathinaikos)

Per l'Over 14,5 la soglia dell'analisi è almeno 15 angoli. A Glasgow mancavano cinque angoli al 65:00 e ne sono arrivati due. Ad Atene ne mancavano due e ne sono arrivati tre. Il club bulgaro era il PFC CSKA Sofia, in trasferta. [Scheda UEFA Celtic–Beşiktaş](https://www.uefa.com/uefaeuropaleague/match/2050116/) · [Scheda UEFA Panathinaikos–CSKA Sofia](https://www.uefa.com/uefaconferenceleague/match/2050350/)

## Angoli prepartita

Negli 815 incontri utilizzabili, 58 hanno raggiunto i 15 angoli (7,1%). Nel 2025/26 sono 12 su 252. Ho ricontrollato anche le 2.804 partite regolamentari del precedente archivio di Serie A e Champions. Lo stesso controllo sugli zeri ne esclude 87. Restano 1.919 gare di Serie A e 798 di Champions, per un totale di 3.532 gare nelle quattro competizioni dopo questo filtro. La verifica qui sotto riguarda Europa League e Conference.

Ho confrontato tre stime prepartita. La prima usa la media della competizione. La seconda usa angoli fatti e concessi dalle squadre, in casa e in trasferta, con attenuazione verso la media della coppa. La terza aggiunge una distribuzione binomiale negativa per la variabilità dei totali. La dispersione usa soltanto le partite fino al 2024/25. Le medie si aggiornano con le gare precedenti già disponibili, assumendo tre ore dopo il calcio d'inizio. [Studio sulle distribuzioni degli angoli](https://research.polyu.edu.hk/en/publications/forecasting-number-of-corner-kicks-taken-in-association-football-/)

Le tre cifre in ogni cella sono nell'ordine **media della coppa / squadre / squadre con dispersione**. Per log loss e Brier un valore più basso indica previsioni migliori.

| Coppa | Test | Over | Esiti osservati | Log loss | Brier |
|---|---|---:|---:|---:|---:|
| Europa League | 2025/26 | 9,5 | 67/144 | 0,692 / 0,700 / 0,698 | 0,250 / 0,253 / 0,252 |
| Europa League | 2025/26 | 14,5 | 7/144 | 0,195 / 0,185 / 0,191 | 0,046 / 0,045 / 0,046 |
| Europa League | 2026/27 parziale | 9,5 | 32/72 | 0,688 / 0,652 / 0,655 | 0,247 / 0,230 / 0,231 |
| Europa League | 2026/27 parziale | 14,5 | 7/72 | 0,334 / 0,340 / 0,327 | 0,090 / 0,091 / 0,089 |
| Conference League | 2025/26 | 9,5 | 51/108 | 0,695 / 0,676 / 0,677 | 0,251 / 0,242 / 0,242 |
| Conference League | 2025/26 | 14,5 | 5/108 | 0,188 / 0,187 / 0,189 | 0,044 / 0,044 / 0,045 |
| Conference League | 2026/27 parziale | 9,5 | 25/54 | 0,690 / 0,697 / 0,697 | 0,248 / 0,252 / 0,252 |
| Conference League | 2026/27 parziale | 14,5 | 6/54 | 0,377 / 0,394 / 0,384 | 0,102 / 0,103 / 0,103 |

Sull'Over 9,5 il profilo squadra aiuta in Conference nel 2025/26 e in Europa League nel 2026/27 parziale. Negli altri due confronti prevale la media della coppa. Sull'Over 14,5 il profilo squadra migliora la log loss 2025/26, con soli 7 e 5 esiti positivi. Nel parziale 2026/27 su questa soglia la variante con dispersione ottiene la log loss più bassa in Europa League, mentre in Conference prevale la media della coppa. La scelta cambia fra stagioni e metriche. La prova è preliminare e andrebbe ripetuta con dati prepartita dei campionati nazionali, dove le squadre giocano più spesso.

Nel turno, in 29 gare su 36 almeno una delle squadre aveva meno di quattro precedenti osservati nella stessa coppa e nella sede pertinente, casa o trasferta. Per esempio, il CSKA Sofia aveva un solo precedente utilizzabile in trasferta. È un motivo concreto per integrare i campionati nazionali, tenendo conto del livello degli avversari.

| Squadra | Gare di campionato reperite nel calendario 2026 prima del turno | Tabellini a campione con il campo angoli |
|---|---:|---:|
| Celtic | 31 | 3/3 |
| Besiktas | 27 | 3/3 |
| Panathinaikos | 27 | 3/3 |
| CSKA Sofia | Da verificare | Query respinta (HTTP 400) |

Il controllo dei tabellini nazionali è un campione di tre gare per squadra, senza una verifica di copertura sull'intero calendario.

## Angoli in diretta

Nel turno, il numero di eventi con minuto coincide con il totale finale in tutte le 36 gare. Nelle tre stagioni precedenti accade in 107 su 696. A parità di coppa e angoli al 65:00, per ognuno dei due esempi c'è una sola gara storica con sequenza riconciliata. È una base troppo piccola per stimare una probabilità live affidabile. La prossima raccolta deve confrontare i totali anche per squadra e distinguere i corner assegnati dagli eventuali corner non battuti, in base alla definizione del mercato.

I minuti ricostruiti dai tabellini conclusi servono allo storico. Per testare il live servono fotografie acquisite durante le gare, con minuto, angoli già battuti, punteggio, espulsioni e orario in cui la quota era disponibile. Il bersaglio sarebbe il numero di angoli *rimanenti* da quel momento.

## Ammoniti e tris nelle due coppe

Gli archivi FotMob già presenti contengono 573 gare di Europa League e 483 di Conference, fino al 22 ottobre 2026. Sono 21.120 presenze da titolare dei giocatori di movimento. Ho confrontato una regressione con ruolo e fattore casa contro la stessa regressione che aggiunge i tassi storici personali di gialli e falli per 90 minuti. L'allenamento usa stagioni precedenti. Le formazioni sono quelle effettive archiviate e le etichette comprendono eventuali supplementari. Per il top 3 uso la media attesa in caso di pari merito, così l'ordine degli ID dei giocatori non determina il risultato.

| Coppa | Test | Gare | Log loss | Gialli medi fra i primi tre |
|---|---|---:|---:|---:|
| Europa League | 2025/26 | 189 | 0,4336 → 0,4258 | 0,558 → 0,698 |
| Europa League | 2026/27 parziale | 54 | 0,4211 → 0,4158 | 0,501 → 0,500 |
| Conference League | 2025/26 | 153 | 0,4669 → 0,4616 | 0,565 → 0,776 |
| Conference League | 2026/27 parziale | 36 | 0,4354 → 0,4335 | 0,607 → 0,514 |

Lo storico personale migliora la stima media in tutte e quattro le prove. Nel parziale della Conference peggiora però la selezione dei tre giocatori. Il test confronta un riferimento minimo, con un obiettivo individuale. Per adottare i tris servono un confronto con il modello completo, regole coerenti per tempi regolamentari e sostituti, e verifica dedicata sulle nuove gare con formazioni disponibili prima del calcio d'inizio.

## Marcatori e quote

Ho riconciliato il numero di gol con il punteggio e trovato nel tabellino l'identità dei marcatori ordinari in 820 gare su 822, comprese tutte le 36 del turno. Per collegare i gol ai minuti FotMob ho richiesto stesso incontro, squadra e identità verificabile per tutti i marcatori. Restano 673 partite e 1769 gol individuali. Gli autogol entrano nel punteggio e restano fuori dall'esito individuale. Le gare del 4 e 5 novembre sono successive allo storico FotMob disponibile per questo test.

La prova stima la probabilità di almeno un gol dato che il giocatore parte titolare. Entrambe le varianti stimano i minuti da partite precedenti. La prima usa il tasso di gol per ruolo, la seconda aggiunge il tasso personale delle presenze passate nelle due coppe, anche da subentrato. Lo storico personale con pochi minuti pesa meno. Le colonne dei punteggi confrontano ruolo → profilo personale.

| Coppa | Test | Gare | Titolari di movimento | Con storico personale | Log loss | Brier |
|---|---|---:|---:|---:|---:|---:|
| Europa League | 2025/26 | 118 | 2360 | 88,1% | 0,2933 → 0,2907 | 0,0820 → 0,0811 |
| Europa League | 2026/27 parziale | 49 | 980 | 74,3% | 0,3105 → 0,3109 | 0,0881 → 0,0882 |
| Conference League | 2025/26 | 94 | 1880 | 83,4% | 0,2754 → 0,2742 | 0,0756 → 0,0752 |
| Conference League | 2026/27 parziale | 23 | 460 | 53,5% | 0,3017 → 0,3028 | 0,0853 → 0,0851 |

Lo storico personale migliora entrambi i punteggi nel 2025/26. Nel 2026/27 parziale la log loss peggiora in entrambe le coppe. La copertura personale scende al 53% in Conference. C'è anche una selezione del campione: nel test 2025/26 le 212 gare riconciliate avevano 2,40 gol di media, mentre le 40 escluse ne avevano 3,33. Per proseguire serve recuperare copertura, soprattutto con le presenze nei campionati nazionali, e valutare forza offensiva, tiri e rigori come variabili successive.

Il confronto delle quote richiede un archivio dello stesso mercato, della linea esatta e dell'orario di rilevazione. Nei tabellini controllati non ho verificato una serie storica adeguata di quote per Over 14,5 e marcatori. I punteggi del modello misurano l'errore sulle probabilità. Per misurare un eventuale vantaggio rispetto alla quota serve una verifica separata, con stime e quote registrate prima dell'evento.

## Come organizzare EXTRA

La scheda per partita può raccogliere tutte le stime disponibili per quell'incontro. Per ogni mercato conserva la previsione originale con il suo orario, la quota osservata se verificabile, la linea, l'esito e il riferimento al tabellino. Nella vista Esiti si può aggiungere la sequenza degli angoli, quando riconciliata. Le schede sono generate dai modelli e l'inserimento di una scelta personale richiede una richiesta esplicita del proprietario.

Il percorso di lavoro che propongo è:

1. **Angoli prepartita.** Costruire un archivio comune con le quattro competizioni, integrare lo storico nazionale delle squadre e fissare un confronto temporale per più soglie. Conservare anche le partite che non raggiungono la linea.
2. **Ammoniti.** Provare il modello completo delle coppe in Europa League e Conference con verifiche distinte. Per i tris, valutare anche la frequenza con cui si verificano insieme gli esiti dei tre giocatori.
3. **Marcatori.** Verificare il collegamento fra fonti e preparare un campione con gol attribuiti e minuti giocati. Archiviare le formazioni future prima delle partite per testare la stima del minutaggio.
4. **Diretta e doppie.** Iniziare a registrare istanti live e quote sui nuovi turni. Valutare le combinazioni quando esiste un confronto con le singole probabilità e una stima della dipendenza fra esiti.

## Tutte le 36 gare

Angoli e gialli sono riportati come casa + trasferta. La colonna 65:00 usa il cronometro degli eventi strutturati. I gialli sono il conteggio del tabellino, mentre la prova sui titolari usa l'esito binario per giocatore.

| Coppa | Data | Partita | Finale | Angoli | Angoli al 65:00 | Gialli | Fonte |
|---|---|---|---:|---:|---:|---:|---|
| Europa League | 04/11 | Stade Rennais – Olympiacos | 0–0 | 3+3 = 6 | 5 | 1+0 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915551/olympiacos-stade-rennais) |
| Europa League | 05/11 | AC Milan – Ferencvaros | 0–2 | 2+4 = 6 | 4 | 2+1 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915534/ferencvaros-ac-milan) |
| Europa League | 05/11 | Anderlecht – RB Salzburg | 2–0 | 5+4 = 9 | 7 | 4+3 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915538/rb-salzburg-anderlecht) |
| Europa League | 05/11 | Crystal Palace – TSG Hoffenheim | 1–1 | 5+5 = 10 | 7 | 4+3 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915526/tsg-hoffenheim-crystal-palace) |
| Europa League | 05/11 | Levski Sofia – Jagiellonia Bialystok | 1–0 | 4+5 = 9 | 7 | 3+3 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915536/jagiellonia-bialystok-levski-sofia) |
| Europa League | 05/11 | Lillestrom – Viktoria Plzen | 0–1 | 3+6 = 9 | 6 | 2+4 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915527/viktoria-plzen-lillestrom) |
| Europa League | 05/11 | NEC Nijmegen – Omonia Nicosia | 3–1 | 5+2 = 7 | 4 | 1+0 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915535/omonia-nicosia-nec-nijmegen) |
| Europa League | 05/11 | Real Sociedad – Lyon | 1–1 | 5+6 = 11 | 7 | 3+4 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915537/lyon-real-sociedad) |
| Europa League | 05/11 | Sparta Prague – AFC Bournemouth | 1–3 | 3+10 = 13 | 7 | 2+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915528/afc-bournemouth-sparta-prague) |
| Europa League | 05/11 | AZ Alkmaar – Juventus | 1–2 | 4+2 = 6 | 3 | 1+3 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915529/juventus-az-alkmaar) |
| Europa League | 05/11 | Bayer Leverkusen – Marseille | 0–1 | 6+2 = 8 | 5 | 1+3 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915533/marseille-bayer-leverkusen) |
| Europa League | 05/11 | Benfica – Lech Poznan | 3–1 | 6+3 = 9 | 8 | 2+1 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915525/lech-poznan-benfica) |
| Europa League | 05/11 | Celta Vigo – Union St.-Gilloise | 1–2 | 11+1 = 12 | 4 | 1+1 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915531/union-st-gilloise-celta-vigo) |
| Europa League | 05/11 | Celtic – Besiktas | 3–2 | 5+7 = 12 | 10 | 1+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915522/besiktas-celtic) |
| Europa League | 05/11 | Hapoel Be'er – OFI Crete | 0–2 | 4+2 = 6 | 2 | 3+1 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915532/ofi-crete-hapoel-beer) |
| Europa League | 05/11 | SK Sturm Graz – NK Celje | 2–3 | 12+2 = 14 | 9 | 1+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915524/nk-celje-sk-sturm-graz) |
| Europa League | 05/11 | Sunderland – Dinamo Zagreb | 0–2 | 5+3 = 8 | 6 | 3+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915523/dinamo-zagreb-sunderland) |
| Europa League | 05/11 | Torreense – Ararat-Armenia | 3–2 | 4+6 = 10 | 7 | 3+5 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915530/ararat-armenia-torreense) |
| Conference League | 05/11 | AGF – Braga | 0–0 | 2+7 = 9 | 7 | 2+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915831/braga-agf) |
| Conference League | 05/11 | Atalanta – Kairat Almaty | 1–1 | 9+2 = 11 | 8 | 3+4 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915830/kairat-almaty-atalanta) |
| Conference League | 05/11 | FC Midtjylland – Ajax Amsterdam | 1–6 | 1+8 = 9 | 9 | 1+0 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915829/ajax-amsterdam-fc-midtjylland) |
| Conference League | 05/11 | FC Thun – Heart of Midlothian | 3–1 | 4+5 = 9 | 5 | 4+1 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915828/heart-of-midlothian-fc-thun) |
| Conference League | 05/11 | KuPS Kuopio – KAA Gent | 0–0 | 3+7 = 10 | 6 | 1+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915826/kaa-gent-kups-kuopio) |
| Conference League | 05/11 | Lincoln Red Imps – Hajduk Split | 1–0 | 0+8 = 8 | 5 | 3+4 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915742/hajduk-split-lincoln-red-imps) |
| Conference League | 05/11 | Mjällby AIF – Borac Banja Luka | 2–0 | 4+6 = 10 | 9 | 0+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915741/borac-banja-luka-mjallby-aif) |
| Conference League | 05/11 | Red Star Belgrade – Inter D'Escaldes | 2–1 | 6+3 = 9 | 4 | 2+3 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915827/inter-descaldes-red-star-belgrade) |
| Conference League | 05/11 | Trabzonspor – SC Freiburg | 0–1 | 7+4 = 11 | 5 | 2+3 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915825/sc-freiburg-trabzonspor) |
| Conference League | 05/11 | AS Monaco – FC Nordsjælland | 2–0 | 4+3 = 7 | 5 | 1+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915824/fc-nordsjælland-as-monaco) |
| Conference League | 05/11 | CSU Craiova – Egnatia | 2–0 | 5+6 = 11 | 8 | 4+0 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915817/egnatia-csu-craiova) |
| Conference League | 05/11 | F.C. København – Iberia 1999 | 2–1 | 3+2 = 5 | 5 | 2+5 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915740/iberia-1999-fc-københavn) |
| Conference League | 05/11 | FC Lugano – Kauno Zalgiris | 3–0 | 4+2 = 6 | 5 | 1+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915823/kauno-zalgiris-fc-lugano) |
| Conference League | 05/11 | FC Twente – Pafos | 3–1 | 12+1 = 13 | 5 | 1+0 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915822/pafos-fc-twente) |
| Conference League | 05/11 | Getafe – Brighton & Hove Albion | 0–1 | 5+5 = 10 | 6 | 1+4 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915821/brighton-hove-albion-getafe) |
| Conference League | 05/11 | Panathinaikos – CSKA Sofia | 2–1 | 12+4 = 16 | 13 | 4+0 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915819/cska-sofia-panathinaikos) |
| Conference League | 05/11 | Riga FC – Jablonec | 1–1 | 5+5 = 10 | 6 | 1+2 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915818/jablonec-riga-fc) |
| Conference League | 05/11 | Sint-Truidense – SK Brann | 1–1 | 4+7 = 11 | 5 | 1+1 | [ESPN](https://www.espn.com/soccer/match/_/gameId/401915820/sk-brann-sint-truidense) |

## Totali angoli esclusi

- Ferencvaros–Cukaricki Belgrade, tabellino 0+0 e 8 corner in cronaca. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/687731/cukaricki-belgrade-ferencvaros)
- Cukaricki Belgrade–Racing Genk, tabellino 0+0 e 9 corner in cronaca. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/687756/racing-genk-cukaricki-belgrade)
- Fiorentina–Cukaricki Belgrade, tabellino 0+0 e 6 corner in cronaca. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/687774/cukaricki-belgrade-fiorentina)
- Cukaricki Belgrade–Fiorentina, tabellino 0+0 e 7 corner in cronaca. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/687777/fiorentina-cukaricki-belgrade)
- Cukaricki Belgrade–Ferencvaros, tabellino 0+0 e 10 corner in cronaca. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/687806/ferencvaros-cukaricki-belgrade)
- Racing Genk–Cukaricki Belgrade, tabellino 0+0 e 6 corner in cronaca. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/687814/cukaricki-belgrade-racing-genk)
- Anderlecht–TSG Hoffenheim, tabellino 0+0 e 11 corner in cronaca. [Tabellino e cronaca ESPN](https://www.espn.com/soccer/match/_/gameId/720502/tsg-hoffenheim-anderlecht)
