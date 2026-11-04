"""Verifica sui dati delle ipotesi: casa/fuori, derby, diffida, ritardo, falli, ruolo."""
import sys
import numpy as np
import pandas as pd
from statsmodels.formula.api import logit

d = pd.read_parquet(sys.argv[1] if len(sys.argv) > 1 else "data/player_match.parquet")
st = d[(d.starter == 1) & (d.pos_grp != "GK")].copy()
print(f"Titolari di movimento: {len(st)} righe, {st.MatchURL.nunique()} partite")
base = st.booked.mean()
print(f"P(ammonito) media titolare: {base:.3f}")

def tab(col, label=None):
    t = st.groupby(col).booked.agg(["mean", "size"])
    t["lift"] = t["mean"] / base
    print(f"\n--- {label or col}\n{t.round(3).to_string()}")

tab("home", "Casa (1) / Trasferta (0)")
tab("derby", "Derby/rivalità")
tab("diffidato", "Diffidato (prossimo giallo = squalifica)")
tab("pos_grp", "Ruolo")
st["ritardo"] = pd.cut(st.apps_since_yc, [-1, 0, 2, 5, 10, 20, 999],
                        labels=["0 (ultima)", "1-2", "3-5", "6-10", "11-20", ">20"])
tab("ritardo", "Ritardo: presenze dall'ultimo giallo")
st["fls_q"] = pd.qcut(st.car_fls90, 5, labels=["Q1 pochi falli", "Q2", "Q3", "Q4", "Q5 molti falli"])
tab("fls_q", "Falli commessi per 90' (storico)")
st["yc_q"] = pd.qcut(st.car_yc90, 5, labels=["Q1", "Q2", "Q3", "Q4", "Q5"])
tab("yc_q", "Gialli per 90' (storico)")
st["ofld_q"] = pd.qcut(st.o_fld_r10, 4, labels=["avversario subisce pochi falli", "Q2", "Q3", "subisce molti falli"])
tab("ofld_q", "Falli subiti dall'avversario (ultime 10)")

# Effetto netto: il ritardo e la diffida contano a parità di 'cattiveria' del giocatore?
x = st.dropna(subset=["apps_since_yc", "car_yc90", "car_fls90", "t_yc_r10", "o_fld_r10"]).copy()
x["log_since"] = np.log1p(x.apps_since_yc)
mod = logit("booked ~ np.log(car_yc90) + np.log(car_fls90) + home + derby + diffidato + log_since"
            " + t_yc_r10 + o_fld_r10 + C(pos_grp)", data=x).fit(disp=0)
print("\n--- Regressione logistica (effetti netti)")
print(mod.summary2().tables[1][["Coef.", "P>|z|"]].round(4).to_string())

# Falli nella partita stessa (non noto prima: serve a capire il meccanismo)
print("\n--- P(giallo) per numero di falli commessi NELLA partita")
print(st.assign(f=st.Fls.clip(upper=5)).groupby("f").booked.agg(["mean", "size"]).round(3).to_string())
