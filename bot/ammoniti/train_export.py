"""Allena il modello sui dati FBref 2017-2022 usando SOLO feature ricostruibili da Sofascore
(ruolo grezzo D/M/F) ed esporta coefficienti + normalizzazione in JSON, per applicarlo ai dati live."""
import json
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score

d = pd.read_parquet("data/player_match.parquet").merge(pd.read_parquet("data/referee.parquet"), on="MatchURL", how="left")
coarse = {"CB": "D", "FB": "D", "DM": "M", "CM": "M", "AM": "M", "WM": "M", "W": "F", "FW": "F", "GK": "G"}
d["pc"] = d.pos_grp.map(coarse)
st = d[(d.starter == 1) & (d.pc != "G")].copy()

# tassi per ruolo grezzo (prior per lo shrinkage), calcolati su tutti i minuti
allm = d[d.pc != "G"]
rates = {pc: {k: float(g[c].sum() / g.Min.sum() * 90) for k, c in [("yc", "booked"), ("fls", "Fls")]}
         for pc, g in allm.groupby("pc")}
# fld90 non è nel parquet come totale: ricostruisco il tasso medio dal car_fld90 dei veterani
for pc, g in st[st.cum_Min > 3000].groupby("pc"):
    rates[pc]["fld"] = float(g.car_fld90.median())

st["log_yc90"], st["log_fls90"] = np.log(st.car_yc90), np.log(st.car_fls90)
st["log_since"] = np.log1p(st.apps_since_yc.fillna(30))
st["pos_M"], st["pos_F"] = (st.pc == "M").astype(int), (st.pc == "F").astype(int)
lg_ref = float(st.ref_yc_prior.mean())
st["ref"] = st.ref_yc_prior.fillna(lg_ref)
st["has_ref"] = st.ref_yc_prior.notna().astype(int)

F = ["log_yc90", "log_fls90", "car_fld90", "r10_yc90", "r10_fls90", "card_per_foul", "avg_min_last10", "home", "derby",
     "diffidato", "season_yc_before", "log_since", "t_yc_r10", "t_fls_r10", "o_yc_r10", "o_fls_r10", "o_fld_r10",
     "pos_M", "pos_F", "ref"]
tr = st[(st.season <= 2022) & (st.has_ref == 1)]
te = st[st.season == 2023]
med = tr[F].median()
mu, sd = tr[F].fillna(med).mean(), tr[F].fillna(med).std()
Z = lambda df: (df[F].fillna(med) - mu) / sd
m = LogisticRegression(max_iter=3000, C=0.5).fit(Z(tr), tr.booked)
p = m.predict_proba(Z(te))[:, 1]
t3 = te.assign(p=p).sort_values("p", ascending=False).groupby("MatchURL").head(3).groupby("MatchURL").booked.sum()
print(f"test 2022-23: logloss {log_loss(te.booked, p):.4f} AUC {roc_auc_score(te.booked, p):.3f} giusti/3 {t3.mean():.3f} P(3/3) {(t3==3).mean():.3f}")
print(pd.Series(m.coef_[0], index=F).round(3).to_string())
json.dump({"features": F, "coef": m.coef_[0].tolist(), "intercept": float(m.intercept_[0]),
           "mu": mu.tolist(), "sd": sd.tolist(), "median": med.tolist(), "rates": rates, "lg_ref": lg_ref},
          open("ammoniti/model_v0.json", "w"), indent=1)
print(json.dumps(rates), lg_ref)
