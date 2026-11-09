# Studio degli 1 contro 1 — seconda fase, 5 novembre 2026

Nessuna delle tre ipotesi numeriche supera i criteri del progetto. Il modello e le probabilità pubblicate restano invariati. La pulizia delle identità rende però più utile l'archivio degli episodi reali, necessario per studiare chi provoca i cartellini.

## Qualità dei dati: 40 partite ESPN

Le coppie utilizzabili passano da 849 a **898**: 50 recuperate grazie a grafie, secondi nomi e alias verificati, meno un episodio escluso perché indicato sia come mano sia come fallo. Il registro contiene 18 identità per id ESPN; 17 hanno un riscontro su club, federazione o scheda statistica, una espone entrambe le forme già nel profilo ESPN. Nessuna somiglianza approssimativa decide fra due giocatori. Le schede di Sofascore sono riscontri secondari, distinti dalle fonti dei club. Fonti, date di nascita e hash dei profili sono in identity-registry.json; la verifica del sito indipendente è manuale e documentata, non automatica.

Restano esclusi 24 falli: 13 con alias non verificato, 10 con nomi di giocatori diversi fra testo e metadati, uno con tipo mano/fallo discordante. I due casi di coordinate discordanti restano inutilizzabili per la posizione. Le sostituzioni verificate salgono da 337 a **354 su 372**. Le associazioni temporali univoche fallo–giallo salgono da 102 a **107 su 155 cartellini**: non sono una prova automatica della causa del cartellino.

Il tabellino riporta 970 falli: 922 episodi strutturati di tipo fallo + 41 mani strutturate aggiuntive + 5 rigori da mano descritti in cronaca + 1 fallo presente soltanto nel testo = **969**. Resta uno scarto di un fallo del Como in Como–Venezia (ESPN 401875002). Il tipo mano/fallo discordante di Mittelstädt al 60° di Galatasaray–Stoccarda compare una sola volta nel riscontro e viene escluso dalle coppie utilizzabili. Non si inventa una coppia per chiudere il totale.

Nei dieci incontri confrontabili con l'app sono riconosciuti 198 giocatori su 200; le due righe S. Camara restano ambigue. Il file attuale dell'app non è uno snapshot certificato prima della partita: questo confronto descrive i contatti, non misura la precisione prepartita.

## I casi proposti

| Episodio | Riscontro della cronaca |
|---|---|
| Maatsen–Yamal, Barcellona–Villa | Fallo a 629 secondi, giallo a 634: associazione temporale univoca. |
| Heaven–Soulé, United–Roma | Fallo a 4152 secondi, giallo a 4159. |
| Maguire, United–Roma | Il fallo collegato al giallo è su **Castro**, entrato per Malen 14 secondi prima del fallo. Il duello cambia con la sostituzione. |

