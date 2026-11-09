// Strumenti di ricerca: estrazione prudente dei falli, non un modello di probabilità.
export const norm = s => String(s ?? '').replace(/[øØ]/g,'o').replace(/[łŁ]/g,'l').replace(/[æÆ]/g,'ae').replace(/[đĐðÐ]/g,'d').replace(/ı/g,'i').replace(/[þÞ]/g,'th').replace(/ß/g,'ss').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9 ]/g,' ').replace(/\s+/g,' ').trim();
export function teamKey(s) {
  const k = norm(s);
  if(['fc copenhagen','f c kobenhavn'].includes(k))return 'copenhagen';
  if(['fk qarabag','qarabag'].includes(k))return 'qarabag';
  if(['verona','hellas verona'].includes(k))return 'hellas verona';
  return ({'as roma':'roma','internazionale':'inter','inter milan':'inter','ac milan':'milan','fc barcelona':'barcelona','feyenoord rotterdam':'feyenoord','lask linz':'lask','bayern munich':'bayern munchen','sporting lisbon':'sporting cp','stuttgart':'vfb stuttgart','bodo glimt':'bodo glimt','fenerbahce':'fenerbahce','slovan bratislava':'slovan bratislava'})[k] || k;
}
const stat = (a, key) => { const x = (a || []).find(x => x.name === key); return x == null ? null : Number(x.value ?? x.displayValue); };
const actorText = s => String(s || '').match(/^Foul by (.+?) \(([^)]+)\)/);
const victimText = s => String(s || '').match(/^(.+?) \(([^)]+)\) wins a free kick/);
const cardText = s => String(s || '').match(/^(?:Second yellow card to )?(.+?) \(([^)]+)\)(?: is shown| for a bad foul|\.)/);

