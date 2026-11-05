# Studio degli 1 contro 1

Ricerca separata dal sito e dal modello servito. Node 20 o successivo, nessuna dipendenza da installare. Non esegue workflow né scrive previsioni.

Risultato corrente: **898 coppie utilizzabili su 922 falli** in 40 gare, 107 associazioni temporali fallo–giallo; tre ipotesi su 46.240 righe di test senza candidati ammessi. Leggere rapporto-fase2.md, audit-fase2.json, revisioni-fase2.json ed esperimento-sintesi.json.

rapporto.md, sintesi.json e revisioni.json conservano la prima fase (849 coppie): per riprodurre quei numeri usare il codice al commit 8824f5e94d1198fb88f93493e171e1d401a21b1a. La seconda fase recupera 50 coppie da nomi verificati ed esclude un nuovo conflitto mano/fallo: saldo +49.

## Riprodurre il pilota

Dalla cartella bot/ammoniti/ricerca/duelli di un checkout:

```sh
node collect_pilot.mjs
node assemble_identities.mjs
node --test duelli.test.mjs
node audit_pilot.mjs cache ../../../webapp/data.json ../../data/quote/valutazione.jsonl results-fase2 4ef307827be2ab64e7074717a424195fa42bee65 identity-registry.json
```

Gli input app e quote devono provenire dal commit indicato, anche se il checkout è più recente. fonti.json conserva URL e SHA-256 delle 52 risposte ESPN originarie; le risposte grezze rimangono nella cache ignorata da git. La raccolta riutilizza la cache; per un nuovo download usare un'altra cartella e passarla all'audit. Il fornitore può correggere gli eventi: una nuova raccolta non garantisce gli stessi hash.

assemble_identities.mjs controlla id e data di nascita di 18 profili selezionati e ricostruisce il registro con curated-identities.json. I riscontri indipendenti dei nomi sono stati letti manualmente e documentati con URL; alcuni sono schede statistiche secondarie, distinti dalle fonti dei club. Per una replica esatta mantenere il registro consegnato e i profili con gli hash originali; per una revisione confrontare il nuovo registro. collect_identities.mjs è facoltativo: legge una prima uscita dell'audit in results/ e scarica profili per scoperta; non abilita da solo tutti i nomi trovati.

## Riprodurre le prove temporali

Occorre un checkout autenticato con i commit fissati nei manifesti e il ramo dati già recuperato. La preparazione usa soltanto git show, verifica gli SHA e copia 90 archivi compressi e 8 sorgenti in input/, ignorato da git. Non modifica quel checkout né i rami remoti.

```sh
node prepare_fotmob.mjs /percorso/del/checkout
node matchup_experiment.mjs
node summarize_phase2.mjs
```

summarize_phase2.mjs richiede anche l'audit in results-fase2/. Il risultato completo con differenze appaiate per gara rimane in results/esperimento-1v1.json; la sintesi pubblicata conserva tutte le ipotesi e tutte le stagioni senza i blocchi individuali. Non occorre scaricare FotMob dal terminale o lanciare Actions.

Sviluppo: 2022/23–2024/25; anni di verifica separati: 2025/26–2026/27, allenando sulle stagioni precedenti. Nessuna variante supera nello sviluppo la soglia log loss −0,0002 e top3 non peggiore. Gli anni di verifica sono stati consultati per documentare tutti i risultati e non sono più dati mai visti per scegliere altre varianti.

Il confronto riguarda la componente FotMob ricostruita, senza Sofascore, quote, calibrazione finale, vincolo 2+1 e sostituti. Eredita alcune medie e imputazioni su archivio completo: contiene informazione aggregata futura. Le posizioni storiche della formazione non hanno timestamp prepartita certificato; l'ordine per calcio d'inizio non verifica la conclusione delle gare sovrapposte. È un confronto esplorativo: prima di un rilascio occorre correggere queste contaminazioni e validare il sistema completo.

## Regole di estrazione

- Deduplicazione per id e poi tipo, periodo, secondo e partecipanti. Id aggiuntivi e coordinate discordanti restano segnalati.
- Identità nella rosa e alias limitati all'id ESPN verificato; iniziali o omissioni di secondi nomi richiedono un'unica identità compatibile. Niente somiglianza approssimativa.
- Testo e partecipanti devono concordare. Giocatori diversi, alias non verificati o tipo mano/fallo discordante restano esclusi.
- Giallo associato solo per motivo esplicito da fallo e un unico fallo precedente dello stesso autore e periodo entro 30 secondi. Proteste, esultanze e mani non diventano gialli provocati da un avversario. È un'associazione temporale, non una prova automatica della causa.
- Sostituzioni utilizzate solo quando testo e coppia entrato/uscito coincidono.
- Mani e rigori conteggiati separatamente senza inventare coppie. Rimane un fallo non riconciliato del Como; non viene trasformato in zero o attribuito a un giocatore.

priorFouls esclude eventi contemporanei e futuri rispetto all'istante richiesto, ma non verifica il ritardo della fonte. Il confronto con l'app è descrittivo, senza snapshot certificati prepartita. Il confronto quote della prima fase è limitato a un turno: nessuna modifica al peso del mercato.

L'indice individuale di gialli provocati dall'attaccante resta da testare su più stagioni di episodi verificati. Un fallo non misura tutti i dribbling o il tempo di marcatura. Il RUNBOOK già documenta prove scartate su ruoli dalla formazione e dribbling di zona; non sono idee mai provate.
