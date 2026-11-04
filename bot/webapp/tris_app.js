// Tris dell'app (2+1, regola del sostituto) per tutte le partite: Serie A e coppe. Uscita: tris_app.json
const {chromium}=require('playwright');(async()=>{const b=await chromium.launch();const p=await b.newPage();
await p.goto('file://'+require('path').resolve(__dirname,'index.html')); await p.waitForTimeout(600);
const out=await p.evaluate(()=>{ state.subRule=true; const res=[]; for (const c of ['sa','ucl']) { if (c==='ucl' && !CUP) continue; setComp(c); for (const m of DATA.matches) { const t=pick(m,'21',0); res.push({comp:c, id:m.id, ko:m.ko, partita:m.h+' - '+m.a, uff:!!m.uff, p3:t.p3, trio:t.trio.map(x=>({n:x.n,p:+x.p.toFixed(4),team:x.team}))}); } } setComp('sa'); return res; });
require('fs').writeFileSync(require('path').resolve(__dirname,'tris_app.json'),JSON.stringify(out,null,1)); console.log(out.map(o=>(o.comp==='ucl'?'[UCL] ':'')+o.partita+': '+o.trio.map(t=>t.n+' '+Math.round(t.p*100)+'%').join(', ')).join('\n')); await b.close();})()
