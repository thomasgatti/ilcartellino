// Risultati, dataset verificato e indicazioni per chi prosegue la ricerca.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'results-fase3'),read=n=>JSON.parse(fs.readFileSync(path.join(out,n))),write=(n,j)=>fs.writeFileSync(path.join(root,n),JSON.stringify(j,null,2)+'\n');
const a=read('audit-archivio.json'),e=read('esperimento-attaccanti.json'),profiles=read('profili-attaccanti.json');
fs.copyFileSync(path.join(out,'observations.json.gz'),path.join(root,'dati-episodi.json.gz'));
fs.copyFileSync(path.join(out,'fonti-archivio.json.gz'),path.join(root,'fonti-archivio.json.gz'));
fs.copyFileSync(path.join(out,'revisioni-archivio.json.gz'),path.join(root,'revisioni-archivio.json.gz'));
fs.writeFileSync(path.join(root,'profili-attaccanti.json.gz'),zlib.gzipSync(JSON.stringify(profiles)+'\n'));
write('audit-fase3.json',a);write('esperimento-attaccanti.json',e);
const f=(x,d=6)=>(x>=0?'+':'')+x.toFixed(d).replace('.',','),fmt=n=>n.toLocaleString('it-IT');
function table(phase){return Object.entries(e.competitions).flatMap(([comp,c])=>['conversione','per90'].map(name=>{const x=c[phase][name];return `| ${comp==='sa'?'Serie A':'Champions'} | ${name} | ${f(x.vsBase.deltaLL)} | ${f(x.vsBase.deltaTop3,4)} | ${f(x.vsCoverage.deltaLL)} | ${f(x.vsCoverage.deltaTop3,4)} |`;})).join('\n');}
const examples=profiles.profiles.filter(p=>['Lamine Yamal','Matias Soulé','Donyell Malen','Santiago Castro'].includes(p.name)).map(p=>`| ${p.name} | ${p.league===55?'Serie A':'Champions'} | ${p.fouls} | ${p.yFouls} | ${p.rankConversion?'sì':'no'} |`).join('\n');
const report=`# Ricerca sugli attaccanti e sui cartellini

Terza fase, 5 novembre 2026. È stato creato uno storico utilizzabile dei falli sugli avversari seguiti da cartellini e un riferimento di test che evita le medie future. **Nessuno dei due nuovi indici supera i criteri prefissati nello sviluppo**: non sono state cambiate le probabilità pubblicate, il modello servito o l'interfaccia.

## Dati raccolti e controllati

Raccolte e archiviate **${fmt(a.totals.fixtures)} cronache ESPN**, dal 2021/22 al 4 novembre 2026, selezionate per calendario e compatibilità con gli archivi FotMob fissati al commit ${a.dataRef}; nessun filtro sugli esiti. Tutte sono state verificate con SHA-256 e collegate a una gara FotMob tramite competizione, squadre nello stesso ordine e kickoff entro cinque minuti. Non si pretende copertura di ogni incontro ufficiale: sono le gare reperibili nell'archivio fissato, con stagione 2026/27 parziale.

Le ${fmt(a.totals.rawFoulRows)} righe della cronaca sono deduplicate in **${fmt(a.totals.foulEvents)} episodi di fallo**. Di questi ${fmt(a.totals.trustedPairs)} hanno una coppia affidabile nel fornitore, ${fmt(a.totals.mappedFouls)} anche entrambi gli id FotMob. Su ${fmt(a.totals.cards)} cartellini compaiono ${fmt(a.totals.linkedCards)} associazioni temporali univoche con un fallo; ${fmt(a.totals.mappedLinkedCards)} sono collegate a entrambi gli id. Non equivalgono a causalità dimostrata né contano i duelli senza fallo.

Le identità usano nomi/alias verificati nella stessa gara e squadra. Ancore di id stabili sono costruite solo da corrispondenze di nomi completi esatti, senza punteggi o cartellini per scegliere la persona. Sono stati esclusi due id ESPN in conflitto con più id FotMob: ${a.anchorConflicts.map(c=>c.id).join(', ')}. Le ancore possono usare metadati di identità dell'intero archivio; nessuna statistica futura di prestazione passa invece negli stati del modello. Restano errori e omissioni della fonte: ${fmt(a.sourceProblems.grafia_o_alias_non_verificato||0)} episodi con alias non verificato e ${fmt(a.sourceProblems.testo_indica_altro_giocatore||0)} con giocatori diversi fra testo e metadati, oltre alle altre anomalie nel JSON.

## Come sono stati costruiti gli indici

La conversione conta, per l'avversario, la quota di falli verificati che sono seguiti da un cartellino associabile. Richiede almeno 90% di coppie verificate e mappate, cartellini coerenti col tabellino e identità del cartellino affidabile. Un cartellino vicino non attribuibile censura il fallo; una discordanza con FotMob censura i trial di quell'autore. Dopo questi controlli restano **${fmt(a.totals.trials)} falli utilizzabili, ${fmt(a.totals.positiveTrials)} positivi, in ${fmt(a.totals.conversionEligible)} gare**. Gli altri non diventano negativi.

Il tasso per90 richiede inoltre copertura almeno95%, scarto contabile entro1 e attribuzione completa di tutti i cartellini a un fallo verificato oppure a un motivo esplicito diverso dal fallo, senza discordanza fra fonti. Restano **${a.totals.per90Eligible} gare**. I minuti dei subentrati sono quelli realmente giocati; non sono attribuiti90minuti di esposizione a chi è entrato. Il sottoinsieme per90 è selezionato dalla qualità e attribuibilità delle cronache, quindi non è rappresentativo: può favorire gare più semplici da riconciliare. Un valore nullo in questo sottoinsieme non descrive tutta la carriera.

Le stime sono attenuate verso la media passata della competizione e del ruolo:50falli per la conversione e900minuti per il tasso per90. I piccoli prior iniziali e questi parametri sono espliciti nel codice, non ottimizzati dopo i risultati. Per il difendente gli indici degli avversari sono pesati per prossimità delle posizioni abituali delle ultime8 gare disponibili. Il giocatore nuovo mantiene segnale neutro e indicatori separati della mancanza di storia. Lo storico è separato per competizione: non si scambiano senza verifica tassi Serie A e Champions.

### Esempi descrittivi degli attaccanti citati

| Giocatore | Competizione | Falli utilizzabili | Con giallo associato | Almeno50falli |
|---|---|---:|---:|---|
${examples}

Sono conteggi del sottoinsieme verificato, non classifiche definitive, stime causali o probabilità della prossima partita. Un singolo esempio, come Maatsen–Yamal o Heaven–Soulé, non basta a selezionare una variabile. L'episodio del giallo di Maguire resta collegato a Castro, entrato per Malen prima del fallo.

## Verifica temporale

Il riferimento ricostruisce19variabili Serie A e16Champions della componente FotMob. Medie di lega, ruolo, stile, imputazioni e stato del contesto usano soltanto partite disponibili prima del kickoff. Anche le coordinate numeriche vengono dal passato, non dalla formazione della gara da prevedere. In mancanza di un orario di fine certificato si usa kickoff+3ore, con confronto strettamente precedente: è una precauzione esplicita, non prova della latenza del fornitore.

Tutti i ${fmt(e.baselineProtocol.matches)} incontri di contesto sono stati controllati; tutte le variabili risultano finite. Le file di test contengono gli stessi20titolari per incontro in ogni variante: **46.240 righe in2.312 gare**. Le rose dei titolari sono quelle archiviate a posteriori, non snapshot certificati prima delle gare. Il confronto esclude Sofascore, quote, calibrazione finale, vincolo2+1 e regola del sostituto: non valida l'intero sistema pubblicato.

Allenamento sulle stagioni precedenti; sviluppo2022/23–2024/25. Il2025/26–2026/27 è una diagnostica retrospettiva, già consultata nelle fasi precedenti: non viene presentato come holdout cieco. Candidati e soglie sono fissati in attacker.protocol.json prima del primo fit. Le due varianti sono confrontate sia contro il riferimento sia contro un controllo che aggiunge solo la copertura dei dati, per distinguere il segnale dell'attaccante dalla semplice disponibilità dello storico.

Δ log loss negativo significa meno errore; Δtop3 positivo significa più ammoniti nei primi tre per gara. Gli errori standard appaiati per gara sono nel JSON; non sono intervalli bootstrap né dimostrazioni di significatività.

### Sviluppo

| Competizione | Indice | ΔLL base | Δtop3 base | ΔLL controllo | Δtop3 controllo |
|---|---|---:|---:|---:|---:|
${table('development')}

### Diagnostica retrospettiva

| Competizione | Indice | ΔLL base | Δtop3 base | ΔLL controllo | Δtop3 controllo |
|---|---|---:|---:|---:|---:|
${table('diagnostics')}

Nessuno supera nello sviluppo riduzione log loss almeno0,0002 e primi tre non peggiori contro entrambi i riferimenti. La conversione in Champions presenta un segnale favorevole negli anni diagnostici, ma non passa lo sviluppo e il guadagno contro il riferimento è inferiore alla soglia: non viene promossa. I risultati sono stati rieseguiti dopo una correzione esclusivamente anagrafica del club Viking FK/Viking, che recupera tre gare2026/27; nessun parametro o candidato è stato ritoccato sui risultati.

## Documento fornito e continuità del progetto

Il documento «I miei ammoniti: con che cosa addestriamo il modello», datato2novembre2026 e riferito a v0.6, conferma definizioni e fonti. È stato confrontato con il codice successivo e il RUNBOOK: non si riutilizzano le sue vecchie metriche, calibrazioni e regole dei sostituti come se descrivessero il modello attuale. Il confronto è in confronto-documento.md. Le informazioni sugli aggiornamenti e sulle registrazioni live nel documento sono contesto storico, non istruzioni a lanciare pubblicazioni o programmi periodici.

## Cosa rimane al progetto

Un dataset compresso di osservazioni verificate, il manifesto delle fonti con hash, il ponte fra id, il riferimento temporale corretto e un esperimento ripetibile con risultati completi, compresi quelli sfavorevoli. Il modello del sito resta invariato. L'indice degli attaccanti potrà essere riverificato su nuove gare senza cercare a posteriori la variante che vince negli stessi anni.

È disponibile capture_predictions.mjs per conservare i pronostici pubblicati prima del kickoff, senza ricalcolarli e senza sovrascrivere registrazioni. La prima fotografia locale è in snapshots/2026-11-05.json:10gare future, sorgente main fissata al commit92466cbdfdde034a29978b62864ea5ae7d25f306, p0 e q originali. Non sono pronostici prodotti dai candidati rifiutati; sono il riferimento da confrontare con gli esiti successivi. Il timestamp locale non basta da solo a certificare la registrazione: il successivo commit remoto aiuta a documentare quando è stata conservata.

Verifica:68test superati tra estrazione, identità, ordine temporale, censura dei dati mancanti e acquisizione prepartita. Non sono state toccate interfaccia, probabilità, ramo dati, copie JS di produzione o app su Claude; nessun workflow di pubblicazione è stato avviato.
`;
// Spazi in unità e date per rendere leggibile il rapporto, senza modificare i dati o il protocollo.
const hashes=[];
const readable=report.replace(/[a-f0-9]{40,64}/g,h=>`HASH_${hashes.push(h)-1}_`).replace(/(\d)(?=[A-Za-zÀ-ÿ])/g,'$1 ').replace(/\b(almeno|entro|attribuiti|ultime|gare|datato|novembre|sviluppo|Verifica:|ruolo:)(?=\d)/gi,'$1 ').replace(/\b(e|in|il)(?=\d)/g,'$1 ').replace(/commit(?=HASH_)/g,'commit ').replace(/HASH_(\d+)_/g,(_,i)=>hashes[Number(i)]);
fs.writeFileSync(path.join(root,'rapporto-fase3.md'),readable);
const stats={...a.totals,profiles:profiles.profiles.length,profilesWith50Fouls:profiles.profiles.filter(p=>p.rankConversion).length,profilesWith900Minutes:profiles.profiles.filter(p=>p.rankPer90).length};write('sintesi-fase3.json',{schema:1,totals:stats,selected:Object.fromEntries(Object.entries(e.competitions).map(([k,c])=>[k,c.selected])),protocol:e.protocol});
console.log(JSON.stringify(stats));
