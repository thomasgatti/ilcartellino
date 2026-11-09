// Riscontro dei totali: mani e rigori non diventano coppie di giocatori.
import {norm,teamKey} from './duelli.mjs';
export function accountFouls(j,match){
  const commentary=j.commentary||[], extra=new Map(),conflicts=[];
  for(const [i,c] of commentary.entries()){
    const p=c.play,type=p?.type?.type,text=c.text||p?.text||'';
    const sec=p?.clock?.value??c.time?.value??null,period=p?.period?.number??null;
    let category=null;
    if(type==='handball')category='mano_strutturata';
    else if(type!=='foul'&&/^Penalty conceded by .+ with a handball /i.test(text))category='rigore_mano_testo';
    else if(!p&&/^Foul by /.test(text))category='fallo_solo_testo';
    if(!category)continue;
    if(type==='handball'&&match.events.some(e=>e.crossTypeSourceIds?.includes(String(p.id)))){conflicts.push({sourceId:String(p.id),sec,text,reason:'tipo_mano_fallo_discordante'});continue;}
    // Il rigore da fallo già presente negli eventi non viene contato una seconda volta.
    if(category==='fallo_solo_testo'&&match.events.some(e=>e.type==='foul'&&e.sec===sec&&e.texts.some(t=>norm(t)===norm(text))))continue;
    const team=text.match(/\(([^)]+)\)/)?.[1]||p?.team?.displayName||null;
    const side=match.teams.find(t=>teamKey(t.name)===teamKey(team))?.side??null;
    const participants=(p?.participants||[]).map(x=>norm(x.athlete?.displayName)).join('|');
    const key=sec==null?`id:${p?.id??i}`:[category,period,sec,side,participants||norm(text)].join('|');
    if(!extra.has(key))extra.set(key,{category,side,sec,period,text,sourceIds:[]});
    if(p?.id)extra.get(key).sourceIds.push(String(p.id));
  }
  const extras=[...extra.values()].map(e=>({...e,sourceIds:[...new Set(e.sourceIds)]}));
  const teams=match.audit.teamAudit.map(t=>{
    const structured=match.events.filter(e=>e.type==='foul'&&e.people[0]?.side===t.side).length;
    const additional=extras.filter(e=>e.side===t.side).length;
    return {team:t.team,expected:t.expected,structured,additional,residual:t.expected==null?null:t.expected-structured-additional};
  });
  const count=c=>extras.filter(e=>e.category===c).length;
  const expected=match.audit.teamAudit.reduce((s,t)=>s+(t.expected??0),0);
  return {structuredFouls:match.audit.foulEvents,structuredHandballs:count('mano_strutturata'),textHandballPenalties:count('rigore_mano_testo'),textOnlyFouls:count('fallo_solo_testo'),expected,residual:expected-match.audit.foulEvents-extras.length,unknownSide:extras.filter(e=>!e.side).length,crossTypeConflicts:[...new Map(conflicts.map(e=>[e.sourceId,e])).values()],teams,extras};
}
