// Copia in locale snapshot già presenti in un checkout git. Legge soltanto i due commit fissati.
import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {spawnSync} from 'node:child_process';import {createHash} from 'node:crypto';
const root=path.dirname(fileURLToPath(import.meta.url)),repo=path.resolve(process.argv[2]||path.join(root,'../../../..'));
const data=JSON.parse(fs.readFileSync(path.join(root,'fotmob-manifest.json'))),model=JSON.parse(fs.readFileSync(path.join(root,'model-manifest.json')));
for(const [manifest,folder,encoding] of [[data,'fotmob','base64'],[model,'model','utf8']]){
  const dir=path.join(root,'input',folder);fs.mkdirSync(dir,{recursive:true});
  for(const source of manifest.files){
    const result=spawnSync('git',['show',`${manifest.ref}:${source.path}`],{cwd:repo,maxBuffer:20*1024*1024,windowsHide:true});
    if(result.status!==0)throw new Error(`Snapshot non disponibile: ${manifest.ref}:${source.path}. Verificare il checkout e recuperare i rami main e dati.`);
    const bytes=result.stdout,hash=createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${bytes.length}\0`),bytes])).digest('hex');
    if(hash!==source.sha)throw new Error(`Hash discordante: ${source.path}`);
    fs.writeFileSync(path.join(dir,path.basename(source.path)+(encoding==='base64'?'.b64':'')),bytes.toString(encoding));
  }
  if(folder==='fotmob')fs.writeFileSync(path.join(dir,'provenienza.json'),JSON.stringify(manifest,null,2)+'\n');
}
console.log(`Snapshot pronti: ${data.files.length} archivi, ${model.files.length} sorgenti. Nessuna modifica remota.`);
