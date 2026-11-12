// Tris dell'app con regola del sostituto. Con una lista di id aggiorna soltanto quelle partite.
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

async function main() {
  const ids = (process.argv[2] || '').split(',').filter(Boolean).map(Number);
  const lateIds = new Set((process.argv[3] || '').split(',').filter(Boolean).map(Number));
  const requested = [...new Set([...ids, ...lateIds])];
  const archive = path.join(__dirname, 'tris_app.json');
  const b = await chromium.launch(process.env.CHROMIUM_PATH ? {executablePath:process.env.CHROMIUM_PATH} : {});
  try {
    const p = await b.newPage();
    await p.route(/^https?:/, route => route.abort());
    await p.goto(pathToFileURL(path.join(__dirname,'index.html')).href);
    const out = await p.evaluate(ids => {
      const result = [];
      for (const comp of ['sa','ucl','naz']) {
        if (comp !== 'sa' && !cupOf(comp)) continue;
        setComp(comp);
        for (const m of DATA.matches) {
          if (ids.length && !ids.includes(m.id)) continue;
          const t = pick(m,'21',0,true,true);
          if (t.trio?.length !== 3 || !Number.isFinite(t.p3)) throw new Error(`Tris incompleto: ${m.id}`);
          result.push({comp,id:m.id,ko:m.ko,partita:m.h+' - '+m.a,uff:!!m.uff,p3:t.p3,
            trio:t.trio.map(x=>({n:x.n,p:+x.p.toFixed(4),team:x.team}))});
        }
      }
      return result;
    },requested);
    let rows = out;
    const revisions = new Map(), same = new Set();
    if (requested.length) {
      if (requested.some(id => !out.some(t => t.id === id))) throw new Error('Almeno un tris richiesto è assente');
      const existing = JSON.parse(fs.readFileSync(archive,'utf8'));
      const updated = new Map(out.map(t => [t.id,t]));
      rows = existing.map(t => {
        const fresh = updated.get(t.id);
        updated.delete(t.id);
        if (lateIds.has(t.id)) {
          if (!fresh.uff) throw new Error(`Formazioni ufficiali mancanti per il tris ${t.id}`);
          // ufficiali in ritardo ma stesso tris: nessuna revisione
          if (!t.revised && fresh.trio.map(x => x.n).sort().join() === t.trio.map(x => x.n).sort().join()) { same.add(t.id); return t; }
          const revised = t.revised || {uff:true,late:true,p3:fresh.p3,trio:fresh.trio};
          revisions.set(t.id,revised);
          return {...t,revised};
        }
        return fresh || t;
      }).concat([...updated.values()]);
    }
    if (revisions.size + same.size !== lateIds.size) throw new Error('Almeno un tris prepartita da correggere è assente');
    if (revisions.size) {
      const file = path.join(__dirname,'vercel/risultati.json');
      const results = JSON.parse(fs.readFileSync(file,'utf8'));
      const toUpdate = results.filter(r => revisions.has(r.matchId) && !r.tris_app_revisione);
      for (const r of toUpdate) r.tris_app_revisione = revisions.get(r.matchId);
      if (toUpdate.length) fs.writeFileSync(file,JSON.stringify(results));
    }
    fs.writeFileSync(archive,JSON.stringify(rows,null,1));
    console.log(out.map(t => t.partita + ' · ' + t.trio.map(p => p.n + ' ' + Math.round(p.p*100) + '%').join(', ')).join('\n'));
  } finally {
    await b.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });
