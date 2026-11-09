// Test temporale della componente FotMob: tre ipotesi prefissate, senza modificare il modello servito.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {loadFotmob,buildProduction} from './production_research.mjs';
import {featureSet,evaluate,aggregate,selectCandidate} from './experiment_metrics.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const {matches,provenance}=loadFotmob(path.join(root,'input','fotmob'));
const built=await buildProduction(matches,path.join(root,'input','model'));
const {ctx,sa,ucl}=built;
const keyed=new Map([...sa,...ucl].map(d=>[d.mid+'|'+d.pid,d]));
const P={},SA={},G={D:{min:0,fd:0,dp:0},M:{min:0,fd:0,dp:0},F:{min:0,fd:0,dp:0}},MU={},X={};
const ROLE=p=>p===1?'D':p===3?'F':'M';
const lr=ctx.__CST2.LR,CK=ctx.__CK;
const coord=r=>Number.isFinite(r[12])&&Number.isFinite(r[13])?[r[12],r[13]]:null;
const rateFD=(id,role,league)=>{const p=P[id],m=lr[league+'|'+role]?.fd??1.1;return ((p?.fd||0)+m*CK/90)/((p?.efd||0)+m*CK/90)*m;};
const rateSA=(id,role)=>{const p=SA[id],m=G[role].min?G[role].fd/G[role].min*90:1.1;return ((p?.fd||0)+m*1500/90)/((p?.min||0)+1500)*90;};
const log=v=>Math.log(Math.max(.05,v??1));
let computed=0,fallback=0;
for(const m of matches){
  const st=m.pl.filter(r=>r[4]===1&&r[3]!==0);
  if(m.lg===55||m.lg===42)for(const r of st){
    const d=keyed.get(m.id+'|'+r[0]);if(!d)continue;
    const h=coord(r),facing=[];const ownRole=ROLE(r[3]);
    if(h)for(const o of st){
      if(o[2]===r[2])continue;const ho=coord(o);if(!ho)continue;
      const role=P[o[0]]?.role||ROLE(o[3]);const weight=Math.exp(-Math.hypot(h[0]-(1-ho[0]),h[1]-(1-ho[1]))/.12);
      const fd=m.lg===55?rateSA(o[0],SA[o[0]]?.role||ROLE(o[3])):rateFD(o[0],role,m.lg);
      const po=X[o[0]],mean=MU[role]?.min?MU[role].da/MU[role].min*90:1;
      const da=((po?.da||0)+mean*900/90)/((po?.min||0)+900)*90/Math.max(.05,mean);
      facing.push({id:o[0],name:o[1],weight,fd,da});
    }
    facing.sort((a,b)=>b.weight-a.weight);
    const avg=(a,k)=>a.length?a.reduce((s,x)=>s+x.weight*x[k],0)/a.reduce((s,x)=>s+x.weight,0):null;
    const cf=avg(facing,'fd'),top2=avg(facing.slice(0,2),'fd'),da=avg(facing,'da');
    const sd=SA[r[0]],gr=G[ownRole],meanDP=gr.min?gr.dp/gr.min*90:1;
    const dp=m.lg===42?(d.x2?.dp??1):(((sd?.dp||0)+meanDP*900/90)/((sd?.min||0)+900)*90/Math.max(.05,meanDP));
    d.duel={currentFacing:cf??d.facing,top2Facing:top2??d.facing,attackingDribbles:da??1,ownVulnerability:dp,hasPosition:!!facing.length,topOpponent:facing[0]?.name??null};
    if(facing.length)computed++;else fallback++;
  }
  // Tutti gli aggiornamenti avvengono dopo le righe della partita, mai fra compagni o avversari dello stesso incontro.
  for(const r of m.pl){
    if(!r[5]||r[3]===0)continue;
    const p=P[r[0]]??={role:ROLE(r[3]),fd:0,efd:0};const L=lr[m.lg+'|'+p.role];
    p.fd+=r[7];p.efd+=(L?.fd??1.1)*r[5]/90;
    if(m.lg===55){const p=SA[r[0]]??={role:ROLE(r[3]),fd:0,min:0,dp:0};p.fd+=r[7];p.min+=r[5];p.dp+=r[11];const g=G[p.role];g.min+=r[5];g.fd+=r[7];g.dp+=r[11];}
    const extra=m.x?.[r[0]];if(extra&&Number.isFinite(extra[1])){const x=X[r[0]]??={min:0,da:0};x.min+=r[5];x.da+=extra[1];const g=MU[p.role]??={min:0,da:0};g.min+=r[5];g.da+=extra[1];}
  }
}
const definitions={
  base:'Variabili e fit logistico della componente FotMob usata in produzione; esclusa la fusione con Sofascore e quote.',
  formazione:'Sostituisce facing con la stessa propensione a subire falli, pesata sulle posizioni della formazione della partita.',
  due_avversari:'Sostituisce facing con la media pesata dei due avversari più vicini nella formazione della partita.',
  interazione:'Aggiunge log dribbling tentati degli avversari di zona e la sua interazione con log vulnerabilità individuale al dribbling.'
};
const seasons=['2022/2023','2023/2024','2024/2025','2025/2026','2026/2027'];
const result={schema:2,modelRef:'8824f5e94d1198fb88f93493e171e1d401a21b1a',dataRef:provenance.ref,matches:matches.length,definitions,protocol:{development:seasons.slice(0,3),holdout:seasons.slice(3),threshold:.0002,selection:'Un solo candidato selezionato sullo sviluppo se deltaLL <= -0.0002 e deltaTop3 >= 0; holdout consultato dopo aver fissato tale scelta.',limitations:['Le medie di lega già presenti nella produzione sono ricostruite con la stessa procedura originale; questo non corregge retroattivamente eventuali limiti del baseline.','Le posizioni storiche della formazione non hanno un timestamp certificato prima del calcio d’inizio.','Il confronto riguarda la componente FotMob e non il modello finale con quote e Sofascore.','Test temporale retrospettivo; non è un esperimento prospettico su partite future.']},positionCoverage:{computed,fallback},competitions:{}};
for(const [comp,rows,base] of [['sa',sa,built.featuresSA],['ucl',ucl,built.featuresUCL]]){
  const folds={};
  for(const season of seasons){
    const tr=rows.filter(d=>d.season<season),te=rows.filter(d=>d.season===season);if(!tr.length||!te.length)continue;
    console.log(`${comp} ${season}: ${tr.length} allenamento, ${te.length} test`);
    const baseModel=ctx.fitLogit(tr,base,2),basePred=te.map(baseModel.pred);
    folds[season]={};
    for(const name of Object.keys(definitions)){
      const fsx=featureSet(base,name,comp);if(rows.some(d=>fsx.some(f=>!Number.isFinite(f(d)))))throw new Error(`Variabile non finita ${comp} ${name}`);
      const pred=name==='base'?basePred:te.map(ctx.fitLogit(tr,fsx,2).pred);
      folds[season][name]=evaluate(te,pred,basePred);
    }
  }
  const development=Object.fromEntries(Object.keys(definitions).map(name=>[name,aggregate(seasons.slice(0,3).filter(s=>folds[s]).map(s=>folds[s][name]))]));
  const selected=selectCandidate(development);
  // Solo dopo aver fissato selected vengono sintetizzati gli anni di holdout.
  const holdout=Object.fromEntries(Object.keys(definitions).map(name=>[name,aggregate(seasons.slice(3).filter(s=>folds[s]).map(s=>folds[s][name]))]));
  result.competitions[comp]={rows:rows.length,features:base.length,development,selected,holdout,folds};
}
const out=path.join(root,'results','esperimento-1v1.json');fs.writeFileSync(out,JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({output:out,results:Object.fromEntries(Object.entries(result.competitions).map(([k,v])=>[k,{selected:v.selected,development:v.development,holdout:v.holdout}]))},null,2));
