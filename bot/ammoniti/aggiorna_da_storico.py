"""Impara dalle partite registrate in data/storico_partite.jsonl.
Produce data/aggiustamenti.json, da applicare alla previsione successiva:
- calibrazione: rapporto gialli reali / attesi sui titolari (ridotto verso 1, prior 20 partite)
- arbitri: gialli per partita osservati in stagione (aggiunti allo storico arbitro)
- giocatori: gialli e partite giocate dopo l'ultimo scraping (aggiunti ai tassi individuali)
- regola sostituto: quota di ingressi dalla panchina finiti con un giallo (prior 8,8% su 40 ingressi)
"""
import json, collections
rec=[json.loads(l) for l in open('data/storico_partite.jsonl',encoding='utf-8')]
att=sum(r['metriche']['gialli_attesi_titolari'] for r in rec); real=sum(r['metriche']['gialli_reali_titolari'] for r in rec)
n=len(rec); k=20
calib=(real+k*att/n)/(att+k*att/n) if n else 1.0
arb=collections.defaultdict(lambda:[0,0]); gioc=collections.defaultdict(lambda:[0,0])
ingressi=gialli_ingressi=0
for r in rec:
    arb[r['arbitro']][0]+=1; arb[r['arbitro']][1]+=r['gialli_totali']
    for g in r['giocatori']:
        key=g['squadra']+'|'+g['n']; gioc[key][0]+=1; gioc[key][1]+=g['ammonito']
        if g['sostituito_da']:
            ingressi+=1; gialli_ingressi+=int(g['slot_ammonito'] and not g['ammonito'] or g['sostituito_da'] in r.get('ammoniti_non_in_lista',[]))
sub_rate=(gialli_ingressi+0.088*40)/(ingressi+40)
out={'partite':n,'calibrazione_moltiplicatore':round(calib,3),'arbitri':{a:{'partite':v[0],'gialli':v[1]} for a,v in arb.items()},
     'giocatori':{g:{'partite':v[0],'gialli':v[1]} for g,v in gioc.items()},'tasso_giallo_subentrati':round(sub_rate,4)}
json.dump(out,open('data/aggiustamenti.json','w',encoding='utf-8'),ensure_ascii=False,indent=1)
print({k:v for k,v in out.items() if k!='giocatori'})
