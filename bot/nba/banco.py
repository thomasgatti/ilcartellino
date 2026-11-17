"""NBA, doppie e triple doppie: banco di prova «campione contro sfidante» (17/11/2026).

Uso: python3 bot/nba/banco.py <cartella nba del ramo dati> <cartella di lavoro> [esperimento ...]     (senza nomi: tutti)
     python3 bot/nba/banco.py --elenco

Il CAMPIONE è il modello attuale (prova.py, immutato): per ogni stagione di prova allenato solo sulle stagioni precedenti.
Ogni SFIDANTE è valutato sulle STESSE righe, doppia doppia e tripla doppia separate, con:
  log loss e Brier, differenza appaiata con intervallo al 95% (2.000 ricampionamenti per NOTTE: le righe della stessa notte
  non sono indipendenti), differenza stagione per stagione, rapporto previsto/reale, pendenza di taratura, taratura per fasce.
Regola di promozione (AGENTS.md, regola 6, resa esplicita):
  doppia doppia: log loss migliore di almeno 0,0002, intervallo tutto sotto zero, nessuna stagione peggiore di oltre 0,0002;
  tripla doppia (462 eventi): una modifica che tocca anche la doppia doppia non deve peggiorarla (intervallo non tutto sopra zero);
  una modifica della sola tripla doppia si tiene se l'intervallo sta tutto sotto zero e migliora in ogni stagione.
Esito stampato: ADOTTARE / SCARTARE / NEUTRO (nessuna differenza distinguibile) per la doppia doppia; MIGLIORA / PEGGIORA / NEUTRO per la tripla.
Le previsioni del campione sono messe in <cartella di lavoro>/banco_cache.pkl; i risultati in <cartella di lavoro>/banco_<nome>.json.
"""
import json, os, sys, warnings
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataset import carica, costruisci
from prova import prepara, colonne, gbm, logit_, LG, GRUPPI
warnings.filterwarnings('ignore')

SOGLIA = 0.0002
TAGLI = {'dd': [.01, .03, .08, .15, .25, .40, .55, .70], 'td': [.002, .01, .03, .08, .15, .30]}
V2_MINUTI = ['min_ult', 'min_sd', 'rientro', 'pf36', 'disp', 'gare7', 'n_sq_st']
sig = lambda z: 1 / (1 + np.exp(-z))
def cols(livello): return [x for x in colonne(livello) if x not in GRUPPI['linea prepartita']]
LIV = {'prima': 'assenze già note', 'referto': 'assenze del giorno', 'quintetti': 'quintetto'}

# ---------------------------------------------------------------- misure
def perdita(y, p): p = np.clip(p, 1e-6, 1 - 1e-6); return -(y * np.log(p) + (1 - y) * np.log(1 - p))
def pendenza(y, p):
    """taratura: logistica di y sul logit di p. Pendenza 1 e intercetta 0 = tarato."""
    from sklearn.linear_model import LogisticRegression
    m = LogisticRegression(C=1e6, max_iter=1000).fit(LG(p).reshape(-1, 1), y); return float(m.coef_[0][0]), float(m.intercept_[0])
def fasce(y, p, tagli):
    b = np.digitize(p, tagli); bordi = [0] + list(tagli) + [1]
    return [dict(fascia=f'{bordi[i]:.3g}-{bordi[i + 1]:.3g}', n=int((b == i).sum()), previsto=round(float(p[b == i].mean()), 4), reale=round(float(y[b == i].mean()), 4)) for i in range(len(tagli) + 1) if (b == i).sum()]
def misura(y, p, tagli):
    a, b = pendenza(y, p)
    return dict(n=int(len(y)), eventi=int(y.sum()), ll=float(perdita(y, p).mean()), brier=float(np.mean((p - y) ** 2)), previsto_su_reale=float(p.mean() / max(y.mean(), 1e-9)), pendenza=a, intercetta=b, fasce=fasce(y, p, tagli))

