// Rapporto leggibile e dati di sintesi dello studio, senza intervenire sui file dell'app.
import {readFile,writeFile,copyFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url));
const input=path.resolve(process.argv[2]||path.join(root,'results'));
const output=path.resolve(process.argv[3]||path.join(root,'deliverables'));
await mkdir(output,{recursive:true});
const r=JSON.parse(await readFile(path.join(input,'audit.json'),'utf8'));
const all=JSON.parse(await readFile(path.join(input,'eventi-normalizzati.json'),'utf8'));
const compared=all.filter(m=>m.appComparison), cc=compared.flatMap(m=>m.appComparison.cards);
const bad=all.flatMap(m=>m.events.filter(e=>e.type==='foul'&&!e.trusted).map(e=>({matchId:m.fixture.id,partita:m.fixture.name,source:m.fixture.source,id:e.id,minute:e.minute,people:e.people,texts:e.texts,problems:e.problems})));
const problemCounts={};for(const e of bad)for(const p of e.problems)problemCounts[p]=(problemCounts[p]||0)+1;
const rows=Object.entries(r.groups).map(([k,g])=>`| ${k.replace('uefa.champions','Champions').replace('ita.1','Serie A').replace('|',' | ')} | ${g.matches} | ${g.expectedFouls} | ${g.foulEvents} | ${g.trustedPairs} | ${g.linkedCards} |`).join('\n');
const missing=r.appDataQuality.filter(m=>m.comp==='sa'&&m.missingVs===m.players).map(m=>m.partita);
const market=r.market.weights.map(w=>`| ${Math.round(w.marketWeight*100)}% | ${w.logloss.toFixed(5).replace('.',',')} |`).join('\n');
const matchRows=r.matches.map(m=>`| ${m.fixture.league==='ita.1'?'Serie A':'Champions'} | ${m.fixture.season} | ${m.fixture.date.slice(0,10)} | ${m.fixture.name} | [${m.fixture.id}](${m.fixture.source}) |`).join('\n');
const s={schema:r.schema,baseCommit:r.baseCommit,inputHashes:r.inputHashes,purpose:r.purpose,totals:r.totals,groups:r.groups,problemCounts,appComparison:{matches:compared.length,mappedPlayers:compared.reduce((s,m)=>s+m.appComparison.mappedPlayers,0),totalPlayers:compared.reduce((s,m)=>s+m.appComparison.totalAppPlayers,0),linkedCardContacts:cc.length,comparable:cc.filter(c=>c.sameOpponent!==null).length,sameOpponent:cc.filter(c=>c.sameOpponent===true).length,warning:'Riscontro descrittivo fra file attuale e contatti sanzionati, non accuratezza delle marcature né valutazione prepartita.'},market:r.market,appDataQuality:r.appDataQuality,matches:r.matches.map(m=>({fixture:m.fixture,audit:m.audit,appComparison:m.appComparison?{appMatchId:m.appComparison.appMatchId,mappedPlayers:m.appComparison.mappedPlayers,totalAppPlayers:m.appComparison.totalAppPlayers,unmappedPlayers:m.appComparison.unmappedPlayers,cards:m.appComparison.cards}:null})),caveats:r.caveats};
const report=`# Studio degli 1 contro 1 — primo campione

5 novembre 2026 · ramo \`codex/studio-duelli-1v1\` · base \`${r.baseCommit}\`.

**Esito: è fattibile raccogliere contatti sanzionati fra coppie e una parte della loro cronologia. Prima di allenare nuove variabili vanno risolti gli alias e le incongruenze della fonte. Nessuna probabilità o file di produzione è stato cambiato.**

## Campione e metodo

Quaranta incontri conclusi, dieci per ogni combinazione competizione/stagione. La selezione, stabilita da date e ordinamento degli id prima dell'analisi degli esiti, è ripetibile con \`pilot.config.json\`. È un campione di convenienza vicino alle partite indicate dall'utente, non rappresentativo di un'intera stagione. Ogni risposta grezza è conservata nella cache locale e identificata in \`fonti.json\` con URL e SHA-256.

| Competizione | Stagione | Partite | Falli nel tabellino | Episodi estratti | Coppie accettate | Gialli associati temporalmente |
|---|---|---:|---:|---:|---:|---:|
${rows}

Totale: **${r.totals.expectedFouls} falli nel tabellino**, ${r.totals.foulEvents} episodi estratti da ${r.totals.rawFoulRows} righe della cronaca, **${r.totals.trustedPairs} coppie accettate**. Le doppie descrizioni fallo/punizione non vengono contate due volte. La differenza contabile di ${r.totals.expectedFouls-r.totals.foulEvents} non dimostra altrettante omissioni: mani, rigori e altre differenze di codifica devono ancora essere classificate. Non equivale a una misura di accuratezza.

## Problemi trovati e trattamento

- ${r.totals.untrustedFouls} episodi accantonati dai dati accettati: ${problemCounts.grafia_o_alias_non_verificato||0} hanno grafie o alias non verificati; ${problemCounts.testo_indica_altro_giocatore||0} indicano nel testo un altro giocatore della rosa rispetto ai partecipanti strutturati. Le categorie si sovrappongono in un episodio. Non si sceglie automaticamente quale rappresentazione abbia ragione.
- Esempio concreto: Feyenoord–Inter, 48': il testo indica Nicolò Barella, il campo strutturato Hakan Çalhanoglu. Episodio escluso. Altri casi e fonti sono in \`revisioni.json\`.
- ${r.totals.duplicateSourceIds} episodi hanno più id per stessa coppia e istante; ${r.totals.coordinateConflicts} hanno coordinate discordi, lasciate inutilizzate. Non è stata validata la convenzione delle coordinate contro FotMob.
- ${r.totals.unstructuredFoulRows} riga da fallo è priva dei metadati necessari alla ricostruzione automatica della coppia.
- ${r.totals.verifiedSubstitutions} cambi hanno testo e coppia entrato/uscito coerenti; ${r.totals.unverifiedSubstitutions} restano da verificare. Non sono trattati come assenze di sostituzione.

Le coppie vengono risolte nella rosa con id ESPN, squadra e nome esatto o iniziale più cognome univoci. Non viene creato un collegamento stabile all'id FotMob: il file dell'app espone nomi abbreviati, quindi serve un ulteriore controllo prima di estendere lo storico.

## I casi indicati dall'utente

| Giocatore | Abbinamento nel file attuale dell'app | Contatto del giallo ricostruito |
|---|---|---|
| Ian Maatsen | Lamine Yamal | Fallo su Yamal all'11'; cartellino 5 secondi dopo |
| Ayden Heaven | Matías Soulé | Fallo su Soulé al 70'; cartellino 7 secondi dopo |
| Harry Maguire | Rodrigo Mora | Fallo su Santiago Castro al 78'; cartellino 4 secondi dopo |

Il cambio Castro per Malen è coerente fra testo e metadati e precede di 14 secondi il fallo di Maguire. È un esempio della necessità di aggiornare gli avversari dopo i cambi; non prova che Maguire abbia marcato esclusivamente Castro o che Malen non lo abbia impegnato prima.

Fonti grezze: [Barcelona–Aston Villa](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915387), [Manchester United–Roma](https://site.api.espn.com/apis/site/v2/sports/soccer/uefa.champions/summary?event=401915308).

## Quanto rappresenta l'abbinamento attuale

Per ${s.appComparison.matches} incontri del campione è disponibile anche una riga corrispondente nell'app: ${s.appComparison.mappedPlayers}/${s.appComparison.totalPlayers} giocatori abbinati in modo univoco alla rosa ESPN. Gli altri nomi restano elencati nella sintesi.

Ci sono ${s.appComparison.linkedCardContacts} contatti fallo–giallo associati temporalmente in quegli incontri, ${s.appComparison.comparable} con avversario dell'app risolto. In ${s.appComparison.sameOpponent} casi il nome coincide. **Questo rapporto non misura l'accuratezza del modello**: i file sono attuali e non certificati alla vigilia; un giocatore può commettere fallo su chi non marca abitualmente; la fonte non osserva tutti gli 1 contro 1; i sostituti non erano necessariamente nel file prepartita.

Il codice di produzione riassume la zona con posizioni abituali delle ultime otto partite e una media dei falli subiti degli avversari vicini. L'etichetta \`vs\` mostra il nome con maggiore peso, mentre la variabile usa una media: il nome visualizzato e l'intero segnale del modello non sono la stessa cosa.

La conclusione operativa è raccogliere più avversari plausibili per giocatore e intervallo, conservandone i pesi e l'incertezza. Per valutare il rischio specifico del duello serve testare anche l'interazione fra capacità dell'attaccante di provocare falli/cartellini e vulnerabilità del difensore. La sola quantità media di dribbling avversari era già stata provata e scartata nel RUNBOOK.

## Live

${r.totals.linkedCards} cartellini su ${r.totals.cards} eventi gialli hanno un solo fallo coerente dello stesso autore e periodo nei 30 secondi precedenti, con motivo esplicito da fallo. È un'etichetta candidata, da verificare, non una certezza causale. I restanti comprendono motivi diversi, metadati insufficienti e associazioni non univoche.

La cronologia consente di ricostruire contatori prima di un istante fisso della gara e riduce la dipendenza dalle registrazioni del PC. Tuttavia la copertura non è completa e non si conosce il ritardo di disponibilità degli eventi: per il live servono validazione del ritardo e segnali di dato mancante. \`priorFouls\` esclude gli eventi del momento della previsione e quelli successivi; il futuro test deve usare istanti fissi, non scelti subito prima del cartellino.

## Quote e completezza degli input

Il registro esistente contiene ${r.market.rows} titolari di un turno, ${r.market.paired} con quota, distribuiti su ${r.market.matches} partite. Confronto sullo stesso insieme di ${r.market.paired} righe; le quote sono già normalizzate dal codice rispetto al totale del modello.

| Peso delle quote | Log loss, minore è meglio |
|---:|---:|
${market}

Non è una misura indipendente delle probabilità grezze del bookmaker. Non si ottimizza il peso sullo stesso turno e non viene modificato \`W_MARKET\`. Il campione va esteso con previsioni, quote, orario e versione del modello archiviati prima del calcio d'inizio.

Nel file attuale ${missing.length} partite di Serie A hanno tutti gli abbinamenti \`vs\` vuoti: ${missing.join('; ')}. Questo segnala un problema nell'informazione esportata, non dimostra che il segnale interno del modello sia assente. I valori sostituto nulli usano invece il ripiego per ruolo previsto dal sito: non sono automaticamente dati rotti. Le etichette di poca esperienza rimangono un elenco da approfondire, non una misura quantitativa di copertura della carriera.

## Prossimo esperimento e criteri di accettazione

1. Verificare gli alias per id con un secondo riscontro e classificare il divario rispetto ai tabellini. Rivedere separatamente i ${problemCounts.testo_indica_altro_giocatore||0} episodi con due identità diverse; non creare correzioni manuali alle probabilità.
2. Archiviare formazione, avversari candidati, probabilità e quote prima del calcio d'inizio. Il nome dell'avversario non deve essere ricavato dal fallo futuro che porta al cartellino.
3. Estendere a più stagioni e provare tre famiglie separatamente: assegnazione dell'avversario dalla formazione; gialli provocati dall'attaccante con regolarizzazione per piccoli campioni; interazione attaccante–difensore. Le medie e le variabili storiche devono usare soltanto partite precedenti.
4. Confrontare ogni candidato con la catena vera di produzione in test stagione per stagione; selezione e regolazione sulle sole stagioni precedenti. Tenere soltanto guadagni di log loss almeno circa 0,0002 senza peggiorare i primi tre per partita, con risultati per competizione e stagione e incertezza per partita.

Questo campione ha completato la verifica preliminare e il confronto descrittivo. **Non è stato allenato un nuovo modello e non è dimostrato alcun guadagno predittivo degli 1 contro 1.**

## Verifiche eseguite

Diciotto test superati: duplicati, identità ambigue, dati discordi, coordinate assenti, cartellini non da fallo, associazioni temporali, separazione dei tempi, esclusione di informazione futura, stesse righe nel confronto quote, tre casi reali e composizione del campione. L'audit verifica anche gli id e gli hash delle fonti archiviate. Nessun file dell'interfaccia è stato modificato, quindi non è stata eseguita una build del sito.

## Elenco delle partite

| Competizione | Stagione | Data UTC | Incontro (ospite at casa) | Fonte ESPN |
|---|---|---|---|---|
${matchRows}

## Riga per il passaggio a Claude

Sul ramo \`codex/studio-duelli-1v1\` aggiunta una ricerca ripetibile su 40 partite ESPN: 849 coppie fallo autore/vittima accettate, 102 associazioni temporali fallo–giallo, verifiche dei cambi e audit delle quote; modello, dati pubblicati e artifact Claude invariati.
`;
await writeFile(path.join(output,'rapporto.md'),report,'utf8');
await writeFile(path.join(output,'sintesi.json'),JSON.stringify(s,null,1)+'\n');
await writeFile(path.join(output,'revisioni.json'),JSON.stringify(bad,null,2)+'\n');
await copyFile(path.join(input,'fonti.json'),path.join(output,'fonti.json'));
console.log(JSON.stringify({report:path.join(output,'rapporto.md'),sintesiBytes:Buffer.byteLength(JSON.stringify(s,null,2)),revisioni:bad.length}));
