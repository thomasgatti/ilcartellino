"""Modello base P(ammonito) per titolare + backtest della scelta 'top-3 ammoniti' per partita."""
import sys
import numpy as np
import pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import log_loss, roc_auc_score
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler

d = pd.read_parquet(sys.argv[1] if len(sys.argv) > 1 else "data/player_match.parquet")
st = d[(d.starter == 1) & (d.pos_grp != "GK")].copy()
st["log_since"] = np.log1p(st.apps_since_yc.fillna(30))
st["log_yc90"] = np.log(st.car_yc90)
st["log_fls90"] = np.log(st.car_fls90)
st = pd.concat([st, pd.get_dummies(st.pos_grp, prefix="pos", dtype=int)], axis=1)
pos_cols = [c for c in st.columns if c.startswith("pos_") and c != "pos_grp"]

FEATS = ["log_yc90", "log_fls90", "car_fld90", "r10_yc90", "r10_fls90", "card_per_foul", "avg_min_last10",
         "home", "derby", "diffidato", "season_yc_before", "log_since",
         "t_yc_r10", "t_fls_r10", "o_yc_r10", "o_fls_r10", "o_fld_r10", "h2h_yc", "cum_apps"] + pos_cols

train = st[st.season <= 2022]
tests = {"2022-23 (stagione intera)": st[st.season == 2023],
         "2024-25 + 2025-26 (parziali)": st[st.season >= 2025]}

X = lambda df: df[FEATS].fillna(df[FEATS].median())
models = {
    "Logistica": make_pipeline(StandardScaler(), LogisticRegression(max_iter=2000, C=0.5)),
    "Gradient boosting": HistGradientBoostingClassifier(max_iter=300, learning_rate=0.04, max_leaf_nodes=15,
                                                        min_samples_leaf=200, l2_regularization=1.0),
}
for name, mdl in models.items():
    mdl.fit(X(train), train.booked)

def top3(df, score):
    df = df.assign(score=score)
    picks = df.sort_values("score", ascending=False).groupby("MatchURL").head(3)
    g = picks.groupby("MatchURL").agg(hits=("booked", "sum"), p=("score", lambda s: np.prod(s)))
    return g

rows = []
for tname, te in tests.items():
    base = np.full(len(te), train.booked.mean())
    print(f"\n===== Test {tname}: {te.MatchURL.nunique()} partite, P media={te.booked.mean():.3f}")
    print(f"log loss costante: {log_loss(te.booked, base):.4f}")
    # baseline 'umana': chi ha più gialli per 90' in carriera
    candidates = {"Baseline: più gialli/90 in carriera": te.car_yc90.values}
    for name, mdl in models.items():
        p = mdl.predict_proba(X(te))[:, 1]
        print(f"{name:18s} log loss {log_loss(te.booked, p):.4f}  AUC {roc_auc_score(te.booked, p):.3f}")
        candidates[name] = p
    for cname, sc in candidates.items():
        g = top3(te, sc)
        dist = g.hits.value_counts(normalize=True).reindex([0, 1, 2, 3], fill_value=0)
        rows.append({"test": tname, "metodo": cname, "partite": len(g),
                     "giusti_medi_su_3": round(g.hits.mean(), 3),
                     "P(3/3)": round(dist[3], 4), "P(>=2/3)": round(dist[2] + dist[3], 4),
                     "P(0/3)": round(dist[0], 4),
                     "P(3/3) stimata dal modello": round(g.p.mean(), 4) if cname != candidates and "Baseline" not in cname else None})
res = pd.DataFrame(rows)
print("\n", res.to_string(index=False))

# Calibrazione del modello logistico sul test 2022-23
te = tests["2022-23 (stagione intera)"]
p = models["Logistica"].predict_proba(X(te))[:, 1]
cal = pd.DataFrame({"p": p, "y": te.booked.values})
cal["bin"] = pd.cut(cal.p, [0, .1, .15, .2, .25, .3, .4, 1])
print("\nCalibrazione (logistica, 2022-23):\n", cal.groupby("bin").agg(pred=("p", "mean"), reale=("y", "mean"), n=("y", "size")).round(3).to_string())
print("\nP massima assegnata a un giocatore:", round(p.max(), 3))

# importanza (coefficienti standardizzati)
coef = pd.Series(models["Logistica"][-1].coef_[0], index=FEATS).sort_values(key=abs, ascending=False)
print("\nCoefficienti standardizzati (logistica):\n", coef.round(3).to_string())
res.to_csv("data/backtest_results.csv", index=False)
