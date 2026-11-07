# Il cartellino

Per ogni partita di **Serie A** e di **Champions League**: probabilità di ammonizione di ogni giocatore, i **3 ammoniti più probabili** (il "tris dell'app"), formazioni, riquadro live, storico dei tris e area personale dove ognuno crea e salva i propri tris.

- Sito: **https://ilcartellino.vercel.app** (Vercel, progetto `ilcartellino`). Ogni push su `main` viene ripubblicato in automatico, quindi **`main` = sito degli amici**.
- Repository privato, ramo `main` (codice e sito) + ramo `dati` (storico FotMob compresso, usato dal bot nel cloud).
- Istruzioni operative complete e storia di ogni prova: [`bot/ammoniti/RUNBOOK.md`](bot/ammoniti/RUNBOOK.md) (lungo, cronologico: le sezioni più recenti valgono più delle vecchie).

---

## Come è fatto

```
template.html + data.json + lineups.txt ──build.py──▶ bot/webapp/index.html   (versione per l'artifact su claude.ai)
                       + vercel/risultati.json ──build_vercel.py──▶ vercel/sito/index.html ──copia──▶ index.html (radice = sito Vercel)
```

| Percorso | Cosa contiene |
|---|---|
| `index.html` (radice) | **Generato**, è il sito pubblicato. Non modificarlo a mano. |
| `bot/webapp/template.html` | **Sorgente dell'interfaccia**: HTML, CSS e JavaScript in un file solo. Le modifiche grafiche si fanno qui. |
| `bot/webapp/data.json` | Partite e probabilità (Serie A in `matches`, Champions in `cups.ucl.matches`). |
| `bot/webapp/vercel/risultati.json` | Esiti delle partite finite: ammoniti, falli, sostituzioni (uscito → entrato), tris dell'app. |
| `bot/webapp/lineups.txt` | Formazioni per la scheda "Formazioni" (campo). |
| `bot/webapp/build.py`, `build_vercel.py` | Costruiscono le pagine (vedi sopra). |
| `bot/webapp/tris_app.js` | Calcola il tris dell'app di ogni partita → `tris_app.json` (serve Playwright). |
| `bot/ammoniti/` | Modello, script Python di conversione, test, RUNBOOK, dati di lavoro (`data/`, `tmp/`). |
| `lib/` | Copie dei `.js` del modello servite su `/lib/` del sito (CORS aperto, `vercel.json`): le usano la scheda FotMob nel browser e il bot nel cloud. |
| `cloud/` | Bot per GitHub Actions (Node 20): scarica FotMob, formazioni ufficiali, esiti. |
| `.github/workflows/` | `aggiorna_dati.yml` (ogni giorno 05:17 UTC, scarica FotMob nel ramo `dati`), `formazioni.yml` (manuale, Champions; di default **solo prova**), `esiti.yml` (manuale, id FotMob). |

### Dati di una partita (`data.json`)
`{id, comp, ko (unix), h, a, hc/ac ([colore sfondo, colore testo]), ref, odds, uff (formazioni ufficiali), src, tags, derby, ctx, pl, live?, lu?}`

Ogni riga di `pl`: `[nome, lato 'h'|'a', ruolo D/M/F, numero, p0, vs, st (% titolare), q (prob. giallo di chi entra al suo posto)]`.
`p0` = probabilità di giallo se titolare × st/100.

`live` (riquadro live): `{t, sc, fin, cards: [[min, nome, 'G'|'R']], fl: {nome: [fatti, subiti, lato]}, p: {nome: rischio}, out: [usciti], sub: {uscito: entrato}}`.
Sul sito Vercel il live arriva da solo dal browser (ESPN, ogni 30 s). Sull'artifact di claude.ai lo scrive `live_update.py`.

