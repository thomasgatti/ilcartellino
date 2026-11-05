// Calendari per anno e resoconti ESPN: raccolta sola lettura, cache compressa, errori espliciti.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
import {loadFotmob} from './production_research.mjs';
const root=path.dirname(fileURLToPath(import.meta.url)),config=JSON.parse(fs.readFileSync(path.join(root,'archive.config.json')));
const cache=path.resolve(process.argv[2]||path.join(root,'cache-archive'));fs.mkdirSync(cache,{recursive:true});
const {matches,provenance}=loadFotmob(path.join(root,'input/fotmob')),cutoff=Date.parse(config.cutoff),sources=[],failures=[];
const hash=s=>createHash('sha256').update(s).digest('hex'),pause=ms=>new Promise(r=>setTimeout(r,ms));
async function get(url,file){
 const target=path.join(cache,file+'.gz');let raw,cachedAt;
 if(fs.existsSync(target)){raw=zlib.gunzipSync(fs.readFileSync(target)).toString('utf8');JSON.parse(raw);cachedAt=fs.statSync(target).mtime.toISOString();}
 else{
  const pilot=path.join(root,'cache',file);
  if(file.startsWith('summary-')&&fs.existsSync(pilot)){raw=fs.readFileSync(pilot,'utf8');cachedAt=fs.statSync(pilot).mtime.toISOString();}
  else for(let attempt=0;attempt<4;attempt++)try{
   const r=await fetch(url,{signal:AbortSignal.timeout(25000)});if(!r.ok)throw new Error(`HTTP ${r.status}`);raw=await r.text();JSON.parse(raw);cachedAt=new Date().toISOString();break;
  }catch(e){if(attempt===3)throw e;await pause(1000*2**attempt);}
  fs.writeFileSync(target,zlib.gzipSync(raw));
 }
 sources.push({file:file+'.gz',url,sha256:hash(raw),retrievedOrCachedAt:cachedAt});return JSON.parse(raw);
}
const fixtures=new Map();
for(const league of config.leagues){
 const target=matches.filter(m=>m.lg===league.fotmob&&Number(m.season.slice(0,4))>=config.firstSeason&&m.ts*1000<cutoff);
 for(const year of config.calendarYears){
  const url=`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.espn}/scoreboard?dates=${year}&limit=1000`;
  const j=await get(url,`scoreboard-${league.espn}-${year}.json`);if(j.events?.length>=1000)throw new Error(`Calendario forse troncato ${league.espn} ${year}`);
  for(const e of j.events||[]){
   const when=Date.parse(e.date),season=Number(e.season?.year);if(!e.status?.type?.completed||when>=cutoff||season<config.firstSeason||!target.some(m=>Math.abs(m.ts*1000-when)<=300000))continue;
   fixtures.set(e.id,{id:String(e.id),league:league.espn,season:`${season}/${season+1}`,date:e.date,name:e.name,source:`https://site.api.espn.com/apis/site/v2/sports/soccer/${league.espn}/summary?event=${e.id}`});
  }
  console.log(`Calendario ${league.espn} ${year}: ${j.events?.length||0} righe, ${fixtures.size} gare candidate complessive`);
 }
}
const chosen=[...fixtures.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.id.localeCompare(b.id));
fs.writeFileSync(path.join(cache,'fixtures.json'),JSON.stringify(chosen,null,2)+'\n');let next=0,done=0;
const receipt=()=>fs.writeFileSync(path.join(cache,'receipts.json'),JSON.stringify({schema:1,config,dataRef:provenance.ref,sources,failures},null,2)+'\n');
await Promise.all(Array.from({length:config.concurrency},async()=>{while(next<chosen.length){const f=chosen[next++];try{const j=await get(f.source,`summary-${f.id}.json`);if(String(j.header?.id)!==f.id)throw new Error('Id partita discordante');}catch(e){failures.push({id:f.id,url:f.source,error:e.message});}done++;if(done%50===0||done===chosen.length){receipt();console.log(`Resoconti ${done}/${chosen.length}; errori ${failures.length}`);}await pause(150);}}));
receipt();console.log(JSON.stringify({matches:chosen.length,sources:sources.length,failures}));
