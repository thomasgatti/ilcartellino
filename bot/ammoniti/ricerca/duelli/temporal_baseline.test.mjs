// Test di contaminazione temporale: gli esiti futuri non devono cambiare variabili passate.
import test from 'node:test';import assert from 'node:assert/strict';import path from 'node:path';import {fileURLToPath} from 'node:url';
import {buildTemporal,availableAt} from './temporal_baseline.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),models=path.join(root,'input/model');
function match(id,ts,lg=55){
  const pl=[],x={};for(const side of[1,0])for(let i=0;i<11;i++){
    const pid=side*100+i,pos=i===0?0:i<5?1:i<9?2:3;
    pl.push([pid,'Player '+pid,side,pos,1,90,1,2,4,3,2,1,(i%5)/5,.2+i/20,25]);x[pid]=[1,2,30,1,3,1];
  }
  return {id,ts,lg,season:'2022/2023',h:[10,'Home'],a:[20,'Away'],hs:1,as:0,ref:[8,'Referee'],pl,cards:[[101,12,'Yellow','card_desc_foul',1]],x};
}
const t=1660000000;
const vector=(b,id)=>[...b.sa.map(d=>({d,f:b.featuresSA})),...b.ucl.map(d=>({d,f:b.featuresUCL}))].filter(x=>x.d.mid===id).map(({d,f})=>({pid:d.pid,values:f.map(g=>g(d)),min:d.min,historyMaxAvailableAt:d.historyMaxAvailableAt}));

test('ritardo minimo di tre ore oppure fine esplicita valida',()=>{
  assert.equal(availableAt({id:1,ts:t}),t+10800);assert.equal(availableAt({id:1,ts:t,endTs:t+7200}),t+7200);
  assert.throws(()=>availableAt({id:1,ts:t},0));assert.throws(()=>availableAt({id:1,ts:t,endTs:t-1}));
});
test('partita ancora in corso esclusa e disponibilità strettamente precedente',async()=>{
  const b=await buildTemporal([match(1,t),match(2,t+3600),match(3,t+10800),match(4,t+10801)],models);
  for(const id of[1,2,3])assert.equal(b.sa.find(d=>d.mid===id).min,0);
  assert.equal(b.sa.find(d=>d.mid===4).min,90);
  assert.equal(b.sa.find(d=>d.mid===4).historyMatches,1);
});
test('stessi risultati al passato aggiungendo o alterando tutte le statistiche future',async()=>{
  const past=[match(1,t),match(2,t+86400,42),match(3,t+2*86400)],future=match(4,t+3*86400,42);
  const a=await buildTemporal(past,models),changed=structuredClone(future);changed.cards=changed.pl.filter(r=>r[3]!==0).map(r=>[r[0],1,'Yellow','card_desc_foul',r[2]]);changed.pl.forEach(r=>{r[6]=99;r[7]=123;r[8]=999;r[11]=777;});Object.values(changed.x).forEach(x=>x.fill(999));
  const b=await buildTemporal([...past,future],models),c=await buildTemporal([...past,changed],models);
  for(const id of[1,2,3]){assert.deepEqual(vector(a,id),vector(b,id));assert.deepEqual(vector(a,id),vector(c,id));}
  assert.deepEqual(vector(b,4),vector(c,4),'Gli esiti della gara da prevedere non sono feature della gara stessa');
});
test('gare simultanee e appena iniziate non aggiornano medie, arbitro, stile e precedenti',async()=>{
  const a=match(1,t),b=match(2,t),c=match(3,t+3600,42),changed=structuredClone(a);
  changed.cards=changed.pl.filter(r=>r[3]!==0).map(r=>[r[0],10,'Yellow','card_desc_foul',r[2]]);changed.pl.forEach(r=>{r[6]=90;r[8]=900;r[11]=800;});
  const x=await buildTemporal([a,b,c],models),y=await buildTemporal([changed,b,c],models);
  for(const id of[2,3])assert.deepEqual(vector(x,id),vector(y,id));
});
test('posizione historical non usa le coordinate della gara da prevedere',async()=>{
  const a=match(1,t),b=match(2,t+86400,42),changed=structuredClone(b);changed.pl.forEach(r=>{r[12]=1-r[12];r[13]=1-r[13];});
  const x=await buildTemporal([a,b],models),y=await buildTemporal([a,changed],models);assert.deepEqual(vector(x,2),vector(y,2));
  assert.equal(x.featuresSA.length,19);assert.equal(x.featuresUCL.length,16);assert.equal(x.protocol.positionMode,'historical');
});
test('fine esplicita può riordinare le disponibilità senza anticipare una gara lunga',async()=>{
  const a={...match(1,t),endTs:t+14400},b={...match(2,t+1800),endTs:t+9000},c=match(3,t+10000);
  const x=await buildTemporal([a,b,c],models);const row=x.sa.find(d=>d.mid===3);assert.equal(row.historyMatches,1);assert.equal(row.historyMaxAvailableAt,t+9000);assert.equal(row.min,90);
});
test('snapshot EXS e medie di gruppo restano immutate anche dopo le soglie di storico',async()=>{
  const past=Array.from({length:24},(_,i)=>({...match(i+1,t+i*86400,i%3===0?42:55),cards:i%2?[[101,12,'Yellow','card_desc_foul',1],[2,44,'Red','',0]]:[],hs:i%3,as:(i+1)%3}));
  const future=match(25,t+25*86400,42),changed=structuredClone(future);
  changed.cards=changed.pl.filter(r=>r[3]!==0).map(r=>[r[0],12,'Yellow','card_desc_foul',r[2]]);changed.hs=20;changed.as=30;
  changed.pl.forEach(r=>{r[6]=1000;r[7]=2000;r[8]=3000;r[11]=4000;});Object.values(changed.x).forEach(x=>x.fill(5000));
  const a=await buildTemporal([...past,future],models),b=await buildTemporal([...past,changed],models);
  for(const id of[21,22,23,24,25])assert.deepEqual(vector(a,id),vector(b,id));
  const snap=a.ucl.find(d=>d.mid===25);assert.ok(snap.ex.h2hN>0);assert.ok(snap.ex.refN>20);assert.equal(snap.historyMatches,24);
});
