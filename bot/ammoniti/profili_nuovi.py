"""Profilo storico (anche estero) per i giocatori dell'app: converte gialli/falli per 90' di altri campionati
nella scala della Serie A e calcola un moltiplicatore di rischio rispetto alla media del ruolo."""
import json, unicodedata, numpy as np, pandas as pd
from statsmodels.formula.api import logit
norm=lambda s: unicodedata.normalize('NFD',str(s).replace('’',"'")).encode('ascii','ignore').decode().lower().strip()
CAR=pd.read_parquet('data/carriere.parquet')
# fattori verso la Serie A: media tra rapporto dei campionati e rapporto osservato sui trasferimenti
FY={'ITA':1.0,'ENG':1.30,'ESP':1.01,'FRA':1.18,'GER':1.08,'USA':1.11}
FF={'ITA':1.0,'ENG':1.18,'ESP':1.00,'FRA':1.02,'GER':1.04,'USA':1.10}
CAR=CAR[CAR.Season_End_Year>=2023].copy()
w={2026:1.0,2025:0.8,2024:0.6,2023:0.4}
CAR["w"]=CAR.Season_End_Year.map(w)
CAR["yA"]=CAR.y*CAR.lega.map(FY); CAR["fA"]=CAR.fls*CAR.lega.map(FF)
def grp(pos):
    p=str(pos).split(',')[0]
    return 'F' if p in('FW','LW','RW') else 'D' if p in('CB','LB','RB','WB','DF') else 'M'
G=CAR.groupby('pid').apply(lambda g: pd.Series({'Player':g.sort_values('Season_End_Year').Player.iloc[-1],'Team':g.sort_values('Season_End_Year').Team.iloc[-1],
   'lega_ult':g.sort_values('Season_End_Year').lega.iloc[-1],'leghe':','.join(sorted(set(g.lega))),'ita_min':float(g[g.lega=='ITA'].Min.sum()),
   'Min':float((g.Min*g.w).sum()),'y':float((g.yA*g.w).sum()),'f':float((g.fA*g.w).sum()),'min_raw':float(g.Min.sum()),'pos':grp(g.Pos.iloc[-1])}),include_groups=False).reset_index()
# medie Serie A per ruolo (scala di riferimento) e coefficienti dal modello FBref Serie A 2017-25
pm=pd.read_parquet('data/player_match.parquet')
st=pm[(pm.starter==1)&(pm.pos_grp!='GK')&(pm.cum_Min>=900)].dropna(subset=['car_yc90','car_fls90']).copy()
st['g']=st.pos_grp.map(lambda x:'D' if x in('CB','FB') else 'F' if x in('FW','W') else 'M')
st['lyc']=np.log(st.car_yc90.clip(.02)); st['lfl']=np.log(st.car_fls90.clip(.1))
mod=logit('booked ~ lyc + lfl + C(g)',data=st).fit(disp=0); b1,b2=mod.params['lyc'],mod.params['lfl']
PR=st.groupby('g').agg(y=('car_yc90','median'),f=('car_fls90','median')).to_dict('index')
K=900
def mult(r):
    pr=PR[r.pos]; y=(r.y+pr['y']*K/90)/(r.Min+K)*90; f=(r.f+pr['f']*K/90)/(r.Min+K)*90
    return float(np.exp(b1*(np.log(y)-np.log(pr['y']))+b2*(np.log(f)-np.log(pr['f'])))), y, f
out=[]
for r in G.itertuples():
    m,y,f=mult(r); out.append((r.pid,m,y,f))
G[['pid','mult','y90','f90']]=pd.DataFrame(out,columns=['pid','mult','y90','f90'])
G.to_parquet('data/profili.parquet')
print('coef',round(b1,3),round(b2,3),'prior',PR)
# abbinamento ai giocatori dell'app
d=json.load(open('/home/claude/webapp/data.json',encoding='utf-8'))
idx={}
for r in G.itertuples(): idx.setdefault(norm(r.Player).split()[-1],[]).append(r)
res={}
for m in d['matches']:
    for row in m['pl']:
        n=row[0]; ini,sur=(n.split('. ')[0][0].lower(), n.split('. ')[-1]) if '. ' in n else ('', n)
        cands=[c for c in idx.get(norm(sur).split()[-1],[]) if (not ini or norm(c.Player)[0]==ini) and c.min_raw>=450]
        if len(cands)>1:  # preferisci chi ha giocato in Serie A con la squadra attuale
            team=m['h'] if row[1]=='h' else m['a']
            c2=[c for c in cands if norm(c.Team)==norm(team) or norm(team) in norm(c.Team)]
            cands=c2 if len(c2)==1 else cands
        if len(cands)==1:
            c=cands[0]; res[f"{m['id']}|{n}"]={'fbref':c.Player,'leghe':c.leghe,'ultimo':c.lega_ult,'squadra_prec':c.Team,'min':round(c.min_raw),'ita_min':round(c.ita_min),'mult':round(c.mult,3),'y90':round(c.y90,3),'f90':round(c.f90,2)}
json.dump(res,open('data/profili_app.json','w',encoding='utf-8'),ensure_ascii=False,indent=0)
new=[(k,v) for k,v in res.items() if v['ita_min']<900]
print('abbinati',len(res),'di',sum(len(m['pl']) for m in d['matches']),'| con poco o nulla in Serie A:',len(new))
for k,v in sorted(new,key=lambda x:-x[1]['mult']): print(k,v)
