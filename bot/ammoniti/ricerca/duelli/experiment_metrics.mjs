// Metriche appaiate per partita e regola di selezione fissata prima dell'holdout.
const log=v=>Math.log(Math.max(.05,v??1));
export function featureSet(base,name,comp){
  const faceIndex=comp==='sa'?8:5;
  if(name==='formazione'||name==='due_avversari')return base.map((f,i)=>i===faceIndex?(d=>{
    const value=d.duel?.[name==='formazione'?'currentFacing':'top2Facing'];
    return value==null?f(d):comp==='sa'?value:Math.log(Math.max(.005,value));
  }):f);
  if(name==='interazione')return [...base,d=>log(d.duel?.attackingDribbles),d=>log(d.duel?.ownVulnerability)*log(d.duel?.attackingDribbles)];
  return base;
}
export function evaluate(rows,pred,basePred){
  const clamp=p=>Math.min(.9999,Math.max(.0001,p)),loss=(p,y)=>-y*Math.log(clamp(p))-(1-y)*Math.log(1-clamp(p));
  const games=new Map();let ll=0,baseLL=0;
  rows.forEach((d,i)=>{const a=loss(pred[i],d.y),b=loss(basePred[i],d.y);ll+=a;baseLL+=b;if(!games.has(d.mid))games.set(d.mid,[]);games.get(d.mid).push({p:pred[i],b:basePred[i],y:d.y,dl:a-b});});
  const blocks=[...games].map(([id,a])=>({id,n:a.length,deltaLL:a.reduce((s,x)=>s+x.dl,0)/a.length,top:a.toSorted((x,y)=>y.p-x.p).slice(0,3).reduce((s,x)=>s+x.y,0),baseTop:a.toSorted((x,y)=>y.b-x.b).slice(0,3).reduce((s,x)=>s+x.y,0)}));
  return {n:rows.length,matches:games.size,logloss:ll/rows.length,baselineLogloss:baseLL/rows.length,deltaLL:(ll-baseLL)/rows.length,top3:blocks.reduce((s,x)=>s+x.top,0)/games.size,baselineTop3:blocks.reduce((s,x)=>s+x.baseTop,0)/games.size,blocks};
}
export function aggregate(folds){
  const n=folds.reduce((s,f)=>s+f.n,0),blocks=folds.flatMap(f=>f.blocks),av=k=>folds.reduce((s,f)=>s+f[k]*f.n,0)/n;
  const dt=blocks.map(b=>b.top-b.baseTop),dl=blocks.map(b=>b.deltaLL),mean=a=>a.reduce((s,x)=>s+x,0)/a.length,se=a=>a.length>1?Math.sqrt(a.reduce((s,x)=>s+(x-mean(a))**2,0)/(a.length-1)/a.length):null;
  return {n,matches:blocks.length,logloss:av('logloss'),baselineLogloss:av('baselineLogloss'),deltaLL:av('deltaLL'),deltaLLse:se(dl),top3:blocks.reduce((s,b)=>s+b.top,0)/blocks.length,deltaTop3:mean(dt),deltaTop3se:se(dt)};
}
export function selectCandidate(development){
  return Object.entries(development).filter(([name,x])=>name!=='base'&&x.deltaLL<=-.0002&&x.deltaTop3>=0).sort((a,b)=>a[1].deltaLL-b[1].deltaLL)[0]?.[0]??null;
}