// Un omonimo o un abbinamento approssimativo resta irrisolto. Gli id ESPN si ricavano dalla rosa.
export function resolvePlayer(name, roster, side = null) {
  const key = norm(name), pool = roster.filter(p => side == null || p.side === side);
  const exact = pool.filter(p => p.names.some(n => norm(n) === key));
  if (exact.length === 1) return { player: exact[0], method: 'nome_esatto' };
  if (exact.length > 1) return { player: null, method: 'ambiguo' };
  const tokens = key.split(' ');
  // È ammessa l'omissione dei secondi nomi, mai la loro invenzione: primo nome e cognome devono coincidere.
  if(tokens.length>=2&&tokens[0].length>1){
    const candidates=pool.filter(p=>p.names.some(n=>{
      const t=norm(n).split(' ');if(t[0]!==tokens[0]||t.at(-1)!==tokens.at(-1))return false;
      let at=0;for(const token of t)if(token===tokens[at])at++;return at===tokens.length;
    }));
    if(candidates.length===1)return {player:candidates[0],method:'secondi_nomi_omessi'};
    if(candidates.length>1)return {player:null,method:'ambiguo'};
  }
  const abbreviated = tokens[0]?.length === 1;
  const candidates = abbreviated ? pool.filter(p => p.names.some(n => {
    const t = norm(n).split(' ');
    return t[0]?.startsWith(tokens[0]) && t.slice(-tokens.length + 1).join(' ') === tokens.slice(1).join(' ');
  })) : [];
  return candidates.length === 1 ? { player: candidates[0], method: 'iniziale_e_cognome' } : { player: null, method: candidates.length ? 'ambiguo' : 'non_trovato' };
}
export function getRoster(j, identityProfiles = {}) {
  return (j.rosters || []).flatMap(t => (t.roster || []).map(p => ({
    id: String(p.athlete?.id ?? ''), name: p.athlete?.displayName || p.athlete?.fullName || '',
    names: [...new Set([p.athlete?.displayName,p.athlete?.fullName,p.athlete?.shortName,...(identityProfiles.aliases?.[String(p.athlete?.id)]?.names||[])].filter(Boolean))],
    team: t.team?.displayName || '', side: t.homeAway, starter: !!p.starter,
    played: p.starter || p.subbedIn || stat(p.stats,'appearances') > 0,
    fc: stat(p.stats,'foulsCommitted'), fs: stat(p.stats,'foulsSuffered'),
    yc: stat(p.stats,'yellowCards'), rc: stat(p.stats,'redCards')
  })));
}
export function normalizeMatch(j, fixture, identityProfiles = {}) {
  const roster = getRoster(j, identityProfiles), commentary = j.commentary || [], teams = (j.header?.competitions?.[0]?.competitors || []).map(c => ({ side:c.homeAway, name:c.team?.displayName }));
  const sideOf = name => teams.find(t => teamKey(t.name) === teamKey(name))?.side ?? null;
  const grouped = new Map(), unstructured = [];
  for (let i=0;i<commentary.length;i++) {
    const c=commentary[i], p=c.play;
    if (!p) { if (/^Foul by |yellow card|Second yellow card|Substitution,/i.test(c.text || '')) unstructured.push({sequence:c.sequence ?? i, sec:c.time?.value ?? null, text:c.text}); continue; }
    const type = p.type?.type || '';
    if (!(type === 'foul' || /yellow|red-card|substitution/.test(type))) continue;
    const id=String(p.id ?? `riga-${i}`), row={c,p,i};
    if (!grouped.has(id)) grouped.set(id,[]);
    grouped.get(id).push(row);
  }
  const byLogical=new Map();
  for (const [id, group] of grouped) {
    const {p,c,i}=group[0], type=p.type?.type, sec=p.clock?.value ?? c.time?.value ?? null, period=p.period?.number ?? null;
    const participants=(p.participants || []).map(x=>x.athlete?.displayName || '');
    const key = sec == null ? `id:${id}` : [type,period,sec,...participants.map(norm)].join('|');
    if (!byLogical.has(key)) byLogical.set(key,[]);
    byLogical.get(key).push(...group.map(x=>({...x,id})));
  }
  const events=[];
  for (const group of byLogical.values()) {
    const {p,c,i}=group[0], type=p.type.type, texts=[...new Set(group.flatMap(x=>[x.c.text,x.p.text]).filter(Boolean))];
    const rawNames=(p.participants || []).map(x=>x.athlete?.displayName || '');
    const tActor=texts.map(actorText).find(Boolean), tVictim=texts.map(victimText).find(Boolean);
    const parsedTeam=tActor?.[2] || (type==='foul'?null:cardText(texts[0])?.[2]);
    const side=sideOf(parsedTeam || p.team?.displayName);
    const resolved=rawNames.map((n,k)=>resolvePlayer(n,roster,type==='foul'&&k===1?(side==='home'?'away':side==='away'?'home':null):side));
    const problems=[];
    if (resolved.some(x=>!x.player)) problems.push('identita_non_univoca');
    const checkText = (parsed,index) => {
      if(!parsed || !resolved[index]?.player || resolved[index].player.names.some(n=>norm(n)===norm(parsed[1]))) return;
      const textSide=sideOf(parsed[2]), textResolved=resolvePlayer(parsed[1],roster,textSide);
      if(textResolved.player?.id===resolved[index].player.id) return;
      problems.push(textResolved.player?'testo_indica_altro_giocatore':'grafia_o_alias_non_verificato');
    };
    if(type==='foul'){
      for(const t of texts){checkText(actorText(t),0);checkText(victimText(t),1);}
      const variants=new Set(group.map(x=>(x.p.participants||[]).map(v=>norm(v.athlete?.displayName)).join('|')));
      if(variants.size>1)problems.push('partecipanti_discordi_stesso_evento');
    }
    if(/yellow/.test(type)) for(const t of texts)checkText(cardText(t),0);
    const pp=resolved.map(x=>x.player);
    if (type==='foul' && (pp.length!==2 || !pp[0] || !pp[1] || pp[0].side===pp[1].side)) problems.push('coppia_non_valida');
    const coords=[...new Map(group.filter(x=>Number.isFinite(x.p.fieldPositionX)&&Number.isFinite(x.p.fieldPositionY)).map(x=>[[x.p.fieldPositionX,x.p.fieldPositionY].join('|'),[x.p.fieldPositionX,x.p.fieldPositionY]])).values()];
    const sourceIds=[...new Set(group.map(x=>x.id))];
    events.push({
      id:sourceIds[0], sourceIds, type, sec:p.clock?.value ?? c.time?.value ?? null, period:p.period?.number ?? null,
      minute:p.clock?.displayValue || c.time?.displayValue || '', sequence:Math.min(...group.map(x=>x.c.sequence ?? x.i)),
      people:pp.map((x,k)=>x?{id:x.id,name:x.name,side:x.side}: {id:null,name:rawNames[k],side:null}),
      texts, rawRows:group.length, duplicateIds:sourceIds.length>1, coordinateConflict:coords.length>1,
      xy:coords.length===1?coords[0]:null, problems:[...new Set(problems)],
      trusted:type==='foul'?problems.length===0:pp.length>0&&!!pp[0]&&problems.length===0
    });
  }
  events.sort((a,b)=>a.sequence-b.sequence);
  // Un tipo mano e un tipo fallo per lo stesso autore/istante non provano due infrazioni distinte.
  for(const e of events.filter(e=>e.type==='foul')){
    const conflicts=commentary.filter(c=>c.play?.type?.type==='handball'&&c.play.period?.number===e.period&&c.play.clock?.value===e.sec&&resolvePlayer(c.play.participants?.[0]?.athlete?.displayName,roster,e.people[0]?.side).player?.id===e.people[0]?.id&&e.people[0]?.id);
    if(conflicts.length){e.problems.push('tipo_mano_fallo_discordante');e.trusted=false;e.crossTypeSourceIds=[...new Set(conflicts.map(c=>String(c.play.id)))];}
  }
  const fouls=events.filter(e=>e.type==='foul'), cards=events.filter(e=>/yellow/.test(e.type));
  const linkedCards=cards.map(card=>{
    const badFoul=card.texts.some(t=>/for (?:a )?bad foul|for a foul/i.test(t));
    const nonFoul=card.texts.some(t=>/handball|celebration|argument|dissent|time wasting/i.test(t));
    const candidates=badFoul&&!nonFoul&&card.trusted&&card.sec!=null?fouls.filter(f=>f.trusted&&f.people[0].id===card.people[0].id&&f.period===card.period&&f.sequence<card.sequence&&f.sec!=null&&f.sec<=card.sec&&card.sec-f.sec<=30):[];
    return {cardId:card.id,minute:card.minute,sec:card.sec,period:card.period,player:card.people[0]??null, reason:nonFoul?'non_fallo':badFoul?'fallo_esplicito':'non_specificato',foulId:candidates.length===1?candidates[0].id:null,status:candidates.length===1?'associazione_temporale_univoca':candidates.length>1?'ambigua':'non_associata',victim:candidates.length===1?candidates[0].people[1]:null};
  });
  const teamAudit=(j.boxscore?.teams || []).map(t=>{
    const side=sideOf(t.team?.displayName), expected=stat(t.statistics,'foulsCommitted');
    const found=fouls.filter(e=>e.trusted&&e.people[0].side===side).length;
    const withStats=roster.filter(p=>p.side===side&&p.fc!=null);
    const rosterTotal=withStats.length?withStats.reduce((s,p)=>s+p.fc,0):null;
    return {team:t.team?.displayName,side,expected,found,rosterTotal,gap:expected==null?null:expected-found};
  });
  return {fixture,teams,roster,events,unstructured,linkedCards,audit:{commentaryRows:commentary.length,rawFoulRows:commentary.filter(c=>c.play?.type?.type==='foul').length,foulEvents:fouls.length,trustedPairs:fouls.filter(e=>e.trusted).length,duplicateSourceIds:events.filter(e=>e.duplicateIds).length,coordinateConflicts:events.filter(e=>e.coordinateConflict).length,untrustedFouls:fouls.filter(e=>!e.trusted).length,unstructuredFoulRows:unstructured.filter(e=>/^Foul by /.test(e.text)).length,cards:cards.length,linkedCards:linkedCards.filter(e=>e.foulId).length,teamAudit}};
}

