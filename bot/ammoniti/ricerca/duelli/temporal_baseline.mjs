// Baseline di ricerca con stati disponibili prima del calcio d'inizio.
// Non modifica la produzione né calibra probabilità sugli anni di verifica.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';

const ROLE=p=>p===1?'D':p===3?'F':'M';
const CUPS=new Set([42,73,10216]);
const ELO0={47:1720,87:1700,54:1680,55:1680,53:1620,61:1580,57:1580,71:1520,40:1520,48:1480,135:1480,38:1470,122:1470,64:1470,69:1460,46:1460,441:1460,59:1440,176:1400,262:1380};
const n=x=>Number.isFinite(x)?x:0;
const log=x=>Math.log(Math.max(.005,x??1));
const logStyle=x=>Math.log(Math.max(.05,x??1));
const byTime=(a,b)=>a.ts-b.ts||Number(a.id)-Number(b.id);
const mean=(a,k,fallback)=>a.length?a.reduce((s,x)=>s+x[k],0)/a.length:fallback;
const habit=p=>p?.xs?.length?[0,1].map(i=>p.xs.slice(-8).reduce((s,x)=>s+x[i],0)/Math.min(8,p.xs.length)):null;
const addPosition=(p,r)=>{if(Number.isFinite(r[12])&&Number.isFinite(r[13])){p.xs.push([r[12],r[13]]);if(p.xs.length>8)p.xs.shift();}};
const rateMean=(g,k,fallback)=>g?.min?Math.max(.005,n(g[k])/g.min*90):fallback;
const cardSets=m=>({booked:new Set((m.cards||[]).filter(c=>c[2]==='Yellow'||c[2]==='YellowRed').map(c=>+c[0])),nonfoul:new Set((m.cards||[]).filter(c=>c[2]==='Yellow'&&c[3]&&c[3]!=='card_desc_foul').map(c=>+c[0]))});

// Se manca una fine certificata, tre ore sono un'ipotesi prudente, non una misura della latenza del fornitore.
export function availableAt(m,bufferSeconds=10800){
  if(!Number.isFinite(m.ts)||m.ts<=0)throw new Error(`Calcio d'inizio non valido: ${m.id}`);
  if(m.endTs!=null){if(!Number.isFinite(m.endTs)||m.endTs<m.ts)throw new Error(`Fine partita non valida: ${m.id}`);return m.endTs;}
  if(!Number.isFinite(bufferSeconds)||bufferSeconds<10800)throw new Error('Senza fine certificata il ritardo deve essere almeno tre ore');
  return m.ts+bufferSeconds;
}

export const featureNamesSA=['log_gialli','log_falli','ruolo_M','ruolo_F','casa','logit_livello_lega','gialli_squadra','falli_subiti_avversaria','facing','log_arbitro','log_precedenti','rosso_precedente','lateralita','profondita','forza_D_pos','forza_M_pos','forza_D_neg','forza_M_neg','forza_F'];
export const featureNamesUCL=['ruolo_M','ruolo_F','casa','log_gialli','log_falli','log_facing','divario_assoluto','log_arbitro','log_precedenti','rosso_precedente','diffida','lateralita','profondita','log_dribbling_subiti','log_duelli_vinti','log_palloni_persi'];

