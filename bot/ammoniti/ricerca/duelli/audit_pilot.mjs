// Esecuzione dell'audit su file archiviati. Nessuna richiesta di rete e nessuna modifica alla produzione.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { normalizeMatch, compareApp, marketAudit, verifiedSubstitutions } from './duelli.mjs';
import {accountFouls} from './accounting.mjs';

const [cacheArg, appArg, quoteArg, outArg, commitArg, identitiesArg] = process.argv.slice(2);
if (!outArg) throw new Error('Uso: node audit_pilot.mjs <cache> <data.json> <valutazione.jsonl> <uscita>');
const cache=path.resolve(cacheArg), out=path.resolve(outArg);
const fixtures=JSON.parse(await readFile(path.join(cache,'fixtures.json'),'utf8'));
const receipts=JSON.parse(await readFile(path.join(cache,'receipts.json'),'utf8'));
const appRaw=await readFile(appArg,'utf8'),quoteRaw=await readFile(quoteArg,'utf8');
const app=JSON.parse(appRaw);
const quoteRows=quoteRaw.trim().split(/\r?\n/).filter(Boolean).map(JSON.parse);
const identitiesRaw=identitiesArg?await readFile(identitiesArg,'utf8'):null;
const identities=identitiesRaw?JSON.parse(identitiesRaw):{};
const matches=[];
for(const fixture of fixtures){
  const filename=`summary-${fixture.id}.json`, raw=await readFile(path.join(cache,filename),'utf8');
  const receipt=receipts.sources.find(s=>s.file===filename);
  if(!receipt||receipt.sha256!==createHash('sha256').update(raw).digest('hex'))throw new Error(`Fonte non verificata: ${filename}`);
  const j=JSON.parse(raw);
  if(String(j.header?.id)!==fixture.id)throw new Error(`Id partita discordante: ${fixture.id}`);
  const match=normalizeMatch(j,fixture,identities);
  match.accounting=accountFouls(j,match);
  match.substitutions=verifiedSubstitutions(match);
  match.appComparison=compareApp(match,app);
  matches.push(match);
}
const sums=group=>({
  matches:group.length,
  rawFoulRows:group.reduce((s,m)=>s+m.audit.rawFoulRows,0),
  foulEvents:group.reduce((s,m)=>s+m.audit.foulEvents,0),
  trustedPairs:group.reduce((s,m)=>s+m.audit.trustedPairs,0),
  expectedFouls:group.reduce((s,m)=>s+m.audit.teamAudit.reduce((t,x)=>t+(x.expected??0),0),0),
  missingTeamTotals:group.reduce((s,m)=>s+m.audit.teamAudit.filter(t=>t.expected==null).length,0),
  untrustedFouls:group.reduce((s,m)=>s+m.audit.untrustedFouls,0),
  unstructuredFoulRows:group.reduce((s,m)=>s+m.audit.unstructuredFoulRows,0),
  duplicateSourceIds:group.reduce((s,m)=>s+m.audit.duplicateSourceIds,0),
  coordinateConflicts:group.reduce((s,m)=>s+m.audit.coordinateConflicts,0),
  cards:group.reduce((s,m)=>s+m.audit.cards,0),
  linkedCards:group.reduce((s,m)=>s+m.audit.linkedCards,0),
  verifiedSubstitutions:group.reduce((s,m)=>s+m.substitutions.filter(x=>x.valid).length,0),
  unverifiedSubstitutions:group.reduce((s,m)=>s+m.substitutions.filter(x=>!x.valid).length,0)
});
const groups={};for(const m of matches)(groups[`${m.fixture.league}|${m.fixture.season}`]??=[]).push(m);
const allApp=[...(app.matches||[]),...Object.values(app.cups||{}).flatMap(c=>c.matches||[])];
const appRows=allApp.map(m=>({id:m.id,partita:`${m.h} - ${m.a}`,comp:m.comp||'sa',official:!!m.uff,players:m.pl.length,missingVs:m.pl.filter(r=>!r[5]).length,substituteFallback:m.pl.filter(r=>r[7]==null).length,thinHistory:Object.values(m.tags||{}).flat().filter(t=>/Poca esperienza/.test(t)).length}));
const report={
  schema:2, baseCommit:commitArg??null,
  inputHashes:{appData:createHash('sha256').update(appRaw).digest('hex'),marketLog:createHash('sha256').update(quoteRaw).digest('hex'),identityRegistry:identitiesRaw?createHash('sha256').update(identitiesRaw).digest('hex'):null},
  purpose:'Audit di qualità e casi descrittivi. Nessuna stima del guadagno predittivo; nessuna modifica del modello.',
  totals:sums(matches),groups:Object.fromEntries(Object.entries(groups).map(([k,v])=>[k,sums(v)])),
  accounting:{totals:Object.fromEntries(['structuredFouls','structuredHandballs','textHandballPenalties','textOnlyFouls','expected','residual','unknownSide'].map(k=>[k,matches.reduce((s,m)=>s+m.accounting[k],0)])),teamsWithResidual:matches.flatMap(m=>m.accounting.teams.filter(t=>t.residual!==0).map(t=>({match:m.fixture.id,...t})))},
  matches:matches.map(m=>({fixture:m.fixture,audit:m.audit,accounting:m.accounting,appComparison:m.appComparison,substitutions:m.substitutions,untrustedFouls:m.events.filter(e=>e.type==='foul'&&!e.trusted),coordinateConflicts:m.events.filter(e=>e.coordinateConflict).map(e=>({id:e.id,sourceIds:e.sourceIds,minute:e.minute,people:e.people}))})),
  market:marketAudit(quoteRows),appDataQuality:appRows,
  caveats:[
    'Il numero di falli con coppia identificata diviso per il totale del tabellino è un riscontro contabile, non una misura di accuratezza: falli di mano e rigori possono avere struttura diversa.',
    'Un fallo osservato prova un contatto sanzionato fra due giocatori; non misura tutti gli 1 contro 1 né il tempo passato a marcarsi.',
    'L’associazione fallo-cartellino richiede motivo esplicito, stesso autore e periodo, un solo fallo precedente entro 30 secondi; resta un’associazione temporale da validare.',
    'Coordinate discordi conservate come conflitto e non usate; serve verificare orientamento e convenzione prima di confrontarle con FotMob.',
    'Rosa e file attuale dell’app sono dati a posteriori: per un test prepartita servono snapshot archiviati prima del calcio di inizio.',
    'Campione di convenienza selezionato per date e id, non rappresentativo dell’intera stagione. Per misurare il valore predittivo occorrono più stagioni e test temporale.'
  ]
};
await mkdir(out,{recursive:true});
await writeFile(path.join(out,'audit.json'),JSON.stringify(report,null,2)+'\n');
await writeFile(path.join(out,'eventi-normalizzati.json'),JSON.stringify(matches)+'\n');
await writeFile(path.join(out,'fonti.json'),await readFile(path.join(cache,'receipts.json'),'utf8'));
console.log(JSON.stringify({totals:report.totals,groups:report.groups,comparedMatches:report.matches.filter(m=>m.appComparison).length,market:report.market},null,2));
