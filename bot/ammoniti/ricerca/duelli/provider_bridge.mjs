// Ponte prudente fra ESPN e FotMob: nessuna somiglianza approssimativa e nessun esito decide un'identità.
import {norm,teamKey,verifiedSubstitutions} from './duelli.mjs';

export const COMPETITIONS=Object.freeze({'ita.1':55,'uefa.champions':42});
// Varianti esplicite dello stesso nome di club, osservate nei due archivi del pilota.
export const TEAM_ALIASES=Object.freeze({'as monaco':'monaco','fc kobenhavn':'copenhagen','qarabag fk':'qarabag','rb salzburg':'salzburg','vfl wolfsburg':'wolfsburg','sheriff tiraspol':'fc sheriff','ajax amsterdam':'ajax','red star belgrade':'fk crvena zvezda','antwerp':'royal antwerp','1 fc union berlin':'union berlin','sk sturm graz':'sturm graz','pafos':'pafos fc','viking fk':'viking'});
// Riscontri di denominazione: stessa competizione, kickoff e avversaria; nessun punteggio o cartellino usato.
export const TEAM_ALIAS_EVIDENCE=Object.freeze([
  {espn:'AS Monaco',fotmob:'Monaco',espnMatchId:'757712'},
  {espn:'F.C. København',fotmob:'FC København',espnMatchId:'757715'},
  {espn:'FK Qarabag',fotmob:'Qarabağ FK',espnMatchId:'757716'},
  {espn:'RB Salzburg',fotmob:'Salzburg',espnMatchId:'618791'},
  {espn:'VfL Wolfsburg',fotmob:'Wolfsburg',espnMatchId:'618788'},
  {espn:'Sheriff Tiraspol',fotmob:'FC Sheriff',espnMatchId:'618783'},
  {espn:'Ajax Amsterdam',fotmob:'Ajax',espnMatchId:'618776'},
  {espn:'Red Star Belgrade',fotmob:'FK Crvena Zvezda',espnMatchId:'687540'},
  {espn:'Antwerp',fotmob:'Royal Antwerp',espnMatchId:'687543'},
  {espn:'1. FC Union Berlin',fotmob:'Union Berlin',espnMatchId:'687544'},
  {espn:'SK Sturm Graz',fotmob:'Sturm Graz',espnMatchId:'720433'},
  {espn:'Pafos',fotmob:'Pafos FC',espnMatchId:'757659'},
  {espn:'Viking FK',fotmob:'Viking',espnMatchId:'401915448',fotmobMatchId:'6106400'}
]);
// L'apostrofo interno è solo punteggiatura: N'Dicka e Ndicka conservano le stesse lettere.
export const bridgeNameKey=name=>norm(String(name??'').replace(/(?<=\p{L})['’](?=\p{L})/gu,''));
export function bridgeTeamKey(name,aliases=TEAM_ALIASES){
  const key=norm(name);return aliases[key]||teamKey(name);
}
const matchKey=(lg,h,a)=>`${lg}|${h}|${a}`;

export function buildFotmobIndex(matches,{identityRegistry={},teamAliases={},identityAnchors=null}={}){
  const aliases={...TEAM_ALIASES,...teamAliases},byFixture=new Map(),byId=new Map(),byCompetition=new Map();
  for(const match of matches){
    if(byId.has(String(match.id)))throw new Error(`Id FotMob duplicato: ${match.id}`);
    byId.set(String(match.id),match);
    if(!Number.isFinite(match.ts)||!match.h?.[1]||!match.a?.[1])continue;
    const key=matchKey(match.lg,bridgeTeamKey(match.h[1],aliases),bridgeTeamKey(match.a[1],aliases));
    if(!byFixture.has(key))byFixture.set(key,[]);byFixture.get(key).push(match);
    if(!byCompetition.has(match.lg))byCompetition.set(match.lg,[]);byCompetition.get(match.lg).push(match);
  }
  for(const list of byFixture.values())list.sort((a,b)=>a.ts-b.ts||a.id-b.id);
  return {byFixture,byId,byCompetition,identityRegistry,identityAnchors,teamAliases:aliases};
}

function tokensCompatible(short,long){
  if(short.length<2||long.length<short.length||short[0]!==long[0]||short.at(-1)!==long.at(-1)||short[0].length===1)return false;
  let at=0;for(const token of long)if(token===short[at])at++;return at===short.length;
}
function initialCompatible(a,b){
  const short=a[0]?.length===1?a:b[0]?.length===1?b:null,long=short===a?b:a;
  return !!(short&&short.length>=2&&long[0]?.startsWith(short[0])&&long.slice(-short.length+1).join(' ')===short.slice(1).join(' '));
}
// Prima nome/alias esatto, poi soli secondi nomi omessi, infine iniziale+cognome.
export function nameCompatibility(namesA,namesB){
  let rank=Infinity;
  for(const rawA of namesA||[])for(const rawB of namesB||[]){
    const a=bridgeNameKey(rawA),b=bridgeNameKey(rawB);if(!a||!b)continue;
    if(a===b){rank=0;continue;}
    const aa=a.split(' '),bb=b.split(' ');
    if(tokensCompatible(aa,bb)||tokensCompatible(bb,aa))rank=Math.min(rank,1);
    else if(initialCompatible(aa,bb))rank=Math.min(rank,2);
  }
  return Number.isFinite(rank)?{rank,method:['nome_o_alias_esatto','secondi_nomi_omessi','iniziale_e_cognome'][rank]}:null;
}

export function buildIdentityAnchors(mappedMatches){
  const evidence=new Map(),byEspn=new Map(),byFotmob=new Map();
  for(const match of mappedMatches){
    if(match.status!=='abbinata'||!match.fotmobMatchId)continue;
    for(const p of match.players||[]){
      // Le iniziali e le omissioni non fondano un'ancora riutilizzabile in altre partite.
      if(!p.fotmobId||p.method!=='nome_o_alias_esatto'||!p.nameEvidence?.completeName)continue;
      const eid=String(p.espnId),fid=String(p.fotmobId),key=eid+'|'+fid;
      if(!byEspn.has(eid))byEspn.set(eid,new Set());byEspn.get(eid).add(fid);
      if(!byFotmob.has(fid))byFotmob.set(fid,new Set());byFotmob.get(fid).add(eid);
      if(!evidence.has(key))evidence.set(key,new Map());
      evidence.get(key).set(match.espnMatchId,{espnMatchId:match.espnMatchId,fotmobMatchId:match.fotmobMatchId,side:p.side,name:p.nameEvidence.normalizedName});
    }
  }
  const conflicts=[];
  for(const [id,ids]of byEspn)if(ids.size!==1)conflicts.push({provider:'espn',id,otherIds:[...ids].sort()});
  for(const [id,ids]of byFotmob)if(ids.size!==1)conflicts.push({provider:'fotmob',id,otherIds:[...ids].sort()});
  const anchors={};
  for(const [eid,ids]of byEspn){
    if(ids.size!==1)continue;const fid=[...ids][0];if(byFotmob.get(fid)?.size!==1)continue;
    anchors[eid]={fotmobId:fid,evidence:[...evidence.get(eid+'|'+fid).values()]};
  }
  return {schema:1,policy:'Solo nomi/alias esatti completi in una partita verificata. Corrispondenza globale biunivoca; riuso solo se lo stesso id FotMob è presente sulla stessa squadra nella gara destinazione. Gli esiti non fondano identità.',anchors,conflicts};
}

function playerBridge(match,fm,registry,identityAnchors){
  const sources=(match.roster||[]).map(p=>({...p,id:String(p.id),names:[...new Set([p.name,...(p.names||[]),...(registry.aliases?.[String(p.id)]?.names||[])].filter(Boolean))]}));
  const targets=(fm.pl||[]).map(r=>({id:String(r[0]),name:r[1],names:[r[1]],side:r[2]===1?'home':r[2]===0?'away':null}));
  const sourceIdCounts=new Map(),targetIdCounts=new Map();
  for(const p of sources)sourceIdCounts.set(p.id,(sourceIdCounts.get(p.id)||0)+1);
  for(const p of targets)targetIdCounts.set(p.id,(targetIdCounts.get(p.id)||0)+1);
  const pairs=[];
  for(const source of sources)for(const target of targets){
    if(!source.side||source.side!==target.side)continue;
    const compatibility=nameCompatibility(source.names,target.names);if(compatibility)pairs.push({source,target,...compatibility});
  }
  const best=list=>{const rank=Math.min(...list.map(p=>p.rank));return list.filter(p=>p.rank===rank);};
  // Un'iniziale ambigua non diventa certa per eliminazione di altri compagni.
  const results=sources.map(source=>{
    const candidates=best(pairs.filter(p=>p.source===source));
    let reason='nome_non_trovato',pair=null;
    if(!source.id||source.id==='undefined'||source.id==='null')reason='id_espn_mancante';
    else if(sourceIdCounts.get(source.id)!==1)reason='id_espn_duplicato';
    else if(!source.side)reason='lato_espn_mancante';
    else if(candidates.length>1)reason='nome_ambiguo_nella_squadra';
    else if(candidates.length===1){
      const candidate=candidates[0],reverse=best(pairs.filter(p=>p.target===candidate.target));
      if(!candidate.target.id||candidate.target.id==='undefined'||candidate.target.id==='null')reason='id_fotmob_mancante';
      else if(targetIdCounts.get(candidate.target.id)!==1)reason='id_fotmob_duplicato';
      else if(reverse.length!==1||reverse[0].source!==source)reason='corrispondenza_inversa_ambigua';
      else{pair=candidate;reason=null;}
    }
    const exactName=pair?.rank===0?source.names.map(bridgeNameKey).find(name=>pair.target.names.some(n=>bridgeNameKey(n)===name)):null;
    const nameEvidence=exactName?{normalizedName:exactName,completeName:exactName.split(' ').length>=2&&exactName.split(' ')[0].length>1&&exactName.split(' ').at(-1).length>1}:null;
    return {espnId:source.id,espnName:source.name,side:source.side,played:!!source.played,starter:!!source.starter,fotmobId:pair?.target.id??null,fotmobName:pair?.target.name??null,method:pair?.method??null,nameEvidence,reason,candidates:candidates.map(p=>({fotmobId:p.target.id,name:p.target.name,method:p.method}))};
  });
  if(identityAnchors){
    const badEspn=new Set(identityAnchors.conflicts?.filter(c=>c.provider==='espn').map(c=>String(c.id))||[]),badFotmob=new Set(identityAnchors.conflicts?.filter(c=>c.provider==='fotmob').map(c=>String(c.id))||[]);
    const clear=(p,reason)=>Object.assign(p,{fotmobId:null,fotmobName:null,method:null,nameEvidence:null,reason});
    for(const p of results){
      if(badEspn.has(p.espnId)||badFotmob.has(p.fotmobId)){clear(p,'collisione_nel_registro_identita');continue;}
      const anchor=identityAnchors.anchors?.[p.espnId];if(!anchor)continue;
      const fid=String(anchor.fotmobId);
      if(p.fotmobId&&p.fotmobId!==fid){clear(p,'ancora_identita_discordante');continue;}
      if(p.fotmobId||sourceIdCounts.get(p.espnId)!==1||!['home','away'].includes(p.side))continue;
      const target=targets.filter(t=>t.id===fid&&t.side===p.side);
      if(target.length!==1||targetIdCounts.get(fid)!==1||badFotmob.has(fid)){p.reason='ancora_assente_o_ambigua_nella_squadra';continue;}
      Object.assign(p,{fotmobId:fid,fotmobName:target[0].name,method:'id_stabile_da_nome_esatto',nameEvidence:null,reason:null,anchorEvidence:anchor.evidence});
    }
    const counts=new Map();for(const p of results)if(p.fotmobId)counts.set(p.fotmobId,(counts.get(p.fotmobId)||0)+1);
    for(const p of results)if(p.fotmobId&&counts.get(p.fotmobId)>1)clear(p,'collisione_identita_nella_partita');
  }
  return results;
}

export function mapMatch(match,index,{kickoffToleranceSec=300}={}){
  if(!Number.isFinite(kickoffToleranceSec)||kickoffToleranceSec<0||kickoffToleranceSec>300)throw new Error('Tolleranza kickoff ammessa: 0–300 secondi');
  const fixture=match.fixture||{},lg=COMPETITIONS[fixture.league],kickoff=Date.parse(fixture.date)/1000;
  const homes=(match.teams||[]).filter(t=>t.side==='home'),aways=(match.teams||[]).filter(t=>t.side==='away');
  const result={espnMatchId:String(fixture.id??''),fotmobMatchId:null,competition:lg??null,status:'esclusa',reason:null,kickoffDifferenceSec:null,players:[],playerMap:{},fouls:[],linkedCards:[],substitutions:[]};
  if(lg==null){result.reason='competizione_non_supportata';return result;}
  if(!Number.isFinite(kickoff)){result.reason='orario_mancante';return result;}
  if(homes.length!==1||aways.length!==1||!homes[0].name||!aways[0].name){result.reason='squadre_non_univoche';return result;}
  const home=bridgeTeamKey(homes[0].name,index.teamAliases),away=bridgeTeamKey(aways[0].name,index.teamAliases);
  const candidates=(index.byFixture.get(matchKey(lg,home,away))||[]).filter(f=>Math.abs(f.ts-kickoff)<=kickoffToleranceSec);
  if(candidates.length!==1){result.reason=candidates.length?'partita_ambigua':'partita_non_trovata';result.requestedTeams={home,away};result.candidates=candidates.map(f=>({id:String(f.id),kickoff:f.ts}));return result;}
  const fm=candidates[0];result.status='abbinata';result.fotmobMatchId=String(fm.id);result.kickoffDifferenceSec=fm.ts-kickoff;
  result.players=playerBridge(match,fm,index.identityRegistry,index.identityAnchors);
  result.playerMap=Object.fromEntries(result.players.filter(p=>p.fotmobId).map(p=>[p.espnId,p.fotmobId]));
  const id=p=>p?.id?result.playerMap[String(p.id)]??null:null;
  result.fouls=(match.events||[]).filter(e=>e.type==='foul').map(e=>{
    const actor=id(e.people?.[0]),victim=id(e.people?.[1]),mapped=!!(e.trusted&&actor&&victim&&actor!==victim&&['home','away'].includes(e.people[0]?.side)&&['home','away'].includes(e.people[1]?.side)&&e.people[0]?.side!==e.people[1]?.side);
    return {espnEventId:e.id,sec:e.sec,period:e.period,sourceTrusted:!!e.trusted,mapped,actorEspnId:e.people?.[0]?.id??null,victimEspnId:e.people?.[1]?.id??null,actorFotmobId:mapped?actor:null,victimFotmobId:mapped?victim:null,reason:!e.trusted?'evento_fonte_escluso':!actor||!victim?'identita_non_collegata':!mapped?'coppia_non_valida':null};
  });
  const mappedFouls=new Map(result.fouls.filter(e=>e.mapped).map(e=>[e.espnEventId,e]));
  result.linkedCards=(match.linkedCards||[]).map(c=>{
    const foul=c.foulId?mappedFouls.get(c.foulId):null;
    const mapped=!!(foul&&id(c.player)===foul.actorFotmobId&&id(c.victim)===foul.victimFotmobId);
    return {espnCardId:c.cardId,espnFoulId:c.foulId??null,sec:c.sec,period:c.period,mapped,actorFotmobId:mapped?foul.actorFotmobId:null,victimFotmobId:mapped?foul.victimFotmobId:null,reason:mapped?null:'fallo_o_identita_non_collegati'};
  });
  result.substitutions=(match.substitutions||verifiedSubstitutions({...match,events:match.events||[],roster:match.roster||[]})).map(s=>({espnEventId:s.id,sec:s.sec,period:s.period,mapped:!!(s.valid&&id(s.on)&&id(s.off)),onFotmobId:s.valid?id(s.on):null,offFotmobId:s.valid?id(s.off):null,reason:!s.valid?'cambio_fonte_non_verificato':!id(s.on)||!id(s.off)?'identita_non_collegata':null}));
  return result;
}
