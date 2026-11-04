"""
Costruisce la tabella giocatore-partita per la Serie A con feature calcolate
SOLO su informazioni disponibili prima del calcio d'inizio.

Input  : data/raw/ITA_M_1st_misc_player_advanced_match_stats.csv  (falli, gialli, minuti per giocatore)
         data/raw/ITA_match_summary.csv                            (eventi: cambi, cartellini)
Output : data/player_match.parquet
"""
import sys
import numpy as np
import pandas as pd

RAW = sys.argv[1] if len(sys.argv) > 1 else "data/raw"
OUT = sys.argv[2] if len(sys.argv) > 2 else "data/player_match.parquet"

# Derby: coppie di squadre della stessa città / rivalità storiche
DERBIES = [
    {"Milan", "Internazionale"}, {"Roma", "Lazio"}, {"Juventus", "Torino"},
    {"Genoa", "Sampdoria"}, {"Hellas Verona", "Chievo"},
    {"Juventus", "Internazionale"},  # Derby d'Italia
    {"Napoli", "Roma"}, {"Fiorentina", "Juventus"}, {"Atalanta", "Brescia"},
]

# Soglie squalifica per somma di ammonizioni in Serie A: 5°, 10°, 14°, 17° giallo, poi ogni giallo.
SUSP = [5, 10, 14, 17]


def is_diffidato(n_yellow_before: int) -> int:
    nxt = n_yellow_before + 1
    return int(nxt in SUSP or nxt > 17)


