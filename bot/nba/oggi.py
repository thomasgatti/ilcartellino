"""NBA: probabilità di doppia doppia e tripla doppia per le partite ancora da giocare, con consigli e accoppiate.

Uso: python3 bot/nba/oggi.py <cartella nba del ramo dati> <oggi_input.json di cloud/nba/oggi.mjs> <uscita oggi.json>
Modello: quello «con il referto infortuni» del RUNBOOK (logistica + alberi, media sul logit), allenato su tutto l'archivio.
Chi è «out» per ESPN non gioca e conta come assenza per i compagni; i «dubbi» sono trattati come presenti e segnati.
"""
import json, sys, itertools
import numpy as np, pandas as pd
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from dataset import carica, costruisci
from prova import prepara, colonne, gbm, logit_, LG, GRUPPI
from mercato import norm

def main(cartella, f_in, f_out):
    partite, gioc = carica(cartella); I = json.load(open(f_in)); stato = {}; nomi = {}
    for P in I['partite']:
        righe = []
        for k, L in (('h', 1), ('a', 0)):
            for pid, nome, ruolo_, st, perche in P['rosa'][k]:
                nomi[pid] = nome; stato[pid] = (st, perche); gioc.setdefault(str(pid), [nome, ruolo_, P[k][0]])
                if st != 'out': righe.append([pid, L] + [0] * 18)
        partite.append(dict(id=P['id'], st=f"{P['anno'] - 1}-{P['anno']}", ts=P['ts'], tipo=P['tipo'], h=[P['h'][0], P['h'][1], 0], a=[P['a'][0], P['a'][1], 0], linea=None, t={}, p=righe, futura=True))
    D = prepara(costruisci(partite, gioc)); tr, te = D[D.futura == 0], D[D.futura == 1].copy()
    c = [x for x in colonne('assenze del giorno') if x not in GRUPPI['linea prepartita']]
    for y in ('dd', 'td'):
        a = gbm(y == 'td').fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]; b = logit_().fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]
        te['p_' + y] = 1 / (1 + np.exp(-(LG(a) + LG(b)) / 2))
    out = dict(giorno=I['giorno'], creato=I['creato'], partite=[]); tutti = []
    for P in I['partite']:
        Z = te[te.id == P['id']]; per_nome = {norm(nomi[p]): p for p in Z.pid}
        q = {'dd': {}, 'td': {}}
        for y in ('dd', 'td'):
            for bk, d in P['quote'][y].items():
                for nome, prezzo in d.items():
                    pid = per_nome.get(norm(nome))
                    if pid is None: continue
                    # l'utente gioca in Italia: vale la quota migliore fra i bookmaker italiani; quelli americani solo se in Italia non è quotato
                    it = bk.endswith('.it'); vecchia = q[y].get(pid)
                    if vecchia is None or (it and not vecchia[2]) or (it == vecchia[2] and prezzo > vecchia[0]): q[y][pid] = (prezzo, bk.replace('.it', ''), it)
        G = []
        for r in Z.itertuples():
            if r.emin < 12 or r.gg_fermo > 30: continue
            g = dict(n=nomi[r.pid], sq=P['h'][1] if r.casa else P['a'][1], ruolo=r.ruolo, dubbio=int(stato[r.pid][0] == 'dubbio'), min=round(r.emin, 1), pts=round(r.pts_stag, 1), reb=round(r.reb_stag, 1), ast=round(r.ast_stag, 1),
                     p_dd=round(float(r.p_dd), 4), p_td=round(float(r.p_td), 4))
            for y in ('dd', 'td'):
                if r.pid in q[y]: g['q_' + y], g['b_' + y] = q[y][r.pid][:2]; g['v_' + y] = round(g['p_' + y] * g['q_' + y], 3)
            G.append(g); tutti.append(dict(g, partita=P['id']))
        G.sort(key=lambda g: -g['p_dd'])
        cand = {k: next((g['n'] for g in G if g['sq'] == P[k][1]), None) for k in ('h', 'a')}
        fuori = {}
        # assenti che contano: «out» con almeno 15 minuti di media nell'ultima stagione giocata
        ult = D[D.futura == 0].groupby('pid').emin.last()
        for k in ('h', 'a'): fuori[k] = [dict(n=n_, perche=pc) for pid, n_, _, st, pc in P['rosa'][k] if st == 'out' and ult.get(pid, 0) >= 15]
        out['partite'].append(dict(id=P['id'], ts=P['ts'], h=dict(sigla=P['h'][1], nome=P['h'][2]), a=dict(sigla=P['a'][1], nome=P['a'][2]), giocatori=G[:14], candidati=cand, fuori=fuori, quote=int(bool(q['dd']))))
    con = [g for g in tutti if 'q_dd' in g]
    breve = lambda g: {k: g[k] for k in ('n', 'sq', 'p_dd', 'p_td', 'q_dd', 'b_dd', 'v_dd', 'q_td', 'b_td', 'v_td', 'dubbio') if k in g}
    C = dict(
        bassa=[breve(g) for g in sorted([g for g in con if g['q_dd'] < 2.0], key=lambda g: -g['p_dd'])[:3]],
        alta=[breve(g) for g in sorted([g for g in con if g['q_dd'] >= 3.0 and g['p_dd'] >= 0.10], key=lambda g: -g['v_dd'])[:3]],
        td=[breve(g) for g in sorted([g for g in tutti if g['p_td'] >= 0.03], key=lambda g: -g['p_td'])[:4]], accoppiate=[])
    if not con: C['bassa'] = [breve(g) for g in sorted(tutti, key=lambda g: -g['p_dd'])[:3]]
    def coppia(tipo, a, b): return dict(tipo=tipo, a=breve(a), b=breve(b), p=round(a['p_dd'] * b['p_dd'], 4), q=round(a['q_dd'] * b['q_dd'], 2), v=round(a['p_dd'] * b['p_dd'] * a['q_dd'] * b['q_dd'], 3))
    coppie = [(a, b) for a, b in itertools.combinations([g for g in con if g['p_dd'] >= 0.15], 2) if a['partita'] != b['partita']]   # partite diverse: indipendenti
    if coppie:
        visti = set()
        for tipo, lista in (('la più probabile', sorted(coppie, key=lambda ab: -ab[0]['p_dd'] * ab[1]['p_dd'])),
                            ('quota media', sorted([ab for ab in coppie if 3 <= ab[0]['q_dd'] * ab[1]['q_dd'] < 8], key=lambda ab: -ab[0]['p_dd'] * ab[1]['p_dd'])),
                            ('quota alta', sorted([ab for ab in coppie if ab[0]['q_dd'] * ab[1]['q_dd'] >= 8], key=lambda ab: -ab[0]['v_dd'] * ab[1]['v_dd']))):
            for a, b in lista:
                k = frozenset((a['n'], b['n']))
                if k not in visti: visti.add(k); C['accoppiate'].append(coppia(tipo, a, b)); break
    out['consigli'] = C
    json.dump(out, open(f_out, 'w'), ensure_ascii=False)
    for P in out['partite']:
        print(f"\n{P['a']['sigla']} @ {P['h']['sigla']}  ·  fuori: {', '.join(x['n'] for k in 'ha' for x in P['fuori'][k]) or '-'}")
        for g in P['giocatori'][:5]: print(f"   {g['n']:26s} {g['sq']:4s} DD {g['p_dd']:.0%}  TD {g['p_td']:.1%}  quota DD {g.get('q_dd', '-')} {g.get('b_dd', '')}  valore {g.get('v_dd', '-')}")
    print('\nconsigli:', json.dumps(C, ensure_ascii=False)[:1500])

if __name__ == '__main__': main(*sys.argv[1:4])