export async function buildTemporal(matches,modelDirectory,options={}){
  const bufferSeconds=options.bufferSeconds??10800,positionMode=options.positionMode??'historical';
  if(!['historical','lineup'].includes(positionMode))throw new Error('positionMode deve essere historical oppure lineup');
  const manifest=JSON.parse(fs.readFileSync(fileURLToPath(new URL('./model-manifest.json',import.meta.url))));
  const sources={};
  for(const source of manifest.files){
    const name=path.basename(source.path),text=fs.readFileSync(path.join(modelDirectory,name),'utf8').replace(/\r\n/g,'\n').trimEnd()+'\n';
    if(createHash('sha256').update(text).digest('hex')!==source.canonicalSha256)throw new Error(`Sorgente non verificato: ${name}`);
    sources[name]=text;
  }
  // Riutilizzati solo regressione, trasformazioni e stato del contesto: nessuna build globale viene invocata.
  const ctx=vm.createContext({console,Math,Date,Map,Set,Promise});ctx.window=ctx;
  for(const name of ['fm_model.js','ext_model.js'])vm.runInContext('{'+sources[name]+'\n}',ctx,{filename:name,timeout:1000});
  const EXS=ctx.extState(),LR={},TF={},P={},Psa={},T={},Tsa={},ELO={},Gsa={D:{min:0,y:0,f:0,fd:0},M:{min:0,y:0,f:0,fd:0},F:{min:0,y:0,f:0,fd:0}};
  const MU2={},P2={},MU3={},P3={},F3=['ds','da','tch','int','rec','disp'];
  const lgq=[],facingHistory={sum:0,n:0};let lgSum=0,maxAvailableAt=null,applied=0,unknownEnd=0;
  const cupRate=(id,role,lg,k)=>{const p=P[id],g=LR[lg+'|'+role],r=rateMean(g,k,{y:.2,f:1.2,fd:1.1}[k]),expected={y:'ey',f:'ef',fd:'efd'}[k];return ((p?.[k]||0)+r*600/90)/((p?.[expected]||0)+r*600/90)*r;};
  const saRate=(id,role,k)=>{const p=Psa[id],r=rateMean(Gsa[role],k,{y:.2,f:1.2,fd:1.1}[k]);return ((p?.[k]||0)+r*1500/90)/((p?.min||0)+1500)*90;};
  const style=(id,role,kind,k)=>{const p=kind===2?P2[id]:P3[id],g=kind===2?MU2[role]:MU3[role],r=rateMean(g,k,1),minutes=kind===2?p?.min:p?.xm;return ((p?.[k]||0)+r*900/90)/((minutes||0)+900)*90/r;};
  const sourcesFor=(m,r,sa)=>{
    const ps=sa?Psa:P,h=habit(ps[r[0]]);if(!h)return [];
    return m.pl.filter(o=>o[4]===1&&o[3]!==0&&o[2]!==r[2]).flatMap(o=>{
      const ho=habit(ps[o[0]]);if(!ho)return [];
      const role=ps[o[0]]?.role||ROLE(o[3]);
      return [{id:o[0],name:o[1],role,side:o[2],weight:Math.exp(-Math.hypot(h[0]-(1-ho[0]),h[1]-(1-ho[1]))/.12),fd:sa?saRate(o[0],role,'fd'):cupRate(o[0],role,m.lg,'fd'),priorMin:ps[o[0]]?.min||0}];
    }).sort((a,b)=>b.weight-a.weight);
  };
  const opponentAverage=a=>{const w=a.reduce((s,o)=>s+o.weight,0);return w?a.reduce((s,o)=>s+o.weight*o.fd,0)/w:null;};
  function update(entry){
    const {m,available,saRows}=entry,{booked,nonfoul}=cardSets(m),tF=[0,0],tFD=[0,0],tY=[0,0];
    const tf=TF[m.lg],normalizer=tf?.n?Math.max(.005,tf.f/(2*tf.n)):12;
    // Le medie usate come esposizione sono fotografate prima di aggiungere i dati di questa partita.
    const before={};for(const role of ['D','M','F'])before[role]=Object.fromEntries(['y','f','fd'].map(k=>[k,rateMean(LR[m.lg+'|'+role],k,{y:.2,f:1.2,fd:1.1}[k])]));
    for(const r of m.pl){
      if(!r[5]||r[3]===0)continue;
      const y=booked.has(+r[0])?1:0,role=P[r[0]]?.role||ROLE(r[3]),lr=before[role];
      const p=P[r[0]]??={min:0,y:0,f:0,fd:0,ey:0,ef:0,efd:0,role,xs:[]};
      p.min+=r[5];p.y+=y;p.f+=n(r[6]);p.fd+=n(r[7]);p.ey+=lr.y*r[5]/90;p.ef+=lr.f*r[5]/90;p.efd+=lr.fd*r[5]/90;addPosition(p,r);
      // La media di lega segue il ruolo osservato nella riga storica, come cupLeagueRates originale.
      const g=LR[m.lg+'|'+ROLE(r[3])]??={min:0,y:0,f:0,fd:0};g.min+=r[5];g.y+=y;g.f+=n(r[6]);g.fd+=n(r[7]);
      tF[r[2]]+=n(r[6]);tFD[r[2]]+=n(r[7]);tY[r[2]]+=y;
      if(m.lg===55){const s=Psa[r[0]]??={min:0,y:0,f:0,fd:0,role:ROLE(r[3]),xs:[]};s.min+=r[5];s.y+=y;s.f+=n(r[6]);s.fd+=n(r[7]);addPosition(s,r);const g=Gsa[s.role];g.min+=r[5];g.y+=y;g.f+=n(r[6]);g.fd+=n(r[7]);}
      const s=P2[r[0]]??={min:0,dw:0,dp:0};s.min+=r[5];s.dw+=n(r[8]);s.dp+=n(r[11]);
      if(r[5]>=30){const g=MU2[ROLE(r[3])]??={min:0,dw:0,dp:0};g.min+=r[5];g.dw+=n(r[8]);g.dp+=n(r[11]);}
      const s3=P3[r[0]]??={xm:0,ds:0,da:0,tch:0,int:0,rec:0,disp:0};
      const extra=m.x?.[r[0]];if(extra&&F3.every((_,i)=>Number.isFinite(extra[i]))){s3.xm+=r[5];F3.forEach((k,i)=>s3[k]+=extra[i]);if(r[5]>=30){const g=MU3[ROLE(r[3])]??={min:0,ds:0,da:0,tch:0,int:0,rec:0,disp:0};g.min+=r[5];F3.forEach((k,i)=>g[k]+=extra[i]);}}
    }
    for(const side of [0,1]){const tid=(side?m.h:m.a)[0];(T[tid]??=[]).push({fn:tF[side]/normalizer,fdn:tFD[side]/normalizer});if(T[tid].length>10)T[tid].shift();if(m.lg===55){(Tsa[tid]??=[]).push({y:tY[side],fd:tFD[side]});if(Tsa[tid].length>10)Tsa[tid].shift();}}
    (TF[m.lg]??={n:0,f:0}).n++;TF[m.lg].f+=tF[0]+tF[1];
    const eh=ELO[m.h[0]]??(ELO0[m.lg]||1450),ea=ELO[m.a[0]]??(ELO0[m.lg]||1450),expect=1/(1+10**((ea-eh-60)/400)),result=m.hs>m.as?1:m.hs===m.as?.5:0,k=CUPS.has(m.lg)?30:20;
    ELO[m.h[0]]=eh+k*(result-expect);ELO[m.a[0]]=ea-k*(result-expect);
    ctx.extUpd(m,EXS);
    if(m.lg===55){for(const d of saRows){lgq.push(d.y);lgSum+=d.y;if(lgq.length>3000)lgSum-=lgq.shift();if(d.facing!=null){facingHistory.sum+=d.facing;facingHistory.n++;}}}
    applied++;maxAvailableAt=Math.max(maxAvailableAt??0,available);
  }
  const ordered=matches.filter(m=>m.ts&&m.pl?.length>20).toSorted(byTime);
  if(new Set(ordered.map(m=>m.id)).size!==ordered.length)throw new Error('Partite duplicate nel baseline');
  const pending=[],sa=[],ucl=[];let next=0;
  for(const m of ordered){
    // Coda ordinata per disponibilità, non per ordine degli id o dei calci d'inizio.
    while(next<pending.length&&pending[next].available<m.ts)update(pending[next++]);
    const historyMaxAvailableAt=maxAvailableAt,historyMatches=applied,{booked}=cardSets(m);
    // In modalità prudente anche le due variabili di posizione usano il passato, non la formazione archiviata a posteriori.
    const forContext=positionMode==='lineup'?m:{...m,pl:m.pl.map(r=>{const rr=[...r],h=habit(P[r[0]]);rr[12]=h?.[0]??null;rr[13]=h?.[1]??null;return rr;})};
    const ex=ctx.extFx(forContext,EXS),starters=m.pl.filter(r=>r[4]===1&&r[3]!==0),saRows=[];
    if(m.lg===55||m.lg===42)for(const r of starters){
      const isSA=m.lg===55,ps=isSA?Psa:P,p=ps[r[0]],role=p?.role||ROLE(r[3]),home=r[2],opponents=sourcesFor(m,r,isSA),facing=opponentAverage(opponents),own=(home?m.h:m.a)[0],opp=(home?m.a:m.h)[0];
      const d={mid:m.id,pid:r[0],name:r[1],team:(home?m.h:m.a)[1],opponentTeam:(home?m.a:m.h)[1],side:home,home,role,season:m.season,lg:m.lg,ts:m.ts,y:booked.has(+r[0])?1:0,min:p?.min||0,facing,opponents,ex:ex[r[0]],historyMaxAvailableAt,historyMatches,priorPosition:habit(ps[r[0]])};
      if(isSA){d.yc=saRate(r[0],role,'y');d.fl=saRate(r[0],role,'f');d.lgr=lgq.length>500?lgSum/lgq.length:.17;d.tyc=mean(Tsa[own]||[],'y',2);d.ofd=mean(Tsa[opp]||[],'fd',11);d.facingImputed=facing??(facingHistory.n?facingHistory.sum/facingHistory.n:1.1);sa.push(d);saRows.push(d);}
      else{d.yc=cupRate(r[0],role,m.lg,'y');d.fl=cupRate(r[0],role,m.lg,'f');d.gap=((ELO[opp]??1450)-(ELO[own]??1450)+(home?-60:60))/100;d.x2={dp:style(r[0],ROLE(r[3]),2,'dp'),dw:style(r[0],ROLE(r[3]),2,'dw')};d.x3={disp:style(r[0],ROLE(r[3]),3,'disp')};ucl.push(d);}
    }
    const available=availableAt(m,bufferSeconds);if(m.endTs==null)unknownEnd++;
    // Disponibilità esplicite possono non seguire il calcio d'inizio: manteniamo ordinata la parte non consumata.
    const entry={m,available,saRows};let at=pending.length;while(at>next&&pending[at-1].available>available)at--;pending.splice(at,0,entry);
  }
  const C=ctx.EXT_CANDS;
  const featuresSA=[d=>log(d.yc),d=>log(d.fl),d=>+(d.role==='M'),d=>+(d.role==='F'),d=>d.home,d=>Math.log(Math.max(.005,d.lgr)/Math.max(.005,1-d.lgr)),d=>d.tyc,d=>d.ofd,d=>d.facingImputed,...C.arbitro,...C.precedenti,...C.posizione_partita,...C.forza_ruolo];
  const featuresUCL=[d=>+(d.role==='M'),d=>+(d.role==='F'),d=>d.home,d=>log(d.yc),d=>log(d.fl),d=>log(d.facing??1.1),d=>Math.abs(d.gap??0),...C.arbitro,...C.precedenti,...C.diffida,...C.posizione_partita,d=>logStyle(d.x2?.dp),d=>logStyle(d.x2?.dw),d=>logStyle(d.x3?.disp)];
  for(const [competition,rows,features]of[['sa',sa,featuresSA],['ucl',ucl,featuresUCL]])for(const d of rows){if(d.historyMaxAvailableAt!=null&&d.historyMaxAvailableAt>=d.ts)throw new Error(`Contaminazione temporale: ${d.mid}`);if(features.some(f=>!Number.isFinite(f(d))))throw new Error(`Variabile non finita: ${competition} ${d.mid} ${d.pid}`);}
  return {ctx,sa,ucl,featuresSA,featuresUCL,featureNamesSA,featureNamesUCL,protocol:{name:'baseline_temporale_prudente',sourceRef:manifest.ref,bufferSeconds,positionMode,matches:ordered.length,matchesWithoutCertifiedEnd:unknownEnd,limitations:['Ricostruzione di ricerca delle 19/16 variabili: medie e imputazioni solo da partite disponibili; non equivale al sistema servito con Sofascore, quote e calibrazione finale.','In assenza di endTs la disponibilità è ipotizzata a calcio d’inizio +3 ore; non è una certificazione dell’orario di fine o della latenza del provider.','Le rose dei titolari sono quelle storicamente archiviate: manca uno snapshot certificato prepartita. In modalità historical le posizioni numeriche sono invece calcolate soltanto dal passato.','I valori iniziali neutri delle medie stile sono fissati a 1 e le medie positive hanno soglia 0,005; non sono selezionati sui risultati di verifica.']}};
}
