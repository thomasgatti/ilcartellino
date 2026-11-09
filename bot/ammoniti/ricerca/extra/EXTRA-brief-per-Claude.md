# EXTRA per Il Cartellino

Proposta di ricerca aggiornata al 6 novembre 2026. Il progetto attuale stima gli ammoniti in Serie A e Champions. EXTRA è una possibile sezione futura per angoli, marcatori e tris di ammoniti in altre competizioni, comprese Europa League, Conference League e singole grandi sfide di Ligue 1, LaLiga e Bundesliga.

## Decisioni del proprietario

- Le schede EXTRA mostrano stime del modello. Una scelta personale entra solo se il proprietario chiede esplicitamente a Codex o Claude di inserirla. In quel caso va indicata come scelta sua.
- La direzione di interfaccia da esplorare è la **scheda per partita**. Ogni scheda raccoglie le stime disponibili, la linea esatta del mercato, la quota osservata con orario se verificabile e l'esito. Lo storico conserva la previsione originale. Per gli angoli può mostrare anche l'andamento, se la sequenza è verificata.
- Il lavoro di questa fase è ricerca. Usare il repository e il RUNBOOK per capire l'implementazione attuale. Per una futura integrazione chiedere una richiesta esplicita del proprietario e lavorare su un ramo dedicato.

## Una base comune e tre percorsi di addestramento

Condividere identità di partite, squadre e giocatori, orari, fonti e archivio degli esiti. Definire bersagli, caratteristiche e test separati per mercato. Ogni stima usa soltanto informazioni già disponibili al momento in cui sarebbe stata emessa. Salvare pronostico, versione del modello e quota con orario prima dell'evento, quindi associare l'esito senza riscrivere la stima.

**Angoli prepartita.** Le due coppe hanno 822 tabellini raccolti e 815 gare usate dopo aver scartato sette totali a zero in contrasto con la cronaca. In Serie A e Champions si aggiungono 2.717 gare dopo lo stesso controllo, per una base di 3.532 gare nelle quattro competizioni. I test di Europa League e Conference confrontano media della coppa, profili squadra casa/trasferta e una variante con dispersione. I risultati cambiano per soglia e stagione. Nel 2025/26 ci sono solo 12 partite su 252 con almeno 15 angoli. Prossimo test concreto: integrare gli angoli fatti e concessi nei campionati nazionali e confrontare l'aggiunta con lo stesso riferimento, sulle stesse gare e con un periodo di verifica fissato prima.

**Angoli live.** Il 5 novembre Celtic–Beşiktaş aveva 10 angoli al 65:00 e ha chiuso a 12. Panathinaikos–CSKA Sofia era a 13 ed è arrivata a 16. Il bersaglio live è quanti angoli mancano da un istante preciso, considerando punteggio ed espulsioni. Nelle tre stagioni precedenti la sequenza di corner coincide con il totale in 107 gare su 696. Prima dell'addestramento, raccogliere fotografie live e riconciliare minuti e totali. Per le quote a soglia intera conservare anche la regola di liquidazione. Over 14,5 nel test significa almeno 15 angoli.

**Ammoniti e tris.** FotMob ha 573 gare di Europa League e 483 di Conference fino al 22 ottobre 2026. Il profilo personale migliora la log loss rispetto a ruolo e fattore casa nei quattro confronti. Nel parziale Conference il top 3 corretto per pari merito scende da 0,607 a 0,514 ammoniti medi per partita. Provare il modello completo separatamente per campionato e verificare sia probabilità individuali sia tris. Per una probabilità di tutti e tre serve una stima congiunta. I test forniti usano i titolari archiviati e includono eventuali supplementari, quindi prima dell'uso operativo va allineata la definizione dell'esito al mercato.

**Marcatori.** 673 gare riconciliate fra gol ESPN e minuti FotMob. Il test “segna almeno un gol se parte titolare” confronta tasso per ruolo e profilo personale, entrambi con minuti stimati dallo storico precedente. Il profilo personale migliora il 2025/26, mentre peggiora la log loss nel 2026/27 parziale. Nel 2025/26 le 212 gare riconciliate hanno 2,40 gol di media, contro 3,33 nelle 40 escluse. Recuperare gli abbinamenti e le presenze dei campionati nazionali prima di introdurre forza offensiva, tiri e rigori. Per le 36 gare del 4–5 novembre il FotMob fissato non contiene ancora i minuti.

## Da dove partire nella prossima sessione

1. Aprire `INDICE-DATI.md` e `analisi-extra-coppe-europee.md`. La tabella del turno contiene 36 fonti e la cronologia dei due esempi.
2. Controllare le serie di angoli per le squadre con poco storico in coppa. Il probe trova il campo in tre tabellini a campione per Celtic, Beşiktaş e Panathinaikos. La query tentata per il campionato bulgaro restituisce HTTP 400, quindi la copertura del CSKA Sofia resta da accertare.
3. Proporre un test prepartita che aggiunga il contesto nazionale, prima di valutare una scheda EXTRA reale. Il confronto con le quote richiede uno storico della stessa linea con timestamp. Le metriche attuali misurano la qualità delle probabilità.

Per il progetto leggere `README.md`, `AGENTS.md` e `bot/ammoniti/RUNBOOK.md` nel repository. La ricerca precedente sui duelli è nella [proposta di ricerca](https://github.com/thomasgatti/ilcartellino/pull/1). I dati della fase EXTRA si trovano nei pacchetti allegati.
