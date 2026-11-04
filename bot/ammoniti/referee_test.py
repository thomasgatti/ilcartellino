"""Quanto aggiunge l'arbitro? Train fino al 2020-21, test 2021-22 (stagione con arbitri completi)."""
import numpy as np
import pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

d = pd.read_parquet("data/player_match.parquet").merge(pd.read_parquet("data/referee.parquet"), on="MatchURL", how="left")
st = d[(d.starter == 1) & (d.pos_grp != "GK") & d.ref_yc_prior.notna() & (d.ref_n >= 5)].copy()
st["log_yc90"], st["log_fls90"] = np.log(st.car_yc90), np.log(st.car_fls90)
st["log_since"] = np.log1p(st.apps_since_yc.fillna(30))
st = pd.concat([st, pd.get_dummies(st.pos_grp, prefix="pos", dtype=int)], axis=1)
pos = [c for c in st.columns if c.startswith("pos_") and c != "pos_grp"]
F = ["log_yc90", "log_fls90", "car_fld90", "r10_yc90", "r10_fls90", "card_per_foul", "avg_min_last10", "home", "derby",
     "diffidato", "season_yc_before", "log_since", "t_yc_r10", "t_fls_r10", "o_yc_r10", "o_fls_r10", "o_fld_r10", "h2h_yc", "cum_apps"] + pos
tr, te = st[st.season <= 2021], st[st.season == 2022]
print(f"train {tr.MatchURL.nunique()} partite, test {te.MatchURL.nunique()} partite")

st["ref_q"] = pd.qcut(st.ref_yc_prior, 4, labels=["arbitro permissivo", "Q2", "Q3", "arbitro severo"])
print(st.groupby("ref_q").booked.agg(["mean", "size"]).round(3).to_string())

def run(feats, label):
    X = lambda df: df[feats].fillna(df[feats].median())
    m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5)).fit(X(tr), tr.booked)
    p = m.predict_proba(X(te))[:, 1]
    t = te.assign(p=p).sort_values("p", ascending=False).groupby("MatchURL").head(3).groupby("MatchURL").booked.sum()
    print(f"{label:22s} logloss {log_loss(te.booked, p):.4f} AUC {roc_auc_score(te.booked, p):.3f} "
          f"giusti/3 {t.mean():.3f} P(3/3) {(t == 3).mean():.4f} P(>=2) {(t >= 2).mean():.4f}")

print(f"log loss costante      {log_loss(te.booked, np.full(len(te), tr.booked.mean())):.4f}")
run(F, "senza arbitro")
run(F + ["ref_yc_prior"], "con arbitro")

# Selezione delle partite: giocare solo quelle dove il modello vede P(3/3) più alta
feats = F + ["ref_yc_prior"]
X = lambda df: df[feats].fillna(df[feats].median())
m = make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5)).fit(X(tr), tr.booked)
te = te.assign(p=m.predict_proba(X(te))[:, 1])
g = te.sort_values("p", ascending=False).groupby("MatchURL").head(3).groupby("MatchURL").agg(hits=("booked", "sum"), p3=("p", "prod"))
g["fascia"] = pd.qcut(g.p3, 5, labels=["20% meno favorevoli", "Q2", "Q3", "Q4", "20% più favorevoli"])
print(g.groupby("fascia").agg(P3_stimata=("p3", "mean"), P3_reale=("hits", lambda h: (h == 3).mean()),
                              P2piu_reale=("hits", lambda h: (h >= 2).mean()), partite=("hits", "size")).round(3).to_string())