### Il modello, in breve
- **Serie A** (v0.7): regressione logistica su FotMob (6 stagioni + quella in corso). Variabili: ruolo, gialli/90 e falli/90 personali con shrinkage, casa, livello di ammonizioni della stagione, gialli della squadra, falli subiti dall'avversario e dagli avversari diretti, posizione in campo. Media in logit con il modello Sofascore v0.5 e con il mercato ("+ Cartellino") quando ci sono le quote.
- **Champions** (coppe v4): storia di ogni giocatore in tutti i campionati (~21.000 partite), indici personali per ruolo e campionato, dribbling subiti, duelli, palloni persi, quote bet365 "Player to be Booked".
- **Tris**: di default "2 + 1" (due di una squadra, uno dell'altra), con la **regola del sostituto**: vale anche il giallo di chi entra al posto del giocatore scelto. `jointK` corregge la probabilità congiunta (×1,164 per i 2+1).
- **Regola per ogni modifica del modello**: si tiene solo se migliora la log loss sul test temporale (stagione dopo stagione) di almeno ~0,0002, senza peggiorare i primi 3 per partita. Nel RUNBOOK c'è l'elenco delle idee già provate e scartate: arbitro, derby, forma, diffida in Serie A, posta in palio, ruoli dalla formazione e altre. Prima di riprovarne una, controllare lì.

---

## Lavorarci in locale

Requisiti: Python 3.10+, Node 20, Playwright con Chromium (`pip install playwright && playwright install chromium`).

```bash
cd bot/webapp
python3 build.py && python3 build_vercel.py      # rigenera le pagine
cp vercel/sito/index.html ../../index.html        # aggiorna il sito (radice)
rm -rf vercel/sito                                # cartella temporanea, non va su git
npx serve ../..                                   # poi http://localhost:3000
```

Controllare sempre **computer e telefono** (390 px di larghezza) e i due temi: Serie A (chiaro/scuro) e Champions (blu notte, `data-comp="ucl"`). Per uno screenshot veloce con Playwright: aprire `vercel/sito/index.html`, premere `#comp-ucl` per la Champions, poi `#b<idPartita>`.

### Pubblicare
1. Lavorare su un **ramo** (es. `codex/nome-modifica`): Vercel crea un'anteprima con il suo indirizzo, il sito degli amici non cambia.
2. Quando va bene: merge su `main` → Vercel ripubblica `ilcartellino.vercel.app` in un minuto.

---

## Regole del progetto (decise dal proprietario)
- Interfaccia e testi **in italiano**.
- Niente foto di giocatori, loghi o figurine ufficiali: le "figurine" sono illustrazioni originali (colori sociali, numero, iniziali).
- Niente correzioni manuali "+" sulle probabilità dei giocatori e niente etichetta "partita a senso unico": le letture personali vanno nel tris dell'utente, non nel modello.
- Il modello deve guardare il **singolo giocatore** (carattere, momento, duello specifico), non solo medie generiche, ma ogni idea passa dal test temporale.
- Per ora solo Serie A e Champions: niente Europa League né Conference.
- Colori nel riquadro live: arancione = tris dell'app, blu = tris dell'utente, giallo = ammoniti.
- I tris degli amici restano nel loro browser (`localStorage`, chiave `ammoniti_tris_v1`): non rompere quel formato (`{t<id>: {matchId, comp, partita, ko, savedAt, mio:[{n,p}], app:[{n,p}], …}}`).

## Limiti noti
- Sofascore e FotMob rispondono 403 a molti server: lo scraping completo gira nella scheda del browser (fotmob.com) oppure su GitHub Actions (FotMob lì funziona).
- `lib/` e `bot/ammoniti/` contengono gli stessi `.js`: se ne modifichi uno, copialo anche nell'altro.
- La sostituzione "chi entra al posto di chi" nel live ESPN è nuova (5/11) e non ancora vista su una partita vera; a partita finita arriva comunque da `risultati.json`.

## Aggiornamento automatico delle partite

`Giornata automatica` in GitHub Actions controlla le partite ogni 15 minuti nelle fasce delle gare. Pubblica le formazioni confermate, aggiorna il tris e registra risultato, cartellini, falli e sostituzioni nello Storico a fine gara. Il live continua ad aggiornarsi dal browser. La Serie A passa al turno successivo quando quello corrente è archiviato e il nuovo è vicino. Per la Champions controlla il turno già caricato nell’app.

1. Unisci la richiesta di modifica. In **Actions → Giornata automatica** puoi fare una prima esecuzione con **Solo prova**, che rende i file scaricabili dalla pagina dell'esecuzione.
2. In **Settings → Secrets and variables → Actions → Variables** aggiungi `CARTELLINO_AUTO` con valore `true` per attivare i controlli e la pubblicazione programmata.
3. Vercel usa il collegamento Git già esistente. Se serve un Deploy Hook per i commit del bot, crealo in Vercel per il ramo `main` e salvalo come secret GitHub Actions `VERCEL_DEPLOY_HOOK`.

Puoi sospendere il bot impostando `CARTELLINO_AUTO` a `false`. GitHub può ritardare un controllo rispetto all'orario programmato.
