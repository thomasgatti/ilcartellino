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
def abbina(nome, candidati):
    """Collega un nome di OddsPapi a uno dei nomi (già passati da norm) dei giocatori della partita.
    1) nome uguale; 2) stesso cognome e un nome che è l'inizio dell'altro (Alexandre/Alex, Ron/Ronald), se è uno solo;
    3) stesso cognome e stessa iniziale, se è uno solo. Altrimenti None: meglio nessuna quota che la quota di un altro."""
    k = norm(nome)
    if k in candidati: return k
    t = k.split()
    if len(t) < 2: return None
    stesso = [c for c in candidati if c.split()[-1:] == t[-1:] and len(c.split()) >= 2]
    for regola in (lambda a, b: a.startswith(b) or b.startswith(a), lambda a, b: a[0] == b[0]):
        ok = [c for c in stesso if regola(c.split()[0], t[0])]
        if len(ok) == 1: return ok[0]
    return None
lg = lambda p: np.log(np.clip(p, 1e-6, 1 - 1e-6) / (1 - np.clip(p, 1e-6, 1 - 1e-6)))
ll = lambda y, p: float(-np.mean(y * np.log(np.clip(p, 1e-6, 1)) + (1 - y) * np.log(np.clip(1 - p, 1e-6, 1))))

def ritara(X, y, gruppi):
    """probabilità fuori campione da una logistica sui logit dati (validazione incrociata per partita)"""
    out = np.zeros(len(y)); X = np.asarray(X).reshape(len(y), -1)
    for tr, te in GroupKFold(5).split(X, y, gruppi):
        out[te] = LogisticRegression(C=100, max_iter=1000).fit(X[tr], y[tr]).predict_proba(X[te])[:, 1]
    return out

def ritara_tempo(X, y, ts, inizio=0.4):
    """come ritara(), ma ogni giorno è ritarato SOLO sui giorni precedenti (le prime notti, il 40%, restano senza previsione: NaN).
    Con due soli parametri la differenza da ritara() è minima (17/11/2026: 0,2499 contro 0,2492), ma questo è il confronto corretto."""
    X = np.asarray(X).reshape(len(y), -1); out = np.full(len(y), np.nan); d = np.asarray(ts) // 86400; giorni = np.unique(d)
    for g in giorni[int(len(giorni) * inizio):]:
        tr = d < g
        if y[tr].sum() < 20: continue
        out[d == g] = LogisticRegression(C=100, max_iter=1000).fit(X[tr], y[tr]).predict_proba(X[d == g])[:, 1]
    return out

def tabella(cartella, pred, st, chiave, books=None):
    Q = json.load(open(os.path.join(cartella, f'quote_{st}.json'))); nomi = Q.pop('_nomi', {})
    gioc = json.load(open(os.path.join(cartella, 'giocatori.json')))
    P = pred[pred.st == st]; per_partita = {k: v for k, v in P.groupby('id')}
    righe = []; persi = 0; ignoti = {}                  # persi = quotati ma non entrati in campo; ignoti = nome che non è di nessun giocatore noto
    noti = {norm(v[0]) for v in gioc.values()}
    for gid, rec in Q.items():
        if rec.get('nessuna') or gid not in per_partita: continue
        Z = per_partita[gid]; idx = {norm(gioc[str(p)][0]): i for i, p in zip(Z.index, Z.pid)}
        imp = {}
        for bk, d in (rec.get(chiave) or {}).items():
            if books and bk not in books: continue
            for pid, q in d.items():
                if q and q > 1: imp.setdefault(pid, {})[bk] = 1 / q
        for pid, d in imp.items():
            k = abbina(nomi.get(pid, ''), idx); i = idx.get(k) if k else None
            if i is None:
                if abbina(nomi.get(pid, ''), noti) is None: ignoti[nomi.get(pid, pid)] = ignoti.get(nomi.get(pid, pid), 0) + 1
                else: persi += 1
                continue
            righe.append(dict(i=i, id=gid, pm=float(np.mean(list(d.values()))), nb=len(d), **{'q_' + b: 1 / v for b, v in d.items()}))
    R = pd.DataFrame(righe)
    if ignoti: print('   nomi OddsPapi non riconosciuti:', sorted(ignoti.items(), key=lambda x: -x[1])[:10])
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
            # lo stesso confronto con la ritaratura fatta solo sui giorni precedenti (righe delle prime notti escluse per tutti)
            R2 = R.sort_values('ts'); y2 = R2[chiave].values; t2 = R2['ts'].values; rm2 = ritara_tempo(lg(R2.pm.values), y2, t2); ok = ~np.isnan(rm2)
            if ok.sum() > 100:
                riga = f'   solo sul passato ({int(ok.sum())} righe, {int(y2[ok].sum())} eventi): mercato {ll(y2[ok], rm2[ok]):.4f}'
                for k, c in (('il giorno prima', 'p_' + chiave), ('con il referto', f'p_{chiave}_referto')):
                    r = ritara_tempo(lg(R2[c].values), y2, t2); riga += f' · modello {k} {ll(y2[ok], r[ok]):.4f} (grezzo {ll(y2[ok], R2[c].values[ok]):.4f})'
                print(riga)
            if books is None:
                # dove modello e mercato non sono d'accordo: valore atteso giocando 1 unità quando p_modello x quota > soglia (quota migliore fra i bookmaker)
                qc = [c for c in R.columns if c.startswith('q_')]; best = R[qc].max(axis=1).values
                for c, nm in (('p_' + chiave, 'il giorno prima'), (f'p_{chiave}_quintetti', 'con i quintetti')):
                    for s in (1.05, 1.15, 1.30):
                        m = R[c].values * best > s
                        if m.sum(): print(f'   valore {nm}, p x quota > {s}: {int(m.sum())} giocate, vinte {int(y[m].sum())}, resa {((y[m] * best[m]).sum() - m.sum()) / m.sum():+.1%}')
