# Web app "I miei ammoniti"

Pagina unica (`index.html`) con le partite della giornata: scegli una partita, premi il cartellino giallo
"I miei ammoniti" e compaiono le tre figurine del trio più probabile. "Un altro trio" mostra il successivo in classifica.
Due modalità: **2 + 1 tra le squadre** (almeno un giocatore per squadra) oppure **Liberi**.

Versione pubblicata (aggiornata da Claude a ogni ricalcolo): https://claude.ai/artifact/TR5e5jMWv3LbPP4DnKpLbq

## Aprirla in locale
- Doppio clic su `index.html` (funziona offline, tranne i caratteri tipografici), oppure
- `npx serve .` dentro questa cartella e poi http://localhost:3000

## Metterla su Vercel
1. Crea un account su vercel.com (o accedi).
2. Opzione A: `npm i -g vercel` e poi `vercel` dentro questa cartella (rispondi alle domande, è un sito statico).
   Opzione B: carica la cartella su un repository GitHub e importalo da vercel.com → "Add New Project".
3. Non serve nessuna configurazione: Vercel pubblica `index.html` così com'è.

## Aggiornare i dati
1. Nella scheda Sofascore del browser integrato: `copy(JSON.stringify(exportAppData(P, round)))` oppure lo fa Claude (vedi RUNBOOK).
2. Salva il risultato come `data.json` e lancia `python3 build.py` → rigenera `index.html`.
3. Ripubblica (Claude: `publish_files` sullo stesso artifact; Vercel: `vercel --prod`).

Le figurine sono illustrazioni originali (colori sociali, numero, iniziali): niente foto o marchi ufficiali.
