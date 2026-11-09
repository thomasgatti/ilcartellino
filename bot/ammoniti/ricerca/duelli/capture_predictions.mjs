// Archivia pronostici già pubblicati prima delle gare, senza ricalcolarli o sovrascrivere registrazioni.
import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
export function snapshotPredictions(raw,{capturedAt=new Date().toISOString(),sourceCommit}={}){
 if(!/^[a-f0-9]{40}$/.test(sourceCommit||''))throw new Error('Serve il commit esatto dei dati');
 const now=Date.parse(capturedAt);if(!Number.isFinite(now))throw new Error('Istante di acquisizione non valido');
 const data=JSON.parse(raw),all=[...(data.matches||[]).map(m=>({...m,comp:m.comp||'sa'})),...Object.entries(data.cups||{}).flatMap(([comp,c])=>(c.matches||[]).map(m=>({...m,comp:m.comp||comp})))];
 const matches=all.filter(m=>Number.isFinite(m.ko)&&m.ko*1000>now&&!m.live?.fin&&!(m.live?.t>0)).sort((a,b)=>a.ko-b.ko||a.id-b.id);
 for(const m of matches)for(const r of m.pl||[])if(!Number.isFinite(r[4])||r[4]<0||r[4]>1)throw new Error(`Probabilità non valida: ${m.id}`);
 if(new Set(matches.map(m=>m.comp+'|'+m.id)).size!==matches.length)throw new Error('Partite duplicate');
 return {schema:1,capturedAt:new Date(now).toISOString(),sourceCommit,sourceSha256:createHash('sha256').update(raw).digest('hex'),scope:'Pronostici pubblicati del sito, con formazioni disponibili e p0/q originali. Nessun pronostico della ricerca sostituisce il modello servito.',limitations:'Il timestamp locale non è una certificazione indipendente; il commit remoto che conserva questo file fornisce un ulteriore riscontro temporale. Una sola giornata non basta per validare nuovi modelli.',excludedAlreadyStarted:all.length-matches.length,matches};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const [input,output,sourceCommit]=process.argv.slice(2);if(!sourceCommit)throw new Error('Uso: node capture_predictions.mjs <data.json> <snapshot.json> <commit-fonte>');
 const snapshot=snapshotPredictions(fs.readFileSync(input,'utf8'),{sourceCommit});fs.mkdirSync(path.dirname(path.resolve(output)),{recursive:true});fs.writeFileSync(output,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({file:output,matches:snapshot.matches.length,capturedAt:snapshot.capturedAt,sourceCommit}));
}
