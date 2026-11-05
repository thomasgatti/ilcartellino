# Ricerca sugli attaccanti e sui cartellini

Terza fase, 5 novembre 2026. È stato creato uno storico utilizzabile dei falli sugli avversari seguiti da cartellini e un riferimento di test che evita le medie future. **Nessuno dei due nuovi indici supera i criteri prefissati nello sviluppo**: non sono state cambiate le probabilità pubblicate, il modello servito o l'interfaccia.

## Dati raccolti e controllati

Raccolte e archiviate **2816 cronache ESPN**, dal 2021/22 al 4 novembre 2026, selezionate per calendario e compatibilità con gli archivi FotMob fissati al commit cdcd037ab30cc8e578b69b690dd11aa04c065b61; nessun filtro sugli esiti. Tutte sono state verificate con SHA-256 e collegate a una gara FotMob tramite competizione, squadre nello stesso ordine e kickoff entro cinque minuti. Non si pretende copertura di ogni incontro ufficiale: sono le gare reperibili nell'archivio fissato, con stagione 2026/27 parziale.

Le 128.032 righe della cronaca sono deduplicate in **64.082 episodi di fallo**. Di questi 60.457 hanno una coppia affidabile nel fornitore, 58.661 anche entrambi gli id FotMob. Su 11.265 cartellini compaiono 7412 associazioni temporali univoche con un fallo; 7190 sono collegate a entrambi gli id. Non equivalgono a causalità dimostrata né contano i duelli senza fallo.

Le identità usano nomi/alias verificati nella stessa gara e squadra. Ancore di id stabili sono costruite solo da corrispondenze di nomi completi esatti, senza punteggi o cartellini per scegliere la persona. Sono stati esclusi due id ESPN in conflitto con più id FotMob: 208518, 276823. Le ancore possono usare metadati di identità dell'intero archivio; nessuna statistica futura di prestazione passa invece negli stati del modello. Restano errori e omissioni della fonte: 3344 episodi con alias non verificato e 102 con giocatori diversi fra testo e metadati, oltre alle altre anomalie nel JSON.

## Come sono stati costruiti gli indici

La conversione conta, per l'avversario, la quota di falli verificati che sono seguiti da un cartellino associabile. Richiede almeno 90% di coppie verificate e mappate, cartellini coerenti col tabellino e identità del cartellino affidabile. Un cartellino vicino non attribuibile censura il fallo; una discordanza con FotMob censura i trial di quell'autore. Dopo questi controlli restano **39.090 falli utilizzabili, 4773 positivi, in 1786 gare**. Gli altri non diventano negativi.

Il tasso per90 richiede inoltre copertura almeno 95%, scarto contabile entro 1 e attribuzione completa di tutti i cartellini a un fallo verificato oppure a un motivo esplicito diverso dal fallo, senza discordanza fra fonti. Restano **489 gare**. I minuti dei subentrati sono quelli realmente giocati; non sono attribuiti 90 minuti di esposizione a chi è entrato. Il sottoinsieme per90 è selezionato dalla qualità e attribuibilità delle cronache, quindi non è rappresentativo: può favorire gare più semplici da riconciliare. Un valore nullo in questo sottoinsieme non descrive tutta la carriera.

Le stime sono attenuate verso la media passata della competizione e del ruolo: 50 falli per la conversione e 900 minuti per il tasso per90. I piccoli prior iniziali e questi parametri sono espliciti nel codice, non ottimizzati dopo i risultati. Per il difendente gli indici degli avversari sono pesati per prossimità delle posizioni abituali delle ultime 8 gare disponibili. Il giocatore nuovo mantiene segnale neutro e indicatori separati della mancanza di storia. Lo storico è separato per competizione: non si scambiano senza verifica tassi Serie A e Champions.

### Esempi descrittivi degli attaccanti citati

| Giocatore | Competizione | Falli utilizzabili | Con giallo associato | Almeno 50 falli |
|---|---|---:|---:|---|
| Donyell Malen | Champions | 17 | 1 | no |
| Matias Soulé | Serie A | 93 | 10 | sì |
| Matias Soulé | Champions | 4 | 1 | no |
| Lamine Yamal | Champions | 62 | 13 | sì |
| Santiago Castro | Serie A | 100 | 7 | sì |
| Santiago Castro | Champions | 1 | 0 | no |
| Donyell Malen | Serie A | 20 | 4 | no |

Sono conteggi del sottoinsieme verificato, non classifiche definitive, stime causali o probabilità della prossima partita. Un singolo esempio, come Maatsen–Yamal o Heaven–Soulé, non basta a selezionare una variabile. L'episodio del giallo di Maguire resta collegato a Castro, entrato per Malen prima del fallo.

## Verifica temporale

