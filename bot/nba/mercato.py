"""NBA: modello contro mercato sulle quote «doppia doppia» e «tripla doppia» (OddsPapi, ultima quota prima della palla a due).

Uso: python3 bot/nba/mercato.py <cartella nba del ramo dati> <dataset_pred.pkl> [stagione]
Righe = giocatori entrati in campo che avevano una quota. Probabilità del mercato = media sui bookmaker di 1/quota (c'è solo l'esito «Sì»:
il margine non si può togliere con l'esito opposto), poi ritarata con una logistica a un ingresso in validazione incrociata per partita;
la stessa ritaratura è applicata al modello, così il confronto è alla pari.
"""
import json, os, sys, unicodedata, re
import numpy as np, pandas as pd
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import GroupKFold
from sklearn.metrics import roc_auc_score

def norm(s):
    s = str(s)
    if ',' in s: a, b = s.split(',', 1); s = b + ' ' + a
    s = unicodedata.normalize('NFD', s); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn').lower()
    s = re.sub(r"[.'’\-]", '', s); s = re.sub(r'\b(jr|sr|ii|iii|iv)\b', '', s)
    return ' '.join(s.split())
lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
ll = lambda y, p: float(-np.mean(y * np.log(np.clip(p, 1e-6, 1)) + (1 - y) * np.log(np.clip(1 - p, 1e-6, 1))))

def ritara(X, y, gruppi):
    """probabilità fuori campione da una logistica sui logit dati (validazione incrociata per partita)"""
    out = np.zeros(len(y)); X = np.asarray(X).reshape(len(y), -1)
    for tr, te in GroupKFold(5).split(X, y, gruppi):
        out[te] = LogisticRegression(C=100, max_iter=1000).fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    return out

def tabella(cartella, pred, st, chiave, books=None):
    Q = json.load(open(os.path.join(cartella, f'quote_{st}.json'))); nomi = Q.pop('_nomi', {})
    gioc = json.load(open(os.path.join(cartella, 'giocatori.json')))
    P = pred[pred.st == st]; per_partita = {k: v for k, v in P.groupby('id')}
    righe = []; persi = 0
    for gid, rec in Q.items():
        if rec.get('nessuna') or gid not in per_partita: continue
        Z = per_partita[gid]; idx = {norm(gioc[str(p)][0]): i for i, p in zip(Z.index, Z.pid)}
        imp = {}
        for bk, d in (rec.get(chiave) or {}).items():
            if books and bk not in books: continue
            for pid, q in d.items():
                if q and q > 1: imp.setdefault(pid, {})[bk] = 1 / q
        for pid, d in imp.items():
            i = idx.get(norm(nomi.get(pid, '')))
            if i is None: persi += 1; continue          # non entrato in campo oppure nome non riconosciuto
            righe.append(dict(i=i, id=gid, pm=float(np.mean(list(d.values()))), nb=len(d), **{'q_' + b: 1 / v for b, v in d.items()}))
    R = pd.DataFrame(righe)
    if not len(R): return R, persi
    return R.join(P, on='i', rsuffix='_p'), persi

if __name__ == '__main__':
    cartella, fpred = sys.argv[1], sys.argv[2]; st = sys.argv[3] if len(sys.argv) > 3 else '2026-2027'
    pred = pd.read_pickle(fpred); pd.set_option('display.width', 220)
    for chiave, nome in (('dd', 'DOPPIA DOPPIA'), ('td', 'TRIPLA DOPPIA')):
        for books in (None, ['fanduel'], ['bet365'], ['draftkings']):
            R, persi = tabella(cartella, pred, st, chiave, books)
            if len(R) < 200: print(f'\n{nome} · {books or "tutti"}: solo {len(R)} righe'); continue
            y = R[chiave].values; g = R['id'].values; out = []
            print(f'\n=== {nome} · bookmaker: {", ".join(books) if books else "tutti (media)"} · {len(R)} giocatori in {R.id.nunique()} partite · eventi {int(y.sum())} ({y.mean():.3f}) · quote senza riga {persi} ===')
            print(f'   media 1/quota {R.pm.mean():.3f} (margine medio sull\'esito Sì: {R.pm.mean() / y.mean() - 1:+.1%})')
            cand = [('mercato grezzo (1/quota)', R.pm.values, None)]
            for k, c in (('modello il giorno prima', 'p_' + chiave), ('modello con il referto infortuni', f'p_{chiave}_referto'), ('modello con i quintetti', f'p_{chiave}_quintetti'), ('solo medie', f'p_{chiave}_medie')):
                cand.append((k + ' (grezzo)', R[c].values, None))
            for k, p, _ in cand: out.append(dict(cosa=k, ll=ll(y, p), auc=roc_auc_score(y, p), media=p.mean()))
            rm = ritara(lg(R.pm.values), y, g); out.append(dict(cosa='MERCATO ritarato', ll=ll(y, rm), auc=roc_auc_score(y, rm), media=rm.mean()))
            for k, c in (('MODELLO il giorno prima ritarato', 'p_' + chiave), ('MODELLO con il referto ritarato', f'p_{chiave}_referto'), ('MODELLO con i quintetti ritarato', f'p_{chiave}_quintetti')):
                r = ritara(lg(R[c].values), y, g); out.append(dict(cosa=k, ll=ll(y, r), auc=roc_auc_score(y, r), media=r.mean()))
                r2 = ritara(np.c_[lg(R[c].values), lg(R.pm.values)], y, g); out.append(dict(cosa='   + mercato (miscela)', ll=ll(y, r2), auc=roc_auc_score(y, r2), media=r2.mean()))
            print(pd.DataFrame(out).round(4).to_string(index=False))
            if books is None:
                # dove modello e mercato non sono d'accordo: valore atteso giocando 1 unità quando p_modello x quota > soglia (quota migliore fra i bookmaker)
                qc = [c for c in R.columns if c.startswith('q_')]; best = R[qc].max(axis=1).values
                for c, nm in (('p_' + chiave, 'il giorno prima'), (f'p_{chiave}_quintetti', 'con i quintetti')):
                    for s in (1.05, 1.15, 1.30):
                        m = R[c].values * best > s
                        if m.sum(): print(f'   valore {nm}, p x quota > {s}: {int(m.sum())} giocate, vinte {int(y[m].sum())}, resa {((y[m] * best[m]).sum() - m.sum()) / m.sum():+.1%}')