def confronta(X, y_col, p0, p1, nome, n_boot=2000, seme=1, stampa=True, regola=True):
    """X: righe (colonne y_col, st, notte); p0 campione, p1 sfidante (array allineati a X)."""
    y = X[y_col].values.astype(float); d = perdita(y, p1) - perdita(y, p0); db = (p1 - y) ** 2 - (p0 - y) ** 2
    G = pd.DataFrame(dict(d=d, n=1, notte=X.notte.values)).groupby('notte').sum(); rng = np.random.default_rng(seme)
    i = rng.integers(0, len(G), (n_boot, len(G))); bs = G.d.values[i].sum(1) / G.n.values[i].sum(1)
    per_st = {s: float(d[X.st.values == s].mean()) for s in sorted(X.st.unique())}
    r = dict(sfidante=nome, y=y_col, campione=misura(y, p0, TAGLI[y_col]), prova=misura(y, p1, TAGLI[y_col]), d_ll=float(d.mean()), ic95=[float(np.percentile(bs, 2.5)), float(np.percentile(bs, 97.5))],
             d_brier=float(db.mean()), per_stagione=per_st, notti=int(len(G)))
    if y_col == 'dd': r['esito'] = 'ADOTTARE' if (r['d_ll'] <= -SOGLIA and r['ic95'][1] < 0 and max(per_st.values()) <= SOGLIA) else 'SCARTARE' if (r['ic95'][0] > 0 or r['d_ll'] > SOGLIA) else 'NEUTRO'
    else: r['esito'] = 'PEGGIORA' if r['ic95'][0] > 0 else 'MIGLIORA' if r['ic95'][1] < 0 else 'NEUTRO'
    if not regola: r['esito'] = '-'
    if stampa:
        c, s = r['campione'], r['prova']
        print(f"  [{y_col.upper()}] {nome}: {c['n']} righe, {c['eventi']} eventi, {r['notti']} notti")
        print(f"     log loss {c['ll']:.5f} → {s['ll']:.5f}  (Δ {r['d_ll']:+.5f}, IC95 [{r['ic95'][0]:+.5f}; {r['ic95'][1]:+.5f}])   Brier {c['brier']:.5f} → {s['brier']:.5f}")
        print(f"     previsto/reale {c['previsto_su_reale']:.3f} → {s['previsto_su_reale']:.3f} · pendenza {c['pendenza']:.3f} → {s['pendenza']:.3f} · per stagione " + ' '.join(f"{k[2:4]}/{k[7:9]} {v:+.5f}" for k, v in per_st.items()) + f"   ⇒ {r['esito']}")
    return r

