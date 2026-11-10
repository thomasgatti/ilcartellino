"""Angoli prepartita con i dati EXTRA FotMob: oltre agli angoli fatti/concessi, la pressione offensiva della squadra
(tiri, tocchi in area, xG fatti e concessi) e il possesso. Regressione di Poisson per gli angoli di ciascuna squadra,
allenata sulle stagioni precedenti, provata sulla successiva (ogni gara vede solo le gare precedenti).
Uso: python3 angoli2.py <cartella extra> <lega> [<lega> ...]"""
import json, gzip, math, sys, os, glob
import numpy as np
from scipy.special import gammaln

EXTRA = sys.argv[1]; LEAGUES = sys.argv[2:] or ['55']
LINES = [8.5, 9.5, 10.5, 11.5]
N_LAST = 10

def load(lg):
    ms = []
    for f in sorted(glob.glob(os.path.join(EXTRA, f'{lg}_*.json.gz'))):
        season = os.path.basename(f).split('_')[1][:4]
        for id, m in json.load(gzip.open(f)).items():
            t = m['t']
            if all(k in t for k in ('angoli', 'tiri', 'tocchi_area', 'xg', 'possesso')):
                ms.append(dict(id=id, ts=m['ts'], season=int(season), h=m['h'][0], a=m['a'][0], **{k: t[k] for k in ('angoli', 'tiri', 'tocchi_area', 'xg', 'possesso')}))
    return sorted(ms, key=lambda x: x['ts'])

KEYS = ['angoli', 'tiri', 'tocchi_area', 'xg', 'possesso']

def features(ms):
    """per ogni gara, medie delle ultime N_LAST gare (stessa lega) di ciascuna squadra: fatti e concessi."""
    hist, rows, lg_hist = {}, [], []
    for m in ms:
        f = {}
        ok = True
        for side, team in (('h', m['h']), ('a', m['a'])):
            H = hist.get(team, [])[-N_LAST:]
            if len(H) < 3: ok = False; break
            for k in KEYS:
                f[f'{side}_{k}_f'] = np.mean([x[k][0] for x in H]); f[f'{side}_{k}_c'] = np.mean([x[k][1] for x in H])
        if ok and len(lg_hist) >= 100:
            L = lg_hist[-380:]
            f['lg_h'] = np.mean([x[0] for x in L]); f['lg_a'] = np.mean([x[1] for x in L])
            rows.append((m, f))
        for side, team, o in (('h', m['h'], 0), ('a', m['a'], 1)):
            hist.setdefault(team, []).append({k: (m[k][o], m[k][1 - o]) for k in KEYS})
        lg_hist.append(m['angoli'])
    return rows

def X_for(f, side, variant):
    o = 'a' if side == 'h' else 'h'; lg = f['lg_h'] if side == 'h' else f['lg_a']
    lx = lambda v: math.log(max(v, 0.05))
    x = [1.0, lx(lg)]
    if variant >= 1: x += [lx(f[f'{side}_angoli_f']), lx(f[f'{o}_angoli_c'])]
    if variant >= 2: x += [lx(f[f'{side}_tiri_f']), lx(f[f'{o}_tiri_c']), lx(f[f'{side}_tocchi_area_f']), lx(f[f'{o}_tocchi_area_c']),
                          lx(f[f'{side}_xg_f']), lx(f[f'{o}_xg_c']), lx(f[f'{side}_possesso_f']), lx(f[f'{o}_possesso_f'])]
    return x

def fit_poisson(X, y, lam=1.0):
    X = np.array(X); y = np.array(y, float); b = np.zeros(X.shape[1]); b[0] = math.log(y.mean())
    for _ in range(50):
        mu = np.exp(X @ b); g = X.T @ (y - mu) - lam * np.r_[0, b[1:]]; Hs = X.T @ (X * mu[:, None]) + lam * np.diag(np.r_[0, np.ones(len(b) - 1)])
        step = np.linalg.solve(Hs, g); b += step
        if np.abs(step).max() < 1e-8: break
    return b

def nb_cdf(k, mu, r):
    p = r / (r + mu); t = c = p ** r
    for i in range(1, k + 1): t *= (i - 1 + r) / i * (1 - p); c += t
    return c

def run(lg):
    rows = features(load(lg)); seasons = sorted({m['season'] for m, _ in rows})
    print(f'\nLega {lg}: {len(rows)} gare utilizzabili, stagioni {seasons}')
    for te in seasons[-3:]:
        tr = [(m, f) for m, f in rows if m['season'] < te]; ts = [(m, f) for m, f in rows if m['season'] == te]
        if len(tr) < 300 or not ts: continue
        tot_tr = np.array([sum(m['angoli']) for m, _ in tr]); mu0 = tot_tr.mean(); var = tot_tr.var(ddof=1); r = mu0 ** 2 / max(var - mu0, 1e-3)
        res = {}
        for v, name in [(0, 'media lega'), (1, 'angoli squadre'), (2, '+ tiri/xG/possesso')]:
            bh = fit_poisson([X_for(f, 'h', v) for _, f in tr], [m['angoli'][0] for m, _ in tr])
            ba = fit_poisson([X_for(f, 'a', v) for _, f in tr], [m['angoli'][1] for m, _ in tr])
            ll = {L: 0.0 for L in LINES}
            for m, f in ts:
                mu = math.exp(np.dot(X_for(f, 'h', v), bh)) + math.exp(np.dot(X_for(f, 'a', v), ba)); y = sum(m['angoli'])
                for L in LINES:
                    p = 1 - nb_cdf(int(L), mu, r); p = min(max(p, 1e-6), 1 - 1e-6)
                    ll[L] += -(math.log(p) if y > L else math.log(1 - p))
            res[name] = {L: ll[L] / len(ts) for L in LINES}
        print(f'  {te}/{(te+1)%100:02d} ({len(ts)} gare, media angoli {np.mean([sum(m["angoli"]) for m,_ in ts]):.2f})')
        for name, d in res.items(): print(f'    {name:22s} ' + '  '.join(f'O{L}: {d[L]:.4f}' for L in LINES) + f'   media {np.mean(list(d.values())):.4f}')

for lg in LEAGUES: run(lg)

# Angoli della singola squadra (log-verosimiglianza di Poisson media, più alta = meglio) e differenza angoli casa-trasferta
def run_team(lg):
    rows = features(load(lg)); seasons = sorted({m['season'] for m, _ in rows})
    print(f'\nLega {lg}: angoli per squadra')
    for te in seasons[-3:]:
        tr = [(m, f) for m, f in rows if m['season'] < te]; ts = [(m, f) for m, f in rows if m['season'] == te]
        out = []
        for v, name in [(0, 'media lega'), (1, 'angoli squadre'), (2, '+ tiri/xG/possesso')]:
            s = 0.0; n = 0
            for side, i in (('h', 0), ('a', 1)):
                b = fit_poisson([X_for(f, side, v) for _, f in tr], [m['angoli'][i] for m, _ in tr])
                for m, f in ts:
                    mu = math.exp(np.dot(X_for(f, side, v), b)); y = m['angoli'][i]
                    s += y * math.log(mu) - mu - gammaln(y + 1); n += 1
            out.append(f'{name}: {s/n:.4f}')
        print(f'  {te}: ' + ' | '.join(out))
for lg in LEAGUES: run_team(lg)
