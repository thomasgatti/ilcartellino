"""NBA: previsto contro osservato, notte per notte, dal registro delle previsioni (17/11/2026).

Uso: python3 bot/nba/rapporto.py <cartella nba del ramo dati> [uscita .json]
Per ogni notte prende dal registro l'ULTIMA fotografia scritta prima della prima palla a due (quella che un utente poteva
davvero leggere) e la confronta con i tabellini in archivio. Chi non è entrato in campo conta come evento mancato e viene
contato a parte («non entrati»): è la misura dell'universo vero, non di «chi ha giocato».
Si possono passare anche pagine pubblicate (oggi.json / ieri.json) al posto del registro: --pagina <file> (anche più volte).
"""
import glob, gzip, json, os, sys
import numpy as np
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from mercato import norm, abbina

def esiti(cartella):
    """id partita → {id giocatore: (dd, td)}, nome normalizzato → id, per le partite in archivio"""
    gioc = json.load(open(os.path.join(cartella, 'giocatori.json'))); E = {}
    for f in sorted(glob.glob(os.path.join(cartella, '2*.json.gz')))[-2:]:
        for gid, m in json.load(gzip.open(f, 'rt')).items():
            E[str(gid)] = {r[0]: (int(sum(x >= 10 for x in r[4:9]) >= 2), int(sum(x >= 10 for x in r[4:9]) >= 3)) for r in m['p']}
    return E, gioc

def fotografie(cartella):
    """per ogni notte, l'ultima fotografia del registro scritta prima della prima partita"""
    per_notte = {}
    for f in sorted(glob.glob(os.path.join(cartella, 'registro', '*', '*.json.gz'))):
        r = json.load(gzip.open(f, 'rt')); O = r['uscita']
        if not O.get('partite'): continue
        if r['scritto'] < min(P['ts'] for P in O['partite']): per_notte[r['giorno']] = O        # i file sono in ordine di tempo: resta l'ultima valida
    return per_notte

def notte(O, E, gioc):
    righe = []
    for P in O['partite']:
        es = E.get(str(P['id']))
        if es is None: continue                        # partita non ancora in archivio (o rinviata)
        nomi = {norm(gioc[str(p)][0]): p for p in es if str(p) in gioc}
        for g in P['giocatori']:
            pid = g.get('id') if g.get('id') in es else nomi.get(abbina(g['n'], nomi) or '')
            dd, td = es.get(pid, (0, 0))
            righe.append(dict(n=g['n'], p_dd=g['p_dd'], p_td=g['p_td'], entrato=int(pid in es), dd=dd, td=td, q_dd=g.get('q_dd'), dubbio=g.get('dubbio', 0), riposo=g.get('riposo', 0)))
    return righe

def riassunto(righe):
    if not righe: return {}
    p = np.clip(np.array([r['p_dd'] for r in righe]), 1e-6, 1 - 1e-6); y = np.array([r['dd'] for r in righe]); pt = np.clip(np.array([r['p_td'] for r in righe]), 1e-6, 1 - 1e-6); yt = np.array([r['td'] for r in righe])
    ll = lambda y, p: float(-np.mean(y * np.log(p) + (1 - y) * np.log(1 - p)))
    q = [r for r in righe if r['q_dd']]
    return dict(giocatori=len(righe), non_entrati=int(sum(1 - r['entrato'] for r in righe)), dd_previste=round(float(p.sum()), 2), dd_reali=int(y.sum()), ll_dd=round(ll(y, p), 4), brier_dd=round(float(np.mean((p - y) ** 2)), 4),
                td_previste=round(float(pt.sum()), 2), td_reali=int(yt.sum()), ll_td=round(ll(yt, pt), 4), quotati=len(q), quotati_non_entrati=int(sum(1 - r['entrato'] for r in q)),
                dubbi=int(sum(r['dubbio'] for r in righe)), dubbi_non_entrati=int(sum(r['dubbio'] and not r['entrato'] for r in righe)))

if __name__ == '__main__':
    arg = sys.argv[1:]; pagine = [arg[i + 1] for i, a in enumerate(arg) if a == '--pagina']; resto = [a for i, a in enumerate(arg) if a != '--pagina' and (i == 0 or arg[i - 1] != '--pagina')]
    cartella = resto[0]; E, gioc = esiti(cartella); N = fotografie(cartella)
    for f in pagine: O = json.load(open(f)); N[str(O['giorno'])] = O
    out = {}; tutte = []
    for g in sorted(N):
        R = notte(N[g], E, gioc)
        if not R: continue
        out[g] = riassunto(R); tutte += R; s = out[g]
        print(f"{g}: {s['giocatori']} giocatori ({s['non_entrati']} non entrati) · DD previste {s['dd_previste']} reali {s['dd_reali']} · log loss {s['ll_dd']} · TD previste {s['td_previste']} reali {s['td_reali']} · in dubbio {s['dubbi']} (non entrati {s['dubbi_non_entrati']})")
    if tutte:
        out['totale'] = riassunto(tutte); print('TOTALE:', json.dumps(out['totale'], ensure_ascii=False))
        for a, b in ((0, .03), (.03, .08), (.08, .15), (.15, .30), (.30, .55), (.55, 1.01)):
            Z = [r for r in tutte if a <= r['p_dd'] < b]
            if Z: print(f"   DD {a:.0%}-{min(b, 1):.0%}: n {len(Z)} · previsto {np.mean([r['p_dd'] for r in Z]):.3f} · reale {np.mean([r['dd'] for r in Z]):.3f}")
    else: print('nessuna notte del registro ha ancora i tabellini in archivio')
    if len(resto) > 1: json.dump(out, open(resto[1], 'w'), indent=1, ensure_ascii=False)