# ---------------------------------------------------------------- dati e campione
class Banco:
    def __init__(self, cartella, lavoro):
        self.cartella, self.lavoro = cartella, lavoro; os.makedirs(lavoro, exist_ok=True)
        f = os.path.join(lavoro, 'banco_tabelle.pkl')
        if os.path.exists(f): self.U, self.U1 = pd.read_pickle(f)
        else:
            import copy
            partite, gioc = carica(cartella)
            self.U = costruisci(copy.deepcopy(partite), gioc, universo=True)                             # variabili del campione + righe di chi non è entrato
            self.U1 = costruisci(partite, gioc, universo=True, lega_per_giorno=True)                     # stessa tabella con le medie di lega per giorno
            pd.to_pickle((self.U, self.U1), f)
        for T in (self.U, self.U1):
            T['notte'] = (T.ts - 10 * 3600) // 86400; T['d_min'] = T.min_ult - T.emin
            for k in ('n', 'min', 'pts', 'reb', 'ast'): T['nuo_' + k] = T['ass_' + k] - T['gia_' + k]      # assenze NUOVE rispetto alla partita prima
        self.D = self.tab(self.U); self.stag = sorted(self.D.st.unique()); self.prove = self.stag[3:]
        self.T = self.D[self.D.st.isin(self.prove)]                                                     # righe di prova (chi è entrato, almeno 5 partite prima)
        self.fc = os.path.join(lavoro, 'banco_cache.pkl'); self.cache = pd.read_pickle(self.fc) if os.path.exists(self.fc) else {}
    @staticmethod
    def tab(U):
        """righe del campione: chi è entrato in campo; l'indice resta quello della tabella completa"""
        D = U[(U.gioca == 1) & (U.n_prec >= 5)].copy()
        for r in 'GFC': D['r_' + r] = (D.ruolo == r).astype(int)
        lg = lambda p: np.log(np.clip(p, 1e-5, 1 - 1e-5) / (1 - np.clip(p, 1e-5, 1 - 1e-5)))
        D['l_dd_strut'] = lg(D.p_dd_strut); D['l_td_strut'] = lg(D.p_td_strut)
        return D
    def previsioni(self, D, y, c, chiave=None, servi=None, allena=None, solo=None, modello='misto'):
        """stagione per stagione: allenato sulle precedenti. servi/allena: funzioni che trasformano le righe di prova/allenamento.
        solo: maschera delle righe di allenamento. Ritorna una Serie sulle righe di prova di D."""
        if chiave and chiave in self.cache: return self.cache[chiave]
        out = []
        for st in self.prove:
            tr, te = D[D.st < st], D[D.st == st]
            if solo is not None: tr = tr[solo(tr)]
            if allena is not None: tr = allena(tr)
            if servi is not None: te = servi(te)
            if not len(te): continue
            a = gbm(y == 'td').fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]
            p = a if modello == 'alberi' else sig((LG(a) + LG(logit_().fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1])) / 2)
            out.append(pd.Series(p, index=te.index))
        p = pd.concat(out)
        if chiave: self.cache[chiave] = p; pd.to_pickle(self.cache, self.fc)
        return p
    def campione(self, y, livello='prima'): return self.previsioni(self.D, y, cols(LIV[livello]), chiave=f'campione_{y}_{livello}')

# ---------------------------------------------------------------- esperimenti
def e_lega_giorno(B):
    """Medie di lega aggiornate a fine giornata (correzione: le partite della stessa sera non si vedono fra loro)."""
    D1 = B.tab(B.U1); R = []
    for y in ('dd', 'td'):
        p1 = B.previsioni(D1, y, cols(LIV['prima'])); R.append(confronta(B.T, y, B.campione(y).loc[B.T.index].values, p1.loc[B.T.index].values, 'medie di lega per giorno'))
    return R

def e_minuti_fini(B):
    """Minuti più fini: ultimi minuti giocati, variabilità, rientro da uno stop, falli, presenza, calendario fitto, minuti ridistribuiti."""
    R = []
    for liv, extra in (('prima', V2_MINUTI + ['d_min', 'emin_red_gia']), ('referto', V2_MINUTI + ['d_min', 'emin_red_gia', 'emin_red_ass'])):
        for y in ('dd', 'td'):
            p1 = B.previsioni(B.D, y, cols(LIV[liv]) + extra); R.append(confronta(B.T, y, B.campione(y, liv).loc[B.T.index].values, p1.loc[B.T.index].values, f'minuti fini ({liv})'))
    return R

def e_minuti_uno(B):
    """Le variabili dei «minuti fini» aggiunte una alla volta (solo alberi sarebbe più svelto, ma il confronto è col campione intero)."""
    R = []
    for v in V2_MINUTI + ['d_min', 'emin_red_gia']:
        p1 = B.previsioni(B.D, 'dd', cols(LIV['prima']) + [v]); R.append(confronta(B.T, 'dd', B.campione('dd').loc[B.T.index].values, p1.loc[B.T.index].values, f'+ {v}'))
    return R

def e_td_da_dd(B):
    """Tripla doppia = P(doppia doppia) × P(tripla | doppia): P(TD) ≤ P(DD) garantita per costruzione."""
    c = cols(LIV['prima']); pdd = B.campione('dd'); ptd = B.campione('td')
    cond = B.previsioni(B.D, 'td', c, solo=lambda tr: tr.dd == 1)
    p1 = (pdd * cond).loc[B.T.index].values
    R = [confronta(B.T, 'td', ptd.loc[B.T.index].values, p1, 'TD = P(DD) × P(TD | DD)')]
    R.append(confronta(B.T, 'td', ptd.loc[B.T.index].values, np.sqrt(np.clip(p1, 1e-9, 1) * ptd.loc[B.T.index].values), 'media geometrica fra modello diretto e condizionato'))
    return R

