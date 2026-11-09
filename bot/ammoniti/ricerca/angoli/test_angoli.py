"""Angoli prepartita Serie A: test temporale.
Ogni partita viene stimata solo con le partite precedenti (finite almeno 3 ore prima del suo calcio d'inizio).
Varianti:
  M0  media di lega (ultime 380 gare), Poisson
  M0n media di lega, binomiale negativa
  M1  squadre: angoli fatti/concessi in casa e in trasferta, attenuati verso la media, con decadimento nel tempo, Poisson
  M1n M1 con binomiale negativa
  M2n come M1n ma fatti/concessi senza separare casa e trasferta (più dati per squadra)
Parametri (attenuazione k, decadimento tau, dispersione r) scelti SOLO sulla stagione di sviluppo 2023/24.
Verifica: 2024/25, 2025/26, 2026/27 parziale. Linee: 8,5 9,5 10,5 11,5.
"""
import json, math, sys, itertools
from statistics import mean

A = json.load(open('angoli-serie-a-champions.json'))
SA = sorted([x for x in A if x['league'] == 'ita.1'], key=lambda x: x['ts'])
LINES = [8.5, 9.5, 10.5, 11.5]
DAY = 86400

def pois_cdf(k, lam):
    t = c = math.exp(-lam)
    for i in range(1, k + 1):
        t *= lam / i; c += t
    return c

def nb_cdf(k, lam, r):
    # media lam, varianza lam + lam^2/r
    p = r / (r + lam)
    t = c = p ** r
    for i in range(1, k + 1):
        t *= (i - 1 + r) / i * (1 - p); c += t
    return c

def over(lam, line, r=None):
    k = int(line)  # over 9,5 = almeno 10 = 1 - P(X <= 9)
    return 1 - (pois_cdf(k, lam) if r is None else nb_cdf(k, lam, r))

def predict(i, k, tau, split=True):
    """lambda casa e trasferta per la partita i con le gare precedenti."""
    m = SA[i]; cut = m['ts'] - 3 * 3600
    past = [x for x in SA[:i] if x['ts'] <= cut]
    last = past[-380:]
    mh = mean(x['hc'] for x in last); ma = mean(x['ac'] for x in last)
    def rate(team, field_for, field_ag, where):
        # angoli fatti e concessi della squadra, pesati nel tempo
        sf = sa = w = 0.0
        for x in past[-1200:]:
            if split:
                if where == 'h' and x['homeId'] == team: f, g = x['hc'], x['ac']
                elif where == 'a' and x['awayId'] == team: f, g = x['ac'], x['hc']
                else: continue
            else:
                if x['homeId'] == team: f, g = x['hc'], x['ac']
                elif x['awayId'] == team: f, g = x['ac'], x['hc']
                else: continue
            wt = math.exp(-(m['ts'] - x['ts']) / DAY / tau)
            sf += wt * f; sa += wt * g; w += wt
        return sf, sa, w
    if split:
        hf, hg, hw = rate(m['homeId'], 'hc', 'ac', 'h')
        af, ag, aw = rate(m['awayId'], 'ac', 'hc', 'a')
        att_h = (hf + k * mh) / (hw + k) / mh; def_h = (hg + k * ma) / (hw + k) / ma
        att_a = (af + k * ma) / (aw + k) / ma; def_a = (ag + k * mh) / (aw + k) / mh
    else:
        mt = (mh + ma) / 2
        hf, hg, hw = rate(m['homeId'], 0, 0, 'h'); af, ag, aw = rate(m['awayId'], 0, 0, 'a')
        att_h = (hf + k * mt) / (hw + k) / mt; def_h = (hg + k * mt) / (hw + k) / mt
        att_a = (af + k * mt) / (aw + k) / mt; def_a = (ag + k * mt) / (aw + k) / mt
    return mh * att_h * def_a, ma * att_a * def_h, mh + ma

def evaluate(season, k, tau, r, split=True, rows=None):
    idx = [i for i, x in enumerate(SA) if x['season'] == season]
    out = {name: {L: [0.0, 0] for L in LINES} for name in ['M0', 'M0n', 'M1', 'M1n']}
    hits = {L: 0 for L in LINES}
    for i in idx:
        lh, la, l0 = predict(i, k, tau, split)
        tot = SA[i]['hc'] + SA[i]['ac']
        for L in LINES:
            y = tot > L; hits[L] += y
            for name, p in [('M0', over(l0, L)), ('M0n', over(l0, L, r)), ('M1', over(lh + la, L)), ('M1n', over(lh + la, L, r))]:
                p = min(max(p, 1e-6), 1 - 1e-6)
                out[name][L][0] += -(math.log(p) if y else math.log(1 - p)); out[name][L][1] += 1
        if rows is not None: rows.append((SA[i], lh + la, l0))
    return {n: {L: v[0] / v[1] for L, v in d.items()} for n, d in out.items()}, hits, len(idx)

def fit_r(season_max):
    # dispersione stimata sui totali delle stagioni fino a season_max (momenti, attorno alla media di stagione)
    num = den = 0
    for se in range(2021, season_max + 1):
        t = [x['hc'] + x['ac'] for x in SA if x['season'] == se]
        mu = mean(t); var = sum((v - mu) ** 2 for v in t) / (len(t) - 1)
        num += len(t) * mu * mu; den += len(t) * max(var - mu, 1e-6)
    return num / den

if __name__ == '__main__':
    r = fit_r(2022)
    print('dispersione r (fino al 2022/23) =', round(r, 1))
    best = None
    for split, k, tau in itertools.product([True, False], [3, 6, 10, 20], [120, 250, 500, 10000]):
        res, _, _ = evaluate(2023, k, tau, r, split)
        score = mean(res['M1n'].values())
        if best is None or score < best[0]: best = (score, split, k, tau)
        print(f"sviluppo 2023/24 split={split} k={k} tau={tau}: M1n {score:.4f}  (M0n {mean(res['M0n'].values()):.4f})")
    _, split, k, tau = best
    print('\nscelti:', 'casa/trasferta separati' if split else 'casa/trasferta insieme', 'k =', k, 'tau =', tau)
    report = {'parametri': {'split': split, 'k': k, 'tau': tau, 'r': r}, 'verifica': {}}
    for se in [2024, 2025, 2026]:
        r_se = fit_r(se - 1)
        res, hits, n = evaluate(se, k, tau, r_se, split)
        report['verifica'][se] = {'gare': n, 'over': hits, 'logloss': res}
        print(f"\n{se}/{(se+1)%100:02d} ({n} gare)")
        for L in LINES:
            print(f"  over {L}: {hits[L]}/{n}  " + '  '.join(f"{name} {res[name][L]:.4f}" for name in res))
    json.dump(report, open('risultati_angoli_sa.json', 'w'), indent=1)
