// Verifiche dei casi che potrebbero falsare lo studio: duplicati, omonimi e informazione futura.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {normalizeMatch,resolvePlayer,priorFouls,marketAudit,verifiedSubstitutions} from './duelli.mjs';
const roster=[{id:'a',name:'Ian Maatsen',names:['Ian Maatsen','I. Maatsen'],side:'away'},{id:'b',name:'Lamine Yamal',names:['Lamine Yamal','L. Yamal'],side:'home'}];
function base(){return {header:{competitions:[{competitors:[{homeAway:'home',team:{displayName:'Barcelona'}},{homeAway:'away',team:{displayName:'Aston Villa'}}]}]},rosters:['home','away'].map(side=>({homeAway:side,team:{displayName:side==='home'?'Barcelona':'Aston Villa'},roster:roster.filter(r=>r.side===side).map(r=>({starter:true,athlete:{id:r.id,displayName:r.name},stats:[]}))})),boxscore:{teams:[]},commentary:[]};}
function event(id,type,sec,names,text,seq=1,period=1){return {sequence:seq,time:{value:sec,displayValue:'11\''},text,play:{id,type:{type},clock:{value:sec,displayValue:'11\''},period:{number:period},participants:names.map(displayName=>({athlete:{displayName}})),team:{displayName:'Aston Villa'},text,fieldPositionX:35,fieldPositionY:90}};}
const foul=()=>event('f','foul',629,['Ian Maatsen','Lamine Yamal'],'Foul by Ian Maatsen (Aston Villa).');
test('stesso fallo ripetuto nella cronaca vale una sola volta',()=>{const j=base();j.commentary=[foul(),{...foul(),sequence:2,text:'Lamine Yamal (Barcelona) wins a free kick on the right wing.'}];const m=normalizeMatch(j,{});assert.equal(m.audit.rawFoulRows,2);assert.equal(m.audit.trustedPairs,1);});
test('id diversi per stessa coppia, periodo e secondo restano un episodio con conflitto coordinate',()=>{const j=base(),f=foul(),g=structuredClone(f);g.play.id='f2';g.play.fieldPositionX=65;j.commentary=[f,g];const m=normalizeMatch(j,{});assert.equal(m.audit.trustedPairs,1);assert.equal(m.audit.duplicateSourceIds,1);assert.equal(m.events[0].xy,null);assert.equal(m.events[0].coordinateConflict,true);});
test('non si associa un cartellino a un fallo futuro',()=>{const j=base();j.commentary=[event('c','yellow-card',620,['Ian Maatsen'],'Ian Maatsen (Aston Villa) is shown the yellow card for a bad foul.',1),foul()];assert.equal(normalizeMatch(j,{}).linkedCards[0].foulId,null);});
test('associazione univoca al fallo precedente e stesso autore',()=>{const j=base();j.commentary=[foul(),event('c','yellow-card',634,['Ian Maatsen'],'Ian Maatsen (Aston Villa) is shown the yellow card for a bad foul.',2)];assert.equal(normalizeMatch(j,{}).linkedCards[0].victim.id,'b');});
test('due falli precedenti rendono ambigua l’associazione',()=>{const j=base();j.commentary=[foul(),event('f2','foul',631,['Ian Maatsen','Lamine Yamal'],'Foul by Ian Maatsen (Aston Villa).',2),event('c','yellow-card',634,['Ian Maatsen'],'Ian Maatsen (Aston Villa) is shown the yellow card for a bad foul.',3)];assert.equal(normalizeMatch(j,{}).linkedCards[0].status,'ambigua');});
test('proteste o esultanza non si trasformano in gialli provocati da un avversario',()=>{const j=base();j.commentary=[foul(),event('c','yellow-card',634,['Ian Maatsen'],'Ian Maatsen (Aston Villa) is shown the yellow card for excessive celebration.',2)];assert.equal(normalizeMatch(j,{}).linkedCards[0].foulId,null);});
test('testo e partecipanti discordi escludono la coppia dai dati affidabili',()=>{const j=base(),f=foul();f.text='Foul by Another Player (Aston Villa).';j.commentary=[f];const m=normalizeMatch(j,{});assert.equal(m.audit.trustedPairs,0);assert.ok(m.events[0].problems.includes('grafia_o_alias_non_verificato'));});
test('un omonimo non viene abbinato arbitrariamente',()=>{const r=[...roster,{...roster[0],id:'c'}];assert.equal(resolvePlayer('I. Maatsen',r,'away').player,null);assert.equal(resolvePlayer('L. Yamal',roster,'home').player.id,'b');});
test('i falli del momento della previsione e quelli successivi sono esclusi dal live',()=>{const j=base();j.commentary=[foul()];const m=normalizeMatch(j,{});assert.equal(priorFouls(m,'a',1,629).length,0);assert.equal(priorFouls(m,'a',1,630).length,1);assert.equal(priorFouls(m,'a',2,10).length,1);});
test('il confronto quote usa le stesse righe con quota per tutti i pesi',()=>{const r=marketAudit([{match:1,p_mod:.2,p_mkt:.3,y:1},{match:1,p_mod:.4,p_mkt:null,y:0}]);assert.equal(r.paired,1);assert.ok(Math.abs(r.weights[0].logloss+Math.log(.2))<1e-10);assert.ok(Math.abs(r.weights[4].logloss+Math.log(.3))<1e-10);});
test('non si abbinano falli e cartellini appartenenti a tempi diversi',()=>{const j=base();j.commentary=[foul(),event('c','yellow-card',634,['Ian Maatsen'],'Ian Maatsen (Aston Villa) is shown the yellow card for a bad foul.',2,2)];assert.equal(normalizeMatch(j,{}).linkedCards[0].foulId,null);});
test('un cartellino con testo e giocatore diversi viene escluso',()=>{const j=base();j.commentary=[foul(),event('c','yellow-card',634,['Ian Maatsen'],'Lamine Yamal (Barcelona) is shown the yellow card for a bad foul.',2)];assert.equal(normalizeMatch(j,{}).linkedCards[0].foulId,null);});
test('un fallo senza coordinate resta valido senza inventare una posizione',()=>{const j=base(),f=foul();delete f.play.fieldPositionX;delete f.play.fieldPositionY;j.commentary=[f];const m=normalizeMatch(j,{});assert.equal(m.audit.trustedPairs,1);assert.equal(m.events[0].xy,null);});
test('il testo senza metadati resta da revisionare',()=>{const j=base();j.commentary=[{time:{value:629},text:'Foul by Ian Maatsen (Aston Villa).'}];const m=normalizeMatch(j,{});assert.equal(m.audit.trustedPairs,0);assert.equal(m.audit.unstructuredFoulRows,1);});
test('una sostituzione fra avversari non aggiorna gli abbinamenti',()=>{const j=base();j.commentary=[event('s','substitution',630,['Ian Maatsen','Lamine Yamal'],'Substitution, Aston Villa. Ian Maatsen replaces Lamine Yamal.')];const m=normalizeMatch(j,{});assert.equal(verifiedSubstitutions(m)[0].valid,false);});
const cache=path.join(path.dirname(fileURLToPath(import.meta.url)),'cache');
const hasCases=existsSync(path.join(cache,'summary-401915308.json'))&&existsSync(path.join(cache,'summary-401915387.json'));
test('casi reali: Maatsen-Yamal e Heaven-Soulé mantengono le identità corrette',{skip:!hasCases},()=>{
  const a=normalizeMatch(JSON.parse(readFileSync(path.join(cache,'summary-401915387.json'))),{});
  const b=normalizeMatch(JSON.parse(readFileSync(path.join(cache,'summary-401915308.json'))),{});
  assert.equal(a.linkedCards.find(c=>c.player?.name==='Ian Maatsen').victim?.name,'Lamine Yamal');
  assert.equal(b.linkedCards.find(c=>c.player?.name==='Ayden Heaven').victim?.id,'323974');
});
test('caso reale: Castro entra prima del fallo che porta al giallo di Maguire',{skip:!hasCases},()=>{
  const m=normalizeMatch(JSON.parse(readFileSync(path.join(cache,'summary-401915308.json'))),{});
  const c=m.linkedCards.find(c=>c.player?.name==='Harry Maguire'), f=m.events.find(e=>e.id===c.foulId);
  assert.equal(c.victim?.name,'Santiago Castro');
  const s=verifiedSubstitutions(m).find(s=>s.on?.name==='Santiago Castro');
  assert.ok(s.valid&&s.period===f.period&&s.sec<f.sec&&s.sequence<f.sequence);
});
test('campione reale: quaranta partite distinte e dieci per ciascun gruppo',{skip:!existsSync(path.join(cache,'fixtures.json'))},()=>{
  const f=JSON.parse(readFileSync(path.join(cache,'fixtures.json'))), counts={};
  assert.equal(f.length,40);assert.equal(new Set(f.map(x=>x.id)).size,40);
  for(const x of f)counts[x.league+'|'+x.season]=(counts[x.league+'|'+x.season]||0)+1;
  assert.deepEqual(Object.values(counts),[10,10,10,10]);
});
