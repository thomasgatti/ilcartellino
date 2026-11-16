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


# Combinazioni: per ogni fascia di quota, la combinazione PIÙ PROBABILE che paga almeno quella quota.
# Gambe = doppia doppia o tripla doppia di giocatori di partite diverse (indipendenti: vedi RUNBOOK), 2 o 3 gambe; quota = prodotto delle singole.
FASCE = (('Sicura', 1.5), ('Media', 3), ('Alta', 10), ('Altissima', 30), ('Colpo grosso', 100))
def combinazioni(tutti):
    gambe = []
    for g in tutti:
        if g.get('riposo'): continue
        if g.get('q_dd') and g['p_dd'] >= 0.08: gambe.append(dict(n=g['n'], sq=g['sq'], cosa='dd', p=g['p_dd'], q=g['q_dd'], partita=g['partita'], dubbio=g.get('dubbio', 0), ex=g.get('ex', 0)))
        if g.get('q_td') and g['p_td'] >= 0.03: gambe.append(dict(n=g['n'], sq=g['sq'], cosa='td', p=g['p_td'], q=g['q_td'], partita=g['partita'], dubbio=g.get('dubbio', 0), ex=g.get('ex', 0)))
    gambe = sorted(gambe, key=lambda x: -x['p'])[:40]; cand = []
    for k in (2, 3):
        for c in itertools.combinations(gambe, k):
            if len({x['partita'] for x in c}) < k: continue
            cand.append((float(np.prod([x['p'] for x in c])), float(np.prod([x['q'] for x in c])), c))
    out, visti = [], set()
    for i, (nome, minimo) in enumerate(FASCE):
        tetto = FASCE[i + 1][1] if i + 1 < len(FASCE) else 1e9
        buone = sorted([c for c in cand if minimo <= c[1] < tetto], key=lambda c: (-c[0], len(c[2])))
        for p, q, c in buone:
            k = frozenset((x['n'], x['cosa']) for x in c)
            if k in visti: continue
            visti.add(k); out.append(dict(tipo=nome, p=round(p, 4), q=round(q, 2), gambe=[{a: x[a] for a in ('n', 'sq', 'cosa', 'p', 'q', 'dubbio', 'ex') if a in x} for x in c])); break
    # con le triple doppie (le più probabili non ne contengono mai: sono le quote col margine più alto): la più probabile con una tripla, e con due
    for nome, quante in (('Con una tripla doppia', 1), ('Due triple doppie', 2)):
        buone = sorted([c for c in cand if len(c[2]) == 2 and sum(x['cosa'] == 'td' for x in c[2]) == quante], key=lambda c: -c[0])
        for p, q, c in buone:
            k = frozenset((x['n'], x['cosa']) for x in c)
            if k in visti: continue
            visti.add(k); out.append(dict(tipo=nome, p=round(p, 4), q=round(q, 2), gambe=[{a: x[a] for a in ('n', 'sq', 'cosa', 'p', 'q', 'dubbio')} for x in c])); break
    return out

def ricombina(f):
    """ricalcola solo le combinazioni da un oggi.json già pubblicato (senza richiedere di nuovo le quote)"""
    D = json.load(open(f)); tutti = [dict(g, partita=P['id']) for P in D['partite'] for g in P['giocatori']]
    D['consigli'].pop('accoppiate', None); D['consigli']['combinazioni'] = combinazioni(tutti)
    json.dump(D, open(f, 'w'), ensure_ascii=False)
    for c in D['consigli']['combinazioni']: print(f"{c['tipo']:13s} quota {c['q']:8.2f}  prob {c['p']:.1%}  " + ' + '.join(f"{x['n']} {x['cosa'].upper()} ({x['p']:.0%} @ {x['q']})" for x in c['gambe']))