def e_assenze_robuste(B):
    """In produzione si conoscono solo alcune delle assenze nuove. f = quota di squadre-partita in cui le assenze nuove sono note.
    A = modello «referto» attuale (allenato col referto perfetto) · Bm = modello «il giorno prima» · C = allenato con assenze note a metà (f=0,5)."""
    c_ref, c_pri = cols(LIV['referto']), cols(LIV['prima']); R = []
    def degrada(f, seme):
        def fn(X):
            X = X.copy(); k = pd.util.hash_pandas_object(pd.Series(X.id.astype(str) + '_' + X.sq.astype(str) + f'_{seme}'), index=False).values % 1000 / 1000.0
            nota = (k < f).astype(float)
            for v in ('n', 'min', 'pts', 'reb', 'ast'): X['ass_' + v] = X['gia_' + v].values + nota * X['nuo_' + v].values
            return X
        return fn
    for y in ('dd',):
        for f in [float(x) for x in os.environ.get('BANCO_F', '0,0.25,0.5,1').split(',')]:
            servi = degrada(f, 7)
            pA = B.previsioni(B.D, y, c_ref, servi=servi).loc[B.T.index].values
            pB = B.campione(y, 'prima').loc[B.T.index].values
            pC = B.previsioni(B.D, y, c_ref, servi=servi, allena=degrada(0.5, 3)).loc[B.T.index].values
            print(f'  --- assenze nuove note nel {f:.0%} delle squadre-partita ---')
            R.append(confronta(B.T, y, pA, pB, f'f={f}: «il giorno prima» contro «referto» attuale', regola=False))
            R.append(confronta(B.T, y, pA, pC, f'f={f}: allenato con assenze note a metà contro «referto» attuale', regola=False))
    return R

GIOCA = ['emin', 'emin_lenta', 'min_ult', 'd_min', 'min_sd', 'tit_rec', 'tit_ult', 'disp', 'rientro', 'gg_fermo', 'riposo', 'b2b', 'gare7', 'n_sq_st', 'playoff', 'casa',
         'b2b_occ', 'b2b_gio', 'n_prec', 'n_stag', 'dd_lenta', 'pts_lenta', 'gia_n', 'gia_min', 'cambio_sq', 'pf36']
def universo(B):
    """righe «senza notizie»: di rotazione, in campo nella partita prima della squadra, almeno 12 minuti attesi e 5 partite in archivio"""
    U = B.U[(B.U.ieri == 1) & (B.U.n_prec >= 5) & (B.U.emin >= 12)].copy()
    for r in 'GFC': U['r_' + r] = (U.ruolo == r).astype(int)
    lg = lambda p: np.log(np.clip(p, 1e-5, 1 - 1e-5) / (1 - np.clip(p, 1e-5, 1 - 1e-5))); U['l_dd_strut'] = lg(U.p_dd_strut); U['l_td_strut'] = lg(U.p_td_strut)
    return U
