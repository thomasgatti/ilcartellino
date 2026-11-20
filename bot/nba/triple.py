"""NBA, triple segnate (canestri da 3) per giocatore: quante ne fa stanotte.

20/11/2026, prova chiesta dal proprietario: giocare a sistema le linee «over» delle triple (es. Herro over 2,5 / 3,5 / 4,5).
Modello: media attesa con un gradient boosting a perdita di Poisson sulle variabili note prima della partita (colonne tpm_* e tpa_* di
dataset.py: medie lente, veloci, di stagione e delle ultime 10, percentuale di carriera, tiri da 3 al minuto per minuti attesi, triple
concesse dall'avversario), poi una binomiale negativa (dispersione stimata sui dati di allenamento) per P(almeno k).

Uso per la prova: python3 bot/nba/triple.py /tmp/d3.pkl     (tabella di dataset.costruisci salvata con to_pickle)
"""
import sys, math
import numpy as np, pandas as pd
from scipy.special import gammaln
from scipy.stats import nbinom, poisson
from sklearn.ensemble import HistGradientBoostingRegressor

COL = ['tpm_att', 'tpm_stag', 'tpm_lenta', 'tpm_vel', 'tpm_10', 'tpa_lenta', 'tpa_vel', 'tpa_stag', 'tpa_10', 'tp_car', 'tpa_pm', 'tpa_car',
       'emin', 'emin_lenta', 'tit_rec', 'conc_tpm', 'casa', 'ritmo', 'ritmo_avv', 'b2b', 'n_stag', 'playoff']
KMAX = 8

def adatta(tr):
    m = HistGradientBoostingRegressor(loss='poisson', max_iter=300, learning_rate=0.05, max_leaf_nodes=31, min_samples_leaf=200, random_state=0)
    m.fit(tr[COL], tr.tpm.values)
    mu = np.clip(m.predict(tr[COL]), 1e-3, None)
    a = disp(tr.tpm.values, mu)
    return m, a

def disp(y, mu):
    """alfa della binomiale negativa (Var = mu + alfa mu^2) a massima verosimiglianza, su una griglia"""
    best, ab = None, 0.0
    for a in np.concatenate([[1e-4], np.linspace(0.01, 0.5, 50)]):
        r = 1 / a; ll = np.sum(gammaln(y + r) - gammaln(r) - gammaln(y + 1) + r * np.log(r / (r + mu)) + y * np.log(mu / (r + mu)))
        if best is None or ll > best: best, ab = ll, a
    return float(ab)

def p_almeno(mu, a, kmax=KMAX):
    """matrice [righe, k] con P(X >= k), k = 1..kmax"""
    mu = np.asarray(mu, float)[:, None]; k = np.arange(1, kmax + 1)[None, :]
    if a < 1e-3: return poisson.sf(k - 1, mu)
    r = 1 / a; return nbinom.sf(k - 1, r, r / (r + mu))

def prevedi(m, a, te):
    mu = np.clip(m.predict(te[COL]), 1e-3, None); return mu, p_almeno(mu, a)

def ll(y, p):
    p = np.clip(p, 1e-6, 1 - 1e-6); return -np.mean(y * np.log(p) + (1 - y) * np.log(1 - p))

if __name__ == '__main__':
    D = pd.read_pickle(sys.argv[1]); D = D[(D.n_prec >= 5) & D.emin.notna()]
    for prova in ('2025-2026', '2026-2027'):
        tr, te = D[D.st < prova], D[D.st == prova]
        m, a = adatta(tr); mu, P = prevedi(m, a, te)
        Pb = poisson.sf(np.arange(0, KMAX)[None, :], np.clip(te.tpm_stag.values, 1e-3, None)[:, None])     # riferimento: Poisson sulla media di stagione
        print(f'\n== prova su {prova}: allenamento {len(tr)} righe, prova {len(te)} · dispersione alfa {a:.3f}')
        print(' linea   reale   modello  rif.   log loss modello / riferimento')
        for k in range(1, 7):
            y = (te.tpm.values >= k).astype(float)
            print(f'  {k - 0.5:>4}  {y.mean():6.3f}  {P[:, k - 1].mean():6.3f}  {Pb[:, k - 1].mean():6.3f}   {ll(y, P[:, k - 1]):.4f} / {ll(y, Pb[:, k - 1]):.4f}')
        # calibrazione per la linea 2,5 e 3,5
        for k in (3, 4):
            y = (te.tpm.values >= k).astype(float); b = pd.cut(P[:, k - 1], [0, .05, .1, .2, .3, .4, .5, .6, .8, 1])
            print(f'  calibrazione over {k - 0.5}:'); print(pd.DataFrame(dict(prev=P[:, k - 1], reale=y, b=b)).groupby('b', observed=True).agg(n=('reale', 'size'), prev=('prev', 'mean'), reale=('reale', 'mean')).round(3).to_string())
