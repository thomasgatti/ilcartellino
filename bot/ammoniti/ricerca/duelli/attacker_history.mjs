// Gialli temporalmente associati ai falli sugli avversari: dati osservati, non causalità provata.
// Soglie e shrinkage fissati prima di valutare il modello; cronaca mancante non diventa zero.
export const ATTACKER_PROTOCOL=Object.freeze({availabilityLagSeconds:10800,conversionTrustedFraction:.90,conversionMappedFraction:.90,per90TrustedFraction:.95,per90MappedFraction:.95,maxAccountingResidual:1,conversionShrinkFouls:50,per90ShrinkMinutes:900,habitMatches:8,distanceScale:.12,associationSeconds:30,rankingMinFouls:50,rankingMinMinutes:900});
const role=p=>p===1?'D':p===3?'F':'M';
const finite=x=>Number.isFinite(x);
const sum=(a,f)=>a.reduce((s,x)=>s+f(x),0);
const id=x=>String(x);
const key=(lg,pid)=>`${lg}|${pid}`;

// Una partita senza cronaca o con carte non riconciliabili non espone nessun giocatore a uno zero certo.
export function prepareAttackerObservation(match,fotmobMatch,bridge,options={}){
 const p={...ATTACKER_PROTOCOL,...options},events=match.events||[],fouls=events.filter(e=>e.type==='foul'),trusted=fouls.filter(e=>e.trusted),cards=events.filter(e=>/yellow/.test(e.type));
 const empty={schema:1,espnMatchId:match.fixture?.id??null,fotmobMatchId:fotmobMatch?.id==null?null:id(fotmobMatch.id),ts:fotmobMatch?.ts??null,league:fotmobMatch?.lg??null,conversionEligible:false,per90Eligible:false,players:[],trials:[],audit:{}};
 if(!fotmobMatch||bridge?.status!=='abbinata'||id(bridge.fotmobMatchId)!==id(fotmobMatch.id))return {...empty,audit:{reasons:['partita_non_abbinata']}};
 const mapping=bridge.playerMap||{},rows=new Map((fotmobMatch.pl||[]).map(r=>[id(r[0]),r])),played=(match.roster||[]).filter(r=>r.played),playedIds=new Set(played.map(r=>id(r.id)));
 const expectedKnown=played.length>0&&played.every(r=>finite(r.yc)),expectedCards=expectedKnown?sum(played,r=>r.yc):null;
 const playerCards=cards.filter(c=>c.people?.[0]?.id&&playedIds.has(id(c.people[0].id))),unknownCards=cards.length-playerCards.length;
 const textOnlyCards=(match.unstructured||[]).filter(e=>/yellow card|Second yellow card/i.test(e.text||''));
 const cardAuditComplete=expectedCards!=null&&expectedCards===playerCards.length&&unknownCards===0&&textOnlyCards.length===0&&playerCards.every(c=>c.trusted);
 const sourceFraction=fouls.length?trusted.length/fouls.length:null;
 const mappedFouls=trusted.filter(f=>mapping[id(f.people?.[0]?.id)]&&mapping[id(f.people?.[1]?.id)]);
 const mappedFraction=trusted.length?mappedFouls.length/trusted.length:null;
 const residual=match.accounting?.residual??match.accounting?.totals?.residual??null;
 const accountingKnown=finite(residual)&&(match.accounting?.unknownSide??match.accounting?.totals?.unknownSide??0)===0;
 const fmCardsKnown=Array.isArray(fotmobMatch.cards),fmBooked=new Set((fotmobMatch.cards||[]).filter(c=>c[2]==='Yellow'||c[2]==='YellowRed').map(c=>id(c[0])));
 const cardDisagreements=played.flatMap(r=>{const fm=mapping[id(r.id)];return fm&&rows.has(id(fm))&&finite(r.yc)&&fmCardsKnown&&(r.yc>0)!==fmBooked.has(id(fm))?[{espnId:id(r.id),fotmobId:id(fm),espnYellowCards:r.yc,fotmobBooked:fmBooked.has(id(fm))}]:[];});
 const discordantActors=new Set(cardDisagreements.map(r=>r.espnId)),crossSourceCardsComplete=fmCardsKnown&&cardDisagreements.length===0;
 const conversionEligible=!!(cardAuditComplete&&fmCardsKnown&&sourceFraction!=null&&sourceFraction>=p.conversionTrustedFraction&&mappedFraction!=null&&mappedFraction>=p.conversionMappedFraction);
 let per90Eligible=!!(conversionEligible&&sourceFraction>=p.per90TrustedFraction&&mappedFraction>=p.per90MappedFraction&&accountingKnown&&Math.abs(residual)<=p.maxAccountingResidual);
 const positives=new Map((match.linkedCards||[]).filter(c=>c.foulId&&c.status==='associazione_temporale_univoca').map(c=>[id(c.foulId),c]));
 const trialAudit={positive:0,negative:0,censored:0,unmappedOrUntrusted:fouls.length-mappedFouls.length};
 const trials=[];
 if(conversionEligible)for(const foul of mappedFouls){
  const actor=foul.people[0],victim=foul.people[1],fmActor=mapping[id(actor.id)],fmVictim=mapping[id(victim.id)];
  if(!rows.has(id(fmActor))||!rows.has(id(fmVictim))||!finite(foul.sec)||!finite(foul.period)||discordantActors.has(id(actor.id))){trialAudit.censored++;continue;}
  const positive=positives.get(id(foul.id));
  if(positive&&!fmBooked.has(id(fmActor))){trialAudit.censored++;continue;}
  // Una carta vicina non specificata/ambigua non può trasformare quel fallo in un negativo.
  const nearby=(match.linkedCards||[]).filter(c=>c.period===foul.period&&finite(c.sec)&&c.sec>=foul.sec&&c.sec-foul.sec<=p.associationSeconds&&(!c.player?.id||id(c.player.id)===id(actor.id)));
  const unresolved=nearby.some(c=>c.foulId!==foul.id&&c.reason!=='non_fallo');
  const directRed=events.some(c=>/red/.test(c.type)&&!/yellow/.test(c.type)&&c.period===foul.period&&finite(c.sec)&&c.sec>=foul.sec&&c.sec-foul.sec<=p.associationSeconds&&(!c.people?.[0]?.id||id(c.people[0].id)===id(actor.id)));
  if(!positive&&(unresolved||directRed)){trialAudit.censored++;continue;}
  const y=positive?1:0;trialAudit[y?'positive':'negative']++;
  trials.push({foulId:id(foul.id),cardId:positive?.cardId??null,actorFotmobId:id(fmActor),victimFotmobId:id(fmVictim),victimRole:role(rows.get(id(fmVictim))[3]),y,sec:foul.sec,period:foul.period});
 }
 // Per /90 servono minuti noti e un'intera gara di buona copertura, non soltanto falli isolati.
 const mappedPlayed=new Map();
 for(const r of played){const fm=mapping[id(r.id)],row=fm?rows.get(id(fm)):null;if(row&&row[3]!==0&&finite(row[5])&&row[5]>0)mappedPlayed.set(id(fm),{fotmobId:id(fm),name:row[1],role:role(row[3]),minutes:row[5],starter:row[4]===1});}
 const positiveByVictim=new Map();for(const t of trials)if(t.y)positiveByVictim.set(t.victimFotmobId,(positiveByVictim.get(t.victimFotmobId)||0)+1);
 const positiveCardIds=new Set(trials.filter(t=>t.y).map(t=>id(t.cardId)));
 const attributionComplete=(match.linkedCards||[]).length===cards.length&&(match.linkedCards||[]).every(c=>c.reason==='non_fallo'||positiveCardIds.has(id(c.cardId)));
 per90Eligible=per90Eligible&&attributionComplete&&crossSourceCardsComplete;
 const players=per90Eligible?[...mappedPlayed.values()].map(r=>({...r,associatedYellows:positiveByVictim.get(r.fotmobId)||0})):[];
 const reasons=[];if(!cardAuditComplete)reasons.push('cartellini_non_riconciliati');if(!(sourceFraction>=p.conversionTrustedFraction))reasons.push('coppie_verificate_insufficienti');if(!(mappedFraction>=p.conversionMappedFraction))reasons.push('mapping_insufficiente');if(!accountingKnown)reasons.push('riscontro_contabile_mancante');else if(Math.abs(residual)>p.maxAccountingResidual)reasons.push('scarto_contabile_eccessivo');if(!attributionComplete)reasons.push('attribuzione_cartellini_incompleta_per90');if(!fmCardsKnown)reasons.push('cartellini_fotmob_mancanti');if(cardDisagreements.length)reasons.push('cartellini_discordi_fra_fonti');
 return {...empty,conversionEligible,per90Eligible,players,trials,audit:{reasons,foulEvents:fouls.length,trustedFouls:trusted.length,mappedFouls:mappedFouls.length,sourceFraction,mappedFraction,expectedCards,observedPlayerCards:playerCards.length,unknownCards,textOnlyCards:textOnlyCards.length,cardAuditComplete,attributionComplete,fmCardsKnown,crossSourceCardsComplete,cardDisagreements,accountingResidual:residual,trialAudit,per90Players:players.length,per90Minutes:sum(players,r=>r.minutes)}};
}

