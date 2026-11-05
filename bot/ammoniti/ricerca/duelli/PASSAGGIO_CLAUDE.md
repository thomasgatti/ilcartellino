# Stato del progetto per la prossima sessione

Aggiornato il 5 novembre 2026. Leggere prima README.md e AGENTS.md della radice e bot/ammoniti/RUNBOOK.md del ramo effettivamente aperto. Questo file documenta il lavoro; non autorizza pubblicazioni o merge al posto dell'utente.

## Dove si trovano le modifiche

- Firma «Webapp creata da Thomas Gatti» e nota privacy: proposta #2 già unita a main. Il sito pubblico è aggiornato per quella modifica; l'artifact su Claude non è stato aggiornato da Codex.
- Ricerca dei duelli e degli attaccanti: ramo codex/studio-duelli-1v1, proposta #1. Alla stesura di questa nota non è unita a main. Sincronizzare esplicitamente questo ramo e questi file per leggerne il contenuto su Claude.
- Ultimo rapporto: rapporto-fase3.md. Le altre fasi sono fotografie precedenti, non risultati da sommare o confondere con quelli attuali.

## Lavoro completato

1. Raccolte 2.816 cronache ESPN 2021/22–4 novembre 2026 e collegate a gare FotMob con stessa competizione, squadre ordinate e kickoff entro cinque minuti. Hash di tutte le risposte nel manifesto compresso delle fonti.
2. Deduplicati 64.082 falli; 60.457 coppie affidabili nella fonte e 58.661 con entrambi gli id FotMob. 7.412 cartellini temporalmente collegati a un fallo; 7.190 mappati ai due id. Alias e due id in conflitto restano esclusi, senza matching approssimativo.
3. Dopo i controlli più severi: 39.090 trial di fallo e 4.773 positivi in 1.786 gare; 489 gare utilizzabili per esposizioni per90. Cronache mancanti, gialli non attribuiti e identità dubbie non diventano zeri certi. Il sottoinsieme è selezionato per qualità e può avere bias.
4. Ricostruito un riferimento temporale con 19/16 variabili della componente FotMob: medie e imputazioni solo dal passato, posizioni abituali precedenti e disponibilità prima del kickoff. Senza fine certificata si assume kickoff+3ore; è un'ipotesi prudente, non la latenza misurata della fonte.
5. Allenati e confrontati due indici prefissati degli avversari: conversione fallo→giallo associato (shrink50falli) e gialli associati/90 (shrink900minuti). Controllo separato della copertura dei dati. Test su46.240 righe in2.312 gare.
6. Nessuno supera i criteri nello sviluppo2022/23–2024/25. La diagnostica2025/26–2026/27 era già consultata e non è un holdout cieco. Non cambiare candidati o soglie guardando quegli stessi risultati.
7. Salvata una prima fotografia dei pronostici pubblicati per10gare future in snapshots/2026-11-05.json: fonte main92466cbdfdde034a29978b62864ea5ae7d25f306, p0/q originali. Non è un pronostico del nuovo indice.

## Cosa non è cambiato

Nessuna modifica a probabilità pubblicate, modello servito, quote, calibrazione finale, q dei sostituti, interfaccia o dati remoti. Nessuna nuova attività periodica o esecuzione di workflow di pubblicazione. Il confronto non ricostruisce la fusione Sofascore/mercato né il tris completo 2+1 con sostituti.

## File per riprendere

Il README locale descrive replica e dipendenze. dati-episodi.json.gz contiene le osservazioni derivate verificate; fonti-archivio.json.gz gli URL/hash delle fonti; revisioni-archivio.json.gz esclusioni e motivi; profili-attaccanti.json.gz conteggi descrittivi con esposizione e soglie. audit-fase3.json, esperimento-attaccanti.json e fase3-manifest.json documentano controlli, risultati e integrità. Le cache grezze grandi restano sul PC, non nel repository.

Il documento allegato dall'utente descriveva v0.6 al 2 novembre; confronto-documento.md spiega cosa conferma e cosa è superato dal codice successivo. Non riutilizzare le sue vecchie metriche come validazione del modello attuale.

## Passo successivo verificabile

Raccogliere nuove previsioni prima delle partite con capture_predictions.mjs, conservare timestamp/hash e commit remoto, poi registrare gli esiti senza riscrivere i pronostici. L'indice degli attaccanti rimane un candidato di ricerca: serve una successiva verifica su nuove gare e sul sistema completo prima di promuoverlo. I conteggi individuali, incluso l'esempio di Yamal, non autorizzano bonus manuali.