def e_p_gioca(B):
    """Universo vero di prima della partita: chi era in campo nella partita precedente può non giocare stanotte.
    Campione = probabilità attuale (dà per scontato che giochi) · sfidante = P(gioca) × P(evento | gioca)."""
    U = universo(B); T = U[U.st.isin(B.prove)]; R = []; c = cols(LIV['prima'])
    pg = B.previsioni(U, 'gioca', GIOCA, chiave='p_gioca')                       # P(gioca), stagione per stagione
    base = pd.concat([pd.Series(U[U.st < st].gioca.mean(), index=U[U.st == st].index) for st in B.prove])
    g = T.gioca.values.astype(float); print(f'  P(gioca): {len(T)} righe, non gioca {1 - g.mean():.2%}')
    print(f'     log loss: frequenza storica {perdita(g, base.loc[T.index].values).mean():.5f} → modello {perdita(g, pg.loc[T.index].values).mean():.5f}')
    X = T.assign(pg=pg.loc[T.index].values); X['f'] = pd.cut(X.pg, [0, .6, .8, .9, .95, 1.01])
    print('     taratura di P(gioca):  ' + ' · '.join(f"{k}: prev {z.pg.mean():.3f} reale {z.gioca.mean():.3f} (n {len(z)})" for k, z in X.groupby('f', observed=True)))
    regola = (T.b2b == 1) & (T.b2b_occ >= 4) & (T.b2b_gio / T.b2b_occ.clip(lower=1) < 0.6)
    print(f'     regola attuale «RISCHIO RIPOSO»: segnala {int(regola.sum())} righe, non gioca il {1 - T[regola].gioca.mean():.1%}; le {int(regola.sum())} righe col P(gioca) più basso del modello: non gioca il {1 - X.nsmallest(int(regola.sum()), "pg").gioca.mean():.1%}')
    for y in ('dd', 'td'):
        out = []
        for st in B.prove:                                                    # P(evento | gioca): il campione, allenato su chi è entrato, applicato a tutto l'universo
            tr, te = B.D[B.D.st < st], T[T.st == st]
            a = gbm(y == 'td').fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]; b = logit_().fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]
            out.append(pd.Series(sig((LG(a) + LG(b)) / 2), index=te.index))
        p0 = pd.concat(out).loc[T.index].values
        R.append(confronta(T, y, p0, p0 * base.loc[T.index].values, 'universo: × frequenza storica di presenza'))
        R.append(confronta(T, y, p0, p0 * pg.loc[T.index].values, 'universo: × P(gioca) del modello'))
    return R

def e_v2(B):
    """Il modello v2 intero (modello2.py) contro il modello in produzione, servito come in produzione (assenze nuove note in parte)."""
    import modello2 as M2
    U = M2.prepara2(B.U1); D = U[(U.gioca == 1) & (U.n_prec >= 5)]; R = []; c_ref = cols(LIV['referto'])
    for f in [float(x) for x in os.environ.get('BANCO_F', '0.25').split(',')]:
        servi = lambda X, f=f: M2.degrada(X, f, 7); P = {'dd': [], 'td': []}
        for st in B.prove:
            te = servi(D[D.st == st]); a, b = M2.prevedi(D[D.st < st], te); P['dd'].append(pd.Series(a, index=te.index)); P['td'].append(pd.Series(b, index=te.index))
        print(f'  --- assenze nuove note nel {f:.0%} delle squadre-partita ---')
        for y in ('dd', 'td'):
            p0 = B.previsioni(B.D, y, c_ref, servi=servi).loc[B.T.index].values; p1 = pd.concat(P[y]).loc[B.T.index].values
            R.append(confronta(B.T, y, p0, p1, f'v2 contro produzione attuale (f={f})'))
        v = pd.concat(P['td']).loc[B.T.index].values > pd.concat(P['dd']).loc[B.T.index].values; print(f'     righe con P(TD) > P(DD): {int(v.sum())}')
    return R

def e_livello(B):
    """Ritaratura sulle stagioni di prova precedenti: per la stagione s si stimano spostamento (e pendenza) del logit sulle previsioni
    fuori campione delle stagioni di prova prima di s. La prima stagione di prova resta senza correzione per entrambi: si confrontano le altre."""
    from sklearn.linear_model import LogisticRegression
    R = []; T = B.T[B.T.st.isin(B.prove[1:])]
    for y in ('dd', 'td'):
        p = B.campione(y); out = {'spostamento': [], 'spostamento e pendenza': []}
        for st in B.prove[1:]:
            tr = B.T[B.T.st < st]; te = T[T.st == st]; x_tr = LG(p.loc[tr.index].values); x_te = LG(p.loc[te.index].values)
            # solo spostamento: si cerca b che minimizza la log loss di sig(x + b) (logistica con x come «offset», per bisezione sulla derivata)
            yy = tr[y].values.astype(float); lo, hi = -2.0, 2.0
            for _ in range(60):
                b = (lo + hi) / 2; g = np.sum(sig(x_tr + b) - yy)
                lo, hi = (lo, b) if g > 0 else (b, hi)
            out['spostamento'].append(pd.Series(sig(x_te + b), index=te.index))
            m = LogisticRegression(C=1e6, max_iter=1000).fit(x_tr.reshape(-1, 1), yy); out['spostamento e pendenza'].append(pd.Series(m.predict_proba(x_te.reshape(-1, 1))[:, 1], index=te.index))
            print(f'     {y} {st}: spostamento del logit {b:+.3f} · pendenza {m.coef_[0][0]:.3f}')
        for k, v in out.items(): R.append(confronta(T, y, p.loc[T.index].values, pd.concat(v).loc[T.index].values, f'ritaratura ({k}), stagioni di prova 2-4'))
    return R

