"""NBA, doppie e triple doppie: prova temporale del modello.

Uso: python3 bot/nba/prova.py <dataset.pkl> [file risultati .json]
Per ogni stagione di prova il modello è allenato solo sulle stagioni precedenti. Misure: log loss, AUC, taratura.
Riferimenti semplici: «frequenza» (quante volte il giocatore l'ha fatta, senza allenamento) e «medie» (logistica sulle sole medie di stagione).
"""
import json, sys, warnings
import numpy as np, pandas as pd
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.linear_model import LogisticRegression
from sklearn.pipeline import make_pipeline
from sklearn.preprocessing import StandardScaler
from sklearn.impute import SimpleImputer
from sklearn.metrics import roc_auc_score
warnings.filterwarnings('ignore')

MIN_PREC = 5            # partite precedenti in archivio perché la riga entri (allenamento e prova)
GRUPPI = {              # in ordine: ogni passo aggiunge un gruppo
    'giocatore': ['pts_stag', 'reb_stag', 'ast_stag', 'stl_stag', 'blk_stag', 'pts_lenta', 'reb_lenta', 'ast_lenta', 'stl_lenta', 'blk_lenta', 'pts_vel', 'reb_vel', 'ast_vel',
                  'pts_10', 'reb_10', 'ast_10', 'pts_sd', 'reb_sd', 'ast_sd', 'dd_stag', 'dd_lenta', 'dd_10', 'dd_car', 'td_stag', 'td_lenta', 'td_10', 'td_car', 'n_prec', 'n_stag'],
    'minuti attesi': ['emin', 'emin_lenta', 'u10_min', 'tit_rec', 'tit_ult', 'pts_att', 'reb_att', 'ast_att', 'att_2a', 'att_3a', 'l_dd_strut', 'l_td_strut', 'gg_fermo', 'cambio_sq'],
    'ruolo': ['r_G', 'r_F', 'r_C'],
    'ritmo e difesa avversaria': ['ritmo', 'ritmo_avv', 'ritmo_lega', 'conc_pts', 'conc_reb', 'conc_ast', 'concr_pts', 'concr_reb', 'concr_ast', 'sq_pts', 'sq_reb', 'sq_ast', 'casa', 'playoff'],
    'riposo': ['riposo', 'riposo_avv', 'b2b', 'b2b_avv'],
    'assenze già note': ['gia_n', 'gia_min', 'gia_pts', 'gia_reb', 'gia_ast'],
    'linea prepartita': ['linea_hc', 'linea_tot'],
    'assenze del giorno': ['ass_n', 'ass_min', 'ass_pts', 'ass_reb', 'ass_ast'],
    'quintetto': ['tit'],
}
MEDIE = ['pts_stag', 'reb_stag', 'ast_stag', 'emin_lenta']
LIVELLI = {'MODELLO il giorno prima': 'assenze già note', 'MODELLO con il referto infortuni': 'assenze del giorno', 'MODELLO con i quintetti': 'quintetto'}
LG = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))

def prepara(D):
    D = D[D.n_prec >= MIN_PREC].copy()
    for r in 'GFC': D['r_' + r] = (D.ruolo == r).astype(int)
    lg = lambda p: np.log(np.clip(p, 1e-5, 1 - 1e-5) / (1 - np.clip(p, 1e-5, 1 - 1e-5)))
    D['l_dd_strut'] = lg(D.p_dd_strut); D['l_td_strut'] = lg(D.p_td_strut)
    return D.sort_values('ts').reset_index(drop=True)

def ll(y, p): p = np.clip(p, 1e-6, 1 - 1e-6); return float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
def auc(y, p): return float(roc_auc_score(y, p)) if 0 < y.sum() < len(y) else float('nan')
def logit_(): return make_pipeline(SimpleImputer(strategy='median', add_indicator=True), StandardScaler(), LogisticRegression(C=0.5, max_iter=2000))
def gbm(rara=False): return HistGradientBoostingClassifier(max_iter=350 if not rara else 200, learning_rate=0.04, max_depth=4 if not rara else 3, min_samples_leaf=80 if not rara else 150, l2_regularization=1.0, random_state=7)

def colonne(fino_a):
    out = []
    for g, c in GRUPPI.items():
        out += c
        if g == fino_a: break
    return out

