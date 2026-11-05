// Secondo riscontro dei nomi tramite profili ESPN identificati dall'id, senza somiglianze automatiche.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {norm} from './duelli.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const all=JSON.parse(await readFile(path.join(root,'results','eventi-normalizzati.json'),'utf8'));
const needed=new Map();
for(const m of all){
  for(const e of m.events.filter(e=>e.problems.includes('grafia_o_alias_non_verificato'))){
    for(const p of e.people)if(p.id)needed.set(p.id,{id:p.id,league:m.fixture.league});
  }
  // Recuperare i profili dell'intera rosa nei dieci incontri confrontati permette di verificare anche i nomi dell'app.
  if(m.appComparison)for(const p of m.roster)needed.set(p.id,{id:p.id,league:m.fixture.league});
}
const cache=path.join(root,'cache','identita');await mkdir(cache,{recursive:true});
const jobs=[...needed.values()];let next=0,done=0;const aliases={},sources=[];
await Promise.all(Array.from({length:4},async()=>{
  while(next<jobs.length){
    const p=jobs[next++],url=`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${p.league}/athletes/${p.id}?lang=en&region=us`,file=path.join(cache,`${p.id}.json`);
    let raw;try{raw=await readFile(file,'utf8');}catch{
      const r=await fetch(url,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${url}`);raw=await r.text();await writeFile(file,raw);
    }
    const j=JSON.parse(raw);if(String(j.id)!==p.id)throw new Error(`Id profilo discordante: ${p.id}`);
    const names=[j.fullName,j.displayName,j.shortName,[j.firstName,j.middleName,j.lastName].filter(Boolean).join(' ')].filter(Boolean);
    aliases[p.id]={names:[...new Map(names.map(n=>[norm(n),n])).values()],source:url,sha256:createHash('sha256').update(raw).digest('hex')};
    sources.push({id:p.id,url,sha256:aliases[p.id].sha256});done++;if(done%50===0||done===jobs.length)console.log(`Profili verificati: ${done}/${jobs.length}`);
  }
}));
await writeFile(path.join(root,'input','identity-profiles.json'),JSON.stringify({schema:1,method:'Nomi esposti dal profilo pubblico per id ESPN. Nessuna correzione da similarità.',aliases,sources},null,2)+'\n');
