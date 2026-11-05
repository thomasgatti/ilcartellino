# Studio degli 1 contro 1 — primo campione

5 novembre 2026 · ramo `codex/studio-duelli-1v1` · base `4ef307827be2ab64e7074717a424195fa42bee65`.

**Esito: è fattibile raccogliere contatti sanzionati fra coppie e una parte della loro cronologia. Prima di allenare nuove variabili vanno risolti gli alias e le incongruenze della fonte. Nessuna probabilità o file di produzione è stato cambiato.**

## Campione e metodo

Quaranta incontri conclusi, dieci per ogni combinazione competizione/stagione. La selezione, stabilita da date e ordinamento degli id prima dell'analisi degli esiti, è ripetibile con `pilot.config.json`. È un campione di convenienza vicino alle partite indicate dall'utente, non rappresentativo di un'intera stagione. Ogni risposta grezza è conservata nella cache locale e identificata in `fonti.json` con URL e SHA-256.

| Competizione | Stagione | Partite | Falli nel tabellino | Episodi estratti | Coppie accettate | Gialli associati temporalmente |
|---|---|---:|---:|---:|---:|---:|
| Champions | 2026/2027 | 10 | 223 | 211 | 183 | 18 |
| Champions | 2025/2026 | 10 | 248 | 237 | 220 | 29 |
| Serie A | 2026/2027 | 10 | 234 | 217 | 202 | 25 |
| Serie A | 2025/2026 | 10 | 265 | 257 | 244 | 30 |

Totale: **970 falli nel tabellino**, 922 episodi estratti da 1831 righe della cronaca, **849 coppie accettate**. Le doppie descrizioni fallo/punizione non vengono contate due volte. La differenza contabile di 48 non dimostra altrettante omissioni: mani, rigori e altre differenze di codifica devono ancora essere classificate. Non equivale a una misura di accuratezza.

## Problemi trovati e trattamento

- 73 episodi accantonati dai dati accettati: 64 hanno grafie o alias non verificati; 10 indicano nel testo un altro giocatore della rosa rispetto ai partecipanti strutturati. Le categorie si sovrappongono in un episodio. Non si sceglie automaticamente quale rappresentazione abbia ragione.
- Esempio concreto: Feyenoord–Inter, 48': il testo indica Nicolò Barella, il campo strutturato Hakan Çalhanoglu. Episodio escluso. Altri casi e fonti sono in `revisioni.json`.
- 2 episodi hanno più id per stessa coppia e istante; 2 hanno coordinate discordi, lasciate inutilizzate. Non è stata validata la convenzione delle coordinate contro FotMob.
- 1 riga da fallo è priva dei metadati necessari alla ricostruzione automatica della coppia.
- 337 cambi hanno testo e coppia entrato/uscito coerenti; 35 restano da verificare. Non sono trattati come assenze di sostituzione.

Le coppie vengono risolte nella rosa con id ESPN, squadra e nome esatto o iniziale più cognome univoci. Non viene creato un collegamento stabile all'id FotMob: il file dell'app espone nomi abbreviati, quindi serve un ulteriore controllo prima di estendere lo storico.

## I casi indicati dall'utente

| Giocatore | Abbinamento nel file attuale dell'app | Contatto del giallo ricostruito |
|---|---|---|
| Ian Maatsen | Lamine Yamal | Fallo su Yamal all'11'; cartellino 5 secondi dopo |
| Ayden Heaven | Matías Soulé | Fallo su Soulé al 70'; cartellino 7 secondi dopo |
| Harry Maguire | Rodrigo Mora | Fallo su Santiago Castro al 78'; cartellino 4 secondi dopo |

Il cambio Castro per Malen è coerente fra testo e metadati e precede di 14 secondi il fallo di Maguire. È un esempio della necessità di aggiornare gli avversari dopo i cambi; non prova che Maguire abbia marcato esclusivamente Castro o che Malen non lo abbia impegnato prima.

Fonti grezze: [Barcelona–Aston Villa](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915387), [Manchester United–Roma](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915308).

## Quanto rappresenta l'abbinamento attuale

Per 10 incontri del campione è disponibile anche una riga corrispondente nell'app: 189/200 giocatori abbinati in modo univoco alla rosa ESPN. Gli altri nomi restano elencati nella sintesi.

Ci sono 18 contatti fallo–giallo associati temporalmente in quegli incontri, 16 con avversario dell'app risolto. In 6 casi il nome coincide. **Questo rapporto non misura l'accuratezza del modello**: i file sono attuali e non certificati alla vigilia; un giocatore può commettere fallo su chi non marca abitualmente; la fonte non osserva tutti gli 1 contro 1; i sostituti non erano necessariamente nel file prepartita.

