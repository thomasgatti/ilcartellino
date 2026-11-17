# Istruzioni per agenti (Codex, Claude, altri)

Leggi prima `README.md` (struttura, dati, regole del progetto). Storia completa e procedure: `bot/ammoniti/RUNBOOK.md`.

## Regole operative
1. **Rispondi e scrivi in italiano** (interfaccia, commenti, messaggi di commit).
2. **Non lavorare direttamente su `main`**: ogni push su `main` va subito online su ilcartellino.vercel.app, dove lo usano gli amici del proprietario. Crea un ramo `codex/<cosa>`, fai lì build e controlli, poi **unisci subito a `main`** senza lasciare richieste di unione in attesa (dal 17/11/2026 il proprietario non vuole approvarle a mano). Dopo l'unione controlla che il giro successivo della Giornata automatica finisca bene e di' al proprietario che cosa è cambiato.
3. **Non modificare `index.html` della radice né `bot/webapp/index.html` a mano**: sono generati. Modifica `bot/webapp/template.html` (o i dati), poi:
   `cd bot/webapp && python3 build.py && python3 build_vercel.py && cp vercel/sito/index.html ../../index.html && rm -rf vercel/sito`
4. Non toccare il ramo `dati` né i file grandi in `bot/ammoniti/data/` senza un motivo esplicito.
5. Se modifichi un `.js` presente sia in `lib/` sia in `bot/ammoniti/`, tieni identiche le due copie.
6. Modifiche al modello: tienile solo se migliorano la log loss sul test temporale (≥ ~0,0002) senza peggiorare i primi 3 per partita. Riporta i numeri nel RUNBOOK, in una nuova sezione datata in fondo. Prima di provare un'idea, cerca nel RUNBOOK se è già stata scartata.
7. Non cambiare il formato di `localStorage` `ammoniti_tris_v1` né le chiavi di `data.json` / `risultati.json` senza mantenere la compatibilità: il sito legge anche i dati vecchi.
8. Niente foto, loghi o marchi ufficiali; niente correzioni manuali "+" sui giocatori; niente etichetta "partita a senso unico".
9. Prima di consegnare una modifica all'interfaccia: build, poi controllo visivo (Playwright o browser) a 1300 px e 390 px, tema Serie A e tema Champions, e nessun errore nuovo in console (l'errore "Invalid time value" esiste già).
10. Non lanciare i workflow di GitHub Actions che pubblicano (`formazioni.yml` con `prova: false`) senza che il proprietario lo chieda.
