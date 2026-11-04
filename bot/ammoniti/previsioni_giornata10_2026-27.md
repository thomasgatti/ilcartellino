# Previsioni ammoniti, Serie A 2026-27, 10ª giornata
Modello v0 (logistico, allenato su FBref 2017-22, applicato a dati Sofascore 2025-26 + 2026-27 fino alla 9ª).
Formazioni PROBABILI Sofascore al 31/10 ore 04:45: da rifare con le ufficiali ~1h prima.
Formato: probabilità | gialli e falli nelle ultime 2 stagioni | gialli in questa stagione.

| Partita | Arbitro | Ammoniti attesi* | P(3/3) top-3 | Top 3 |
|---|---|---|---|---|
| Milan - Inter (sab 20:45) | Guida | 3,97 | 2,5% | Bastoni 31%, Çalhanoğlu 31%, Barella 26% |
| Como - Venezia (dom 12:30) | n/d | 3,60 | 2,2% | Juan Jesus 31%, Kike Pérez 29%, Halhal 25% |
| Atalanta - Parma (lun 20:45) | n/d | 3,05 | 1,7% | Diego Carlos 29%, Obrić 25%, Troilo 24% |
| Udinese - Roma (sab 18:00) | Maresca | 3,57 | 1,7% | Mancini 26%, Hermoso 25%, De Roon 25% |
| Bologna - Monza (sab 15:00) | Zanotti | 3,28 | 1,4% | Lucchesi 26%, Ferguson 24%, Kouadio 22% |
| Sassuolo - Fiorentina (lun 18:30) | n/d | 3,39 | 1,2% | Viery 28%, Drăgușin 22%, João Mário 20% |
| Lecce - Genoa (dom 18:00) | n/d | 3,31 | 1,2% | Veiga 24%, H. J. Traorè 22%, Østigård 22% (diffidato) |
| Lazio - Cagliari (dom 15:00) | n/d | 3,19 | 1,1% | J. Rodríguez 24%, Zé Pedro 22%, Provstgaard 21% |
| Frosinone - Torino (dom 15:00) | n/d | 3,21 | 1,0% | Masini 22%, Cittadini 22%, Bracaglia 21% (diffidato) |
| Juventus - Napoli (dom 20:45) | n/d | 2,72 | 0,8% | Rafa Marín 22%, Douglas Luiz 20%, Olivera 18% |

*somma delle probabilità dei 20 titolari di movimento (portieri esclusi).

## Milan - Inter nel dettaglio (derby, arbitro Guida: 70 ammoniti in 19 partite nei nostri dati, 3,7 a gara)
1. Alessandro Bastoni (Inter, D) 31%: 8 gialli e 53 falli in 2.898'; 2 gialli in stagione
2. Hakan Çalhanoğlu (Inter, M) 31%: 8 gialli e 32 falli in 1.981'; 1 giallo in stagione
3. Nicolò Barella (Inter, M) 26%: 9 gialli e 39 falli in 3.203'; 2 gialli in stagione
4. Adrien Rabiot (Milan, M) 23%
5. Manuel Akanji (Inter, D) 22%
6. Koni De Winter (Milan, D) 22%
Assenti Milan: Saelemaekers, Tomori, Gabbia, Chukwueze. Assenti Inter: Pavard, Curtis Jones, Stones, Lautaro, Luís Henrique.

## Aggiornamento v0.1: duelli diretti (posizioni medie Sofascore)
Variabile nuova: falli subiti/90' dei 3 avversari più vicini in campo (posizione media abituale, ultime 8 partite).
Verifica su 9.371 titolari: difensori contro avversari poco "fallati" 15,4% di gialli, contro i più fallati 19,5%.
Test sulla stagione 2026-27 (allenamento sul 2025-26): AUC da 0,588 a 0,599, log loss da 0,3721 a 0,3709.

