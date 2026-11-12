# RUNBOOK — Bot ammoniti Serie A (istruzioni operative per Claude nelle sessioni future)

Obiettivo dell'utente: per ogni partita di Serie A stimare la probabilità di ammonizione di ogni titolare e indicare i 3 più probabili.
Il progetto va portato avanti IN AUTONOMIA: ogni giornata registrare gli esiti, aggiornare dati e modello, provare nuove variabili
e tenere solo quelle che migliorano il test temporale. Rispondere all'utente in italiano.

## Dove gira
- Sofascore NON è raggiungibile dal container cloud né dalla VM locale: tutto il lavoro sui dati gira nel **browser integrato**
  dell'app desktop (strumenti `Claude_Browser`), aprendo una scheda su `https://www.sofascore.com/api/v1/unique-tournament/23/seasons`
  (pagina JSON stabile, non si ricarica da sola) ed eseguendo il codice con `javascript_tool`.
- Il salvataggio su disco dal browser (download) non funziona in automatico: i dati restano in memoria della scheda;
  il registro previsioni è in `localStorage` (`amm_pred_log`) della scheda sofascore.com.
- Questa cartella (Download/ammoniti sul PC dell'utente) contiene codice, risultati e questo file.

## Procedura completa (da zero, ~15 minuti)
1. Aprire la scheda Sofascore API e incollare in ordine: `scrape_sofascore.js`, `features_v03.js`, `model_v03.js`, `predict_v03.js`,
   `model_v04.js`, `model_v05.js`, `tracking_v05.js` (sono definizioni di funzioni).
2. `await scrapeSofascore()` → riempie `__H` e `__TE` (stagioni 22/23 → corrente).
3. `const R5 = patchBuild5()(__H, __TE); const D = R5.data.filter(d => d.mi >= 150);`
4. Modello v0.5: `F5 = [...finalFeatures(D), ...roleFeats({hx: 49.4}), ...extraFeats().forma_recente]`, `fitLogitW(D, F5)`,
   offset sul logit per allineare la media prevista alle ultime 1,5 stagioni (vedi tracking_v05.js).
5. Prossima giornata: id partite da `/unique-tournament/23/season/{sid}/rounds` (currentRound) e `/events/round/{n}`.
   `predictV05(ids, modello, R5.state)` → `logPredictions(P, 'gNN_v05')`. Rifare ~1h prima di ogni partita con formazioni ufficiali.
6. Dopo le partite: `await checkResults('gNN_v05')` → aggiornare la tabella Esiti in `previsioni_*.md`.
7. Live (se richiesto): `liveAmmoniti(eventId, {pid: p}, {pid: falli90}, lambdaCartellini)` da `live_module.js`.
8. Quote "+ Cartellino": Oddschecker IT, pagina partita → "Scommesse sul giocatore" → "+ Cartellino" (rifiutare cookie non essenziali);
   fondere con `blendMarket(lista, {nome: quota})` (definita nella sessione del 31/10; peso 0,5 dopo aver allineato i livelli).

## Web app "I miei ammoniti"
- Pubblicata come artifact: slug `d5ea5092-54b0-4feb-9caa-2f567f82e3a8` (https://claude.ai/artifact/TR5e5jMWv3LbPP4DnKpLbq).
- Sorgenti in `webapp/`: `template.html`, `data.json`, `build.py` (inserisce i dati e scrive `index.html`), README con istruzioni Vercel.
- Ad ogni nuovo calcolo: `exportAppData(P, giornata)` nel browser → scrivere `webapp/data.json` → `python3 build.py`
  → `publish_files` con slug e base_version correnti (get_artifact). Modalità trio: "2 + 1 tra le squadre" (default, richiesta
  dall'utente) e "Liberi".
- Il "+ Personale" manuale è stato TOLTO su richiesta dell'utente (non deve dipendere da cosa sa chi usa l'app).
- Etichette automatiche per ogni titolare (`tags` in data.json): "Ex <squadra>" (ha giocato nell'avversaria), "N gialli in M gare
  contro <squadra>" (solo se N>=2), "Diffidato", "Rientra da squalifica"; `derby` a livello partita. Calcolate dallo stato __V6
  (patchBuild6: aggiunge p.vs[avversario]=[presenze,gialli]). Sono INFORMATIVE: testate, non migliorano il modello
  (ex: 44 gialli vs 54 attesi; precedenti personali: log loss 0,4015 vs 0,4014).
  Lo storico Sofascore parte dal 2022: per gli ex più vecchi usare `/player/{id}/transfer-history` (da fare quando Sofascore
  non blocca; il 31/10 aggiunti a mano Çalhanoğlu ex Milan e Molina ex Udinese).
- "Salva la mia schedina": scrive nel database della pagina
  il documento `schedine/<matchId>` con `trio` (scelto dall'utente, con i fattori personali) e `trioModello`.
  Leggerlo con `db_list(slug, "schedine")` e confrontare entrambi con gli ammoniti reali: bilancio "tu contro il modello".

## Area personale e risultati (dal 31/10)
- Accesso = account Claude (capability `user`, profilo per il nome). Ogni utente salva i suoi tris in `data/users/<id>/t<matchId>`
  (privato, Claude non lo legge): {matchId, partita, ko, mio:[{n,p}], app:[{n,p}], savedAt}. Tris bloccato dal calcio d'inizio.
- A FINE PARTITA Claude deve scrivere `risultati/<matchId>` con db_write (slug sopra):
  {matchId, partita, finale:"1-2", ammoniti:[nomi come in data.json, cioè shortName Sofascore], falli:{nome: falli commessi} per
  tutti i giocatori scesi in campo, aggiornato:ISO}. Fonte: Sofascore `event/{id}/incidents` + `event/{id}/lineups` (statistics.fouls).
- REGOLA DEL SOSTITUTO (gioco dell'utente): una scelta vale se è ammonito il titolare O chi entra al suo posto. Nel doc
  `risultati/<matchId>` aggiungere `sostituzioni: {uscito: entrato}` (da incidents, incidentType "substitution").
  Probabilità per casella = 1 - (1-p)(1-q); q per ruolo (FBref 2017-25): D 0,019, M 0,042, F 0,039; per minuti medi recenti
  (<60', 60-70', 70-80', 80-88', 88'+): D .030/.027/.024/.015/.008, M .058/.050/.038/.029/.017, F .054/.041/.029/.024/.015.
  DA FARE: q per giocatore usando i minuti medi da titolare (stato __V6, p.hist) invece del solo ruolo. Analisi: slot_analysis.py.
- Punteggio nella pagina: 3 punti per ammonito azzeccato + 0,5 per ogni fallo dei giocatori scelti; confronto con il tris dell'app.

## Formazioni probabili (dal 31/10)
- NON usare solo quelle di Sofascore: usare il consenso di Fantacalcio.it, Gazzetta, SOS Fanta e Sky dalla pagina
  https://www.fantacalcio-online.com/it/serie-a/2026-2027/probabili-formazioni/NN-giornata (WebFetch: media % per giocatore;
  91 = titolare sicuro → P(titolare) = min(1, media/91)). Mappare i cognomi agli id Sofascore con le presenze recenti per squadra.
- Probabilità di giallo = P(titolare) × P(giallo se titolare). Nella web app: colonna "Titolare" ed etichetta "Titolare al X%" se < 80%.
- Con le formazioni ufficiali: P(titolare) = 100% per gli 11.

## Stato del modello (31/10/2026)
- v0.5 = base (gialli/falli storici con shrinkage, ruolo D/M/F, casa, gialli squadra, falli subiti avversario) + duelli (falli subiti,
  dribbling, velocità, scatti degli avversari vicini da posizioni medie abituali) + gialli per proteste + arbitro + linea cartellini
  + quote 1X2 + ruolo fine (profondità/fascia) + forma recente (ultime 5).
- Test temporale (2024-25 → 2026-27, 850 partite): log loss 0,4014, AUC 0,625. 3/3 ≈ 1%, almeno 2/3 ≈ 11-13%.
- PROVATE E SCARTATE (nessun guadagno): riposo/coppe, classifica/posta in palio, ex, precedenti, derby, diffida, rientro da squalifica,
  peso alle stagioni recenti, gradient boosting, minuti attesi, conversione fallo→giallo, interazioni.
- Correlazione tra ammoniti della stessa partita leggermente NEGATIVA: P(3/3) reale un po' sotto il prodotto.
- Nessun "valore" trovato contro le quote del bookmaker su Milan-Inter (31/10).

## Idee ancora da provare (in ordine)
0. Ex di turno su tutta la carriera con `/player/{id}/transfer-history` (etichette complete).
1. Valutazione sugli esiti reali giornata per giornata (calibrazione sulla stagione in corso).
2. Fusione con le quote "+ Cartellino": misurare se il fuso batte modello e mercato sugli esiti registrati.
3. Statistiche avanzate del duello (contrasti persi, duelli persi del giocatore) dalle righe lineups (campi duelLost, challengeLost).
4. Arbitro per tipo di giallo (proteste vs falli) e per squadra.
5. Validare il modulo live quando si avranno dati minuto per minuto.

## Aggiornamento 31/10 sera
- Bonus sostituto per giocatore: 8° elemento di ogni riga `pl` in data.json = q_i = pSub_i (ultime 2 stagioni, shrink 4 titolarità verso D .228/M .454/F .624) × r_pos (D .088, M .095, F .073). slotP usa q_i se presente, altrimenti SUBQ per ruolo. Mancano i giocatori senza storico (quasi tutti Monza, Cabal, Zhegrova, Bella-Kotchap, İlkhan).
- Falli tattici (2 stagioni, 8.200 righe titolari, CV 5 fold): duelli persi non aiutano (0.39826→0.39823); duelli persi + contrasti sì, di poco (0.39757; coeff. contrasti +0.157). Da inserire nel modello al prossimo scraping completo.
- risultati/16285066 scritto senza falli (fonti pubbliche senza falli per giocatore): l'area mostra "falli in arrivo". Aggiungere `falli` con merge appena disponibili.
- Fonti utili senza Sofascore: calciomercato.com/liste (tabellino con cambi abbinati), fantacalcio-online voti (gialli con minuto), sport.sky.it minuto per minuto.

## Apprendimento partita per partita (dal 31/10)
- Dopo ogni partita: aggiungere una riga a data/storico_partite.jsonl (previsioni p e p_slot, ammoniti con minuto e motivo, cambi abbinati, gialli dei subentrati, metriche) e lanciare `python3 aggiorna_da_storico.py`.
- data/aggiustamenti.json va applicato alla previsione successiva: moltiplicatore di calibrazione sui p, gialli dell'arbitro aggiunti al suo storico, gialli/presenze dei giocatori aggiunti ai tassi individuali, tasso gialli dei subentrati per la regola del sostituto.
- Bologna-Monza (prima partita registrata): attesi 2,55 gialli tra i titolari, reali 5; 7 totali con Zanotti; 2 subentrati ammoniti su 10 (Touré per Kouadio, Amondarain per Zortea); Lucchesi ammonito per trattenuta su rigore (giallo non da falli). Tris app 2/3 con regola sostituto.

## Testa calda e clima derby (31/10 sera)
- Le proteste SONO già nel modello dalla v0.2: variabile `argr` = gialli non da fallo (proteste, perdite di tempo, pallone calciato via) per 90', dai motivi dei cartellini Sofascore. Moreira aveva storico basso, per questo era al 10%.
- Test FBref 2017-25 (test_testacalda_derby.py, 41.458 righe): "testa calda" = gialli in più rispetto ai falli → +18% di probabilità (odds) per deviazione standard, p<0,001. Derby: +0,29 logit per tutti a parità di falli; NESSUN extra significativo per teste calde, giovani o attaccanti (attaccanti +0,15, p=0,36).
- Nel modello finale il derby non è una variabile a sé (scartata sulle 2 stagioni Sofascore), ma passa dalla linea cartellini dei bookmaker. Da riverificare derby oltre la linea cartellini quando torna Sofascore.
- App: etichetta automatica "Testa calda" per chi ha residuo ≥ 1 deviazione standard nello storico FBref (solo etichetta, la probabilità lo contiene già).
- Storico: Udinese-Roma registrata (2 gialli su 2,7 attesi, partita chiusa al 37'); falli fatti/subiti per giocatore da playerstats.football/fixture/<casa>/<ospite>/<data>.

## Storico estero dei nuovi arrivati (1/11)
- Fonte: worldfootballR_data (FBref), release `fb_advanced_match_stats`: `{ENG,ESP,GER,FRA,USA}_M_1st_misc_player_advanced_match_stats.csv` (falli, gialli, minuti per partita, fino a gennaio 2026). Scaricabili dal container, non serve il Desktop.
- Championship, Portogallo, Olanda, Brasile: solo `fb_match_summary/{POR,NED,BRA}_M_1st_match_summary.csv` e `ENG_M_2nd_...` (eventi: gialli e cambi, niente minuti né falli) → non usati per i tassi. Serie B, Primavera: non disponibili in questo archivio.
- carriere_estero.py → data/carriere.parquet (giocatore × campionato × stagione, id FBref unico tra campionati) + data/fattori_campionato.json.
- Fattori verso la Serie A (media tra rapporto dei campionati e trasferimenti reali 2017-25): gialli ENG 1,30, ESP 1,01, FRA 1,18, GER 1,08, USA 1,11; falli ENG 1,18, ESP 1,00, FRA 1,02, GER 1,04, USA 1,10.
- Correlazione gialli/90 prima→dopo il trasferimento: FRA 0,58, ESP 0,50 (come la Serie A anno su anno, 0,48); ENG 0,21, GER 0,19 (campioni piccoli).
- test_storico_estero.py: 234 giocatori alla prima stagione in Serie A, 2.786 partite da titolare. Logloss 0,4749 (solo ruolo) → 0,4686 (con storico estero). Quartili: previsto 11,8/16,6/20,3/24,9% vs reale 11,9/17,9/18,7/25,2%.
- profili_nuovi.py → data/profili_app.json: moltiplicatore di rischio (coeff. 0,514 log gialli/90 + 0,556 log falli/90, shrink 900' verso la mediana del ruolo, stagioni pesate 1/0,8/0,6/0,4). Applicato con esponente 0,6 a chi ha < 900' di Serie A (il modello v0.5 vede già la stagione in corso). Etichetta "Storico <campionati>" nell'app.
- Moreira: storico Ligue 1 nella media (moltiplicatore 0,91): il suo giallo era per proteste.

## Nuovi arrivati da tutti i campionati via FotMob (1/11 pomeriggio)
- Sofascore ancora bloccato (403 challenge). FotMob funziona dal browser integrato del PC (scheda separata, NON la scheda seed): `/api/data/leagues?id=55`, `/api/data/teams?id=<squadra>`, `/api/data/playerData?id=<giocatore>` (statSeasons), `/api/data/playerStats?playerId=<id>&seasonId=<entryId>&isFirstSeason=false` (minuti, gialli, rossi, falli fatti/subiti, duelli, contrasti + percentile per 90' nel campionato).
- Rose Serie A 2026/27: 534 giocatori di movimento; 154 senza Serie A nelle stagioni precedenti; 784 schede stagione×competizione (2023/24-2025/26) scaricate; 105 con minuti utili. Dati grezzi in localStorage `fm_newcomers` della scheda FotMob; riepilogo in data/fotmob_nuovi.psv.
- Conversione: Premier/LaLiga/Bundesliga/Ligue 1/MLS con i fattori FBref; tutti gli altri campionati (Serie B, Championship, Eredivisie, Liga Portugal, Pro League, Brasile, Argentina, giovanili...) col percentile per 90' del giocatore nel suo campionato mappato sulla distribuzione della Serie A per ruolo (data/quantili_serieA.json). Pesi: stagione 1/0,8/0,6; campionato 1, coppe 0,6, nazionali 0,5, giovanili 0,4; shrink 900' verso la mediana del ruolo.
- Corretto bug in profili_nuovi.py: i ruoli FBref (CB/LB/RB/WB, LW/RW) erano mappati tutti su centrocampisti.
- Applicato alle 4 partite ancora da giocare (esponente 0,6), 17 giocatori con etichetta "Storico ...".

## Storico tris dell'app (2/11)
- Bottone "Storico tris dell'app" in alto a destra: legge tutta la collezione `risultati` e giudica il campo `tris_app` di ogni documento (regola del sostituto), con bilancio e schede per giornata.
- Ogni documento risultati/<matchId> deve avere anche: `tris_app` = [{n, p}] (il tris 2+1 dell'app al calcio d'inizio, con la regola del sostituto), `p3_app`, `ko` (unix), `giornata`. Il tris si ricava dalla pagina con Playwright: `state.subRule = true; pick(m, '21', 0)` su ogni partita di DATA.matches (webapp/tris_app.js).
- Giornata 10, prime 8 partite: Bologna-Monza 2/3, Udinese-Roma 0/3, Milan-Inter 1/3, Como-Venezia 1/3, Lazio-Cagliari 1/3, Frosinone-Torino 2/3, Lecce-Genoa 1/3, Juventus-Napoli 2/3 → 10 ammoniti su 24 (42%), nessun tris completo.
- Script per ricavare i tris: webapp/tris_app.js (node, Playwright).

## Inesperti nelle partite di cartello (2/11)
- Ipotesi dell'utente: giocatori con poca esperienza buttati in partite di cartello (Juve-Napoli, derby, Roma-Napoli, Inter-Milan) rischiano di più.
- Test FBref 2017-25 (test_inesperti_bigmatch.py; "cartello" = entrambe tra Juventus, Inter, Milan, Napoli, Roma, Lazio, Atalanta, oppure derby; "inesperto" = meno di 20 presenze in Serie A): nelle partite di cartello il rischio sale per tutti gli esperti (+0,25 logit, 20,2% contro 17,5%), ma NON per gli inesperti (16,8%; interazione −0,28, p=0,001; solo difensori −0,24, p=0,04). Possibile selezione: gli allenatori fanno giocare i giovani in quei match solo se affidabili. Non applicato come bonus.
- Applicato invece: etichetta "Poca esperienza: X' in Serie A" (FotMob, carriera) per chi è sotto i 900', con i gialli della stagione; storico FotMob esteso anche a chi ha pochi minuti di Serie A (non solo ai nuovi arrivati). Obrić: 250' in Serie A con 2 gialli, 2 rossi in Serie C con l'Atalanta U23.
- Da riverificare con più dati: piccoli campioni della stagione in corso (es. 2 gialli in 3 partite) contano già nel modello v0.5 via shrinkage verso il ruolo.

## Modello v0.6 su FotMob (02/11/2026)
- Fonte dati: FotMob dalla scheda del browser integrato su https://www.fotmob.com (il container e il terminale del PC ricevono 403).
  1. Iniettare `fotmob_scrape.js`, poi `await fmScrape(['2020/2021','2021/2022','2022/2023','2023/2024','2024/2025','2025/2026','2026/2027'], 4)`:
     salva in IndexedDB 'amm'/'fm' e salta le partite già presenti (aggiornamento settimanale = solo le nuove, ~1 minuto). Stato in `window.__FMS`.
  2. Iniettare `fm_model.js` (dentro una funzione), poi `fmBuild()` e
     `window.__FIN = fmFinal(['base','lega','squadre','duelli'], ['2021/2022','2022/2023','2023/2024','2024/2025','2025/2026'], '2026/2027')`.
  3. Per ogni partita: `await fmPredictMatch(<id FotMob>, __FIN.model, extra)` → p di giallo SE titolare per gli 11 della formazione FotMob
     (probabile finché `lineupType` = 'predicted', poi ufficiale) + i giocatori `extra` [{id,name,side,pos}] presi dalle partite 2026/27 in __FMM.
- Dati: 2.379 partite (6 stagioni complete + 2026/27), 47.580 righe titolari, motivi dei gialli, falli fatti/subiti, posizioni medie.
- Variabili tenute dalla selezione in avanti (log loss stagione successiva): ruolo, gialli/90 e falli/90 con shrinkage 1500', casa,
  livello di ammonizioni della stagione (ultime 3.000 righe: la Serie A ammonisce meno ogni anno, 17,6% → 12,8% dei titolari),
  gialli della squadra e falli subiti dell'avversario (ultime 10), falli subiti degli avversari diretti (posizioni medie).
  SCARTATE: proteste (già nei gialli/90), arbitro, partita squilibrata (differenza punti per partita), derby, forma, esperienza.
- Test 2026/27 (98 partite, 1.960 titolari): log loss 0,3739, AUC 0,611, calibrato per fasce; 0,55 ammoniti per partita nei primi 3.
- Dispersione: pendenza logit(y)~logit(p) fuori campione 0,91 / 1,04 / 1,03 sulle tre stagioni → NON allargare. La compressione vista
  nelle 8 partite registrate era rumore (25 gialli su 19 attesi).
- Confronto sulle 8 partite registrate (150 titolari abbinati): app v0.5 log loss 0,430 AUC 0,694 top3 10; FotMob 0,427/0,721/8;
  media in logit 0,427/0,723/11 → nell'app si usa la MEDIA IN LOGIT tra v0.5 e FotMob per chi ha ≥ 900' nello storico FotMob;
  sotto i 900' resta la p dell'app (che contiene lo storico estero e le stime per ruolo). p0 in data.json = p_se_titolare × st/100.
- Copia dei dati prima della modifica: tmp/data_backup_0211.json.

## Lezioni dal vivo e registrazione (02/11 sera)
- data/osservazioni.jsonl: una riga per ogni osservazione utile (formazioni a sorpresa, gialli con contesto, letture live dell'utente), con il campo "lezione".
- Formazioni: il giorno della partita calcolare la p per TUTTA la rosa con `fmSquadPredict(<id FotMob>, __FIN.model)` (11 FotMob + chi ha giocato nelle
  ultime 6 partite), così un titolare a sorpresa ha subito il suo valore e non la media del ruolo (caso Sulemana: 11% di ruolo, 16% reale, ammonito al 40').
- Ufficiali: fidarsi di FotMob quando `lineupType` = 'standard'; tra i siti, solo quelli che riportano anche la panchina (alcuni ripubblicano le probabili).
- Modulo live (idea n. 5): lo storico FotMob ha solo i falli a fine gara. Durante le partite lanciare `fmLiveStart([id,...])` nella scheda FotMob:
  ogni 3 minuti salva falli fatti/subiti per giocatore, cartellini e punteggio in localStorage 'live_<id>'. A fine giornata copiare i dati con
  `localStorage.getItem('live_<id>')` in data/live/<id>.json. Con 2-3 giornate: stimare P(giallo nel resto della gara | falli finora, minuto, punteggio, ruolo).
- Lezioni dalle partite registrate e dallo storico FotMob: vedi data/osservazioni.jsonl (12 righe al 02/11). In sintesi:
  P(giallo | falli in partita) 0→3%, 1→19%, 2→28%, 3→34%, 4→36%, 5→41% (prior per il modulo live);
  partita chiusa (2+ gol di scarto al 60') → -24% di gialli nell'ultima mezz'ora (effetto live, non pre-partita);
  subentrati ammoniti nell'8% degli ingressi; secondo giallo 2,2% degli ammoniti;
  gli ammoniti a sorpresa (p<10%) sono soprattutto attaccanti e spesso per proteste/simulazione, ma il peso extra alle proteste
  degli attaccanti non migliora la log loss (0,40363→0,40352 in validazione, 0,37386→0,37390 in test): non tenuto.

## Versione Vercel per gli amici (02/11)
- `python3 webapp/build_vercel.py` dopo build.py → webapp/vercel/sito/index.html (copiata in Download/ammoniti/sito/index.html).
  Senza account Claude: tris salvati nel browser di ognuno (localStorage), esiti e tris dell'app da webapp/vercel/risultati.json
  (stessi documenti di risultati/<matchId> nel database dell'artifact, senza falli_subiti): aggiungere lì ogni nuovo esito.
- Pubblicazione AUTOMATICA: repository GitHub thomasgatti/ilcartellino (privato, ramo main) collegato al progetto Vercel 'ilcartellino'
  (team micio) → https://ilcartellino.vercel.app. Dopo ogni aggiornamento dell'app: build.py, build_vercel.py, copiare
  webapp/vercel/sito/index.html nella radice del repository (add_repo thomasgatti/ilcartellino con access push, clone in /home/claude/ilcartellino),
  commit e push su main: Vercel ripubblica da solo. Funziona anche a PC spento (GitHub è raggiungibile dal cloud).

## Chiusura giornata 10 (02/11 sera)
- Sassuolo-Fiorentina 2-4: 5 gialli (Sulemana 40', Drăgușin 42', Njie 44', Gnonto 90+2' per Njie, Kulla 90+5' per Esposito). Tris app 0/3.
- Atalanta-Parma 0-3: 0 gialli. Tris app 0/3. ERRORE: ufficiali prese da una sola fonte (calcioatalanta.it, senza panchina) e sbagliate per il Parma
  (Diego Carlos in panchina; titolari Drobnic, Fabbian, Lontani). REGOLA: ufficiali solo da FotMob 'standard' o da almeno due siti con panchina.
- Bilancio tris dell'app giornata 10: 10 ammoniti su 30 (con regola del sostituto). Falli per giocatore delle due partite di lunedì da aggiungere
  (FotMob matchDetails 5749738 e 5749731, con merge su risultati/16285070 e 16285071 e su webapp/vercel/risultati.json).
- Fotografie live salvate nella scheda FotMob del PC: localStorage 'live_5749738' e 'live_5749731' → copiarle in data/live/ al prossimo collegamento.

## Coppe europee: Champions League (dal 03/11), poi Europa e Conference League
- Dati FotMob (scheda fotmob.com, javascript_tool):
  - Champions: `uclScrape([...stagioni dal 2021/2022])` → window.__UCL e IndexedDB 'amm_ucl' (807 partite al 03/11).
  - Campionati esteri + Europa League (73) + Conference (10216): `domScrape(spec, 5)` → window.__DOM e IndexedDB 'amm_dom'.
    spec usato: Premier 47, LaLiga 87, Bundesliga 54, Ligue 1 53, Eredivisie 57, Liga Portugal 61 (2024/25-2026/27);
    Turchia 71, Belgio 40, Grecia 135, Austria 38, Cechia 122, Scozia 64, Svizzera 69, Danimarca 46, Ucraina 441, Slovacchia 176,
    Azerbaigian 262, Championship 48 (2025/26-2026/27); Norvegia 59 (2025, 2026). Circa 9.500 partite, ~2 al secondo.
    Al prossimo aggiornamento basta rilanciarli: saltano le partite già scaricate (solo se window.__DOM è caricato da IndexedDB 'amm_dom').
- Modello: cup_model.js (cupBuild, cupFS, cupPredict) + cupSquad/cupExport definiti nella scheda.
  Gialli e falli di ogni giocatore in TUTTE le competizioni, divisi per la media del suo ruolo in quel campionato
  (indice personale), riportati alla scala della coppa. Variabili: ruolo, casa, gialli e falli personali. Allenato sulle righe Champions.
  Prima verifica (solo Champions + Serie A come storico): allenato 2021-25, test 2025/26 + 2026/27 → log loss 0,3949 contro 0,4003 del solo ruolo,
  AUC 0,601 contro 0,562. Gialli della squadra, arbitro, eliminazione diretta: nessun guadagno.
  Champions: 3,5-3,6 gialli a partita (2025/26-2026/27), in calo; per titolare ~14% (Serie A 2026/27 ~13%).
- App e sito: data.json ha `cups.ucl` {round, season, updated, model, lineups_note, matches}; partite con `comp:'ucl'`, id FotMob, `src:'fotmob'`.
  Generato da `python3 cup_to_data.py export.json <giornata> [id_ufficiali]` (export = cupExport con solo titolari).
  Selettore Serie A / Champions in alto; tema notte blu (data-comp="ucl"). Risultati in risultati/<id FotMob> con `comp:'ucl'`;
  lo Storico mostra solo la competizione scelta. Sisal: pagina Champions https://www.sisal.it/scommesse-matchpoint/quote/calcio/champions-league.
- Formazioni ufficiali: solo FotMob con lineupType diverso da 'predicted' (o almeno due fonti con panchina).

## Modello coppe v2 — studio dell'avversario (3 nov 2026)
- File: cup_model2.js (cupBuild2, cupPredict2, cupExport2, uclRoundIds). Da caricare nella pagina FotMob (tab-4) dopo fm_model.js e cup_model.js.
- Feature finali __CFS2: ruolo M, ruolo F, casa, L(gialli/90), L(falli/90), L(falli subiti dall'avversario che ha di fronte), |divario forza|.
- Divario: Elo per campionato (base per lega) oppure, se ci sono quote, 4·log10(p1/p2) dalle quote 1X2.
- Test su tutto lo storico UCL: log loss .39334 → .39232, AUC .610 → .619, ammoniti nel top 3 per partita .59 → .65. Intercetta spostata −0.079 (calibrata su UCL 25/26–26/27).
- Quote: /api/data/matchOdds?matchId=&ccode3=ESP|AUS|GBR|DEU (ITA dà null). Danno 1X2 bet365 e "Player to be Booked" per 2 giocatori → tag "Quota bookmaker per il giallo".
- Flusso giornata: ids = uclRoundIds(n) → cupExport2(ids) → salvare JSON → python3 cup_to_data.py export.json n [ids_ufficiali] → build.py → build_vercel.py → push GitHub + publish artifact.
- Formazioni: solo quelle FotMob non 'predicted' contano come ufficiali.
- Funzioni ancora solo nella pagina (da tenere a mente): fmOdds, domScrape, uclScrape.

## Variabili extra (ext_model.js, 3 nov 2026)
Provate 21 famiglie di variabili su tutto lo storico (Serie A 2022/23→oggi, coppe 2022/23→oggi, test stagione per stagione allenando solo sulle precedenti):
diffida, gialli in stagione, fatica (minuti 14 gg, riposo), congestione calendario (partite in 15 gg, giorni alla prossima), forma cartellini, falli recenti, rosso recente,
conti personali (gialli già presi contro lo stesso avversario), età, posizione media in campo, turnover, titolari abituali assenti, classifica/posta in gioco a fine stagione,
forma squadra, forma avversario, intensità (falli squadre), cattiveria squadre, livello (Elo medio), arbitro (indice su tutte le competizioni, per nome), precedenti tra le due squadre, ritorno a eliminazione diretta.
Risultato onesto: quasi tutte non cambiano CHI viene ammonito (differenze nel top 3 dentro il rumore, ±0,01 su ~0,01 di errore).
Tenute solo quelle che migliorano davvero:
- Serie A: arbitro (coeff. 1,07 sul log dell'indice) + precedenti. Log loss .42724 → .42606 (5 stagioni di test).
- Champions: arbitro (0,53) + precedenti (0,48) + diffida (−0,29: i diffidati prendono ~25% di gialli in meno; osservato/atteso 0,82). Spostamento intercetta −0,073.
Segnali osservati ma non abbastanza robusti da entrare: già ammonito contro questo avversario in UCL (oss/att 1,21), ritorno con risultato in bilico (1,08), falli in crescita (1,05–1,07, migliora log loss ma peggiora il top 3).
In pagina: extBuild() → extMakeModels() → extPatchPredict(); poi cupExport3(await uclRoundIds(n)) e extDelta(...) per portare i numeri nel container (merge sul JSON dell'export precedente con lo stesso ordine giocatori), fmPredict3(id, __SAM3) per la Serie A.
App: m.refnote (sotto il nome dell'arbitro) e m.ctx (righe di contesto sotto le statistiche); tag "Diffidato" sul giocatore.

## Quote del mercato e modello live (3 nov 2026, pomeriggio)
- Oddschecker (scheda tab-1, fetch normale, nessun blocco): pagina partita /it/calcio/coppe-e-amichevoli-per-club/champions-league/<slug>; il mercato "+ Cartellino" (To Be Shown A Card) è nei dati incorporati nella pagina (query "odds-grid" con l'id del mercato). Funzioni in pagina: ocParseCards(html), ocCards(path) → bets [{n, ai, dec[], bk[]}]. Bookmaker disponibile: William Hill (WI). Esporta "slug|Nome:quota;..." in data/quote/oc_<comp><giornata>_<data>.txt. Non usare la apiKey che compare nella pagina.
- market_blend.py: abbina i nomi (cognome, 2 parole in comune, grafie simili), de-vig a potenza sui titolari abbinati in modo che il totale resti quello del modello, poi media in logit modello/mercato con W_MARKET = 0,5 (PROVVISORIO: nessuno storico di quote per validarlo). Chi non è quotato riceve lo spostamento medio della partita.
- cup_to_data.py export.json 4 "<id ufficiali>" data/quote/oc_....txt → modello "coppe v2 + quote"; tag "Quota bookmaker per il giallo" per ogni titolare quotato.
- DA FARE con gli esiti: per ogni partita salvare p_modello, p_mercato, p_finale e chi è stato ammonito → dopo ~60 partite stimare il peso giusto (log loss di modello, mercato, miscela).
- Testati e scartati: fuori ruolo (posizione nella partita vs abituale), quota di gialli non per falli (motivo vuoto nell'88% dei cartellini). Posizione nella formazione della partita: piccolo guadagno in entrambe le competizioni (log loss −0,0004 SA, −0,0003 UCL, top 3 nel rumore) → candidato, richiede x/y della formazione al momento della previsione.
- live_model.js: probabilità residua durante la partita. Cartellini e punteggio aggiungono poco oltre al tempo che passa; il segnale utile saranno i falli del giocatore minuto per minuto, che raccogliamo con fmLiveStart.

## Serie A giornata 11 e modello v0.7 (3 nov 2026, mezzogiorno)
- Ricostruzione completa in pagina: fmScrape(['2026/2027'],4); fmBuild(); addLgr() (SERVE: senza, la variabile 'lega' è NaN); cupBuild2(); extBuild();
  extMakeModels(['posizione_partita'], ['posizione_partita']); extPatchPredict(). Funzioni nuove in ext_model.js: posizione nella formazione della partita
  (plat = distanza dal centro, pdep = profondità) da verticalLayout di FotMob; tenuta in Serie A e Champions (log loss −0,0004 / −0,0003).
- Verifica sulla giornata 10 (modelli allenati senza la giornata 10, 200 titolari, 30 gialli): v0.6 log loss 0,4031, v0.7 0,4007; tris 2+1 10/30 in entrambi.
- sa_export.js: saPatchVs(); __SAX = await saExport(ids); JSON.stringify(saFinal()) → tmp/saNN.json → python3 sa_to_data.py tmp/saNN.json NN [quote_oddschecker.txt].
  Formazioni PROVVISORIE (src 'provv') finché non escono le probabili: titolare % da ultima formazione + presenze da titolare ultime 5 giornate.
  Quando escono le probabili dei giornali (consenso Fantacalcio-Online, di solito da giovedì) sostituire st con il consenso; ufficiali FotMob 'standard' → 100%.
- Quote "+ Cartellino" Serie A su Oddschecker: il 3/11 il mercato non era ancora aperto per la giornata 11 → riprovare da giovedì-venerdì
  (pagina /it/calcio/italia/serie-a/<slug>), poi sa_to_data.py con il file delle quote (media in logit sulla p se titolare).
- Backup dei dati della giornata 10: tmp/data_g10_backup.json.

## Studio: giallo la giornata prima e tipo di partita (3 nov, pomeriggio)
Previsioni fuori campione Serie A 2022/23→oggi (32.420 titolari):
- Ammonito nella partita precedente: 16,9% reale (prevista 18,2%); non ammonito: 15,6% (15,7%). Due gialli di fila: 16,9% (20,3%).
  Il giallo della settimana prima quasi non conta; variabile "ammonito l'ultima volta" provata: non migliora (log loss +0,0001). Da monitorare.
- Per ruolo il modello è calibrato (D 0,98, M 0,99, F 0,98); gli attaccanti con p alta sono anzi un po' sottostimati (oss/att 1,04-1,11).
- Tipo di partita per ruolo (forza relativa Elo + casa): squadra nettamente favorita → difensori oss/att 0,77, centrocampisti 0,75, attaccanti 1,01.
  Squadra in forma/in crisi: nessun effetto. Variabile forza_ruolo tenuta in Serie A (log loss −0,0010, la più forte di oggi; top 3 +0,018 ± 0,012),
  NON in Champions (peggiora: +0,0004). extMakeModels(['posizione_partita','forza_ruolo'], ['posizione_partita']).

## valuta.py — chi ha ragione tra modello e mercato (3 nov)
python3 valuta.py tmp/ex5.json data/quote/oc_ucl4_2026-11-03.txt esiti.json "ucl4"
esiti.json = {"<id FotMob>": {"titolari": [...nomi FotMob, opzionale], "ammoniti": [...nomi FotMob]}} (da matchDetails: cards tipo Yellow/YellowRed).
Accumula in data/quote/valutazione.jsonl e stampa log loss di modello, mercato e miscele (peso 0 → 1), calibrazione per fasce, ammoniti nei primi 3
di modello e mercato, e il peso del mercato migliore su tutto lo storico. Cambiare W_MARKET in market_blend.py solo con ~600 titolari (≈30 partite).
Vale anche per la Serie A (export tmp/saNN.json: usa la p se titolare e i giocatori con titolare % ≥ 50, meglio passare i titolari veri).

## Piano B senza PC (3 nov sera)
- Quando il PC è acceso: nella scheda FotMob cupSquad3(ids) (definita in pagina, vedi sotto) calcola la p se titolare per TUTTA la rosa
  (11 probabili + panchina FotMob + chi ha giocato nelle ultime 6 partite) → esportazione compatta → python3 rose_parse.py in.txt data/rose/<file>.json.
  Fatto per le 9 partite di Champions di mercoledì 4/11: data/rose/ucl4_mercoledi.json (366 giocatori).
- Se all'ora delle formazioni il PC non risponde: formazioni ufficiali da almeno DUE siti con panchina (WebSearch → WebFetch dei risultati),
  formazioni.json {id: {h: [portiere + 10], a: [...], fonti: [...]}} → python3 cloud_lineup.py data/rose/<file>.json formazioni.json tmp/ex5.json
  → cup_to_data.py tmp/ex5.json 4 "<id ufficiali>" data/quote/oc_....txt → build.py → tris_app.js → artifact + build_vercel.py + push GitHub.
  Chi non è nella rosa riceve la p mediana della squadra (avviso in uscita). Niente fmLiveStart né quote nuove senza PC.
- cupSquad3 = come cupPredict3 con extra = panchina del lineup FotMob + giocatori delle ultime 6 partite (cupAll), output
  [nome, lato, ruolo, p, minuti, campionato estero, di fronte, diffidato, gialli, nell'XI]. Da portare in un file .js alla prossima sessione con il PC.
- Per la Serie A il piano B esiste già: tmp/saNN.json contiene tutta la rosa con la p se titolare (r[7]); basta mettere st=100 agli 11 ufficiali.

## Scheda "Formazioni" (campo) — 3 nov sera
- field_lineups.js nella scheda FotMob: fieldExport(await fieldLineups(ids)) → righe in webapp/lineups.txt (sostituire quelle con lo stesso id).
  build.py le mette in m.lu; la scheda mostra "Possibili 11 titolari" (probabili / ultima schierata) o "Formazioni ufficiali" (tipo standard),
  con numero, cognome, probabilità di giallo e il cartellino giallo sui giocatori del tris dell'app.
- Ad ogni aggiornamento delle formazioni ufficiali: rigenerare anche lineups.txt per quelle partite.

## Sveglie del PC (3/11)
Cartella `sveglia/` (sul PC: Download/ammoniti/sveglia). Il PC resta in SOSPENSIONE e Windows lo sveglia 10 minuti prima di ogni attività programmata di Claude (Utilità di pianificazione, cartella \Ammoniti\, opzione WakeToRun); `sveglia.ps1` lo tiene sveglio N minuti e apre l'app Claude se è chiusa.
- `sveglie.txt`: una riga per sveglia `AAAA-MM-GG HH:MM minuti nota` (oppure `ven HH:MM minuti nota` ogni venerdì).
- Prima installazione: doppio clic su INSTALLA_SVEGLIE.bat (chiede i permessi di amministratore per i timer di riattivazione).
- **Ogni volta che crei nuove attività programmate** aggiungi le righe a sveglie.txt (10 minuti prima, minuti = fino al calcio d'inizio + 5) e copiale sul PC con device_commit_files: ogni sveglia, quando parte e quando finisce, rilegge sveglie.txt e registra le nuove righe (device_bash è una macchina Linux, NON può lanciare PowerShell su Windows). Registro in sveglia/registro_sveglie.txt. Serve che nel file ci sia sempre almeno una sveglia futura (c'è quella fissa del venerdì).

## Riquadro live (3/11)
Durante le partite l'app mostra un riquadro "Live" (ammoniti con ✓ se nel tris, tris dell'app, rischio da qui alla fine, falli fatti e subiti).
Giro: nella scheda FotMob `JSON.stringify(await fmLiveExport([ids]))` (in fm_model.js) → `ammoniti/tmp/live.json` → `python3 live_update.py tmp/live.json` (scrive m.live in webapp/data.json; per le partite finite resta con "Finita") → build.py → artifact → build_vercel.py + push.
Rischio ora = liveProb (live_model.js) × quota 1,3 per ogni fallo fatto (max 4): il fattore dei falli è indicativo, da riallenare con le fotografie live.
Aggiorna a metà primo tempo se richiesto, all'intervallo, verso il 70' e a fine partita.
- **Dal 3/11 sera il sito Vercel si aggiorna da solo ogni minuto**: la pagina chiede a ESPN (site.api.espn.com, CORS aperto; uefa.champions / ita.1, scoreboard?dates= poi summary?event=) punteggio, ammoniti, cambi e falli fatti/subiti, e ricalcola il rischio nel browser. Niente PC né server. L'artifact su claude.ai blocca le richieste esterne: lì il riquadro resta quello di live_update.py, con un link al sito.

## Esiti Champions in area e storico (3/11)
Nella scheda FotMob `JSON.stringify(await Promise.all(ids.map(fmResult)))` → `tmp/res_<...>.json` → `python3 ucl_results.py tmp/res_<...>.json` (nomi come nell'app, cambi uscito→entrato, falli fatti e subiti; aggiorna webapp/vercel/risultati.json e scrive tmp/res_<...>_docs.json) → db_write `set risultati/<id>` con i documenti → build.py, build_vercel.py + push, artifact. Il tris dell'app viene da webapp/tris_app.json (lanciare tris_app.js prima, a formazioni ufficiali). Nello storico e nell'area gli ammoniti sono evidenziati in giallo.
Fatte il 3/11: 6106341, 6106335.
- 3/11 sera, prima prova delle sveglie: alle 21:43 e 21:50 il PC non risultava collegato (sveglia delle 21:40). Quote e fotografie live dell'intervallo delle 21:00 non raccolte. Da verificare domani: sveglia partita? (registro_sveglie.txt, Utilità di pianificazione → Ammoniti → Ultima esecuzione), portatile ASUS con sospensione moderna (powercfg /a), app Claude ricollegata dopo il risveglio.

## Revisione giornata 4 Champions (4/11) – idee dell'utente verificate sullo storico UCL (16.140 titolari, test 2022/23→2025/26)
- Partite a senso unico: osservati/attesi per ruolo e forza (gap Elo): sfavoriti netti M 1,20 e F 1,19, favoriti netti D 0,90 (media 1,07). Ma come variabili non migliorano: forza_ruolo +0,00033 log loss (peggio), "sfavoriti non difensori" −0,00006 (rumore), top3 +0,01 ± 0,012. Il gap del modello coppe lo cattura già.
- Proteste/testa calda: i motivi dei cartellini FotMob ci sono solo per ~12% dei gialli (1.069 per proteste su 50.570): troppo pochi per una variabile. Il rapporto gialli/falli del giocatore è già nel modello (yc e fl insieme).
- Capitano, crisi della squadra, "partite sentite": dati non disponibili nello storico (capitano) o già provati senza effetto (forma squadra, mentale avversario, classifica).
- Mercato meglio del modello su martedì (log loss 0,4390 vs 0,4582, 173 titolari): rivedere W_MARKET dopo ~600 titolari.
- **Modello coppe v3 (4/11)**: cup_x2.js → `cupX2Build()` dopo extBuild/extMakeModels/extPatchPredict (e prima di cupExport3). Aggiunge "volte saltato in dribbling" e "duelli vinti" per 90' (dati FotMob già nelle righe). Storico UCL: log loss −0,00058, top3 +0,021 ± 0,020; sulla sola giornata di martedì (9 partite) leggermente peggio (0,4516 vs 0,4490): rumore, da riverificare con valuta.py nelle prossime giornate. Se la scheda FotMob viene ricaricata, rilanciare anche cupX2Build().
- Scaricati per i test anche capitano per le 807 partite UCL (window.__X3, non salvato): nessun effetto.

## 4/11 mattina: pannello browser del PC chiuso → modelli in pagina persi
- I dati restano in IndexedDB (amm/fm 2.381, amm_ucl 807, amm_dom 9.548), ma funzioni e modelli erano solo nella pagina. Molte funzioni nei file .js sono più vecchie della versione in pagina (cupPredict2 senza quote, extMakeModels senza argomenti; fmOdds, uclScrape, domScrape mai salvate).
- Per stasera: formazioni ufficiali con uff_lineup.js (fmUff) + cloud_lineup.py sulla rosa precalcolata data/rose/ucl4_mercoledi.json (modello v2 + arbitro/precedenti/diffida, senza la v3).
- DA FARE prima della Serie A di giovedì: ricostruire la catena modello in modo durevole (codice completo salvato nei file, oppure in Python sul repository GitHub), perché fmPredict3/sa_export non esistono più in pagina.

## Ricostruzione durevole (4/11, mattina) — USARE QUESTA
- Tutto il codice della pagina è in https://ilcartellino.vercel.app/lib/ (copia di questi file .js, CORS aperto, vercel.json). Nuovo amm_boot.js:
  idbAll/ammLoad (dati da IndexedDB), fmOdds (ricostruita: 1X2 e "Player to be Booked" bet365 da /api/data/matchOdds), cupFS2 (= __CFS2 del RUNBOOK),
  extMakeModels2(['posizione_partita','forza_ruolo'], ['posizione_partita']), extCV2, extPair, ammBuild() = catena completa (~35 s).
- In una scheda fotmob.com: for (const f of AMM_FILES o elenco dei prompt) (0,eval)('{' + testo + '\n}'); poi await ammBuild(); stato in window.__AMMB.
- Verifica: Man United-Roma ricostruito ≈ previsioni del 3/11 (Mancini .314 vs .317, Hermoso .288 vs .289, Bruno .107 = .107); Barcellona-Villa ~+10% (shift e dati diversi).
- Peso della storia personale nel modello coppe: window.__CK = 600 minuti (prima 1500). Test UCL: log loss 300 .41868, 600 .41854, 900 .41857, 1500 .41873, 3000 .41910; top3 uguale nel rumore. Serie A resta __K = 1500 (scelto a suo tempo).
- Quando si cambia un file .js: copiarlo anche in ilcartellino/lib/ e fare push.

## Modello coppe v4 (4/11 pomeriggio)
- Scaricate +9.061 partite (stagioni vecchie: Premier/Liga/Bundesliga/Ligue 1 dal 2021/22, Olanda/Portogallo dal 2022/23, Turchia/Belgio dal 2023/24, altri 2024/25, Europa e Conference 2023/24-2024/25) e statistiche extra per tutte (IndexedDB amm_xs; nel cloud dentro m.x). Totale: Serie A 2.381, UCL 807, altri 18.609.
- Effetto della storia più lunga (stesse righe di test UCL): log loss .41854 → .41618, top3 per partita .705 → .750. Il guadagno più grande della giornata.
- Variabili nuove (deep_feats.js): tenuto solo "palloni persi per 90'" (coeff. −0,16: chi perde molti palloni prende meno gialli): dll −0,00033, top3 +0,010 ± 0,010 → cup_x3.js (cupX3Build, __CUPM5 = __CUPM3). Scartati: dribbling degli avversari di zona (odrib/odatt), tocchi, recuperi, intercetti.
- Regola del sostituto per giocatore: subqBuild() (amm_boot.js) → riga[9] dell'export → ottavo campo di pl.
- ammBuild() ora fa tutto (v4 compresa): ~40 s.
- 4/11 17:22: la sveglia ha aperto una finestra con "Accesso negato" (le attività create da amministratore non si possono riscrivere senza amministratore). sveglia.ps1 ora non rilegge più sveglie.txt e si rilancia invisibile (conhost --headless). Le sveglie dal sonno non funzionano comunque (sospensione moderna): la soluzione vera è il bot nel cloud. Nuove sveglie solo rifacendo il doppio clic su INSTALLA_SVEGLIE.bat.

## Gialli insieme: stesso reparto e squadre diverse (4/11 sera)
- Idea dell'utente: due compagni nella stessa zona (es. coppia di mediani) si "rubano" il giallo → meglio pescare da posizioni diverse.
- Verifica su 21.000 partite (coppie di titolari, attesi = prodotto dei tassi personali): avversari +8%, compagni linee diverse +2%, compagni vicini D +2%, M +6%, F −7% (pochi casi). Nessuna penalità per lo stesso reparto.
- Terne: "2 + 1" ×1,164 sul prodotto, tutti della stessa squadra ×1,039 (24 milioni di terne).
- App: jointK(t) in template.html moltiplica il "tutti e tre ammoniti" (combos e "Il mio tris").

## Ruoli dalla formazione (5/11) — provato e scartato
Caso El Aynaoui (Lipsia-City): FotMob lo segna F (posizione abituale), gioca mediano. Ruolo = usualPlayingPositionId, fissato alla prima partita vista; nel modello SA F rispetto a M vale circa -0,19 log-odds (~-3 punti a p=0,2).
Prove (exp/roles.mjs, test stagione per stagione 2022/23→2025/26): ruolo dalla linea in campo (line), con esterni del 3 dietro come D (hybrid), dalla posizione media nelle ultime 8 (habit), solo centrocampisti centrali rimessi M (narrow).
Nessuna migliora: log loss e top 3 oscillano nel rumore, narrow peggiora la log loss in Serie A in tutte e 4 le stagioni e in Bundesliga. Ruoli lasciati come sono.
Posta in palio e riposo: nel modello semplice (exp/stakes.mjs) riposo <4 giorni + lotta salvezza davano ~0,0002-0,0004 a stagione; nel modello vero di produzione (__FS_SA3, extPair 2022/23→2025/26, 1.521 partite) riposo_salvezza dll -0,00009, top3 -0,003±0,003 (riposo da solo 0, salvezza da sola -0,00008): sotto la soglia 0,0002, NON aggiunto. Candidata riposo_salvezza resta in EXT_CANDS (campi ex.otrest, ex.srel) per riprovarla a fine stagione, quando la salvezza pesa di più.
Tris indicati dall'utente: data/tris_utente.json (giornata 4 UCL: 7 ammoniti su 18 contro 8 dell'app nelle stesse partite; Dortmund-Betis 3/3).
Idea per marzo-aprile (utente, 5/11): riprovare posta in palio solo nelle ultime ~10 giornate, con scontro diretto (entrambe nella stessa corsa) e incroci tipo "chi lotta per lo scudetto contro chi lotta per salvarsi"; unire più campionati per avere abbastanza partite. Nota: nei dati la lotta salvezza ha dato MENO gialli del previsto (coef. negativo, 4 stagioni su 4).
Diffidati in Serie A (5/11, 2021/22→oggi, __SAM3 senza diffida): diffidati ammoniti 17,5% contro 18,7% previsto (rapporto ~0,93, prudenza). "Pulire la diffida" (oggi avversaria normale, dopo una top 5): 745 casi, 17,0% osservato contro 18,6% previsto, nessun segno di gialli cercati. extPair con EXT_CANDS.diffida: dll -0,00003, top3 -0,001: non aggiunta in SA (resta nel modello coppe).

## Studio dei duelli 1 contro 1 (5/11/2026) — ricerca, nessuna modifica al modello
- Ramo codex/studio-duelli-1v1; strumenti e risultati in ricerca/duelli/. Pilota ESPN: 40 partite fissate per date/id, Serie A e UCL 2025/26–2026/27. Prima fase 849 coppie; verifiche identità +50, nuovo conflitto mano/fallo −1 → 898 coppie su 922 episodi; 107 associazioni temporali fallo–giallo, 354/372 sostituzioni verificate. Restano 24 falli esclusi (13 alias, 10 giocatori discordanti, 1 tipo mano/fallo). Totali: 922 falli strutturati +41 mani +5 rigori da mano +1 fallo solo testo =969 contro970; scarto1 del Como in Como–Venezia. Nessuna coppia inventata.
- Casi: Maatsen–Yamal e Heaven–Soulé confermati in cronaca. Maguire ammonito dopo un fallo su Castro, entrato per Malen 14 secondi prima del fallo. Il file attuale dell'app non è uno snapshot prepartita certificato.
- Tre varianti esplorative della componente FotMob: posizione della formazione della gara al posto dell'abituale; due avversari più vicini; dribbling avversari × vulnerabilità individuale. Contesto 21.559 partite, test 46.240 righe/2.312 incontri, 2022/23→2026/27 parziale. Fit su stagioni precedenti; sviluppo 2022/23–2024/25, verifica separata 2025/26–2026/27. Nessun candidato supera nello sviluppo dll≤−0,0002 e top3≥baseline.
- Sviluppo Serie A (dll, Δtop3/gara): formazione +0,000063/+0,0105; due avversari +0,000061/+0,0105; interazione +0,000169/+0,0026. Sviluppo UCL: +0,000024/−0,0251; +0,000170/−0,0410; +0,000156/−0,0114.
- Verifica Serie A: −0,000076/−0,0229; −0,000062/−0,0229; −0,000037/+0,0063. Verifica UCL: −0,000444/−0,0198; −0,000250/−0,0278; +0,000010/0. Nessuna promossa. Questi anni sono ormai consultati, non riutilizzarli per scegliere varianti come se fossero dati mai visti.
- Limiti: riferimento con alcune medie/imputazioni su archivio completo (informazione aggregata futura), nessuna certificazione prepartita delle posizioni né controllo della conclusione di gare sovrapposte, esclusi fusione Sofascore/quote e calibrazione finale. Top3 senza 2+1 e sostituto. Test esplorativo, non validazione del sistema pubblicato. L'indice vero di gialli provocati dall'attaccante non è ancora testato: occorre estendere gli episodi e correggere la temporalità anche del riferimento.
- Manifesti SHA e protocolli nel rapporto-fase2.md e README della ricerca. 25 test superati e riesecuzione completa. Modello servito, probabilità, interfaccia e dati remoti invariati.

## Archivio multi-stagione dei falli sugli attaccanti (5/11/2026) — terza fase
- Ramo codex/studio-duelli-1v1, proposta #1. Rapporto e continuità in ricerca/duelli/rapporto-fase3.md e PASSAGGIO_CLAUDE.md. Firma/privacy della proposta #2 sono già su main; questa ricerca non aggiorna l'artifact Claude o il modello servito.
- Raccolte 2.816 cronache ESPN (2021/22–4/11/2026), tutte verificate SHA e collegate con competizione, squadre e kickoff entro5min. 64.082 falli deduplicati, 60.457 coppie affidabili, 58.661 mappate su FotMob; 7.412 associazioni temporali fallo–giallo, 7.190 mappate. Due id ESPN in conflitto esclusi. Nessun fuzzy.
- Allenamento: 39.090 trial verificati con4.773 positivi, da1.786gare; solo489gare con attribuzione sufficientemente completa per /90. Shrink50falli/900minuti prefissati, medie comp+ruolo precedenti. Eventi sconosciuti censurati, non negativi; sottoinsieme per90 selezionato per qualità e non rappresentativo.
- Nuovo riferimento di ricerca temporale:19variabili SA/16UCL, medie/imputazioni/stile/context solo da gare disponibili prima del kickoff, coordinate abituali dal passato. Tre ore dopo il kickoff se manca fine certificata (ipotesi, non certificazione); restano rose archiviate a posteriori. Niente fusione finale Sofascore/quote/calibrazione, 2+1 o regola sostituto.
- Sviluppo2022/23–2024/25, diagnostica2025/26–2026/27 già consultata; 46.240 righe test/2.312gare. Controllo baseline+sola copertura per separare qualità dati e segnale attaccante. Nessuno selezionato.
- Sviluppo SA (dll/Δtop3 vsbaseline): conversione +0,000183/+0,0044, per90 +0,000061/−0,0018. UCL: conversione +0,000571/+0,0114, per90 +0,000479/+0,0114. Contro controllo copertura: SA +0,000113/+0,0018 e −0,000009/−0,0044; UCL −0,000079/+0,0114 e −0,000172/+0,0114.
- Diagnostica SA vsbaseline: conversione +0,000020/0, per90 +0,000133/−0,0146; UCL −0,000189/+0,0317 e +0,000075/+0,0198. Segnale favorevole conversione UCL non supera selezione sullo sviluppo né soglia controbase: non promosso. Correzione anagrafica Viking FK/Viking ha recuperato3gare2026/27 e ha richiesto riesecuzione, nessun ritocco di candidati/soglie sugli esiti.
- Inclusi dataset derivato gzip, manifesto fonti/hash e strumenti riutilizzabili; cache grezze grandi solo locali.68test passati; controlli espliciti contro esiti futuri, gare sovrapposte, identità discordi, negativi inventati e timestamp al kickoff.
- Documento utente v0.6 datato2/11 letto e confrontato colcodice successivo; non usare vecchie calibrazioni/metriche come stato attuale. Prima fotografia dei pronostici originali del sito per10gare future conservata in snapshots/2026-11-05.json. Lo strumento capture_predictions non ricalcola i p, non sovrascrive e non pianifica attività. Serve confronto su nuove gare e sistema completo prima di integrare l'indice.


## Ripresa dopo Codex (9/11/2026)
- Giornata automatica (cloud/giornata.mjs): `syncRound` passa alla giornata successiva per **Serie A (FotMob 55, 10 partite) e Champions (42, 18 partite)** quando la giornata in corso è tutta archiviata, la prossima inizia entro 72 ore e almeno metà delle partite ha una formazione (ultima, probabile o ufficiale); le partite rimaste fuori vengono aggiunte ai giri successivi appena hanno la formazione. Serie A 12ª: prima partita 21/11 15:00 → passaggio dal 18/11. Champions 5ª: 24/11 18:45 → dal 21/11. Dopo l'8ª giornata Champions (spareggi, round non numerico) il passaggio automatico NON funziona: va fatto a mano.
- Arbitro: preso da FotMob (infoBox.Referee) anche quando la formazione non cambia (controllo da 60 ore prima); nota "X cartellini/gara · Y gialli · N gare di Serie A" calcolata dall'archivio del ramo dati (Champions: tutte le competizioni, "gare in archivio"). Stesso calcolo che Codex aveva fatto a mano per l'11ª.
- Linea cartellini: se manca quella del mercato, stima del modello = media cartellini delle ultime 380 gare (Champions 250) × √(somma p0 della partita / media della giornata), soglia x,5 sulla mediana di Poisson; `line_est: 1` e nell'app "stima del modello". Sull'11ª coincideva con i bookmaker in 7 partite su 10. FotMob/bet365 non ha il mercato "totale cartellini".
- Prove: `CARTELLINO_ORA` (ora simulata) e `CARTELLINO_ANTICIPO_ORE` solo per test su un ramo con `prova: true`. Prova del 9/11 con ora 3/11 06:00: Serie A 10→11 (10/10 pronte) e Champions 4 completata da 9 a 18 partite, modello, tris e pagine generati senza errori.
- sonda.yml (manuale): `urls` (relativi = FotMob) + `js` facoltativo, estratto nel log. Gli artifact di Actions NON si scaricano da qui (blob bloccato dal proxy): usare i log.
- Da questa sessione non si possono cancellare rami remoti (proxy): rami codex/* già uniti da cancellare a mano da GitHub (Branches) o con "Automatically delete head branches".
- PR #9 (In attesa del live) riportata su main e chiusa; PR #1 (duelli) unita su main come archivio di ricerca, esito negativo.
- Bilancio: tris dell'app Serie A g10 10/30 (attesi 6,3), g11 8/30 (attesi 6,3), Champions g4 14/54 (attesi 12,7): in linea o sopra le attese. g11 titolari: 32 gialli contro 26,3 attesi (log loss 0,424), fascia 0,22+ 5 su 2,4 attesi. Da seguire: se anche la 12ª resta sopra le attese, rivedere il livello della stagione (17,6% → 12,8% dei titolari) che potrebbe essere sceso troppo.
- GitHub lancia la Giornata automatica molto meno spesso del cron (8/11: 15:25, 16:55, 21:23, 00:58 ora italiana): le ufficiali possono arrivare in ritardo nel tris registrato. Rimedio possibile: chiamata esterna programmata (cron-job.org → API workflow_dispatch con un token dell'utente).
- 9/11 mezzogiorno: la Giornata automatica la lancia cron-job.org (account dell'utente, job "Giornata ilcartellino", 0,20,40 11-23 * * 0-3,5-6 Europe/Rome, POST .../actions/workflows/giornata.yml/dispatches con {"ref":"main","inputs":{"prova":false}}; token fine-grained "cron-job ilcartellino", Actions read/write solo su ilcartellino, scade 8/11/2027: a ottobre 2027 rigenerarlo e incollarlo nell'intestazione Authorization). Tolto il cron interno di GitHub. Stima ~1000 minuti/mese di Actions + ~480 dell'aggiornamento dati (limite gratuito 2000).
- 9/11: Genoa-Milan, tolto il giallo di Musah (FotMob lo ha poi dato a Diawara). La Giornata automatica ora ricontrolla i cartellini per 48 ore dopo la fine e riarchivia se FotMob li corregge (confronto sui nomi abbreviati, allenatori esclusi). Nota: in Champions g4 i rossi diretti (Koïta, Marín, McCarthy) sono contati negli ammoniti; in Serie A il workflow li esclude.
- 9/11 (utente): il rosso diretto vale come ammonito, in tutte le competizioni. Giornata automatica allineata (prima in Serie A li escludeva); aggiunto A. Ndiaye in Parma-Bologna (rosso al 9').

## EXTRA: angoli prepartita Serie A (9/11/2026)
- Documenti di Codex sulla fase EXTRA (angoli, marcatori, ammoniti Europa/Conference) in ricerca/extra/. Pacchetto dati completo (4,6 MB) e fonti originali (146 MB) restano sul PC dell'utente (Documents/Codex/2026-11-05/...-git-3/outputs).
- Decisione utente 9/11: ammoniti di Europa League e Conference rimandati (troppi giocatori poco conosciuti e pochi dati). Marcatori fermi (segnale instabile, copertura 53% in Conference).
- Test in ricerca/angoli/test_angoli.py sui 1.919 tabellini ESPN di Serie A 2021/22→4/11/2026 (angoli-serie-a-champions.json di Codex). Ogni gara stimata solo con le precedenti. Parametri scelti solo sul 2023/24: squadre senza separare casa/trasferta, attenuazione k=10, nessun decadimento, binomiale negativa (r dai totali delle stagioni precedenti).
- Log loss Over 8,5/9,5/10,5/11,5, media di lega (M0n) → modello squadre (M1n): 2024/25 0,6884/0,6933/0,6493/0,5543 → 0,6746/0,6739/0,6409/0,5416 (meglio su tutte); 2025/26 0,6922/0,6771/0,6107/0,5011 → 0,6979/0,6821/0,6158/0,5026 (peggio su tutte: la media di lega è scesa da 9,36 a 8,86); 2026/27 parziale (100 gare) 0,6861/0,6899/0,6636/0,6503 → 0,6817/0,6821/0,6492/0,6163 (meglio). Vantaggio piccolo e non stabile: niente scheda angoli per ora.
- Da questa data la Giornata automatica salva gli angoli di ogni partita archiviata (campo `angoli`: [casa, trasferta], da FotMob), così la verifica può continuare sulle gare nuove senza dipendere da ESPN.
- 10/11: negli esiti anche `quote_1x2` (probabilità implicite casa/trasferta in %, come in data.json, dall'ultimo calcolo prima del calcio d'inizio) e `linea_cartellini` (`linea_stimata: 1` se è la stima del modello). Le quote passate non si possono recuperare (FotMob le toglie a partita finita): lo storico parte da qui. La stima angoli invece si può ricalcolare dopo, perché usa solo partite precedenti.
- Prossimi passi possibili: forza delle squadre dalle quote 1X2 (chi domina batte più angoli; serve uno storico di quote), registrare le stime prima delle partite per una verifica in avanti, e una linea di mercato con orario per misurare un vantaggio rispetto alle quote.

## Livello di ammonizioni della stagione (10/11/2026)
- Dubbio: g11 con 32 gialli fra i titolari contro 26,3 attesi → il modello abbassa troppo il livello? Test in ricerca/livello/livello.mjs (modello FotMob Serie A, gruppi base+lega+squadre+duelli, finestra del livello W righe titolari, oggi 3000).
- Tasso gialli titolari per stagione: 17,6 / 18,6 / 17,6 / 16,9 / 15,1 / 14,3 / 12,7% (2020/21 → 2026/27 parziale, 105 gare).
- Attesi/osservati sulla stagione di verifica con W=3000: 2024/25 1296/1148, 2025/26 1161/1090, 2026/27 274/267 → nella stagione in corso il modello è calibrato (semmai di poco alto). W da 750 a 12000 cambia la log loss di meno di 0,0005 (2026/27: 0,37224 … 0,37178). Senza il gruppo "lega" peggiora (0,37290, attesi 300).
- Conclusione: nessuna modifica. Il +5,7 della g11 è rumore (deviazione tipica ~5 gialli su una giornata).
- 10/11: app su claude.ai (artifact d5ea5092…) ripubblicata da bot/webapp/index.html e database `risultati` dell'artifact completato con la g11 (10 esiti, db_write). La Giornata automatica aggiorna solo Vercel: l'artifact va riallineato a mano (pagina + collection risultati) quando serve.

## Dati EXTRA e primi test (10/11/2026)
- Nuovo archivio nel ramo `dati`, cartella `extra/` (cloud/scrape_extra.mjs, workflow manuale "Dati EXTRA FotMob"; ogni giorno lo stesso passo, 20 minuti massimo, gira dentro "Aggiorna dati FotMob" per le partite nuove). Recupero dello storico fatto il 10/11: tutte le 21.763 partite delle 23 competizioni dell'archivio (7,1 MB, ~35 minuti di Actions).
- Per partita: `t` statistiche di squadra [casa, trasferta] (angoli, tiri, tiri_porta, xg, xg_azione, xg_inattiva, grandi_occasioni, possesso, fuorigioco, cross, tocchi_area, falli, parate, gialli, rossi); `p` per giocatore [id, lato, titolare, minuti, gol, xG, xG senza rigori, tiri, tiri in porta, xA, tocchi in area, assist, rigori segnati]; `g` gol [minuto, id, lato, rigore, autogol]. Controllo Serie A 2025/26: angoli presenti in tutte le 380 gare (media 8,81, uguale a ESPN), gol dei giocatori + autogol = risultato in 379/380.
- Ammoniti nei grandi campionati (ricerca/extra/ammoniti_leghe.mjs, modello Serie A FotMob riallenato per lega, test sulla stagione successiva): AUC 0,59-0,61 come in Serie A; gialli nei primi 3 per partita 2025/26 → 2026/27: LaLiga 0,77/0,73, Premier 0,71/0,72, Bundesliga 0,69/0,63, Ligue 1 0,61/0,55 (Serie A 0,65/0,57). Il modello si trasferisce: base pronta per i "big match" esteri.
- Angoli (ricerca/angoli/angoli_extra.py, regressione di Poisson per squadra, ultime 10 gare, allenata sulle stagioni precedenti):
  - TOTALE angoli: né gli angoli delle squadre né tiri/xG/possesso battono stabilmente la media di lega (Serie A 2024/25-2026/27: 0,6435/0,6195/0,6769 media lega contro 0,6535/0,6211/0,6620 modello completo). Il totale resta poco prevedibile prima della partita.
  - Angoli della SINGOLA SQUADRA: chiaramente prevedibili. Log-verosimiglianza media, media lega → angoli squadre → + tiri/xG/possesso: Serie A 2024 -2,434/-2,397/-2,381, 2025 -2,382/-2,337/-2,316, 2026 -2,625/-2,564/-2,510; meglio anche in LaLiga, Premier, Bundesliga e Ligue 1 in 13 stagioni-lega su 15 (eccezioni: Bundesliga 2025 pari, Ligue 1 2026 peggio). Mercati adatti: angoli squadra e handicap angoli, non il totale.

## Sezione EXTRA nel sito (10/11/2026)
- Scelta utente: lista automatica + partite chieste da lui, comprese le coppe nazionali importanti (FA Cup, EFL Cup, Copa del Rey, DFB Pokal, Coupe de France, Coppa Italia).
- cloud/extra.mjs (passo "Sezione EXTRA" della Giornata automatica, continue-on-error): partite dei prossimi 14 giorni (dal 10/11; prima 6); automatiche = derby della lista DERBY o entrambe nelle prime 7 del proprio campionato (classifiche FotMob), ordinate per somma delle posizioni, massimo 8; più `aggiunte` di bot/webapp/extra_scelte.json (id FotMob), meno `escluse`. Ricalcolo ogni 3 ore, oppure se una partita inizia entro 2 ore senza ufficiali, oppure se c'è un esito da archiviare (2,5 ore dopo il calcio d'inizio).
- Cartellini: fmBuild sul campionato del paese (ENG 47, ESP 87, GER 54, FRA 53, ITA 55), modello base+lega+squadre+duelli allenato sulle stagioni precedenti, fmPredictMatch sulla formazione FotMob; tris 2+1 (prodotto delle p più alto). Senza formazione: niente tris, solo angoli.
- Angoli: regressione di Poisson casa/trasferta allenata su tutto lo storico extra del campionato (ultime 10 gare per squadra, almeno 3), dispersione binomiale negativa stimata dai residui; probabilità oltre 2,5…7,5 per squadra e chi ne batte di più.
- Esiti: data.json extra.storico (ultimi 150) con tris, ammoniti (rosso compreso), sostituzioni (regola del subentrato), angoli reali e previsti.
- Prova del 10/11 con ora simulata 6/11 22:00: scelte Borussia Dortmund-Elversberg e Atlético Madrid-Barcelona; tris Atlético-Barça M. Bernal, J. Cancelo, Á. Baena; angoli attesi 5,4-5,0.
- Interfaccia: terzo pulsante "EXTRA" (compare solo quando ci sono partite o esiti), schede con tris, titolari per squadra, tabella angoli e barra "chi ne batte di più".
- 10/11: pulsante EXTRA sempre visibile; input "extra" della Giornata automatica per ricalcolare subito (EXTRA_FORZA).

## Nazionali e Storico unico (12/11/2026)
- Nuova sezione **Nazionali**: Nations League A (FotMob 9806, gironi 920741…). In `cloud/giornata.mjs` è il terzo turno (`comp:'naz'`, `data.cups.naz`): `syncNaz` aggiunge ogni partita nelle 72 ore prima del calcio d'inizio appena FotMob ha una formazione (probabile o ufficiale); le partite archiviate da più di 36 ore escono dalla sezione (restano nello Storico).
- Modello: coppe v4 della Champions (`cupExport3`) invariato. Per le nazionali valgono le variabili del giocatore (falli e gialli nei club, avversari diretti per zona, dribbling subiti, duelli, palloni persi, ruolo, esperienza, arbitro); quelle di squadra (Elo, falli di squadra recenti) vanno al valore medio perché le nazionali non sono in archivio. Niente diffidati (contano solo in Champions) e niente linea cartellini stimata (nessuno storico di Nations League).
- Linea cartellini delle Nazionali (12/11): stimata come per la Champions, partendo dalla media cartellini delle ultime 250 gare di Champions × √(somma probabilità dei titolari / media delle partite della sezione); niente linea di mercato disponibile su FotMob.
- `cup_to_data.py` con `CUP_COMP=naz`: nomi delle nazionali in italiano, `en` con i nomi inglesi per agganciare la diretta ESPN (`uefa.nations`).
- Posta in palio: dalla classifica FotMob, tutte le combinazioni V/N/P delle gare rimaste → posizione migliore/peggiore di ogni squadra; prime 2 quarti, 3ª spareggio, 4ª retrocessa. `hot` (etichetta "Partita che conta") se entrambe hanno ancora qualcosa da decidere.
- Interfaccia: pulsante Nazionali (rosso e oro); Champions, Nazionali ed EXTRA visibili nel menu solo vicino alle partite; Storico unico per tutte le competizioni, compresi gli esiti EXTRA (prima erano dentro la sezione EXTRA).
- Prima prova (12/11, 01:30 UTC): 4 partite della 5ª giornata con le probabili, top3 Italia-Francia Upamecano 25%, Calafiori 25%, Scalvini 23%.
- Il giovedì è escluso da cron-job.org: nelle settimane delle nazionali va riattivato (o lanciato a mano) perché le formazioni ufficiali entrino in tempo.
- Sfondi per competizione (palette scelte dall'utente, 12/11): Serie A blu notte con triangoli blu e ciano (tema scuro), Champions archi ciano-blu-viola-magenta, EXTRA con lo sfondo del campionato della partita aperta (`data-lg`: Premier prugna e rosa, LaLiga nero e rosso a cerchi, Bundesliga rosso con schede bianche, Ligue 1 blu e giallo; le coppe nazionali prendono quello del loro paese). Solo colori e forme originali, niente loghi. Gli SVG si rigenerano con `bot/webapp/sfondi.py`.
- Coppe e Nazionali (12/11, notte): FA Cup rosso con tagli neri (schede bianche), Copa del Rey nero con nastri oro e rossi, Coppa Italia bordeaux a triangoli rossi e arancio, EFL Cup verde con fasce lime e oro, DFB Pokal viola con coriandoli oro e verde, Coupe de France blu federale con esagoni bianchi, rossi e oro, Nazionali blu notte con triangoli multicolori (colori delle bandiere, come il marchio della Nations League). Fino al 14/11 (o con `?tutte` nell’indirizzo) tutte le sezioni restano nel menu per la revisione.
- Nazionali da altre leghe (12/11): `bot/webapp/naz_scelte.json` (`aggiunte`/`escluse`, id FotMob) aggiunge partite di Lega B (9807) e C (9808); prima scelta Albania-Finlandia (Lega C, 5181902). La posta in palio legge le zone dalla legenda FotMob di ogni lega (quarti, promozione, spareggi, retrocessione); nel riquadro compare "Lega C · Girone 1".
- EXTRA con la stessa interfaccia delle altre sezioni (12/11): nel browser le partite EXTRA diventano una sezione come Champions e Nazionali (`XCUP`, righe giocatore adattate), con i 4 riquadri Arbitro / Pronostico 1X2 / Linea cartellini / Il mio tris, schede Tris dell'app, Il mio tris, Tutti i titolari, Formazioni, diretta ESPN (`eng.1`, `esp.1`, `ger.1`, `fra.1` e coppe) e La mia area. `extra.mjs` aggiunge 1X2 (quote FotMob bet365), linea cartellini stimata (media del campionato × √ somma probabilità) e nota arbitro dall'archivio. Angoli tolti dall'interfaccia: avranno una sezione a parte.
- Nazionali, forza e arbitro (12/11): Sofascore risponde 403 dai server di GitHub, quindi i dati arrivano da FotMob. Ranking FIFA (`header.teams[].fifaRank`) → Elo delle nazionali per la variabile "divario di forza" del modello coppe (1950 − 105·ln(rank): 1º 1950, 3º 1835, 15º 1666, 51º 1537), e riga "Ranking FIFA" nel contesto della partita. Arbitro: gialli a gara e rossi a gara di FotMob (`infoBox.Referee.stats`, salvati in `refstat`) nella nota del riquadro; la linea cartellini delle Nazionali è la media geometrica tra la stima del modello e i cartellini a gara dell'arbitro. Le medie Sofascore mandate dall’utente stanno in `bot/webapp/arbitri.json` (nome → gialli e rossi a gara) e hanno la precedenza.
- Squadra sfavorita (12/11, su segnalazione dell'utente per Rep. Ceca-Spagna): nell'archivio (Elo ricostruito con vantaggio casa, partite dal 2021) la sfavorita prende il 53% dei gialli con divario Elo < 100, 56% 100-200, 59% 200-300, 62% oltre (Champions 53, 57, 63, 67%). Il modello coppe vede solo |divario|: per le Nazionali, se dà alla sfavorita (dalle quote 1X2) meno di 0,515 + 0,033·|divario|/100 (massimo 64%), le probabilità vengono spostate in logit per lato fino a quella quota, totale invariato (`underdogFix`, flag `sfav`). Da verificare anche su Champions ed EXTRA con gli esiti.
