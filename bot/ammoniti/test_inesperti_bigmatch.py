"""Giocatori con poca esperienza in Serie A nelle partite di cartello: c'è un rischio di giallo in più? (FBref 2017-25, titolari)"""
import numpy as np, pandas as pd
from statsmodels.formula.api import logit
d=pd.read_parquet('data/player_match.parquet')
st=d[(d.starter==1)&(d.pos_grp!='GK')].copy()
BIG={'Juventus','Internazionale','Milan','Napoli','Roma','Lazio','Atalanta'}
st['big']=((st.Team.isin(BIG)&st.opp.isin(BIG))|(st.derby==1)).astype(int)
st['inesp']=(st.cum_apps<20).astype(int)
st['lyc']=np.log(st.car_yc90.fillna(st.car_yc90.median()).clip(.02)); st['lfl']=np.log(st.car_fls90.fillna(st.car_fls90.median()).clip(.1))
st['g']=st.pos_grp.map(lambda x:'D' if x in('CB','FB') else 'F' if x in('FW','W') else 'M')
print('righe',len(st),'partite di cartello',st.big.sum(),'inesperti in partite di cartello',int((st.big&st.inesp).sum()))
t=st.groupby(['inesp','big']).booked.agg(['mean','size']).unstack(); print(t.round(3))
tg=st[st.g=='D'].groupby(['inesp','big']).booked.agg(['mean','size']).unstack(); print('difensori\n',tg.round(3))
m=logit('booked ~ lyc + lfl + C(g) + home + inesp + big + inesp:big',data=st).fit(disp=0)
print(m.summary2().tables[1].loc[['inesp','big','inesp:big'],['Coef.','Std.Err.','P>|z|']].round(3))
md=logit('booked ~ lyc + lfl + home + inesp + big + inesp:big',data=st[st.g=='D']).fit(disp=0)
print('solo difensori\n',md.summary2().tables[1].loc[['inesp','big','inesp:big'],['Coef.','Std.Err.','P>|z|']].round(3))
