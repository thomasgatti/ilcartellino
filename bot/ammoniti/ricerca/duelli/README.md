# Studio preliminare degli 1 contro 1

Strumenti di ricerca separati dal sito e dal modello. Node 20 o successivo, nessuna dipendenza da installare.

Il campione comprende 40 partite concluse: dieci per ciascuna combinazione Serie A/Champions e stagione 2025/26–2026/27. La scelta è deterministica per data e id ESPN, definita in `pilot.config.json`; è un controllo di fattibilità e qualità, non una validazione predittiva.

## Riprodurre

Dalla cartella `bot/ammoniti/ricerca/duelli` di un checkout del repository:

```sh
node collect_pilot.mjs
node --test duelli.test.mjs
node audit_pilot.mjs cache ../../../webapp/data.json ../../data/quote/valutazione.jsonl risultati <commit-dei-dati>
node build_report.mjs risultati consegna
```

L'ultimo argomento è facoltativo e documenta il commit degli input. Il rapporto consegnato usa `4ef307827be2ab64e7074717a424195fa42bee65`. Per riprodurlo esattamente servono quei due file a quel commit e le risposte ESPN con gli hash archiviati in `fonti.json`; il fornitore può correggere i resoconti successivamente. La raccolta riutilizza la cache esistente. Per una nuova raccolta usare una diversa cartella, per esempio `node collect_pilot.mjs cache-nuova` e passarla anche all'audit.

L'audit genera `audit.json`, `eventi-normalizzati.json` e `fonti.json` nella cartella di uscita indicata. La cache contiene le risposte grezze. Gli hash SHA-256 vengono verificati prima dell'analisi. Gli id delle partite vengono controllati contro il manifesto.

## Cosa viene verificato

- Doppie righe fallo/punizione raggruppate per id, poi per tipo, periodo, secondo e coppia. Id aggiuntivi e coordinate discordanti restano segnalati.
- Identità risolte nella rosa della partita; niente scelta arbitraria fra omonimi né somiglianza approssimativa dei nomi.
- Concordanza fra nomi nel testo e nei partecipanti strutturati; grafie non verificate ed episodi discordi sono esclusi dalle coppie accettate.
- Cartellino associato soltanto a un unico fallo precedente dello stesso autore e periodo entro 30 secondi, con motivo esplicito da fallo. Si tratta di un'associazione temporale prudente, non di una prova automatica della causalità. Esultanze, proteste e falli di mano non vengono attribuiti all'avversario.
- Sostituzioni usate soltanto quando testo e coppia entrato/uscito coincidono. Un cambio non verificato rimane nei risultati da revisionare.
- Confronto con gli abbinamenti salvati nell'app solo per incontri con squadre e orario corrispondenti. Gli alias delle squadre sono espliciti. I nomi non risolti rimangono elencati.

`priorFouls` rende disponibili esclusivamente i falli strettamente precedenti a un istante di previsione, distinguendo i tempi di gioco. Non valuta l'effettivo ritardo con cui il fornitore rende disponibili gli eventi.

## Limiti e passo successivo

Un fallo prova un contatto sanzionato; non conta tutti i dribbling, gli 1 contro 1 riusciti o i minuti di marcatura. La frazione rispetto ai falli del tabellino è un riscontro contabile, influenzato anche da rigori e mani senza coppia. Nessun evento mancante viene trasformato in uno zero certo.

Gli abbinamenti dell'app provengono dal file attuale, senza snapshot prepartita certificato: non sono una misura dell'accuratezza prima della gara. Il confronto con le quote è descrittivo su un solo turno e usa le stesse righe per ogni peso. Non viene cambiato `W_MARKET`.

Prima di allenare: verificare gli alias tramite identità stabili e un secondo riscontro, classificare i conteggi mancanti, archiviare formazioni e previsioni prima del calcio d'inizio. Poi estendere a più stagioni e provare separatamente assegnazione dell'avversario, gialli provocati dall'attaccante e interazione fra i due profili, usando solo partite già concluse prima della previsione. Nel RUNBOOK, dribbling aggregati di zona e ruoli dalla formazione sono già stati provati: non vanno presentati come idee nuove.

Qualsiasi cambiamento del modello segue la regola del progetto: miglioramento della log loss temporale di almeno circa 0,0002, senza peggiorare i primi tre per partita. Questo studio non autorizza un modello migliore: prepara i dati e documenta i limiti.