Il codice di produzione riassume la zona con posizioni abituali delle ultime otto partite e una media dei falli subiti degli avversari vicini. L'etichetta `vs` mostra il nome con maggiore peso, mentre la variabile usa una media: il nome visualizzato e l'intero segnale del modello non sono la stessa cosa.

La conclusione operativa è raccogliere più avversari plausibili per giocatore e intervallo, conservandone i pesi e l'incertezza. Per valutare il rischio specifico del duello serve testare anche l'interazione fra capacità dell'attaccante di provocare falli/cartellini e vulnerabilità del difensore. La sola quantità media di dribbling avversari era già stata provata e scartata nel RUNBOOK.

## Live

102 cartellini su 155 eventi gialli hanno un solo fallo coerente dello stesso autore e periodo nei 30 secondi precedenti, con motivo esplicito da fallo. È un'etichetta candidata, da verificare, non una certezza causale. I restanti comprendono motivi diversi, metadati insufficienti e associazioni non univoche.

La cronologia consente di ricostruire contatori prima di un istante fisso della gara e riduce la dipendenza dalle registrazioni del PC. Tuttavia la copertura non è completa e non si conosce il ritardo di disponibilità degli eventi: per il live servono validazione del ritardo e segnali di dato mancante. `priorFouls` esclude gli eventi del momento della previsione e quelli successivi; il futuro test deve usare istanti fissi, non scelti subito prima del cartellino.

## Quote e completezza degli input

Il registro esistente contiene 180 titolari di un turno, 173 con quota, distribuiti su 9 partite. Confronto sullo stesso insieme di 173 righe; le quote sono già normalizzate dal codice rispetto al totale del modello.

| Peso delle quote | Log loss, minore è meglio |
|---:|---:|
| 0% | 0,45824 |
| 25% | 0,45242 |
| 50% | 0,44728 |
| 75% | 0,44282 |
| 100% | 0,43904 |

Non è una misura indipendente delle probabilità grezze del bookmaker. Non si ottimizza il peso sullo stesso turno e non viene modificato `W_MARKET`. Il campione va esteso con previsioni, quote, orario e versione del modello archiviati prima del calcio d'inizio.

Nel file attuale 5 partite di Serie A hanno tutti gli abbinamenti `vs` vuoti: Napoli - Lazio; Genoa - Milan; Monza - Atalanta; Inter - Como; Fiorentina - Juventus. Questo segnala un problema nell'informazione esportata, non dimostra che il segnale interno del modello sia assente. I valori sostituto nulli usano invece il ripiego per ruolo previsto dal sito: non sono automaticamente dati rotti. Le etichette di poca esperienza rimangono un elenco da approfondire, non una misura quantitativa di copertura della carriera.

## Prossimo esperimento e criteri di accettazione

1. Verificare gli alias per id con un secondo riscontro e classificare il divario rispetto ai tabellini. Rivedere separatamente i 10 episodi con due identità diverse; non creare correzioni manuali alle probabilità.
2. Archiviare formazione, avversari candidati, probabilità e quote prima del calcio d'inizio. Il nome dell'avversario non deve essere ricavato dal fallo futuro che porta al cartellino.
3. Estendere a più stagioni e provare tre famiglie separatamente: assegnazione dell'avversario dalla formazione; gialli provocati dall'attaccante con regolarizzazione per piccoli campioni; interazione attaccante–difensore. Le medie e le variabili storiche devono usare soltanto partite precedenti.
4. Confrontare ogni candidato con la catena vera di produzione in test stagione per stagione; selezione e regolazione sulle sole stagioni precedenti. Tenere soltanto guadagni di log loss almeno circa 0,0002 senza peggiorare i primi tre per partita, con risultati per competizione e stagione e incertezza per partita.

Questo campione ha completato la verifica preliminare e il confronto descrittivo. **Non è stato allenato un nuovo modello e non è dimostrato alcun guadagno predittivo degli 1 contro 1.**

## Verifiche eseguite

Diciotto test superati: duplicati, identità ambigue, dati discordi, coordinate assenti, cartellini non da fallo, associazioni temporali, separazione dei tempi, esclusione di informazione futura, stesse righe nel confronto quote, tre casi reali e composizione del campione. L'audit verifica anche gli id e gli hash delle fonti archiviate. Nessun file dell'interfaccia è stato modificato, quindi non è stata eseguita una build del sito.

## Elenco delle partite

