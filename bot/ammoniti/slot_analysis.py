"""Regola dell'utente: una scelta vale se viene ammonito il titolare OPPURE il giocatore entrato al suo posto.
Misura sullo storico FBref quanto cambia la probabilità per "casella" rispetto al solo titolare."""
import re
import numpy as np
import pandas as pd

s = pd.read_csv("data/raw/ITA_match_summary.csv", low_memory=False)
d = pd.read_parquet("data/player_match.parquet")
st = d[(d.starter == 1) & (d.pos_grp != "GK")].copy()

def tmin(x):
    m = re.match(r"(\d+)(?:\+(\d+))?", str(x)); return int(m.group(1)) + (int(m.group(2)) if m and m.group(2) else 0) if m else np.nan

ev = s[["MatchURL", "Team", "Event_Type", "Event_Players", "Event_Time"]].copy()
ev["t"] = ev.Event_Time.map(tmin)
subs = ev[ev.Event_Type == "Substitute"].copy()
subs["inn"] = subs.Event_Players.str.split(" for ").str[0].str.strip()
subs["out"] = subs.Event_Players.str.split(" for ").str[1].str.strip()
yc = ev[ev.Event_Type.isin(["Yellow Card", "Second Yellow Card"])].copy()
yc["p"] = yc.Event_Players.str.strip()
first_yc = yc.groupby(["MatchURL", "Team", "p"]).t.min()

sub_of = subs.set_index(["MatchURL", "Team", "out"])[["inn", "t"]]
sub_of = sub_of[~sub_of.index.duplicated()]
k = list(zip(st.MatchURL, st.Team, st.Player))
st["subbed"] = [x in sub_of.index for x in k]
st["sub_t"] = [sub_of.loc[x, "t"] if x in sub_of.index else np.nan for x in k]
st["repl"] = [sub_of.loc[x, "inn"] if x in sub_of.index else None for x in k]
st["repl_booked"] = [bool(r) and (u, tm, r) in first_yc.index and first_yc[(u, tm, r)] >= t0
                     for u, tm, r, t0 in zip(st.MatchURL, st.Team, st.repl, st.sub_t.fillna(999))]
st["slot"] = ((st.booked == 1) | st.repl_booked).astype(int)

print(f"Titolari di movimento: {len(st)}")
print(f"P(giallo titolare) {st.booked.mean():.3f} | P(casella: titolare o sostituto) {st.slot.mean():.3f} | sostituiti {st.subbed.mean():.3f}")
print(f"P(sostituto ammonito | entrato) {st[st.subbed].repl_booked.mean():.3f}, minuto medio del cambio {st.sub_t.mean():.0f}")
print("\nPer ruolo:")
print(st.groupby("pos_grp").agg(titolare=("booked", "mean"), casella=("slot", "mean"), sostituiti=("subbed", "mean"),
      sostituto_ammonito=("repl_booked", "sum"), n=("booked", "size")).assign(guadagno=lambda x: x.casella - x.titolare).round(3).sort_values("guadagno").to_string())
# chi viene sostituito spesso guadagna di più: per minuti medi recenti
st["minq"] = pd.cut(st.avg_min_last10, [0, 60, 70, 80, 88, 100], labels=["<60'", "60-70'", "70-80'", "80-88'", "88'+"])
print("\nPer minuti medi giocati nelle ultime 10 (quanto spesso esce):")
print(st.groupby("minq", observed=True).agg(titolare=("booked", "mean"), casella=("slot", "mean"), sostituiti=("subbed", "mean"), n=("booked", "size")).assign(guadagno=lambda x: x.casella - x.titolare).round(3).to_string())
# stima semplice della casella a partire dalla probabilità del titolare:
# P(casella) = 1 - (1 - p) * (1 - P(sostituito) * P(sostituto ammonito | entra))
ps = st.groupby("pos_grp").subbed.mean(); pr = st[st.subbed].groupby("pos_grp").repl_booked.mean()
st["q"] = st.pos_grp.map(ps * pr)
print("\nTasso di 'sostituto ammonito' per ruolo del titolare (P(sostituito) x P(ammonito|entra)):")
print((ps * pr).round(3).to_string())
st[["MatchURL", "Player", "pos_grp", "season", "booked", "slot", "subbed", "repl_booked", "avg_min_last10"]].to_parquet("data/slot.parquet", index=False)
