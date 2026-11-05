// Due ipotesi prefissate: conversione fallo→giallo associato e gialli associati/90 degli avversari di zona.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {loadFotmob} from './production_research.mjs';import {buildTemporal} from './temporal_baseline.mjs';import {buildAttackerHistory} from './attacker_history.mjs';import {evaluate,aggregate} from './experiment_metrics.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),out=path.join(root,'results-fase3');fs.mkdirSync(out,{recursive:true});
const protocol=JSON.parse(fs.readFileSync(path.join(root,'attacker.protocol.json'))),{matches,provenance}=loadFotmob(path.join(root,'input/fotmob'));
const observationFile=fs.existsSync(path.join(out,'observations.json.gz'))?path.join(out,'observations.json.gz'):path.join(root,'dati-episodi.json.gz');
const observations=JSON.parse(zlib.gunzipSync(fs.readFileSync(observationFile)));
const built=await buildTemporal(matches,path.join(root,'input/model'),{bufferSeconds:protocol.fitting.availabilityBufferSeconds,positionMode:protocol.fitting.positionMode});
const history=buildAttackerHistory(matches,observations,{availabilityLagSeconds:protocol.fitting.availabilityBufferSeconds});
const zero={conversionSignal:0,per90Signal:0,conversionCoverage:0,per90Coverage:0,positionCoverage:0,missingPosition:true};
for(const d of [...built.sa,...built.ucl])d.attacker=history.byKey.get(`${d.mid}|${d.pid}`)??zero;
const h=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const result={schema:1,dataRef:provenance.ref,sourceCodeRef:built.protocol.sourceRef,protocolHash:h('attacker.protocol.json'),observationHash:createHash('sha256').update(fs.readFileSync(observationFile)).digest('hex'),baselineProtocol:built.protocol,attackerProtocol:history.protocol,historyAudit:history.audit,definitions:{base:'Ricostruzione temporale prudente delle variabili FotMob, esclusa la fusione finale.',copertura:'Baseline più soli indicatori della disponibilità di storico degli avversari.',conversione:'Controllo di copertura più log rapporto di conversione dei falli sugli avversari in gialli associati.',per90:'Controllo di copertura più log rapporto dei gialli associati subiti dagli avversari/90.'},protocol,competitions:{}};
const pass=r=>r.deltaLL<=-protocol.selection.minLoglossGain&&r.deltaTop3>=0;
function compareAcross(folds,seasons,name,control){return aggregate(seasons.filter(s=>folds[s]).map(s=>folds[s][name][control]));}
const compact=r=>{const q={...r};delete q.blocks;return q;};
const predictions=[];
for(const [comp,rows,base] of [['sa',built.sa,built.featuresSA],['ucl',built.ucl,built.featuresUCL]]){
 const controls=protocol.commonCoverageControls.map(k=>d=>d.attacker[k]);
 const fsx={base,copertura:[...base,...controls],conversione:[...base,...controls,d=>d.attacker.conversionSignal],per90:[...base,...controls,d=>d.attacker.per90Signal]};
 const folds={},coverage={};
 for(const season of [...protocol.development,...protocol.retrospectiveDiagnostics]){
  const tr=rows.filter(d=>d.season<season),te=rows.filter(d=>d.season===season);if(!tr.length||!te.length)continue;
  if(new Set(te.map(d=>d.mid)).size*20!==te.length)throw new Error(`Gruppo di titolari incompleto: ${comp} ${season}`);
  console.log(`${comp} ${season}: ${tr.length} allenamento, ${te.length} verifica`);
  for(const [name,features] of Object.entries(fsx))if([...tr,...te].some(d=>features.some(f=>!Number.isFinite(f(d)))))throw new Error(`Variabile non finita ${comp} ${season} ${name}`);
  const fitted=Object.fromEntries(Object.entries(fsx).map(([name,features])=>[name,built.ctx.fitLogit(tr,features,protocol.fitting.ridge)]));
  const pr=Object.fromEntries(Object.entries(fitted).map(([name,model])=>[name,te.map(d=>model.pred(d))]));
  if(Object.values(pr).some(ps=>ps.some(p=>!Number.isFinite(p)||p<=0||p>=1)))throw new Error(`Previsione non valida ${comp} ${season}`);
  folds[season]=Object.fromEntries(Object.keys(fsx).map(name=>[name,{vsBase:evaluate(te,pr[name],pr.base),vsCoverage:evaluate(te,pr[name],pr.copertura),brier:te.reduce((s,d,i)=>s+(pr[name][i]-d.y)**2,0)/te.length,coefficients:fitted[name].b}]));
  const avg=k=>te.reduce((s,d)=>s+d.attacker[k],0)/te.length;
  coverage[season]={rows:te.length,matches:te.length/20,meanConversionCoverage:avg('conversionCoverage'),meanPer90Coverage:avg('per90Coverage'),meanPositionCoverage:avg('positionCoverage'),withConversionHistory:te.filter(d=>d.attacker.conversionCoverage>0).length,withPer90History:te.filter(d=>d.attacker.per90Coverage>0).length};
  te.forEach((d,i)=>predictions.push({comp,season,mid:d.mid,pid:d.pid,ts:d.ts,y:d.y,base:pr.base[i],copertura:pr.copertura[i],conversione:pr.conversione[i],per90:pr.per90[i]}));
 }
 const development=Object.fromEntries(Object.keys(fsx).map(name=>[name,{vsBase:compareAcross(folds,protocol.development,name,'vsBase'),vsCoverage:compareAcross(folds,protocol.development,name,'vsCoverage')}]));
 const selected=['conversione','per90'].filter(name=>pass(development[name].vsBase)&&pass(development[name].vsCoverage)).sort((a,b)=>development[a].vsCoverage.deltaLL-development[b].vsCoverage.deltaLL)[0]??null;
 // Nessuna modifica a candidati o soglie dopo la scelta basata sullo sviluppo.
 const diagnostics=Object.fromEntries(Object.keys(fsx).map(name=>[name,{vsBase:compareAcross(folds,protocol.retrospectiveDiagnostics,name,'vsBase'),vsCoverage:compareAcross(folds,protocol.retrospectiveDiagnostics,name,'vsCoverage')}]));
 const diagnosticPass=selected?pass(diagnostics[selected].vsBase)&&pass(diagnostics[selected].vsCoverage):false;
 result.competitions[comp]={rows:rows.length,featureCount:base.length,coverage,development,selected,diagnostics,diagnosticPass,folds:Object.fromEntries(Object.entries(folds).map(([season,variants])=>[season,Object.fromEntries(Object.entries(variants).map(([name,r])=>[name,{...r,vsBase:compact(r.vsBase),vsCoverage:compact(r.vsCoverage)}]))]))};
}
fs.writeFileSync(path.join(out,'esperimento-attaccanti.json'),JSON.stringify(result,null,2)+'\n');
fs.writeFileSync(path.join(out,'profili-attaccanti.json'),JSON.stringify({schema:1,descriptionAsOf:history.audit.descriptionAsOf,protocol:history.protocol,profiles:history.profiles},null,2)+'\n');
fs.writeFileSync(path.join(out,'previsioni-test.json.gz'),zlib.gzipSync(JSON.stringify(predictions)+'\n'));
console.log(JSON.stringify({history:history.audit,results:Object.fromEntries(Object.entries(result.competitions).map(([k,c])=>[k,{selected:c.selected,diagnosticPass:c.diagnosticPass,development:c.development,diagnostics:c.diagnostics}]))},null,2));