def e_miscela(B):
    """Peso fra alberi e regressione logistica (oggi 50/50 sul logit). Per la stagione s il peso si sceglie sulle stagioni di prova prima di s;
    la prima stagione di prova resta 50/50 per tutti. Confronto anche con alberi soli e logistica sola."""
    R = []; c = cols(LIV['prima']); T = B.T[B.T.st.isin(B.prove[1:])]
    for y in ('dd', 'td'):
        A, L = [], []
        for st in B.prove:
            tr, te = B.D[B.D.st < st], B.D[B.D.st == st]
            A.append(pd.Series(gbm(y == 'td').fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1], index=te.index)); L.append(pd.Series(logit_().fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1], index=te.index))
        a, l = LG(pd.concat(A).loc[B.T.index].values), LG(pd.concat(L).loc[B.T.index].values); yy = B.T[y].values.astype(float)
        p0 = sig((a + l) / 2); pesi = np.linspace(0, 1, 21); scelto = np.full(len(yy), 0.5)
        for st in B.prove[1:]:
            m = (B.T.st < st).values; w = pesi[np.argmin([perdita(yy[m], sig(w * a[m] + (1 - w) * l[m])).mean() for w in pesi])]
            scelto[(B.T.st == st).values] = w; print(f'     {y} {st}: peso degli alberi scelto sulle stagioni prima {w:.2f}')
        k = B.T.st.isin(B.prove[1:]).values
        R.append(confronta(T, y, p0[k], sig(scelto * a + (1 - scelto) * l)[k], 'peso scelto sulle stagioni precedenti'))
        R.append(confronta(T, y, p0[k], sig(a)[k], 'alberi soli', regola=False)); R.append(confronta(T, y, p0[k], sig(l)[k], 'logistica sola', regola=False))
    return R

ESPERIMENTI = {'miscela': e_miscela, 'livello': e_livello, 'v2': e_v2, 'lega_giorno': e_lega_giorno, 'minuti_fini': e_minuti_fini, 'minuti_uno': e_minuti_uno, 'td_da_dd': e_td_da_dd, 'assenze_robuste': e_assenze_robuste, 'p_gioca': e_p_gioca}

if __name__ == '__main__':
    if '--elenco' in sys.argv:
        for k, f in ESPERIMENTI.items(): print(f'{k:18s} {f.__doc__.strip().splitlines()[0]}')
        sys.exit(0)
    B = Banco(sys.argv[1], sys.argv[2]); nomi = sys.argv[3:] or list(ESPERIMENTI)
    print(f'righe di prova {len(B.T)} · stagioni di prova {B.prove}')
    for y in ('dd', 'td'):
        p = B.campione(y).loc[B.T.index].values; m = misura(B.T[y].values.astype(float), p, TAGLI[y]); print(f"campione {y.upper()} il giorno prima: log loss {m['ll']:.5f} · Brier {m['brier']:.5f} · previsto/reale {m['previsto_su_reale']:.3f} · pendenza {m['pendenza']:.3f}")
    for n in nomi:
        print(f'\n=== {n}: {ESPERIMENTI[n].__doc__.strip().splitlines()[0]}'); R = ESPERIMENTI[n](B)
        json.dump(R, open(os.path.join(sys.argv[2], f'banco_{n}.json'), 'w'), indent=1, ensure_ascii=False)
