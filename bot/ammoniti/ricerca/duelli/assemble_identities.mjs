// Compila il registro di identità con profilo per id e riscontro primario esplicito.
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {norm} from './duelli.mjs';
const root=path.dirname(fileURLToPath(import.meta.url));
const curated=JSON.parse(await readFile(path.join(root,'curated-identities.json'),'utf8'));
const registry={schema:2,reviewedOn:curated.reviewedOn,aliases:{},sources:[]};
const jobs=[...curated.entries,{id:'347018',names:[],birthDate:'2003-05-22',source:null,verification:'Il profilo ESPN espone già sia Sulemana sia Ibrahim Sulemana.'}];
const cache=path.join(root,'cache','identita');await mkdir(cache,{recursive:true});await mkdir(path.join(root,'input'),{recursive:true});
for(const item of jobs){
  const file=path.join(cache,item.id+'.json');let raw;
  const fallback=`https://sports.core.api.espn.com/v2/sports/soccer/leagues/uefa.champions/athletes/${item.id}?lang=en&region=us`;
  try{raw=await readFile(file,'utf8');}catch{const r=await fetch(fallback,{signal:AbortSignal.timeout(20000)});if(!r.ok)throw new Error(`HTTP ${r.status}: ${fallback}`);raw=await r.text();await writeFile(file,raw);}
  const j=JSON.parse(raw);if(String(j.id)!==item.id||j.dateOfBirth?.slice(0,10)!==item.birthDate)throw new Error(`Anagrafica non verificata: ${item.id}`);
  const names=[j.fullName,j.displayName,j.shortName,[j.firstName,j.middleName,j.lastName].filter(Boolean).join(' '),...item.names].filter(Boolean);
  const source={id:item.id,espnSource:j.$ref||fallback,sha256:createHash('sha256').update(raw).digest('hex'),birthDate:item.birthDate,independentSource:item.source,verification:item.verification};
  registry.aliases[item.id]={names:[...new Map(names.map(n=>[norm(n),n])).values()],...source};registry.sources.push(source);
}
await writeFile(path.join(root,'identity-registry.json'),JSON.stringify(registry,null,2)+'\n');console.log(`Identità compilate e controllate: ${jobs.length}`);
