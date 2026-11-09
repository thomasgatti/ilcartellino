import test from 'node:test';import assert from 'node:assert/strict';
import {ATTACKER_PROTOCOL,prepareAttackerObservation,buildAttackerHistory} from './attacker_history.mjs';

const row=(pid,name,side,pos,starter=1,min=90,x=.5,y=.5)=>[pid,name,side,pos,starter,min,0,0,0,0,0,0,x,y];
function fm(mid,ts=0){return {id:mid,lg:55,ts,cards:[[1,2,'Yellow','card_desc_foul',true]],pl:[row(1,'Difensore',1,1,1,90,.5,.3),row(2,'Attaccante',0,3,1,90,.5,.7)]};}
function normalized(){return {fixture:{id:'e'},roster:[{id:'d',played:true,yc:1},{id:'a',played:true,yc:0}],events:[{id:'f',type:'foul',trusted:true,period:1,sec:100,people:[{id:'d'},{id:'a'}]},{id:'f2',type:'foul',trusted:true,period:1,sec:400,people:[{id:'d'},{id:'a'}]},{id:'c',type:'yellow-card',trusted:true,period:1,sec:105,people:[{id:'d'}]}],linkedCards:[{cardId:'c',foulId:'f',period:1,sec:105,player:{id:'d'},victim:{id:'a'},reason:'fallo_esplicito',status:'associazione_temporale_univoca'}],unstructured:[],accounting:{residual:0,unknownSide:0}};}
const bridge=mid=>({status:'abbinata',fotmobMatchId:String(mid),playerMap:{d:'1',a:'2'}});
const observation=(m,n=normalized())=>prepareAttackerObservation(n,m,bridge(m.id));