// Solo eventi strettamente precedenti alla previsione: il fallo del giallo non lo predice retroattivamente.
export function priorFouls(match, playerId, period, second) {
  return match.events.filter(e=>e.type==='foul'&&e.trusted&&e.people[0].id===playerId&&e.period!=null&&e.sec!=null&&(e.period<period||(e.period===period&&e.sec<second)));
}

// La coppia on/off è verificata contro il testo prima di usarla per aggiornare i duelli.
export function verifiedSubstitutions(match) {
  return match.events.filter(e=>e.type==='substitution').map(e=>{
    const on=e.people[0],off=e.people[1];
    const parsed=e.texts.map(t=>t.match(/^Substitution, (.+?)\. (.+?) replaces (.+?)(?: because of an injury)?\.$/)).find(Boolean);
    const resolvedOn=parsed?resolvePlayer(parsed[2],match.roster,on?.side):null;
    const resolvedOff=parsed?resolvePlayer(parsed[3],match.roster,off?.side):null;
    const valid=!!(e.trusted&&on?.id&&off?.id&&on.side===off.side&&resolvedOn?.player?.id===on.id&&resolvedOff?.player?.id===off.id);
    return {id:e.id,minute:e.minute,sec:e.sec,period:e.period,sequence:e.sequence,on,off,valid};
  });
}