Il riferimento ricostruisce19 variabili Serie A e 16 Champions della componente FotMob. Medie di lega, ruolo, stile, imputazioni e stato del contesto usano soltanto partite disponibili prima del kickoff. Anche le coordinate numeriche vengono dal passato, non dalla formazione della gara da prevedere. In mancanza di un orario di fine certificato si usa kickoff+3 ore, con confronto strettamente precedente: è una precauzione esplicita, non prova della latenza del fornitore.

Tutti i 21.559 incontri di contesto sono stati controllati; tutte le variabili risultano finite. Le file di test contengono gli stessi20 titolari per incontro in ogni variante: **46.240 righe in 2.312 gare**. Le rose dei titolari sono quelle archiviate a posteriori, non snapshot certificati prima delle gare. Il confronto esclude Sofascore, quote, calibrazione finale, vincolo2+1 e regola del sostituto: non valida l'intero sistema pubblicato.

Allenamento sulle stagioni precedenti; sviluppo 2022/23–2024/25. Il2025/26–2026/27 è una diagnostica retrospettiva, già consultata nelle fasi precedenti: non viene presentato come holdout cieco. Candidati e soglie sono fissati in attacker.protocol.json prima del primo fit. Le due varianti sono confrontate sia contro il riferimento sia contro un controllo che aggiunge solo la copertura dei dati, per distinguere il segnale dell'attaccante dalla semplice disponibilità dello storico.

Δ log loss negativo significa meno errore; Δtop3 positivo significa più ammoniti nei primi tre per gara. Gli errori standard appaiati per gara sono nel JSON; non sono intervalli bootstrap né dimostrazioni di significatività.

### Sviluppo

| Competizione | Indice | ΔLL base | Δtop3 base | ΔLL controllo | Δtop3 controllo |
|---|---|---:|---:|---:|---:|
| Serie A | conversione | +0,000183 | +0,0044 | +0,000113 | +0,0018 |
| Serie A | per90 | +0,000061 | -0,0018 | -0,000009 | -0,0044 |
| Champions | conversione | +0,000571 | +0,0114 | -0,000079 | +0,0114 |
| Champions | per90 | +0,000479 | +0,0114 | -0,000172 | +0,0114 |

### Diagnostica retrospettiva

| Competizione | Indice | ΔLL base | Δtop3 base | ΔLL controllo | Δtop3 controllo |
|---|---|---:|---:|---:|---:|
| Serie A | conversione | +0,000020 | +0,0000 | -0,000058 | +0,0125 |
| Serie A | per90 | +0,000133 | -0,0146 | +0,000056 | -0,0021 |
| Champions | conversione | -0,000189 | +0,0317 | -0,000225 | +0,0119 |
| Champions | per90 | +0,000075 | +0,0198 | +0,000039 | +0,0000 |

Nessuno supera nello sviluppo riduzione log loss almeno 0,0002 e primi tre non peggiori contro entrambi i riferimenti. La conversione in Champions presenta un segnale favorevole negli anni diagnostici, ma non passa lo sviluppo e il guadagno contro il riferimento è inferiore alla soglia: non viene promossa. I risultati sono stati rieseguiti dopo una correzione esclusivamente anagrafica del club Viking FK/Viking, che recupera tre gare 2026/27; nessun parametro o candidato è stato ritoccato sui risultati.

## Documento fornito e continuità del progetto

Il documento «I miei ammoniti: con che cosa addestriamo il modello», datato 2 novembre 2026 e riferito a v0.6, conferma definizioni e fonti. È stato confrontato con il codice successivo e il RUNBOOK: non si riutilizzano le sue vecchie metriche, calibrazioni e regole dei sostituti come se descrivessero il modello attuale. Il confronto è in confronto-documento.md. Le informazioni sugli aggiornamenti e sulle registrazioni live nel documento sono contesto storico, non istruzioni a lanciare pubblicazioni o programmi periodici.

## Cosa rimane al progetto

Un dataset compresso di osservazioni verificate, il manifesto delle fonti con hash, il ponte fra id, il riferimento temporale corretto e un esperimento ripetibile con risultati completi, compresi quelli sfavorevoli. Il modello del sito resta invariato. L'indice degli attaccanti potrà essere riverificato su nuove gare senza cercare a posteriori la variante che vince negli stessi anni.

È disponibile capture_predictions.mjs per conservare i pronostici pubblicati prima del kickoff, senza ricalcolarli e senza sovrascrivere registrazioni. La prima fotografia locale è in snapshots/2026-11-05.json:10 gare future, sorgente main fissata al commit 92466cbdfdde034a29978b62864ea5ae7d25f306, p0 e q originali. Non sono pronostici prodotti dai candidati rifiutati; sono il riferimento da confrontare con gli esiti successivi. Il timestamp locale non basta da solo a certificare la registrazione: il successivo commit remoto aiuta a documentare quando è stata conservata.

Verifica: 68 test superati tra estrazione, identità, ordine temporale, censura dei dati mancanti e acquisizione prepartita. Non sono state toccate interfaccia, probabilità, ramo dati, copie JS di produzione o app su Claude; nessun workflow di pubblicazione è stato avviato.