Fonti dei casi: [cronaca ESPN Barcellona–Villa](https://www.espn.com/soccer/commentary/_/gameId/401915387), [cronaca ESPN United–Roma](https://www.espn.com/soccer/commentary/_/gameId/401915308). Gli hash delle risposte analizzate sono nel manifesto fonti.json della prima fase.

Questi episodi sostengono la necessità di seguire l'avversario effettivo e i cambi. Un fallo sanzionato non conta i dribbling senza fallo né tutti i minuti di marcatura.

## Tre prove numeriche su più stagioni

Letti 90 archivi FotMob, verificati contro il commit dati cdcd037ab30cc8e578b69b690dd11aa04c065b61: **21.559 partite** di contesto. Ricostruite 47.620 righe Serie A e 16.320 Champions; il test comprende **46.240 righe giocatore–partita in 2.312 incontri**. Non sono 46.240 giocatori distinti. Il 2026/27 è parziale.

Le ipotesi fissate sono: posizione della formazione della gara al posto della posizione abituale delle ultime otto presenze; soli due avversari più vicini; interazione fra dribbling tentati dagli avversari di zona e vulnerabilità del difendente. Non sono misure dirette di tutte le marcature reali. Il RUNBOOK aveva già scartato ruoli dalla formazione e dribbling aggregati: queste sono varianti circoscritte, non la scoperta di una variabile mai provata.

Allenamento sulle stagioni precedenti, test sulla successiva. Sviluppo: 2022/23–2024/25. Anni di verifica tenuti separati: 2025/26–2026/27. Regola: riduzione log loss almeno 0,0002 senza peggiorare il numero medio di ammoniti nei primi tre per partita. **Nessun candidato selezionato nello sviluppo**, sia in Serie A sia in Champions. Tutte le ipotesi vengono comunque riportate; gli anni di verifica sono ormai consultati e non vanno riutilizzati come dati mai visti per scegliere altre varianti.

Δ log loss: negativo significa meno errore; Δ top 3: positivo significa più ammoniti fra i primi tre, senza vincolo 2+1 né regola del sostituto.

### Sviluppo

| Competizione | Ipotesi | Δ log loss | Δ top 3 per gara |
|---|---|---:|---:|
| Serie A | formazione | +0,000063 | +0,0105 |
| Serie A | due_avversari | +0,000061 | +0,0105 |
| Serie A | interazione | +0,000169 | +0,0026 |
| Champions | formazione | +0,000024 | -0,0251 |
| Champions | due_avversari | +0,000170 | -0,0410 |
| Champions | interazione | +0,000156 | -0,0114 |

### Anni di verifica — risultati diagnostici

| Competizione | Ipotesi | Δ log loss | Δ top 3 per gara |
|---|---|---:|---:|
| Serie A | formazione | -0,000076 | -0,0229 |
| Serie A | due_avversari | -0,000062 | -0,0229 |
| Serie A | interazione | -0,000037 | +0,0063 |
| Champions | formazione | -0,000444 | -0,0198 |
| Champions | due_avversari | -0,000250 | -0,0278 |
| Champions | interazione | +0,000010 | +0,0000 |

La variante formazione in Champions riduce l'errore negli anni di verifica, ma perde circa 0,020 ammoniti nei primi tre per gara e non aveva superato lo sviluppo. Non basta per promuoverla. Le oscillazioni dei primi tre sono incerte: nel JSON sono riportati gli errori standard appaiati per partita, non intervalli bootstrap o garanzie di significatività.

## Cosa conclude e cosa resta da misurare

Il confronto usa le variabili FotMob della produzione e un fit logistico rifatto per stagione, **senza** fusione Sofascore, quote e calibrazione finale del sito. Eredita medie di campionato/ruolo e imputazioni del codice esistente che in alcuni punti usano l'archivio completo: c'è informazione aggregata futura e non è una validazione integralmente priva di contaminazione temporale. Gli aggiornamenti dei nuovi storici personali avvengono dopo ogni partita nell'ordine dei calci d'inizio; non è verificato l'orario di conclusione di gare sovrapposte. Le posizioni vengono da verticalLayout di FotMob, ma manca la prova che fossero pubblicate prima del calcio d'inizio. Questi limiti impediscono di trattare il test come autorizzazione al rilascio, anche in presenza di un miglioramento.

Non abbiamo ancora testato il vero indice di **gialli provocati dall'attaccante**: 107 associazioni su un campione di 40 gare servono a validare l'estrazione, non ad allenare un indice affidabile per Yamal, Soulé o altri singoli. Il passo utile è raccogliere più stagioni di episodi, mantenere i conflitti esclusi, costruire quel tasso soltanto con il passato e verificare l'eventuale guadagno sul modello completo. Prima di una futura validazione vanno resi temporali anche medie e imputazioni del riferimento e archiviati pronostici/formazioni prima delle gare. L'idea degli 1 contro 1 rimane aperta; le tre scorciatoie provate qui non giustificano cambi alle probabilità.

## Riproducibilità e consegna

Codice base modello: 8824f5e94d1198fb88f93493e171e1d401a21b1a. Manifesti: fotmob-manifest.json (90 blob git), model-manifest.json (8 sorgenti, SHA git e SHA-256 canonici), fonti.json (risposte ESPN), identity-registry.json (profili e riscontri). Input app/quote fissati al commit 4ef307827be2ab64e7074717a424195fa42bee65, con hash in audit-fase2.json. I dettagli esclusi sono in revisioni-fase2.json; tutti i risultati per stagione sono in esperimento-sintesi.json. Le risposte ESPN possono essere corrette dal fornitore: per una replica esatta occorre conservare le cache originarie e confrontare gli hash.

Verifica: 25 test superati, inclusi i due casi reali e il cambio Malen–Castro; audit completato su 40 gare; esperimento completo rieseguito dopo la separazione delle metriche, con risultati invariati. Sito, modello servito, main, dati remoti e workflow di pubblicazione non modificati.