export function compareApp(match, data) {
  const all=[...(data.matches||[]),...Object.values(data.cups||{}).flatMap(c=>c.matches||[])];
  const home=match.teams.find(t=>t.side==='home')?.name, away=match.teams.find(t=>t.side==='away')?.name;
  const fixtures=all.filter(m=>teamKey(m.h)===teamKey(home)&&teamKey(m.a)===teamKey(away)&&Math.abs(m.ko*1000-Date.parse(match.fixture.date))<=300000);
  if(fixtures.length!==1)return null;
  const app=fixtures[0], mappings=app.pl.map(r=>({name:r[0],side:r[1]==='h'?'home':'away',vs:r[5],match:resolvePlayer(r[0],match.roster,r[1]==='h'?'home':'away')}));
  const comparisons=match.linkedCards.filter(c=>c.victim).map(c=>{
    const rows=mappings.filter(r=>r.match.player?.id===c.player.id), row=rows.length===1?rows[0]:null;
    const opponent=row?.vs?resolvePlayer(row.vs,match.roster,c.player.side==='home'?'away':'home'):null;
    return {minute:c.minute,player:c.player.name,playerId:c.player.id,victim:c.victim.name,victimId:c.victim.id,appVs:row?.vs??null,mappedVsId:opponent?.player?.id??null,sameOpponent:opponent?.player?opponent.player.id===c.victim.id:null};
  });
  const contacts=mappings.filter(r=>r.match.player).map(r=>{
    const id=r.match.player.id, fouls=match.events.filter(e=>e.type==='foul'&&e.trusted&&e.people[0].id===id);
    const vs=r.vs?resolvePlayer(r.vs,match.roster,r.side==='home'?'away':'home').player:null;
    return {player:r.name,observedFouls:fouls.length,appVs:r.vs||null,vsResolved:!!vs,foulsOnAppVs:vs?fouls.filter(e=>e.people[1].id===vs.id).length:null};
  });
  return {appMatchId:app.id,snapshotWarning:'Abbinamenti nel file attuale: mancano versioni certificate prima del calcio di inizio. Nessuna misura di accuratezza predittiva.',mappedPlayers:mappings.filter(r=>r.match.player).length,totalAppPlayers:mappings.length,unmappedPlayers:mappings.filter(r=>!r.match.player).map(r=>({name:r.name,side:r.side,reason:r.match.method})),cards:comparisons,contacts};
}

export function marketAudit(rows) {
  // Stesso insieme di titolari per tutti i pesi; le quote sono già normalizzate dal codice di produzione.
  const paired=rows.filter(r=>Number.isFinite(r.p_mkt)&&Number.isFinite(r.p_mod));
  const clamp=p=>Math.min(.9999,Math.max(.0001,p)), logit=p=>Math.log(clamp(p)/(1-clamp(p)));
  const weights=[0,.25,.5,.75,1].map(w=>({marketWeight:w,logloss:paired.length?paired.reduce((s,r)=>{const p=clamp(1/(1+Math.exp(-((1-w)*logit(r.p_mod)+w*logit(r.p_mkt)))));return s-r.y*Math.log(p)-(1-r.y)*Math.log(1-p);},0)/paired.length:null}));
  return {rows:rows.length,paired:paired.length,matches:new Set(paired.map(r=>r.match)).size,weights,warning:'Confronto descrittivo su un solo turno; nessuna selezione del peso e nessuna prova temporale fuori campione.'};
}
