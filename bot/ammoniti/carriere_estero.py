"""Carriere multi-campionato (FBref via worldfootballR_data): Serie A + Premier, LaLiga, Bundesliga, Ligue 1, MLS.
Output: data/carriere.parquet (giocatore x campionato x stagione) e data/fattori_campionato.json."""
import pandas as pd, numpy as np, json, sys
L='/home/claude/ext/leagues/'; R='/home/claude/data/raw/'
cols=['Player','Player_Href','Team','Pos','Min','CrdY','2CrdY','Fls','Fld','Season_End_Year','Competition_Name']
files={'ENG':L+'ENG_M_1st.csv','ESP':L+'ESP_M_1st.csv','GER':L+'GER_M_1st.csv','FRA':L+'FRA_M_1st.csv','USA':L+'USA_M_1st.csv','ITA':R+'ITA_M_1st_misc_player_advanced_match_stats.csv'}
parts=[]
for k,f in files.items():
    d=pd.read_csv(f,usecols=lambda c:c in cols,low_memory=False); d['lega']=k; parts.append(d)
D=pd.concat(parts,ignore_index=True)
D=D[D.Min.fillna(0)>0].copy()
D['pid']=D.Player_Href.str.extract(r'/players/([0-9a-f]{8})/')
D['y']=D.CrdY.fillna(0)
S=D.groupby(['pid','lega','Season_End_Year']).agg(Player=('Player','last'),Team=('Team','last'),Pos=('Pos','last'),pres=('Min','size'),Min=('Min','sum'),y=('y','sum'),fls=('Fls','sum'),fld=('Fld','sum')).reset_index()
S.to_parquet('/home/claude/ammoniti/data/carriere.parquet')
# fattori di campionato: gialli e falli per 90' medi
F={}
for k,g in S.groupby('lega'):
    F[k]={'y90':float(g.y.sum()/g.Min.sum()*90),'fls90':float(g.fls.sum()/g.Min.sum()*90),'stagioni':sorted(map(int,g.Season_End_Year.unique()))[-3:]}
# verifica sui trasferimenti: chi ha giocato >=900' in un campionato estero nella stagione t-1 e >=900' in Serie A nella stagione t
ita=S[(S.lega=='ITA')&(S.Min>=900)][['pid','Season_End_Year','Min','y','fls']]
est=S[(S.lega!='ITA')&(S.Min>=900)]
m=est.assign(Season_End_Year=est.Season_End_Year+1).merge(ita,on=['pid','Season_End_Year'],suffixes=('_prima','_ita'))
tr={}
for k,g in m.groupby('lega'):
    y_prima=g.y_prima.sum()/g.Min_prima.sum()*90; y_ita=g.y_ita.sum()/g.Min_ita.sum()*90
    f_prima=g.fls_prima.sum()/g.Min_prima.sum()*90; f_ita=g.fls_ita.sum()/g.Min_ita.sum()*90
    r=np.corrcoef(g.y_prima/g.Min_prima,g.y_ita/g.Min_ita)[0,1]
    tr[k]={'giocatori':int(len(g)),'gialli90_prima':round(y_prima,3),'gialli90_in_serieA':round(y_ita,3),'rapporto_gialli':round(y_ita/y_prima,3),'falli90_prima':round(f_prima,2),'falli90_in_serieA':round(f_ita,2),'correlazione_gialli':round(r,2)}
# stessa verifica dentro la Serie A (anno su anno) come riferimento
a=ita.assign(Season_End_Year=ita.Season_End_Year+1).merge(ita,on=['pid','Season_End_Year'],suffixes=('_prima','_ita'))
tr['ITA (anno su anno)']={'giocatori':int(len(a)),'correlazione_gialli':round(np.corrcoef(a.y_prima/a.Min_prima,a.y_ita/a.Min_ita)[0,1],2)}
json.dump({'campionati':F,'trasferimenti_verso_serieA':tr},open('/home/claude/ammoniti/data/fattori_campionato.json','w'),indent=1)
print(json.dumps(F,indent=1)); print(json.dumps(tr,indent=1))
