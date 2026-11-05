// Ricostruzione locale delle variabili della produzione; non scrive né pubblica previsioni.
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import zlib from 'node:zlib';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export function loadFotmob(directory){
  const provenance=JSON.parse(fs.readFileSync(path.join(directory,'provenienza.json'),'utf8'));
  const matches=new Map();
  for(const source of provenance.files){
    const file=path.basename(source.path),compressed=Buffer.from(fs.readFileSync(path.join(directory,file+'.b64'),'utf8'),'base64');
    const hash=createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${compressed.length}\0`),compressed])).digest('hex');
    if(hash!==source.sha)throw new Error(`Archivio differente dalla fonte: ${source.path}`);
    const league=Number(file.split('_')[0]),data=JSON.parse(zlib.gunzipSync(compressed));
    for(const m of Object.values(data)){
      if(matches.has(+m.id))throw new Error(`Partita duplicata: ${m.id}`);
      matches.set(+m.id,{...m,lg:league});
    }
  }
  return {matches:[...matches.values()].filter(m=>m.ts&&m.pl?.length>20).sort((a,b)=>a.ts-b.ts||a.id-b.id),provenance};
}
export async function buildProduction(matches,modelDirectory){
  const model=JSON.parse(fs.readFileSync(fileURLToPath(new URL('./model-manifest.json',import.meta.url))));
  for(const source of model.files){
    const text=fs.readFileSync(path.join(modelDirectory,path.basename(source.path)),'utf8').replace(/\r\n/g,'\n').trimEnd()+'\n';
    if(createHash('sha256').update(text).digest('hex')!==source.canonicalSha256)throw new Error(`Sorgente del modello non verificato: ${source.path}`);
  }
  const ctx=vm.createContext({console,Math,Date,Map,Set,Promise,setTimeout,clearTimeout});ctx.window=ctx;
  ctx.__FMM={};ctx.__UCL={};ctx.__DOM={};
  const extra={};for(const m of matches){(m.lg===55?ctx.__FMM:m.lg===42?ctx.__UCL:ctx.__DOM)[m.id]=m;if(m.x)extra[m.id]=m.x;}
  for(const name of ['fm_model.js','cup_model.js','cup_model2.js','ext_model.js','cup_x2.js','deep_feats.js','cup_x3.js','amm_boot.js']){
    vm.runInContext('{'+fs.readFileSync(path.join(modelDirectory,name),'utf8')+'\n}',ctx,{filename:name,timeout:1000});
  }
  ctx.idbAll=async()=>extra;
  console.log('Ricostruzione variabili Serie A');ctx.fmBuild();ctx.addLgr();
  console.log('Ricostruzione storico coppe e contesto');ctx.cupBuild2();ctx.extBuild();
  for(const d of ctx.__ROWS)d.ex=ctx.__EX[d.mid+'|'+d.pid];
  for(const d of ctx.__CROWS2)d.ex=ctx.__EX[d.mid+'|'+d.pid];
  const C=ctx.EXT_CANDS;
  ctx.__FS_SA=ctx.fmGroups(ctx.__ROWS).filter(g=>['base','lega','squadre','duelli'].includes(g[0])).flatMap(g=>g[1]);
  ctx.__FS_SA3=[...ctx.__FS_SA,...C.arbitro,...C.precedenti,...C.posizione_partita,...C.forza_ruolo];
  ctx.__CFS2=ctx.cupFS2();ctx.__CFS3=[...ctx.__CFS2,...C.arbitro,...C.precedenti,...C.diffida,...C.posizione_partita];
  ctx.__CUPM3={};ctx.extPatchPredict();
  console.log('Ricostruzione stile individuale e modello coppe v4');ctx.cupX2Build();await ctx.deepFeatBuild();ctx.cupX3Build();
  const sa=ctx.__ROWS.filter(d=>d.ex),ucl=ctx.__CROWS2.filter(d=>d.lg===42&&d.ex&&d.x2&&d.x3);
  for(const [name,rows,features] of [['sa',sa,ctx.__FS_SA3],['ucl',ucl,ctx.__CFS5]]){
    for(const d of rows)if(features.some(f=>!Number.isFinite(f(d))))throw new Error(`Variabile non finita: ${name} ${d.mid} ${d.pid}`);
  }
  return {ctx,sa,ucl,featuresSA:ctx.__FS_SA3,featuresUCL:ctx.__CFS5};
}