| Competizione | Stagione | Data UTC | Incontro (ospite at casa) | Fonte ESPN |
|---|---|---|---|---|
| Champions | 2026/2027 | 2026-11-03 | Sporting CP at Shakhtar Donetsk | [401915310](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915310) |
| Champions | 2026/2027 | 2026-11-03 | VfB Stuttgart at Galatasaray | [401915311](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915311) |
| Champions | 2026/2027 | 2026-11-03 | Internazionale at Feyenoord Rotterdam | [401915307](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915307) |
| Champions | 2026/2027 | 2026-11-03 | AS Roma at Manchester United | [401915308](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915308) |
| Champions | 2026/2027 | 2026-11-03 | Paris Saint-Germain at Villarreal | [401915309](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915309) |
| Champions | 2026/2027 | 2026-11-03 | Lille at Bodo/Glimt | [401915384](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915384) |
| Champions | 2026/2027 | 2026-11-03 | Slovan Bratislava at LASK Linz | [401915385](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915385) |
| Champions | 2026/2027 | 2026-11-03 | Bayern Munich at Atlético Madrid | [401915386](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915386) |
| Champions | 2026/2027 | 2026-11-03 | Aston Villa at Barcelona | [401915387](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915387) |
| Champions | 2026/2027 | 2026-11-04 | Liverpool at Fenerbahce | [401915382](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915382) |
| Champions | 2025/2026 | 2025-11-04 | Arsenal at Slavia Prague | [757707](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757707) |
| Champions | 2025/2026 | 2025-11-04 | Eintracht Frankfurt at Napoli | [757708](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757708) |
| Champions | 2025/2026 | 2025-11-04 | Bayern Munich at Paris Saint-Germain | [757709](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757709) |
| Champions | 2025/2026 | 2025-11-04 | Sporting CP at Juventus | [757710](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757710) |
| Champions | 2025/2026 | 2025-11-04 | Union St.-Gilloise at Atlético Madrid | [757711](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757711) |
| Champions | 2025/2026 | 2025-11-04 | AS Monaco at Bodo/Glimt | [757712](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757712) |
| Champions | 2025/2026 | 2025-11-04 | PSV Eindhoven at Olympiacos | [757713](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757713) |
| Champions | 2025/2026 | 2025-11-04 | Real Madrid at Liverpool | [757714](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757714) |
| Champions | 2025/2026 | 2025-11-04 | F.C. København at Tottenham Hotspur | [757715](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757715) |
| Champions | 2025/2026 | 2025-11-05 | Chelsea at FK Qarabag | [757716](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=757716) |
| Serie A | 2026/2027 | 2026-10-31 | Monza at Bologna | [401874798](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874798) |
| Serie A | 2026/2027 | 2026-10-31 | AS Roma at Udinese | [401874990](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874990) |
| Serie A | 2026/2027 | 2026-10-31 | Internazionale at AC Milan | [401874795](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874795) |
| Serie A | 2026/2027 | 2026-11-01 | Venezia at Como | [401875002](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401875002) |
| Serie A | 2026/2027 | 2026-11-01 | Torino at Frosinone | [401874782](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874782) |
| Serie A | 2026/2027 | 2026-11-01 | Cagliari at Lazio | [401874983](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874983) |
| Serie A | 2026/2027 | 2026-11-01 | Genoa at Lecce | [401874968](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874968) |
| Serie A | 2026/2027 | 2026-11-01 | Napoli at Juventus | [401874949](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874949) |
| Serie A | 2026/2027 | 2026-11-02 | Fiorentina at Sassuolo | [401874963](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874963) |
| Serie A | 2026/2027 | 2026-11-02 | Parma at Atalanta | [401874971](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=401874971) |
| Serie A | 2025/2026 | 2025-11-01 | Atalanta at Udinese | [736881](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736881) |
| Serie A | 2025/2026 | 2025-11-01 | Como at Napoli | [736875](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736875) |
| Serie A | 2025/2026 | 2025-11-01 | Juventus at Cremonese | [736880](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736880) |
| Serie A | 2025/2026 | 2025-11-02 | Internazionale at Hellas Verona | [736883](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736883) |
| Serie A | 2025/2026 | 2025-11-02 | Lecce at Fiorentina | [736879](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736879) |
| Serie A | 2025/2026 | 2025-11-02 | Pisa at Torino | [736882](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736882) |
| Serie A | 2025/2026 | 2025-11-02 | Bologna at Parma | [736874](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736874) |
| Serie A | 2025/2026 | 2025-11-02 | AS Roma at AC Milan | [736876](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736876) |
| Serie A | 2025/2026 | 2025-11-03 | Genoa at Sassuolo | [736878](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736878) |
| Serie A | 2025/2026 | 2025-11-03 | Cagliari at Lazio | [736877](https://site.api.espn.com/apis/site/v2/sports/soccer/ita.1/summary?event=736877) |

## Riga per il passaggio a Claude

Sul ramo `codex/studio-duelli-1v1` aggiunta una ricerca ripetibile su 40 partite ESPN: 849 coppie fallo autore/vittima accettate, 102 associazioni temporali fallo–giallo, verifiche dei cambi e audit delle quote; modello, dati pubblicati e artifact Claude invariati.