def prova(D, y_col, stagioni_prova, passi=True):
    freq = {'dd': 'dd_stag', 'td': 'td_stag'}[y_col]; rara = y_col == 'td'
    pred = {}
    for st in stagioni_prova:
        tr, te = D[D.st < st], D[D.st == st]
        if not len(tr) or not len(te): continue
        ytr = tr[y_col].values; P = {'frequenza': te[freq].values}
        P['medie'] = logit_().fit(tr[MEDIE], ytr).predict_proba(te[MEDIE])[:, 1]
        for g in (GRUPPI if passi else []):
            c = colonne(g); P['+ ' + g] = gbm(rara).fit(tr[c], ytr).predict_proba(te[c])[:, 1]
        # modello adottato: media (sul logit) di logistica e alberi, a tre livelli di informazione; senza la linea prepartita (non aggiunge nulla e manca in due stagioni)
        for nome, g in LIVELLI.items():
            c = [x for x in colonne(g) if x not in GRUPPI['linea prepartita']]
            a = gbm(rara).fit(tr[c], ytr).predict_proba(te[c])[:, 1]; b = logit_().fit(tr[c], ytr).predict_proba(te[c])[:, 1]
            if g == 'assenze già note': P['solo logistica (il giorno prima)'] = b
            P[nome] = 1 / (1 + np.exp(-(LG(a) + LG(b)) / 2))
        for k, v in P.items(): pred.setdefault(k, []).append(pd.Series(v, index=te.index))
    return {k: pd.concat(v) for k, v in pred.items()}

def tabella(D, P, y_col, filtro=None, nome=''):
    righe = []; idx = next(iter(P.values())).index; X = D.loc[idx]
    if filtro is not None: X = X[filtro(X)]
    y = X[y_col].values
    for k, p in P.items():
        r = dict(modello=k, n=len(X), eventi=int(y.sum()), ll=ll(y, p.loc[X.index].values), auc=auc(y, p.loc[X.index].values))
        for st, Z in X.groupby('st'): r[st] = ll(Z[y_col].values, p.loc[Z.index].values)
        righe.append(r)
    T = pd.DataFrame(righe); base = T.ll.iloc[1]; T['d_vs_medie'] = T.ll - base
    return T

def taratura(y, p, tagli):
    b = np.digitize(p, tagli); out = []
    for i in range(len(tagli) + 1):
        m = b == i
        if m.sum(): out.append(dict(fascia=f'{([0] + list(tagli))[i]:.3g}-{(list(tagli) + [1])[i]:.3g}', n=int(m.sum()), previsto=float(p[m].mean()), reale=float(y[m].mean())))
    return out

if __name__ == '__main__':
    D = prepara(pd.read_pickle(sys.argv[1])); out = {}
    stag = sorted(D.st.unique()); prove = stag[3:]
    print(f'righe {len(D)} · stagioni {stag} · prova su {prove}')
    print(D.groupby('st').agg(righe=('dd', 'size'), dd=('dd', 'mean'), td=('td', 'mean')).round(4).to_string())
    pd.set_option('display.width', 250); pd.set_option('display.float_format', lambda v: f'{v:.4f}')
    for y_col, tagli in (('dd', [.01, .03, .08, .15, .25, .40, .55, .70]), ('td', [.002, .01, .03, .08, .15, .30])):
        P = prova(D, y_col, prove); out[y_col] = {}
        for nome, f in (('tutti', None), ('almeno 24 minuti attesi', lambda X: X.emin >= 24), ('solo stagione regolare', lambda X: X.tipo == 2)):
            T = tabella(D, P, y_col, f, nome); out[y_col][nome] = T.to_dict('records')
            print(f'\n=== {y_col.upper()} · {nome} ===\n' + T.to_string(index=False))
        for k in ('medie', 'MODELLO il giorno prima', 'MODELLO con i quintetti'):
            p = P[k]; y = D.loc[p.index, y_col].values; t = taratura(y, p.values, tagli); out[y_col]['taratura ' + k] = t
            print(f'\ntaratura {y_col} · {k}\n' + pd.DataFrame(t).to_string(index=False))
        D['p_' + y_col] = P['MODELLO il giorno prima']; D['p_' + y_col + '_quintetti'] = P['MODELLO con i quintetti']; D['p_' + y_col + '_medie'] = P['medie']; D['p_' + y_col + '_referto'] = P['MODELLO con il referto infortuni']; D['p_' + y_col + '_freq'] = P['frequenza']
    if len(sys.argv) > 2: json.dump(out, open(sys.argv[2], 'w'), indent=1)
    D[D.st >= prove[0]][['id', 'ts', 'st', 'pid', 'sq', 'tit', 'emin', 'dd', 'td'] + [c for c in D.columns if c.startswith('p_dd') or c.startswith('p_td')]].to_pickle(sys.argv[1].replace('.pkl', '_pred.pkl'))