// Gli stati dei profili sono per competizione; un nuovo arrivato ha segnale neutro e copertura distinta.
// Le medie di ruolo sono anch'esse solo passate, con un piccolo prior fisso dichiarato.
function means(group,lg,r){
 const g=group.get(key(lg,r))||{fouls:0,yFouls:0,minutes:0,yMinutes:0},prior90={D:.06,M:.10,F:.15}[r]??.10;
 return {conversion:(g.yFouls+2)/(g.fouls+20),per90:(g.yMinutes+prior90*20)/(g.minutes/90+20)};
}
function posterior(profile,mu,p){
 const a=profile||{fouls:0,yFouls:0,minutes:0,yMinutes:0};
 return {conversion:(a.yFouls+mu.conversion*p.conversionShrinkFouls)/(a.fouls+p.conversionShrinkFouls),per90:(a.yMinutes+mu.per90*p.per90ShrinkMinutes/90)/(a.minutes/90+p.per90ShrinkMinutes/90)};
}
function habit(player,p){const a=player?.positions?.slice(-p.habitMatches)||[];return a.length?[sum(a,r=>r[0])/a.length,sum(a,r=>r[1])/a.length]:null;}

export function buildAttackerHistory(fotmobMatches,observations,options={}){
 const p={...ATTACKER_PROTOCOL,...options},leagues=new Set(options.leagues||[55,42]);
 const ordered=[...fotmobMatches].filter(m=>finite(m.ts)).sort((a,b)=>a.ts-b.ts||Number(a.id)-Number(b.id));
 const obs=new Map();for(const o of observations){if(o.fotmobMatchId==null)continue;const k=id(o.fotmobMatchId);if(obs.has(k))throw new Error(`Osservazione ESPN duplicata per partita FotMob: ${k}`);obs.set(k,o);}
 const pending=ordered.map(m=>({available:m.ts+p.availabilityLagSeconds,m})).sort((a,b)=>a.available-b.available||Number(a.m.id)-Number(b.m.id));
 const positionState=new Map(),profiles=new Map(),groups=new Map(),byKey=new Map();let next=0,updates=0,targetsWithoutPosition=0;
 const ensureGroup=(lg,r)=>{const k=key(lg,r);if(!groups.has(k))groups.set(k,{fouls:0,yFouls:0,minutes:0,yMinutes:0});return groups.get(k);};
 const ensureProfile=(lg,pid,name,r)=>{const k=key(lg,pid);if(!profiles.has(k))profiles.set(k,{league:lg,fotmobId:id(pid),name,role:r,fouls:0,yFouls:0,minutes:0,yMinutes:0,matchesConversion:0,matchesPer90:0,lastAvailable:null});return profiles.get(k);};
 const apply=({available,m})=>{
  // Posizioni da incontri già disponibili, comprese le altre competizioni: mai verticalLayout della gara bersaglio.
  for(const r of m.pl||[]){if(!finite(r[5])||r[5]<=0||r[3]===0)continue;const k=id(r[0]);let q=positionState.get(k);if(!q){q={role:role(r[3]),positions:[]};positionState.set(k,q);}if(finite(r[12])&&finite(r[13])){q.positions.push([r[12],r[13]]);if(q.positions.length>p.habitMatches)q.positions.shift();}}
  const o=obs.get(id(m.id));if(!o)return;updates++;
  const seen=new Set();
  for(const t of o.trials||[]){const row=(m.pl||[]).find(r=>id(r[0])===t.victimFotmobId);if(!row)continue;const q=ensureProfile(m.lg,t.victimFotmobId,row[1],t.victimRole),g=ensureGroup(m.lg,q.role);q.fouls++;q.yFouls+=t.y;g.fouls++;g.yFouls+=t.y;q.lastAvailable=available;seen.add(q);}
  for(const q of seen)q.matchesConversion++;
  for(const r of o.players||[]){const q=ensureProfile(m.lg,r.fotmobId,r.name,r.role),g=ensureGroup(m.lg,q.role);q.minutes+=r.minutes;q.yMinutes+=r.associatedYellows;q.matchesPer90++;q.lastAvailable=available;g.minutes+=r.minutes;g.yMinutes+=r.associatedYellows;}
 };
 for(const m of ordered){
  while(next<pending.length&&pending[next].available<m.ts)apply(pending[next++]);
  if(!leagues.has(m.lg))continue;
  const starters=(m.pl||[]).filter(r=>r[4]===1&&r[3]!==0);
  for(const r of starters){
   const opponents=starters.filter(o=>o[2]!==r[2]),own=habit(positionState.get(id(r[0])),p),fac=[];
   if(own)for(const o of opponents){const op=positionState.get(id(o[0])),h=habit(op,p);if(!h)continue;const weight=Math.exp(-Math.hypot(own[0]-(1-h[0]),own[1]-(1-h[1]))/p.distanceScale),profile=profiles.get(key(m.lg,o[0])),mu=means(groups,m.lg,profile?.role||op?.role||role(o[3])),rate=posterior(profile,mu,p);fac.push({fotmobId:id(o[0]),name:o[1],weight,conversionRatio:rate.conversion/mu.conversion,per90Ratio:rate.per90/mu.per90,fouls:profile?.fouls||0,minutes:profile?.minutes||0});}
   const sw=sum(fac,o=>o.weight),weighted=f=>sw?sum(fac,o=>o.weight*f(o))/sw:0;
   const f={conversionSignal:sw?Math.log(Math.max(.0001,weighted(o=>o.conversionRatio))):0,per90Signal:sw?Math.log(Math.max(.0001,weighted(o=>o.per90Ratio))):0,conversionCoverage:weighted(o=>o.fouls>0?1:0),per90Coverage:weighted(o=>o.minutes>0?1:0),positionCoverage:opponents.length?fac.length/opponents.length:0,missingPosition:!own||!fac.length,conversionTrials:weighted(o=>o.fouls),per90Minutes:weighted(o=>o.minutes),opponentsWithPosition:fac.length};
   if(options.includeOpponents)f.opponents=fac;
   if(f.missingPosition)targetsWithoutPosition++;
   byKey.set(`${m.id}|${r[0]}`,f);
  }
 }
 // La tabella descrittiva viene datata dopo la disponibilità dell'ultimo incontro; non è una feature del passato.
 while(next<pending.length)apply(pending[next++]);
 const description=[...profiles.values()].map(q=>{const mu=means(groups,q.league,q.role),rate=posterior(q,mu,p);return {...q,conversionRate:rate.conversion,conversionIndex:rate.conversion/mu.conversion,per90Rate:rate.per90,per90Index:rate.per90/mu.per90,rankConversion:q.fouls>=p.rankingMinFouls,rankPer90:q.minutes>=p.rankingMinMinutes};});
 return {byKey,profiles:description,protocol:p,audit:{targetRows:byKey.size,observations:observations.length,conversionGames:observations.filter(o=>o.conversionEligible).length,per90Games:observations.filter(o=>o.per90Eligible).length,conversionTrials:sum(observations,o=>o.trials?.length||0),positiveTrials:sum(observations,o=>sum(o.trials||[],t=>t.y)),per90Minutes:sum(observations,o=>sum(o.players||[],r=>r.minutes)),observationUpdates:updates,targetsWithoutPosition,descriptionAsOf:pending.at(-1)?.available??null}};
}