def sostituto(partite, tid, pid_out, disponibili, nomi):
    """Chi gioca di più quando manca pid_out: differenza di minuti dei compagni, in questa stagione, fra le partite senza e con lui.
    Serve che abbia saltato almeno 2 partite e ne abbia giocate almeno 3 con la squadra; si indica solo un compagno disponibile stanotte con almeno +3 minuti."""
    st = max(m['st'] for m in partite); con, senza = {}, {}; n_con = n_senza = 0
    for m in partite:
        if m['st'] != st or m.get('futura'): continue
        L = 1 if m['h'][0] == tid else 0 if m['a'][0] == tid else None
        if L is None: continue
        mins = {r[0]: r[3] for r in m['p'] if r[1] == L}; c = pid_out in mins
        if c: n_con += 1
        else: n_senza += 1
        for p_, v in mins.items(): (con if c else senza).setdefault(p_, []).append(v)
    if n_con < 3 or n_senza < 2: return {}
    best = None
    for p_ in disponibili:
        if p_ == pid_out or p_ not in senza or len(senza[p_]) < 2: continue
        d = sum(senza[p_]) / n_senza - sum(con.get(p_, [])) / n_con          # chi non entra conta 0 minuti
        if d >= 3 and (best is None or d > best[1]): best = (p_, d)
    return dict(posto=nomi.get(best[0], ''), piu=round(best[1], 1)) if best and nomi.get(best[0]) else {}

def diario(partite, gioc, D):
    """L'ultima notte in archivio: chi ha fatto doppia e tripla doppia, e chi sta trovando più spazio (media minuti delle ultime 3 contro le 10 precedenti)."""
    giocate = [m for m in partite if not m.get('futura')]
    if not giocate: return {}
    giorno = max(m['g'] for m in giocate); dd, td = [], []
    for m in giocate:
        if m['g'] != giorno: continue
        for r in m['p']:
            n10 = sum(1 for x in r[4:9] if x >= 10)
            if n10 >= 2: (td if n10 >= 3 else dd).append(dict(n=gioc[str(r[0])][0], sq=(m['h'] if r[1] else m['a'])[1], riga=f'{r[4]}-{r[5]}-{r[6]}'))
    X = D[(D.futura == 0) & (D.st == D.st.max())]; lim = X.ts.max() - 6 * 86400; spazio = []
    for pid, Z in X.groupby('pid'):
        v = Z['min'].values
        if len(v) < 8 or Z.ts.values[-1] < lim: continue
        ora, prima = v[-3:].mean(), v[-13:-3].mean()
        if ora - prima >= 6 and ora >= 18: spazio.append(dict(n=gioc[str(pid)][0], ora=round(float(ora), 1), prima=round(float(prima), 1)))
    spazio.sort(key=lambda x: x['prima'] - x['ora'])
    return dict(giorno=giorno, dd=sorted(dd, key=lambda x: x['n']), td=td, spazio=spazio[:8])