test('trial singoli: unica carta collegata positiva, altro fallo negativo; /90 osservato',()=>{
 const o=observation(fm(1));assert.equal(o.conversionEligible,true);assert.equal(o.per90Eligible,true);assert.deepEqual(o.trials.map(t=>t.y),[1,0]);assert.equal(o.players.find(r=>r.fotmobId==='2').associatedYellows,1);
});
test('carta vicina non specificata censura il fallo e impedisce zeri /90',()=>{
 const n=normalized();n.linkedCards[0]={...n.linkedCards[0],reason:'non_specificato',foulId:null,status:'non_associata'};const o=observation(fm(1),n);
 assert.equal(o.conversionEligible,true);assert.equal(o.trials.length,1);assert.equal(o.trials[0].foulId,'f2');assert.equal(o.audit.trialAudit.censored,1);assert.equal(o.per90Eligible,false);assert.equal(o.players.length,0);
});
test('dati delle carte incompleti non generano trial negativi',()=>{
 const n=normalized();n.events=n.events.filter(e=>e.type==='foul');n.linkedCards=[];const o=observation(fm(1),n);assert.equal(o.conversionEligible,false);assert.equal(o.trials.length,0);assert.equal(o.players.length,0);assert.equal(o.audit.expectedCards,1);
});
test('un cartellino con identità o testo discordanti blocca anche i negativi',()=>{
 const n=normalized();n.events.find(e=>e.type==='yellow-card').trusted=false;const o=observation(fm(1),n);assert.equal(o.conversionEligible,false);assert.equal(o.trials.length,0);assert.equal(o.per90Eligible,false);
});
test('cronaca mancante non espone minuti e mantiene i profili assenti',()=>{
 const n=normalized();n.events=[];n.linkedCards=[];const a=fm(1),b=fm(2,20000),o=observation(a,n),r=buildAttackerHistory([a,b],[o]);assert.equal(o.conversionEligible,false);assert.equal(o.per90Eligible,false);assert.equal(r.profiles.length,0);assert.equal(r.byKey.get('2|1').conversionSignal,0);assert.equal(r.byKey.get('2|1').conversionCoverage,0);
});
test('fonte o identità sotto90% resta esclusa, senza forzare coppie',()=>{
 const n=normalized();n.events.push(...Array.from({length:3},(_,i)=>({id:'bad'+i,type:'foul',trusted:false,period:1,sec:600+i,people:[{id:'d'},{id:'a'}]})));const o=observation(fm(1),n);assert.equal(o.conversionEligible,false);assert.equal(o.audit.sourceFraction,.4);assert.equal(o.trials.length,0);
 const r=prepareAttackerObservation(normalized(),fm(1),{...bridge(1),playerMap:{d:'1'}});assert.equal(r.conversionEligible,false);assert.equal(r.audit.mappedFraction,0);
});
test('soglia contabile /90 non elimina trial di conversione verificati',()=>{
 const n=normalized();n.accounting.residual=2;const o=observation(fm(1),n);assert.equal(o.conversionEligible,true);assert.equal(o.per90Eligible,false);assert.equal(o.trials.length,2);
});
test('stesso istante, gara futura e gara ancora sovrapposta non aggiornano le feature',()=>{
 const a=fm(1,1000),overlap=fm(2,11000),future=fm(3,20000),o=observation(a),r=buildAttackerHistory([a,overlap,future],[o]);
 for(const k of ['1|1','2|1']){assert.equal(r.byKey.get(k).conversionSignal,0);assert.equal(r.byKey.get(k).conversionCoverage,0);}
 assert.ok(r.byKey.get('3|1').conversionCoverage>0);assert.ok(r.byKey.get('3|1').conversionSignal>0);
});
test('mutare un esito futuro lascia identiche tutte le feature precedenti',()=>{
 const a=fm(1,1000),b=fm(2,20000),c=fm(3,40000),oa=observation(a),ob=observation(b),changed=structuredClone(ob);for(const t of changed.trials)t.y=0;for(const p of changed.players)p.associatedYellows=0;
 const r=buildAttackerHistory([a,b,c],[oa,ob]),s=buildAttackerHistory([a,b,c],[oa,changed]);
 assert.deepEqual(r.byKey.get('1|1'),s.byKey.get('1|1'));assert.deepEqual(r.byKey.get('2|1'),s.byKey.get('2|1'));assert.notEqual(r.byKey.get('3|1').conversionSignal,s.byKey.get('3|1').conversionSignal);
});
test('verticalLayout della gara bersaglio non viene usato per l’abbinamento',()=>{
 const a=fm(1,1000),b=fm(2,20000),changed=structuredClone(b);changed.pl[0][12]=.01;changed.pl[0][13]=.99;changed.pl[1][12]=.99;changed.pl[1][13]=.01;
 const r=buildAttackerHistory([a,b],[observation(a)]),s=buildAttackerHistory([a,changed],[observation(a)]);assert.deepEqual(r.byKey.get('2|1'),s.byKey.get('2|1'));
});
test('pochi falli sono shrunk e la classifica richiede esposizione minima',()=>{
 const a=fm(1,1000),b=fm(2,20000),r=buildAttackerHistory([a,b],[observation(a)]),p=r.profiles.find(p=>p.fotmobId==='2');
 assert.equal(p.fouls,2);assert.ok(p.conversionRate>0&&p.conversionRate<.5);assert.equal(p.rankConversion,false);assert.equal(p.rankPer90,false);assert.equal(r.protocol.conversionShrinkFouls,50);assert.equal(ATTACKER_PROTOCOL.per90ShrinkMinutes,900);
});
test('i subentrati ricevono esposizione dei soli minuti giocati e sono disponibili dopo fine gara',()=>{
 const a=fm(1,1000);a.pl[1][4]=0;a.pl[1][5]=27;const b=fm(2,20000),r=buildAttackerHistory([a,b],[observation(a)]),p=r.profiles.find(p=>p.fotmobId==='2');assert.equal(p.minutes,27);assert.equal(p.yMinutes,1);assert.equal(r.byKey.get('2|1').per90Coverage,1);
});
test('ogni target mantiene una riga anche se manca tutta la storia o il mapping',()=>{
 const a=fm(1),b=fm(2,20000),r=buildAttackerHistory([a,b],[]);assert.equal(r.byKey.size,4);assert.equal(r.byKey.get('1|1').missingPosition,true);assert.equal(r.byKey.get('1|1').conversionSignal,0);assert.equal(r.byKey.get('2|1').missingPosition,false);assert.equal(r.byKey.get('2|1').conversionCoverage,0);
});
test('giallo ESPN assente in FotMob censura tutti i trial di quell’autore e /90',()=>{
 const m=fm(1);m.cards=[];const o=observation(m);assert.equal(o.conversionEligible,true);assert.equal(o.trials.length,0);assert.equal(o.audit.trialAudit.censored,2);assert.equal(o.per90Eligible,false);assert.equal(o.audit.cardDisagreements.length,1);assert.equal(o.audit.cardDisagreements[0].fotmobId,'1');
});
test('giallo FotMob assente in ESPN non diventa un fallo negativo osservato',()=>{
 const m=fm(1),n=normalized();n.roster[0].yc=0;n.events=n.events.filter(e=>e.type==='foul');n.linkedCards=[];const o=observation(m,n);assert.equal(o.audit.cardAuditComplete,true);assert.equal(o.trials.length,0);assert.equal(o.per90Eligible,false);assert.equal(o.audit.cardDisagreements.length,1);
});
test('disponibilità esattamente al kickoff resta esclusa dal passato',()=>{
 const a=fm(1,1000),boundary=fm(2,1000+ATTACKER_PROTOCOL.availabilityLagSeconds),after=fm(3,boundary.ts+1),r=buildAttackerHistory([a,boundary,after],[observation(a)]);assert.equal(r.byKey.get('2|1').conversionCoverage,0);assert.equal(r.byKey.get('3|1').conversionCoverage,1);
});