Milan - Inter con i duelli (prima -> dopo):
- Bastoni 31% -> 32% (di fronte Hutchinson, Gila)
- Çalhanoğlu 31% -> 32% (Modrić, Rabiot)
- Barella 26% -> 26% (Pavlović, Moreira)
- **De Winter 22% -> 25%** (di fronte **Pio Esposito, 2,5 falli subiti/90'**, e Thuram 1,9)
- Akanji 22% -> 24% (Gonçalo Ramos 1,7, Pulisic)
- Rabiot 23% -> 21%; Pavlović 20% -> 19% (di fronte Barella e Diouf, che subiscono pochi falli)
- P(3/3) del trio Bastoni-Çalhanoğlu-Barella: 2,6%

Altri spostamenti forti: Cagliari contro Isaksen e Zaccagni (J. Rodríguez 24% -> 28%, Zé Pedro 22% -> 26%),
Diego Carlos contro Rowe (29% -> 32%), Halhal contro Baturina (25% -> 28%).

## Aggiornamento v0.2 (31/10 ore 14:30): proteste, quote 1X2, quota cartellini
Modello riallenato SOLO su dati Sofascore 2025-26 + 2026-27, variabili tutte pre-partita.
Validazione incrociata a 5 blocchi su 430 partite (8.600 titolari):
| Versione | Log loss | AUC |
|---|---|---|
| base (gialli/falli storici, ruolo, casa, squadre) | 0,3983 | 0,592 |
| + duelli (posizioni abituali) | 0,3983 | 0,593 |
| + gialli per proteste/perdite di tempo | 0,3981 | 0,594 |
| + arbitro | 0,3978 | 0,598 |
| + quota "cartellini in partita" | 0,3957 | 0,610 |
| + quote 1X2 (squadra sfavorita) | 0,3947 | 0,618 |
I guadagni più grandi vengono dalle quote. L'arbitro pesa poco una volta presa la linea cartellini (i bookmaker lo hanno già messo nel prezzo).
Correlazione tra ammoniti della stessa partita: varianza osservata 2,01 contro 2,35 attesa se indipendenti, quindi leggermente NEGATIVA.
La P(3/3) reale è quindi un po' sotto il prodotto delle tre probabilità, non sopra.
Nota: le percentuali sono più basse della v0 perché questo modello è calibrato sulle ultime due stagioni (14% medio per titolare, meno gialli di prima) e conta solo i titolari.

| Partita | Arbitro | 1X2 casa/trasf. | Linea cartellini | Top 3 (v0.2) | P(3/3) |
|---|---|---|---|---|---|
| Lazio - Cagliari | Colombo | 67/14 | 4,5 | Zé Pedro 23%, J. Rodríguez 22%, Obert 22% | 1,1% |
| Como - Venezia | Ferrieri Caputi | 73/10 | 3,5 | Juan Jesus 26%, Halhal 21%, K. Pérez 18% | 1,0% |
| Juventus - Napoli | Sozza | 41/29 | 4,5 | Gatti 21%, Rafa Marín 21%, Rrahmani 21% | 1,0% |
| Bologna - Monza | Zanotti | 55/20 | 3,5 | Lucchesi 23%, Kouadio 20%, Akinsanmiro 20% | 0,9% |
| Milan - Inter | Guida | 26/47 | 4,5 | Bastoni 22%, De Winter 21%, Çalhanoğlu 19% | 0,9% |
| Sassuolo - Fiorentina | n/d | 33/41 | 4,5 | Viery 21%, Cinquegrano 19%, Odenthal 19% | 0,7% |
| Udinese - Roma | Maresca | 17/60 | 3,5 | Kabasele 20%, Mancini 18%, Hermoso 18% | 0,6% |
| Frosinone - Torino | Mucera | 45/30 | 3,5 | Patterson 21%, Cittadini 16%, Comuzzo 16% | 0,5% |
| Lecce - Genoa | Marchetti | 29/40 | 3,5 | Østigård 18%, Veiga 18%, Siebert 17% | 0,5% |
| Atalanta - Parma | n/d | 63/16 | 2,5 | Diego Carlos 18%, Troilo 14%, Britschgi 14% | 0,3% |

Milan - Inter v0.2: Bastoni 22%, De Winter 21% (contro Pio Esposito), Çalhanoğlu 19%, Pavlović 16%, Akanji 15%, Rabiot 15%, Barella 15%.

## Aggiornamento v0.3 (31/10 ore 14:35): 5 stagioni di storico + tutte le variabili
Storico Sofascore 2022-23 → 2026-27: 1.610 partite, 50.469 righe giocatore-partita (formazioni, falli, dribbling,
velocità, scatti, cartellini con motivo, quote 1X2 e cartellini, posizioni medie, calendari di tutte le competizioni).
Validazione incrociata a 5 blocchi su 1.460 partite (29 mila titolari), aggiungendo un gruppo di variabili alla volta:
| Gruppo aggiunto | Log loss | AUC | Ammoniti giusti su 3 | 3/3 reali |
|---|---|---|---|---|
| base | 0,4228 | 0,603 | 0,675 | 1,1% |
| + duelli | 0,4224 | 0,605 | 0,678 | 1,0% |
| + duelli estesi (dribbling, velocità, scatti dell'avversario) | 0,4222 | 0,606 | 0,675 | 1,0% |
| + gialli per proteste | 0,4219 | 0,608 | 0,674 | 1,0% |
| + arbitro | 0,4207 | 0,615 | 0,681 | 1,1% |
| + quota cartellini | 0,4202 | 0,617 | 0,674 | 1,0% |
| + quote 1X2 | **0,4194** | **0,621** | **0,693** | 1,1% |
| + riposo / coppe in settimana | 0,4195 | 0,621 | 0,690 | 1,1% |
| + classifica / posta in palio | 0,4195 | 0,621 | 0,690 | 1,0% |
| + ex, precedenti, derby | 0,4195 | 0,621 | 0,690 | 1,0% |
| + diffida / rientro da squalifica | 0,4195 | 0,621 | 0,687 | 1,1% |
Conclusione: tengo fino alle quote 1X2. Le ultime quattro non aggiungono nulla (le quote ne contengono già l'informazione).
Modello finale: 3/3 nell'1,1% delle partite, almeno 2/3 nel 12,7%, 0,69 ammoniti giusti su 3 (a caso: ~0,47).

| Partita | Formazioni | Top 3 v0.3 | P(3/3) |
|---|---|---|---|
| Lazio - Cagliari | probabili | Zé Pedro 26%, J. Rodríguez 22%, Obert 22% | 1,3% |
| Bologna - Monza | **UFFICIALI** | Kouadio 24%, Lucchesi 22%, L. Colombo 20% (tutti Monza) | 1,1% |
| Sassuolo - Fiorentina | probabili | Viery 23%, Á. Jiménez 21%, Odenthal 18% | 0,9% |
| Udinese - Roma | probabili | Hermoso 21%, Kabasele 20%, Abankwah 19% | 0,8% |
| Como - Venezia | probabili | Juan Jesus 21%, Halhal 19%, K. Pérez 19% | 0,7% |
| Milan - Inter | probabili | De Winter 20%, Bastoni 18%, Çalhanoğlu 17% | 0,6% |
| Juventus - Napoli | probabili | Rafa Marín 20%, Douglas Luiz 18%, Gatti 16% | 0,6% |
| Atalanta - Parma | probabili | Diego Carlos 20%, Troilo 16%, Obrić 15% | 0,5% |
| Frosinone - Torino | probabili | Patterson 19%, Coco 16%, Cittadini 16% | 0,5% |
| Lecce - Genoa | probabili | Vásquez 17%, Østigård 16%, Siebert 16% | 0,5% |

## Milan - Inter: modello contro bookmaker (quote "+ Cartellino", Oddschecker, un solo bookmaker, 31/10 ore 14:30)
| Giocatore | Quota | P implicita (con margine) | Modello v0.3 | Modello / quota |
|---|---|---|---|---|
| Bastoni | 3,10 | 32% | 18% | 0,56 |
| Barella | 3,30 | 30% | 14% | 0,47 |
| Çalhanoğlu | 3,40 | 29% | 17% | 0,58 |
| Pavlović | 3,40 | 29% | 13% | 0,45 |
| Rabiot | 3,75 | 27% | 14% | 0,52 |
| De Winter | 3,80 | 26% | 20% | **0,77** |
Altri nella lista del bookmaker, non nelle formazioni probabili Sofascore: Estupiñán 3,20; Loftus-Cheek 3,30; Mkhitaryan 3,60; Diawara 3,75.
Lettura: nessun giocatore ha probabilità del modello superiore a quella implicita nella quota, quindi nessuna giocata a valore positivo.
De Winter è quello che il modello "preferisce" di più rispetto al mercato; Pavlović e Barella quelli che il mercato paga meno di quanto il modello ritenga giusto.
Le formazioni sono da ricontrollare: il bookmaker quota giocatori che Sofascore non dà titolari.

## Modulo live
File `live_module.js`: aggiorna le probabilità durante la partita con falli commessi, cartellini già dati, cambi e severità dell'arbitro vista in campo.
Al fischio d'inizio restituisce esattamente la probabilità pre-partita. Esempio: un giocatore partito al 25% arriva all'intervallo
all'11% se non ha commesso falli, al 31% con 2 falli, al 42% con 3. È euristico: Sofascore non dà l'orario dei falli, quindi non è ancora validato minuto per minuto.

## Aggiornamento v0.4 (31/10 ore 14:45): ruoli fini, peso alle stagioni recenti, boosting, fusione con il mercato
Test TEMPORALE (alleno sulle stagioni precedenti, provo su 2024-25, 2025-26, 2026-27: 850 partite):
| Versione | Log loss | AUC | Giusti su 3 | Calibrazione (prev./reali) |
|---|---|---|---|---|
| v0.3 attuale | 0,4024 | 0,622 | 0,634 | 1,024 |
| + ruoli fini (profondità e fascia dalla posizione abituale) | **0,4019** | **0,623** | 0,639 | 1,024 |
| + ruoli, peso stagioni recenti 0,6 | 0,4020 | 0,623 | 0,645 | 1,032 |
| + ruoli, peso stagioni recenti 0,8 | 0,4019 | 0,623 | 0,639 | 1,028 |
| boosting (non lineare) + ruoli | 0,4042 | 0,614 | 0,588 | 1,085 |
Tengo: ruoli fini. Scarto: peso alle stagioni recenti (nessun guadagno) e boosting (peggiora, sovrastima).
Ruoli osservati: centrocampisti bassi 19,6% di gialli, alti 14,3%, di fascia 14,8%; difensori centrali 19,0%, esterni 17,9%; punte 10,4%.
Il modello sovrastima di circa il 2-3% in media: le percentuali vanno lette un filo più basse.

Fusione con il bookmaker (Milan - Inter, quote "+ Cartellino", formazioni probabili): metà peso al modello e metà alle quote,
dopo aver allineato i livelli (le quote del bookmaker sono in media 1,86 volte le probabilità del modello: margine + diversa stima).
| Giocatore | Modello v0.4 | Mercato (riallineato) | Fusa |
|---|---|---|---|
| Bastoni | 17% | 17% | 17% |
| De Winter | 20% | 14% | 17% |
| Çalhanoğlu | 17% | 16% | 16% |
| Akanji | 15% | - | 15% |
| Rabiot | 15% | 14% | 14% |
| Pavlović | 13% | 16% | 14% |
| Barella | 12% | 16% | 14% |

Altre partite v0.4: Bologna - Monza (ufficiali) Kouadio 23%, Lucchesi 21%, L. Colombo 20%.
Lazio - Cagliari: **Deiola 28%** (sale perché gioca da centrocampista basso), Zé Pedro 25%, Obert 22%.

## Esiti (da compilare dopo le partite)
| Partita | Ammoniti reali | Top 3 azzeccati |
|---|---|---|
| Bologna-Monza 2-1 | Mangas, Odgaard, Pobega, Lucchesi, Zortea, Touré (entrato per Kouadio), Amondarain (entrato per Zortea) | 2/3 con regola sostituto: Lucchesi sì, Kouadio sì via Touré, Ferguson no |
| Udinese-Roma 2-5 | Miller, Cristante | 0/3: Kabasele, Abankwah, Hermoso non ammoniti (partita chiusa al 37', solo 20 falli) |
| Milan-Inter 3-1 | De Winter (49', trattenuta), Moreira (52', proteste), C. Augusto (90') | 1/3: De Winter sì; Çalhanoğlu e Musah/Bastoni no (sostituti non ammoniti) |