def main(cartella, f_in, f_out, f_quote=None):
    partite, gioc = carica(cartella); I = json.load(open(f_in)); stato = {}; nomi = {}
    if f_quote:                                        # rifacimento della stessa notte: le quote si riprendono dalla pagina già pubblicata
        V = json.load(open(f_quote)); vecchie = {str(P['id']): P for P in V.get('partite', [])} if V.get('giorno') == I['giorno'] else {}
        for P in I['partite']:
            if P['quote']['dd'] or P['quote']['td'] or str(P['id']) not in vecchie: continue
            for g in vecchie[str(P['id'])]['giocatori']:
                for y in ('dd', 'td'):
                    if g.get('q_' + y): P['quote'][y].setdefault(g['b_' + y] + '.it', {})[g['n']] = g['q_' + y]
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
            g = dict(id=int(r.pid), n=nomi[r.pid], sq=P['h'][1] if r.casa else P['a'][1], ruolo=r.ruolo, dubbio=int(stato[r.pid][0] == 'dubbio'), min=round(r.emin, 1), pts=round(r.pts_stag, 1), reb=round(r.reb_stag, 1), ast=round(r.ast_stag, 1),
                     p_dd=round(float(r.p_dd), 4), p_td=round(float(r.p_td), 4))
            # etichette: ex di turno; seconda serata di back-to-back per uno che di solito la salta; minuti in crescita
            if r.ex: g['ex'] = 1
            if r.b2b == 1 and r.b2b_occ >= 4 and r.b2b_gio / r.b2b_occ < 0.6: g['riposo'] = 1
            if r.emin - r.emin_lenta >= 4: g['su'] = round(float(r.emin - r.emin_lenta), 1)
            for y in ('dd', 'td'):
                if r.pid in q[y]: g['q_' + y], g['b_' + y] = q[y][r.pid][:2]; g['v_' + y] = round(g['p_' + y] * g['q_' + y], 3)
            G.append(g); tutti.append(dict(g, partita=P['id']))
        G.sort(key=lambda g: -g['p_dd'])
        cand = {k: next((g['n'] for g in G if g['sq'] == P[k][1]), None) for k in ('h', 'a')}
        fuori = {}
        # assenti che contano: «out» con almeno 15 minuti di media nell'ultima stagione giocata
        ult = D[D.futura == 0].groupby('pid').emin.last()
        for k in ('h', 'a'):
            fuori[k] = [dict(n=n_, perche=pc, **sostituto(partite, P[k][0], pid, {g_['id'] for g_ in G}, nomi)) for pid, n_, _, st, pc in P['rosa'][k] if st == 'out' and ult.get(pid, 0) >= 15]
        out['partite'].append(dict(id=P['id'], ts=P['ts'], h=dict(sigla=P['h'][1], nome=P['h'][2]), a=dict(sigla=P['a'][1], nome=P['a'][2]), giocatori=G[:14], candidati=cand, fuori=fuori, quote=int(bool(q['dd']))))
    tutti = [g for g in tutti if not g.get('riposo')]          # chi rischia il turno di riposo non entra in giocate e combinazioni
    con = [g for g in tutti if 'q_dd' in g]
    breve = lambda g: {k: g[k] for k in ('n', 'sq', 'p_dd', 'p_td', 'q_dd', 'b_dd', 'v_dd', 'q_td', 'b_td', 'v_td', 'dubbio', 'ex', 'su') if k in g}
    C = dict(
        bassa=[breve(g) for g in sorted([g for g in con if g['q_dd'] < 2.0], key=lambda g: -g['p_dd'])[:3]],
        alta=[breve(g) for g in sorted([g for g in con if g['q_dd'] >= 3.0 and g['p_dd'] >= 0.10], key=lambda g: -g['v_dd'])[:3]],
        td=[breve(g) for g in sorted([g for g in tutti if g['p_td'] >= 0.03], key=lambda g: -g['p_td'])[:4]])
    if not con: C['bassa'] = [breve(g) for g in sorted(tutti, key=lambda g: -g['p_dd'])[:3]]
    C['combinazioni'] = combinazioni(tutti)
    out['consigli'] = C
    out['ieri'] = diario(partite, gioc, D)
    json.dump(out, open(f_out, 'w'), ensure_ascii=False)
    for P in out['partite']:
        print(f"\n{P['a']['sigla']} @ {P['h']['sigla']}  ·  fuori: {', '.join(x['n'] for k in 'ha' for x in P['fuori'][k]) or '-'}")
        for g in P['giocatori'][:5]: print(f"   {g['n']:26s} {g['sq']:4s} DD {g['p_dd']:.0%}  TD {g['p_td']:.1%}  quota DD {g.get('q_dd', '-')} {g.get('b_dd', '')}  valore {g.get('v_dd', '-')}")
    print('\nconsigli:', json.dumps(C, ensure_ascii=False)[:1500])

if __name__ == '__main__':
    if sys.argv[1] == '--ricombina': ricombina(sys.argv[2])
    else: main(*[x for x in sys.argv[1:5] if x])
