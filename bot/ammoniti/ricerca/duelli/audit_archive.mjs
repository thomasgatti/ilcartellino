// Audit completo delle fonti e ponte tra provider, senza richieste di rete.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {normalizeMatch} from './duelli.mjs';import {accountFouls} from './accounting.mjs';import {loadFotmob} from './production_research.mjs';
import {buildFotmobIndex,mapMatch,buildIdentityAnchors} from './provider_bridge.mjs';import {prepareAttackerObservation} from './attacker_history.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),cache=path.join(root,'cache-archive'),out=path.join(root,'results-fase3');fs.mkdirSync(out,{recursive:true});
const receipts=JSON.parse(fs.readFileSync(path.join(cache,'receipts.json'))),fixtures=JSON.parse(fs.readFileSync(path.join(cache,'fixtures.json'))),sources=new Map(receipts.sources.map(s=>[s.file,s]));
const registry=JSON.parse(fs.readFileSync(path.join(root,'identity-registry.json'))),{matches:fm,provenance}=loadFotmob(path.join(root,'input/fotmob'));
const normalized=[],failed=[];let done=0;
for(const fixture of fixtures){
 try{
  const filename=`summary-${fixture.id}.json.gz`,source=sources.get(filename);if(!source)throw new Error('Fonte non presente nel manifesto');
  const raw=zlib.gunzipSync(fs.readFileSync(path.join(cache,filename))),hash=createHash('sha256').update(raw).digest('hex');if(hash!==source.sha256)throw new Error('Hash della cronaca discordante');
  const j=JSON.parse(raw);if(String(j.header?.id)!==fixture.id)throw new Error('Id della cronaca discordante');
  const sourceDate=j.header?.competitions?.[0]?.date;if(!sourceDate||Math.abs(Date.parse(sourceDate)-Date.parse(fixture.date))>300000)throw new Error('Data della cronaca discordante');
  const m=normalizeMatch(j,fixture,registry);m.accounting=accountFouls(j,m);normalized.push(m);
 }catch(e){failed.push({id:fixture.id,error:e.message});}
 done++;if(done%500===0)console.log(`Fonti verificate ${done}/${fixtures.length}`);
}
const indexBase=buildFotmobIndex(fm,{identityRegistry:registry}),first=normalized.map(m=>mapMatch(m,indexBase)),anchors=buildIdentityAnchors(first),index=buildFotmobIndex(fm,{identityRegistry:registry,identityAnchors:anchors});
const sum={fixtures:fixtures.length,normalized:normalized.length,matched:0,unmatched:0,rawFoulRows:0,foulEvents:0,trustedPairs:0,cards:0,linkedCards:0,mappedFouls:0,mappedLinkedCards:0,played:0,mappedPlayed:0,conversionEligible:0,per90Eligible:0,trials:0,positiveTrials:0,per90Players:0};
const groups={},reviews=[],observations=[],problems={},sourceSeasonDifferences=[];
for(const m of normalized){
 const b=mapMatch(m,index),fmMatch=b.fotmobMatchId?index.byId.get(b.fotmobMatchId):null,season=fmMatch?.season??m.fixture.season,group=`${m.fixture.league}|${season}`,g=groups[group]??={matches:0,matched:0,conversionEligible:0,per90Eligible:0,trials:0,positiveTrials:0,mappedFouls:0,trustedPairs:0,foulEvents:0};g.matches++;
 if(fmMatch&&fmMatch.season!==m.fixture.season)sourceSeasonDifferences.push({espnMatchId:m.fixture.id,fotmobMatchId:fmMatch.id,espnSeason:m.fixture.season,fotmobSeason:fmMatch.season});
 for(const k of ['rawFoulRows','foulEvents','trustedPairs','cards','linkedCards'])sum[k]+=m.audit[k];
 g.foulEvents+=m.audit.foulEvents;g.trustedPairs+=m.audit.trustedPairs;
 for(const e of m.events.filter(e=>e.type==='foul'))for(const p of e.problems)problems[p]=(problems[p]||0)+1;
 if(b.status!=='abbinata'){sum.unmatched++;reviews.push({fixture:m.fixture.id,group,matchReason:b.reason,requestedTeams:b.requestedTeams});continue;}
 sum.matched++;g.matched++;sum.played+=b.players.filter(p=>p.played).length;sum.mappedPlayed+=b.players.filter(p=>p.played&&p.fotmobId).length;
 const mapped=b.fouls.filter(e=>e.mapped).length,linked=b.linkedCards.filter(e=>e.mapped).length;sum.mappedFouls+=mapped;sum.mappedLinkedCards+=linked;g.mappedFouls+=mapped;
 const obs=prepareAttackerObservation(m,index.byId.get(b.fotmobMatchId),b);observations.push(obs);
 const positive=obs.trials.filter(t=>t.y===1).length;sum.conversionEligible+=+obs.conversionEligible;sum.per90Eligible+=+obs.per90Eligible;sum.trials+=obs.trials.length;sum.positiveTrials+=positive;sum.per90Players+=obs.players.length;
 g.conversionEligible+=+obs.conversionEligible;g.per90Eligible+=+obs.per90Eligible;g.trials+=obs.trials.length;g.positiveTrials+=positive;
 reviews.push({fixture:m.fixture.id,fotmobMatchId:b.fotmobMatchId,group,foulEvents:m.audit.foulEvents,trustedPairs:m.audit.trustedPairs,mappedFouls:mapped,linkedCards:m.audit.linkedCards,mappedLinkedCards:linked,accountingResidual:m.accounting.residual,conversionEligible:obs.conversionEligible,per90Eligible:obs.per90Eligible,observationAudit:obs.audit,unmappedPlayers:b.players.filter(p=>p.played&&!p.fotmobId).map(p=>({id:p.espnId,name:p.espnName,side:p.side,reason:p.reason}))});
}
const hashFile=file=>createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex');
const audit={schema:1,dataRef:provenance.ref,protocolHash:hashFile('attacker.protocol.json'),identityRegistryHash:hashFile('identity-registry.json'),totals:sum,groups,sourceProblems:problems,failed,sourceSeasonDifferences,anchorConflicts:anchors.conflicts,limitations:['Le coppie provano falli sanzionati; non coprono i duelli senza fallo o il tempo di marcatura.','Cartellini associati temporalmente, non cause controfattuali dimostrate.','Corrispondenze di id sono metadati di identità; ancore da nomi completi esatti e squadre della medesima gara, senza esiti per decidere gli abbinamenti.','Raccolta retrospettiva: il contenuto può essere stato corretto dal fornitore dopo le partite.']};
fs.writeFileSync(path.join(out,'audit-archivio.json'),JSON.stringify(audit,null,2)+'\n');
fs.writeFileSync(path.join(out,'revisioni-archivio.json.gz'),zlib.gzipSync(JSON.stringify(reviews)+'\n'));
fs.writeFileSync(path.join(out,'observations.json.gz'),zlib.gzipSync(JSON.stringify(observations)+'\n'));
fs.writeFileSync(path.join(out,'identity-anchors.json.gz'),zlib.gzipSync(JSON.stringify(anchors)+'\n'));
fs.writeFileSync(path.join(out,'fonti-archivio.json.gz'),zlib.gzipSync(JSON.stringify(receipts)+'\n'));
console.log(JSON.stringify(audit,null,2));
