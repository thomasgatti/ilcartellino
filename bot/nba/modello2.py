"""NBA: modello v2 (17/11/2026). Solo ciò che ha superato il banco di prova (bot/nba/banco.py; numeri nel RUNBOOK).

Rispetto al modello attuale (v1, immutato in prova.py / oggi.py):
  1. DOPPIA DOPPIA: stesse variabili del modello «con il referto», ma allenato con le assenze nuove note solo a metà
     (in produzione la lista infortuni del pomeriggio anticipa circa un quarto delle assenze nuove: il modello v1 è allenato
     come se le conoscesse tutte).
  2. TRIPLA DOPPIA: media geometrica fra il modello diretto e P(DD) × P(TD | DD), mai sopra P(DD).
  3. P(GIOCA): probabilità che un giocatore di rotazione, in campo nella partita precedente, giochi stanotte.
Predefinito dal 17/11/2026 pomeriggio; la variabile del repository NBA_MODELLO=v1 torna al modello di prima.
"""
import numpy as np, pandas as pd
from prova import colonne, gbm, logit_, LG, GRUPPI

VERSIONE = 'v2'
F_ALLENA = 0.5                 # quota di squadre-partita di allenamento in cui le assenze nuove restano visibili
SOGLIA_GIOCA = 0.80            # sotto questa P(gioca) il giocatore è segnalato e resta fuori da giocate e combinazioni
COL = [x for x in colonne('assenze del giorno') if x not in GRUPPI['linea prepartita']]
GIOCA = ['emin', 'emin_lenta', 'min_ult', 'd_min', 'min_sd', 'tit_rec', 'tit_ult', 'disp', 'rientro', 'gg_fermo', 'riposo', 'b2b', 'gare7', 'n_sq_st', 'playoff', 'casa',
         'b2b_occ', 'b2b_gio', 'n_prec', 'n_stag', 'dd_lenta', 'pts_lenta', 'gia_n', 'gia_min', 'cambio_sq', 'pf36']
sig = lambda z: 1 / (1 + np.exp(-z))

def prepara2(U):
    """colonne derivate sulla tabella «universo» (dataset.costruisci(..., universo=True, lega_per_giorno=True)); non toglie righe"""
    U = U.copy(); lg = lambda p: np.log(np.clip(p, 1e-5, 1 - 1e-5) / (1 - np.clip(p, 1e-5, 1 - 1e-5)))
    for r in 'GFC': U['r_' + r] = (U.ruolo == r).astype(int)
    U['l_dd_strut'] = lg(U.p_dd_strut); U['l_td_strut'] = lg(U.p_td_strut); U['d_min'] = U.min_ult - U.emin
    for k in ('n', 'min', 'pts', 'reb', 'ast'): U['nuo_' + k] = U['ass_' + k] - U['gia_' + k]
    return U

def degrada(X, f=F_ALLENA, seme=3):
    """nasconde le assenze NUOVE (rispetto alla partita prima) in una quota 1-f delle squadre-partita; la scelta dipende solo da partita e squadra"""
    X = X.copy(); k = pd.util.hash_pandas_object(pd.Series(X.id.astype(str) + '_' + X.sq.astype(str) + f'_{seme}'), index=False).values % 1000 / 1000.0
    nota = (k < f).astype(float)
    for v in ('n', 'min', 'pts', 'reb', 'ast'): X['ass_' + v] = X['gia_' + v].values + nota * X['nuo_' + v].values
    return X

def _misto(tr, te, y, c, rara=False):
    a = gbm(rara).fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]; b = logit_().fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]
    return sig((LG(a) + LG(b)) / 2)

def prevedi(tr, te):
    """tr: righe di chi è entrato in campo (almeno 5 partite prima), già passate da prepara2; te: righe da prevedere.
    Ritorna (p_dd, p_td) con p_td <= p_dd."""
    tr = degrada(tr); p_dd = _misto(tr, te, 'dd', COL)
    diretto = _misto(tr, te, 'td', COL, rara=True); cond = _misto(tr[tr.dd == 1], te, 'td', COL, rara=True)
    p_td = np.minimum(np.sqrt(np.clip(diretto, 1e-9, 1) * np.clip(p_dd * cond, 1e-9, 1)), p_dd)
    return p_dd, p_td

def universo_gioca(U):
    """righe su cui si allena P(gioca): di rotazione, in campo nella partita precedente della squadra, almeno 12 minuti attesi"""
    return U[(U.ieri == 1) & (U.n_prec >= 5) & (U.emin >= 12)]

def prevedi_gioca(tr, te): return _misto(tr, te, 'gioca', GIOCA)
