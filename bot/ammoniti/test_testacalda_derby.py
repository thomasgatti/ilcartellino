"""Testa calda e clima derby: verifiche sui dati FBref 2017-2025 (titolari di movimento)."""
import numpy as np, pandas as pd
from statsmodels.formula.api import logit
d=pd.read_parquet('data/player_match.parquet')
st=d[(d.starter==1)&(d.pos_grp!='GK')&(d.cum_Min>=900)].dropna(subset=['car_yc90','car_fls90']).copy()
st['lyc']=np.log(st.car_yc90.clip(0.02)); st['lfl']=np.log(st.car_fls90.clip(0.1))
# testa calda = gialli in più rispetto a quelli spiegati dai falli (residuo)
r=np.polyfit(st.lfl,st.lyc,1); st['tc']=st.lyc-np.polyval(r,st.lfl)
st['tc_z']=(st.tc-st.tc.mean())/st.tc.std()
st['giovane']=(st.cum_apps<60).astype(int)   # poca esperienza in A
st['att']=st.pos_grp.isin(['FW','W','AM']).astype(int)
print('righe',len(st),'derby',st.derby.sum(),'P base',round(st.booked.mean(),3))
m=logit('booked ~ lfl + tc_z + home + derby + derby:tc_z + derby:giovane + giovane + derby:att + C(pos_grp)',data=st).fit(disp=0)
print(m.summary2().tables[1][['Coef.','P>|z|']].round(3).to_string())
st['tcq']=pd.qcut(st.tc,4,labels=['calmi','Q2','Q3','teste calde'])
t=st.groupby(['tcq','derby'],observed=True).booked.agg(['mean','size']).unstack(); print(t.round(3))
g=st.groupby(['giovane','derby']).booked.agg(['mean','size']).unstack(); print(g.round(3))
a=st.groupby(['att','derby']).booked.agg(['mean','size']).unstack(); print(a.round(3))