def main():
    m = pd.read_csv(f"{RAW}/ITA_M_1st_misc_player_advanced_match_stats.csv", low_memory=False)
    s = pd.read_csv(f"{RAW}/ITA_match_summary.csv", low_memory=False)

    m = m.rename(columns={"2CrdY": "Crd2Y"})
    m["Match_Date"] = pd.to_datetime(m["Match_Date"])
    m["pid"] = m["Player_Href"].str.extract(r"/players/([0-9a-f]+)/")[0]
    m["Min"] = m["Min"].fillna(0)
    # ammonito = almeno un giallo (incluso chi poi prende il secondo giallo)
    m["booked"] = ((m["CrdY"] > 0) | (m["Crd2Y"] > 0)).astype(int)

    # ---- titolari: chi NON è entrato dalla panchina
    subs = s[s.Event_Type == "Substitute"].copy()
    subs["sub_in"] = subs["Event_Players"].str.split(" for ").str[0].str.strip()
    sub_in = set(zip(subs.MatchURL, subs.Team, subs.sub_in))
    m["starter"] = [int((u, t, p) not in sub_in) for u, t, p in zip(m.MatchURL, m.Team, m.Player)]

    # ---- contesto partita
    m["home"] = (m["Home_Away"] == "Home").astype(int)
    m["opp"] = np.where(m.home == 1, m.Away_Team, m.Home_Team)
    m["derby"] = [int({a, b} in DERBIES) for a, b in zip(m.Home_Team, m.Away_Team)]
    m["season"] = m["Season_End_Year"]
    pos1 = m["Pos"].fillna("").str.split(",").str[0]
    m["pos_grp"] = pos1.map({
        "GK": "GK", "CB": "CB", "LB": "FB", "RB": "FB", "WB": "FB",
        "DM": "DM", "CM": "CM", "LM": "WM", "RM": "WM", "AM": "AM",
        "LW": "W", "RW": "W", "FW": "FW"}).fillna("CM")

    m = m.sort_values(["Match_Date", "MatchURL"]).reset_index(drop=True)

    # ---- storico del giocatore (shift(1) => solo partite precedenti)
    g = m.groupby("pid", sort=False)
    for col in ["booked", "Fls", "Fld", "Min", "TklW", "Int"]:
        m[f"cum_{col}"] = g[col].cumsum() - m[col]
    m["cum_apps"] = g.cumcount()

    # medie mobili sulle ultime 10 presenze
    for col in ["booked", "Fls", "Fld", "Min"]:
        m[f"r10_{col}"] = g[col].transform(lambda x: x.shift(1).rolling(10, min_periods=1).sum())

    # tassi per 90' con shrinkage verso la media del ruolo (prior di 900 minuti)
    prior_min = 900.0
    for col, out in [("booked", "yc90"), ("Fls", "fls90"), ("Fld", "fld90")]:
        rate = m.groupby("pos_grp").apply(lambda d: d[col].sum() / d["Min"].sum() * 90).to_dict()
        pr = m["pos_grp"].map(rate)
        m[f"car_{out}"] = (m[f"cum_{col}"] + pr * prior_min / 90) / (m["cum_Min"] + prior_min) * 90
        m[f"r10_{out}"] = (m[f"r10_{col}"] + pr * 300 / 90) / (m["r10_Min"].fillna(0) + 300) * 90
    m["card_per_foul"] = (m["cum_booked"] + 1) / (m["cum_Fls"] + 8)  # quanto spesso un fallo diventa giallo
    m["avg_min_last10"] = m["r10_Min"] / m.groupby("pid").cumcount().clip(upper=10).replace(0, np.nan)

    # ---- stagione corrente: gialli accumulati (diffida) e ritardo
    gs = m.groupby(["pid", "season"], sort=False)
    m["season_yc_before"] = gs["booked"].cumsum() - m["booked"]
    m["diffidato"] = m["season_yc_before"].apply(is_diffidato)

    # ritardo: presenze dall'ultimo giallo (su tutta la carriera osservata)
    def since_last(x):
        out, c = [], np.nan
        for v in x:
            out.append(c)
            c = 0 if v == 1 else (c + 1 if not np.isnan(c) else np.nan)
        return out
    m["apps_since_yc"] = g["booked"].transform(lambda x: pd.Series(since_last(x.values), index=x.index))

    # ---- livello squadra (partite precedenti)
    team = (m.groupby(["MatchURL", "Match_Date", "Team", "opp"], as_index=False)
              .agg(t_yc=("booked", "sum"), t_fls=("Fls", "sum"), t_fld=("Fld", "sum"))
              .sort_values("Match_Date"))
    tg = team.groupby("Team")
    for c in ["t_yc", "t_fls", "t_fld"]:
        team[f"{c}_r10"] = tg[c].transform(lambda x: x.shift(1).rolling(10, min_periods=3).mean())
    m = m.merge(team[["MatchURL", "Team", "t_yc_r10", "t_fls_r10", "t_fld_r10"]], on=["MatchURL", "Team"], how="left")
    opp = team[["MatchURL", "Team", "t_yc_r10", "t_fls_r10", "t_fld_r10"]].rename(
        columns={"Team": "opp", "t_yc_r10": "o_yc_r10", "t_fls_r10": "o_fls_r10", "t_fld_r10": "o_fld_r10"})
    m = m.merge(opp, on=["MatchURL", "opp"], how="left")

    # ---- testa a testa: gialli medi negli scontri precedenti tra le due squadre
    team["pair"] = [" | ".join(sorted([a, b])) for a, b in zip(team.Team, team.opp)]
    pm = team.groupby(["MatchURL", "Match_Date", "pair"], as_index=False).t_yc.sum().sort_values("Match_Date")
    pm["h2h_yc"] = pm.groupby("pair").t_yc.transform(lambda x: x.shift(1).expanding().mean())
    m = m.merge(pm[["MatchURL", "h2h_yc"]], on="MatchURL", how="left")

    keep = ["MatchURL", "Match_Date", "season", "Team", "opp", "Player", "pid", "Pos", "pos_grp",
            "starter", "home", "derby", "Min", "Fls", "booked",
            "cum_apps", "cum_Min", "car_yc90", "car_fls90", "car_fld90", "r10_yc90", "r10_fls90", "r10_fld90",
            "card_per_foul", "avg_min_last10", "season_yc_before", "diffidato", "apps_since_yc",
            "t_yc_r10", "t_fls_r10", "t_fld_r10", "o_yc_r10", "o_fls_r10", "o_fld_r10", "h2h_yc"]
    m[keep].to_parquet(OUT, index=False)
    print(m[keep].shape, "->", OUT)


if __name__ == "__main__":
    main()
