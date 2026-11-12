# Le 100 idee, una per una (12/11/2026)

Valutazione del documento «100 idee per allenare il modello di Il Cartellino» contro il RUNBOOK e con le prove fatte il 12/11
(`replay.mjs` per la scelta del tris, `candidati.mjs` per le variabili nuove, `fotografie_git.mjs` per le fotografie prepartita).

Criterio per il modello individuale: log loss −0,0002 o meglio sulle stagioni di prova (2023/24 → 2026/27, allenando solo sul passato)
senza peggiorare gli ammoniti tra i primi 3 per partita. Per la scelta del tris: nomi centrati, almeno 2/3 e 3/3 su 1.320 partite
(sviluppo 2024/25, verifica 2025/26 + 2026/27), intervalli ricampionando le partite.

Stati: **ADOTTATA** · **PROVATA OGGI, NO** · **GIÀ SCARTATA** (RUNBOOK) · **GIÀ NEL MODELLO** · **FATTA** (metodo/infrastruttura) ·
**SERVONO DATI** (non li abbiamo) · **SOLO LIVE** (non serve al pronostico prepartita) · **NON PROVATA** (dati ci sono, priorità bassa).

| # | Idea | Stato | Note |
|---|---|---|---|
| 1 | P(titolare) per giocatore | SERVONO DATI | Per allenarla serve lo storico delle probabili: esiste solo dal 4/11 (storia git). Oggi: ultima formazione + 5 giornate, poi consenso dei giornali, poi ufficiali. |
| 2 | P(entrare dalla panchina) | PROVATA OGGI, NO | q del sostituto per giocatore: prevede meglio l'ingresso, ma sullo slot non passa (SA log loss peggiore). |
| 3 | Minuti dei titolari | GIÀ SCARTATA | "Minuti attesi" scartati il 31/10; la parte sostituto è la 2. |
| 4 | Minuti dei subentrati | NON PROVATA | Il minuto di ingresso c'è nell'archivio; dopo l'esito della 2 il guadagno atteso è minimo. |
| 5 | Rientro da infortunio | PROVATA OGGI, NO | Assente da ≥ 21 giorni: SA +0,00003, UCL +0,00013. Da ≥ 45: SA +0,00001, UCL +0,00011. |
| 6 | Concorrenza per lo stesso posto | SERVONO DATI | Storico delle probabili. |
| 7 | Accordo tra fonti sulle probabili | SERVONO DATI | Storico delle probabili per fonte e orario. |
| 8 | Affidabilità della distinta | FATTA (in parte) | Ogni cambio di data.json resta nella storia git con l'ora; `fotografie_git.mjs` lo legge. |
| 9 | Continuità con l'allenatore | SERVONO DATI | L'allenatore non è nell'archivio FotMob scaricato. |
| 10 | Scenari di formazione | SERVONO DATI | Come la 6. |
| 11 | Falli per 100 possessi avversari | SERVONO DATI | Il possesso non è nell'archivio. |
| 12 | Falli per azione difensiva | PROVATA OGGI, NO | Falli / (contrasti + duelli): SA +0,00010; Champions v3 −0,00009; Champions v4 −0,00068 ma tutto da una stagione (−0,00135) e una positiva. Da riverificare con nuove gare. |
| 13 | Gialli per fallo con contesto | GIÀ SCARTATA | Conversione fallo→giallo (31/10) e studio duelli fase 3. |
| 14 | Testa calda come variabile continua | **ADOTTATA (Serie A)** | z = gialli oltre quelli attesi dai propri falli, 3 anni, tutte le competizioni: SA −0,00023, top3 −0,003 ± 0,008, in calo in tutte e 4 le stagioni. Champions v4: −0,00018, top3 −0,017 → no. `lib/hot_feats.js`. |
| 15 | Falli per zona | SERVONO DATI | Servono eventi con coordinate. |
| 16 | Falli per tipo | SERVONO DATI | Come la 15. |
| 17 | Rischio da condotta | GIÀ SCARTATA | Motivi presenti solo nel 12% dei gialli; proteste già nel modello come gialli/90. |
| 18 | Intervallo tra falli | SOLO LIVE | |
| 19 | Ruolo abituale e compito effettivo | GIÀ SCARTATA / NEL MODELLO | Ruoli dalla formazione scartati (5/11); posizione nella formazione della partita è nel modello. |
| 20 | Trasferibilità fra campionati | GIÀ NEL MODELLO | Storico in tutti i campionati (v4) e livello della lega; la 14 usa il tasso della lega di provenienza. |
| 21 | Falli subiti per dribbling | GIÀ SCARTATA | Indici degli attaccanti (fase 3) e dribbling avversari di zona (v4). |
| 22 | Difensore saltato che poi interviene | GIÀ NEL MODELLO (in parte) | "Volte saltato in dribbling" nel modello coppe; la sequenza evento per evento richiede dati spaziali. |
| 23 | Ricezioni larghe o nel mezzo spazio | SERVONO DATI | Eventi con coordinate. |
| 24 | Conduzioni verso zone pericolose | SERVONO DATI | |
| 25 | Duelli a parità di contesto | SERVONO DATI | |
| 26 | Ricezioni contro il lato debole | SERVONO DATI | |
| 27 | Copertura alle spalle del terzino | SERVONO DATI | |
| 28 | Duelli in inferiorità numerica | SERVONO DATI | |
| 29 | Incrociarsi in zona e minuto | GIÀ NEL MODELLO (in parte) | Avversario di fronte dalle posizioni; minuti condivisi richiedono dati spaziali. |
| 30 | Stili difensivi × offensivi | GIÀ SCARTATA | Interazioni (31/10) e indici della fase 3. |
| 31 | Possesso atteso | SERVONO DATI | |
| 32 | Pressing | SERVONO DATI | |
| 33 | Falli dopo perdita del pallone | SERVONO DATI | |
| 34 | Contropiedi concessi | SERVONO DATI | |
| 35 | Altezza del blocco | SERVONO DATI | |
| 36 | Ingressi nel terzo finale per corsia | SERVONO DATI | |
| 37 | Tiri e xG concessi in transizione | SERVONO DATI | La fase dell'azione manca. |
| 38 | Gialli della squadra per ruolo | PROVATA OGGI, NO | SA −0,00011 (sotto soglia), Champions 0. |
| 39 | Rischio quando insegue/difende | GIÀ NEL MODELLO / SOLO LIVE | Forza relativa per ruolo in Serie A; lo stato del punteggio è live. |
| 40 | Lato sfavorito | GIÀ NEL MODELLO | Nazionali (correzione) ed EXTRA (divario con segno); in Champions peggiora. Nel tris: dare i due posti alla sfavorita non cambia nulla (replay). |
| 41 | Arbitro: gialli per fallo | PROVATA OGGI, NO | SA +0,00002, Champions +0,00009. L'indice arbitro attuale basta. |
| 42 | Arbitro per tipo di fallo | GIÀ SCARTATA | Motivi del giallo troppo scarsi (12%). |
| 43 | Arbitro che sanziona presto | SOLO LIVE | Non cambia chi viene ammonito prima del via. |
| 44 | Arbitro casa/trasferta | PROVATA OGGI, NO | SA +0,00004, Champions −0,00002. |
| 45 | Arbitro × partita fisica | PROVATA OGGI, NO | Effetto nullo (anche le interazioni del 31/10). |
| 46 | Cambio arbitro vicino al via | FATTA | La Giornata rilegge l'arbitro a ogni giro (20 minuti). |
| 47 | Livello stagionale | GIÀ SCARTATA | Studio del 10/11: finestra indifferente, modello calibrato. |
| 48 | Qualificazione e ritorno | GIÀ SCARTATA | Posta in palio, ritorno in bilico (1,08) non robusti. |
| 49 | Diffida con regola reale | GIÀ NEL MODELLO / SCARTATA | Nel modello Champions; in Serie A scartata. |
| 50 | Rivalità | GIÀ SCARTATA | Derby e precedenti. |
| 51 | Uscire in funzione del minuto | PROVATA OGGI, NO | Dentro la q per giocatore (2). |
| 52 | Uscire dopo un giallo | SOLO LIVE | |
| 53 | Matrice dei cambi | NON PROVATA | Chi entra non si sa prima; la q per ruolo già media su chi entra. |
| 54 | Rischio del subentrante | PROVATA OGGI, NO | Come la 2. |
| 55 | Con e senza sostituto | FATTA | Regola attuale: l'11% dei nomi centrati (107 su 954) arriva dal solo sostituto; 4 dei 24 tris completi lo devono al sostituto. |
| 56 | Tempo al primo giallo | SOLO LIVE | |
| 57 | Falli live | SOLO LIVE | |
| 58 | Espulsione e compiti | SOLO LIVE | |
| 59 | Minuti di recupero | SOLO LIVE | |
| 60 | Momenti di partita | SOLO LIVE | |
| 61 | Quota del singolo ammonito con orario | SERVONO DATI | Oggi quote raccolte a mano, senza orario. Da automatizzare prima di tutto il blocco 61–70. |
| 62 | Margine del mercato | SERVONO DATI | |
| 63 | Più fonti di quote | SERVONO DATI | |
| 64 | Movimento della quota | SERVONO DATI | |
| 65 | Copertura del mercato | SERVONO DATI | |
| 66 | Miscela FotMob/Sofascore/mercato | SERVONO DATI | Peso mercato in Champions 0,5 ancora provvisorio. |
| 67 | Linea cartellini di mercato | SERVONO DATI | Storico della linea con definizione. |
| 68 | Quote 1X2 contro Elo | GIÀ NEL MODELLO (in parte) | Le quote 1X2 servono nelle Nazionali; manca lo storico per i club. |
| 69 | Linea osservata e stimata | FATTA | `linea_stimata` in risultati.json. |
| 70 | Confronto per blocchi di disponibilità | SERVONO DATI | |
| 71 | Fattore fisso sulle terne scelte | FATTA | 24 tris completi contro 25,3 attesi con 1,16: tenuto. |
| 72 | Fattore per coppie | FATTA | Nel 2+1 ogni terna ha le stesse coppie (due avversari, un compagno): un fattore per coppie non può cambiare la scelta. |
| 73 | Intensità comune della gara | FATTA (indiretta) | Uguale per tutte le terne della stessa partita: non cambia la scelta, solo la percentuale. |
| 74 | Effetti separati per squadra | PROVATA OGGI, NO | Verso del 2+1 dalla sfavorita: +0,003 nomi, nel rumore. |
| 75 | Ammoniti distinti per squadra | NON PROVATA | Dopo 72–74 il guadagno sulla scelta è improbabile. |
| 76 | Simulazione congiunta | NON SERVE | Con fattori costanti il calcolo diretto dà lo stesso ordine. |
| 77 | Due versi del 2+1 e soglia del 5% | PROVATA OGGI, NO | Togliere la soglia: +0,005 nomi [−0,005; +0,016]. Regola invariata. |
| 78 | 2+1 contro libero | FATTA | Libero +0,028 nomi e +1,7 punti di almeno 2/3; l'utente tiene il 2+1 (12/11). |
| 79 | Tutte le terne con il modello congiunto | NON SERVE | Con fattori costanti la terna migliore è sempre fra i primi 7 per lato. |
| 80 | Ordinare per la metrica | PROVATA OGGI, NO | Massimizzare i nomi attesi invece del 3/3 cambia 43 tris su 751, stessa resa. |
| 81 | Fotografie prepartita | FATTA | La storia git è l'archivio; 19 partite ricostruite (dal 4/11). |
| 82 | Identità stabili FotMob–ESPN | FATTA | Ponte della ricerca duelli. |
| 83 | Motivi dei cartellini | GIÀ SCARTATA | Copertura 12%. |
| 84 | Etichette uniformi tra sezioni | FATTA | Controllato: Serie A, Champions, Nazionali ed EXTRA contano giallo, secondo giallo e rosso diretto come ammonito (regola del gioco). Il modello impara solo dai gialli. |
| 85 | Falli contro i totali | NON PROVATA | Controllo di qualità, non cambia il modello. |
| 86 | Ordine degli eventi | NON PROVATA | Serve solo al live. |
| 87 | Ritardo dei feed | FATTA | Ufficiali in ritardo misurate (4 partite il 7–8/11, prima di cron-job.org) e rete di sicurezza `uff_late`. |
| 88 | Copertura dei dati | FATTA | Riportata in ogni prova. |
| 89 | StatsBomb / dati spaziali | SERVONO DATI | Prova del metodo dei duelli, non entra in produzione. |
| 90 | Contesto dell'azione | SERVONO DATI | |
| 91 | Riprodurre il modello corrente | FATTA | `boot.mjs` ricostruisce i modelli di produzione in locale. |
| 92 | Divisioni temporali | FATTA | Stagione per stagione; sviluppo/verifica nel replay. |
| 93 | Data di disponibilità | FATTA (in parte) | Variabili solo dal passato; nel replay le formazioni sono quelle reali (= ufficiali). |
| 94 | Una famiglia per volta | FATTA | `candidati.mjs`. |
| 95 | Tre modelli per i duelli | GIÀ SCARTATA | Fase 3. |
| 96 | Alberi regolarizzati | GIÀ SCARTATA | Gradient boosting (31/10). |
| 97 | Modello gerarchico | GIÀ NEL MODELLO (in parte) | Le stime personali sono ridotte verso il ruolo (shrink). |
| 98 | Ricalibrazione | GIÀ SCARTATA / NEL MODELLO | Pendenza 0,91–1,04 in Serie A (non serve); in Champions spostamento di calibrazione già presente. |
| 99 | Misurare per partita e per terna | FATTA | Replay. |
| 100 | Scelte segnate prima del test | FATTA | Varianti e soglie fissate prima; da rifare a fine dicembre senza ritocchi. |

## In sintesi
- Adottata: 14 (testa calda continua) nel modello Serie A.
- Provate oggi e scartate: 2, 5, 12, 38, 41, 44, 45, 51, 54, 74, 77, 80 (e la q per giocatore in Serie A).
- Da riverificare con nuove gare: 12 in Champions.
- Il blocco che può davvero cambiare le cose è il mercato (61–70): serve prima raccogliere le quote con l'orario.
