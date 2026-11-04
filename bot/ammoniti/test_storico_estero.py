"""Verifica: per chi arriva in Serie A dall'estero, lo storico estero convertito migliora la previsione nella prima stagione?"""
import numpy as np, pandas as pd
CAR=pd.read_parquet('data/carriere.parquet'); pm=pd.read_parquet('data/player_match.parquet')
FY={'ENG':1.30,'ESP':1.01,'FRA':1.18,'GER':1.08,'USA':1.11}; FF={'ENG':1.18,'ESP':1.00,'FRA':1.02,'GER':1.04,'USA':1.10}
st=pm[(pm.starter==1)&(pm.pos_grp!='GK')].copy()
st['g']=st.pos_grp.map(lambda x:'D' if x in('CB','FB') else 'F' if x in('FW','W') else 'M')
first=st.groupby('pid').season.min().rename('s0'); st=st.join(first,on='pid'); st=st[st.season==st.s0]
st=st[st.season>=2019]
est=CAR[CAR.lega!='ITA'].copy(); est['yA']=est.y*est.lega.map(FY); est['fA']=est.fls*est.lega.map(FF)
rows=[]
for (pid,s0),g in st.groupby(['pid','s0']):
    e=est[(est.pid==pid)&(est.Season_End_Year<s0)&(est.Season_End_Year>=s0-3)]
    if e.Min.sum()<900: continue
    w=e.Season_End_Year.map(lambda y:{1:1,2:.8,3:.6}[s0-y])
    rows.append((pid,s0,float((e.Min*w).sum()),float((e.yA*w).sum()),float((e.fA*w).sum())))
E=pd.DataFrame(rows,columns=['pid','s0','eMin','ey','ef'])
T=st.merge(E,on=['pid','s0'])
base=st.groupby('g').booked.mean().to_dict()
PR={'D':(.2055,1.1176),'F':(.158,1.3805),'M':(.2353,1.488)}; b1,b2=.514,.556; K=900
def p_est(r):
    py,pf=PR[r.g]; y=(r.ey+py*K/90)/(r.eMin+K)*90; f=(r.ef+pf*K/90)/(r.eMin+K)*90
    p0=base[r.g]; o=p0/(1-p0)*np.exp(b1*np.log(y/py)+b2*np.log(f/pf)); return o/(1+o)
T['p0']=T.g.map(base); T['p1']=T.apply(p_est,axis=1)
ll=lambda p,y: -np.mean(y*np.log(p)+(1-y)*np.log(1-p))
print('giocatori',T.pid.nunique(),'partite da titolare',len(T),'P reale',round(T.booked.mean(),3))
print('logloss solo ruolo',round(ll(T.p0,T.booked),4),'| con storico estero',round(ll(T.p1,T.booked),4))
T['q']=pd.qcut(T.p1,4,labels=['storico tranquillo','Q2','Q3','storico cattivo'])
print(T.groupby('q',observed=True).agg(previsto=('p1','mean'),reale=('booked','mean'),n=('booked','size')).round(3))
