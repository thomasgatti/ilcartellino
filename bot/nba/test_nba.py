"""NBA: controlli automatici (17/11/2026). Uso: python3 bot/nba/test_nba.py     (nessun dato esterno: archivio finto, ~10 secondi)

1. nessuna fuga dal futuro: le variabili delle partite passate non cambiano se all'archivio si aggiungono partite successive;
2. nessuna fuga dal tabellino: alterare i numeri di una partita non cambia le variabili di quella partita
   (con lega_per_giorno nemmeno quelle delle altre partite della stessa sera);
3. senza opzioni la tabella ha le stesse righe di sempre; con universo=True compaiono gli assenti di rotazione (gioca=0);
4. abbina(): nomi OddsPapi → giocatori, senza mai prendere un omonimo;
5. combinazioni(): partite diverse, quota = prodotto, niente «riposo»;
6. modello v2: P(TD) <= P(DD) e probabilità fra 0 e 1;
7. registro: scrive, non riscrive, e rapporto.py lo rilegge.
"""
import copy, json, os, sys, tempfile
import numpy as np, pandas as pd
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from dataset import costruisci
from mercato import abbina, norm
ESITO = {'min', 'pts', 'reb', 'ast', 'stl', 'blk', 'dd', 'td'}

def archivio_finto(n_giorni=70, seme=0):
    """8 squadre, 9 giocatori l'una, 4 partite per sera alla stessa ora; ogni tanto qualcuno salta la partita"""
    rng = np.random.default_rng(seme); partite = []; gioc = {}; forza = {}
    for t in range(1, 9):
        for k in range(9): pid = t * 100 + k; gioc[str(pid)] = [f'Nome{pid} Cognome{pid}', 'CFG'[k % 3], t]; forza[pid] = rng.uniform(0.3, 1.0) * (1.6 if k < 2 else 1.0)
    gid = 0; ts = 1_700_000_000
    for g in range(n_giorni):
        sq = list(rng.permutation(np.arange(1, 9))); ts += 86400 * (1 if g % 3 else 2)        # ogni tre sere un giorno di pausa: ci sono anche i back-to-back
        for i in range(4):
            h, a = int(sq[2 * i]), int(sq[2 * i + 1]); p = []
            for L, t in ((1, h), (0, a)):
                for k in range(9):
                    pid = t * 100 + k
                    if rng.random() < 0.10: continue
                    mn = int(np.clip(rng.normal(34 - 3 * k, 5), 4, 46)); f = forza[pid] * mn / 30
                    p.append([pid, L, int(k < 5), mn] + [int(rng.poisson(x * f)) for x in (16, 9, 8, 1, 1, 2)] + [0] * 8 + [int(rng.poisson(2.5)), 0])
            gid += 1
            partite.append(dict(id=str(gid), st='2026-2027', ts=ts, g=f'{20260000 + g}', tipo=2, h=[h, f'S{h}', 100], a=[a, f'S{a}', 98], linea=None, t={}, p=p, np=[]))
    return partite, gioc

def uguali(A, B, colonne):
    return [c for c in colonne if pd.api.types.is_numeric_dtype(A[c]) and not np.allclose(A[c].astype(float).fillna(-9e9).values, B[c].astype(float).fillna(-9e9).values)]

def test_fuga_dal_futuro():
    P, G = archivio_finto(); taglio = P[len(P) // 2]['ts']
    for opz in (dict(), dict(universo=True, lega_per_giorno=True)):
        tutto = costruisci(copy.deepcopy(P), G, **opz); meta = costruisci([copy.deepcopy(m) for m in P if m['ts'] <= taglio], G, **opz)
        A = tutto[tutto.ts <= taglio].reset_index(drop=True); assert len(A) == len(meta), 'righe diverse'
        d = uguali(A, meta.reset_index(drop=True), list(A.columns)); assert not d, f'variabili che dipendono dal futuro: {d}'

def test_fuga_dal_tabellino():
    P, G = archivio_finto(); sera = P[-1]['g']; ultime = [m['id'] for m in P if m['g'] == sera]; assert len(ultime) == 4
    def altera(quali):
        Q = copy.deepcopy(P)
        for m in Q:
            if m['id'] in quali:
                for r in m['p']: r[3:20] = [55] + [40] * 16
                m['h'][2] = 200; m['a'][2] = 1
        return Q
    for opz, quali, dove in ((dict(), ultime[-1:], ultime[-1:]), (dict(lega_per_giorno=True), ultime, ultime), (dict(universo=True, lega_per_giorno=True), ultime, ultime)):
        A = costruisci(copy.deepcopy(P), G, **opz); B = costruisci(altera(set(quali)), G, **opz); col = [c for c in A.columns if c not in ESITO]
        a = A[A.id.isin(dove)].reset_index(drop=True); b = B[B.id.isin(dove)].reset_index(drop=True)
        d = uguali(a, b, col); assert not d, f'{opz}: variabili che dipendono dal tabellino della stessa sera: {d}'
    # e la differenza che la correzione toglie: senza lega_per_giorno la prima partita della sera entra nelle variabili delle altre
    A = costruisci(copy.deepcopy(P), G); B = costruisci(altera({ultime[0]}), G); col = [c for c in A.columns if c not in ESITO]
    d = uguali(A[A.id.isin(ultime[1:])].reset_index(drop=True), B[B.id.isin(ultime[1:])].reset_index(drop=True), col)
    assert set(d) <= {'ritmo_lega', 'conc_pts', 'conc_reb', 'conc_ast'}, f'fuga inattesa fra partite della stessa sera: {d}'

def test_universo():
    P, G = archivio_finto(); A = costruisci(copy.deepcopy(P), G); U = costruisci(copy.deepcopy(P), G, universo=True)
    assert len(A) == sum(len(m['p']) for m in P) and (A.gioca == 1).all()
    assert len(U[U.gioca == 1]) == len(A) and (U.gioca == 0).sum() > 50
    Z = U[U.gioca == 0]; assert (Z[['min', 'pts', 'dd', 'td']] == 0).all().all()
    col = [c for c in A.columns if c not in ('gioca',)]; assert not uguali(A.reset_index(drop=True), U[U.gioca == 1].reset_index(drop=True), col), 'le righe di chi gioca devono restare identiche'
    chiavi = set(zip(A.id, A.pid)); assert not (set(zip(Z.id, Z.pid)) & chiavi), 'un assente non può essere anche in campo'

def test_abbina():
    c = {norm(x) for x in ('Alex Sarr', 'Ronald Holland II', 'Jalen Williams', 'Jaylin Williams', 'Nikola Jokić', "De'Aaron Fox", 'Tim Hardaway Jr.')}
    assert abbina('Sarr, Alexandre', c) == 'alex sarr' and abbina('Holland, Ron', c) == 'ronald holland'
    assert abbina('Jokic, Nikola', c) == 'nikola jokic' and abbina('Fox, DeAaron', c) == 'deaaron fox' and abbina('Hardaway, Tim', c) == 'tim hardaway'
    assert abbina('Williams, Jalen', c) == 'jalen williams' and abbina('Williams, J', c) is None, 'fra due omonimi possibili: nessuno'
    assert abbina('Doncic, Luka', c) is None and abbina('Sarr', c) is None

def test_combinazioni():
    from oggi import combinazioni
    T = [dict(n=f'G{i}', sq='X', partita=i // 2, p_dd=0.75 - 0.05 * i, p_td=0.05, q_dd=round(1.2 + 0.45 * i, 2), q_td=15.0) for i in range(10)]
    T[0]['riposo'] = 1
    C = combinazioni(T); assert C and all(c['tipo'] for c in C)
    for c in C:
        assert abs(c['q'] - np.prod([x['q'] for x in c['gambe']])) < 0.01 and abs(c['p'] - np.prod([x['p'] for x in c['gambe']])) < 1e-3
        assert all(x['n'] != 'G0' for x in c['gambe']), 'chi rischia il riposo non entra nelle combinazioni'
        part = [next(t['partita'] for t in T if t['n'] == x['n']) for x in c['gambe']]; assert len(set(part)) == len(part), 'gambe della stessa partita'

def test_modello_v2():
    import modello2 as M2
    P, G = archivio_finto(110, seme=2)
    U = M2.prepara2(costruisci(P, G, universo=True, lega_per_giorno=True)); U = U[U.n_prec >= 5]; D = U[U.gioca == 1]
    t = D.ts.quantile(0.8); tr, te = D[D.ts < t], D[D.ts >= t]
    assert tr.dd.sum() > 30 and tr.td.sum() > 5, f'archivio finto troppo povero: {int(tr.dd.sum())} doppie, {int(tr.td.sum())} triple'
    p_dd, p_td = M2.prevedi(tr, te); assert ((p_dd > 0) & (p_dd < 1)).all() and (p_td <= p_dd + 1e-12).all() and (p_td >= 0).all()
    A = M2.degrada(tr, 0.5); B = M2.degrada(tr, 0.5); assert (A.ass_min.values == B.ass_min.values).all(), 'degrada() deve essere ripetibile'
    assert np.allclose(M2.degrada(tr, 1.0).ass_min.values, tr.ass_min.values) and (M2.degrada(tr, 0.0).ass_min.values == tr.gia_min.values).all()
    Ug = M2.universo_gioca(U); pg = M2.prevedi_gioca(Ug[Ug.ts < t], Ug[Ug.ts >= t]); assert ((pg > 0) & (pg < 1)).all()

def test_registro():
    import registro, rapporto
    with tempfile.TemporaryDirectory() as d:
        I = dict(giorno='20261116', creato=1, partite=[]); O = dict(giorno='20261116', creato=1, partite=[dict(id='1', ts=2_000_000_000, giocatori=[dict(n='A B', p_dd=.2, p_td=.01)])], consigli={})
        json.dump(I, open(d + '/i.json', 'w')); json.dump(O, open(d + '/o.json', 'w'))
        f = registro.scrivi(d + '/i.json', d + '/o.json', d, adesso=1_900_000_000); assert os.path.exists(f)
        try: registro.scrivi(d + '/i.json', d + '/o.json', d, adesso=1_900_000_000); assert False, 'ha riscritto una fotografia'
        except SystemExit: pass
        registro.scrivi(d + '/i.json', d + '/o.json', d, adesso=1_900_000_500); registro.scrivi(d + '/i.json', d + '/o.json', d, adesso=2_000_000_500)   # l'ultima è dopo la palla a due
        N = rapporto.fotografie(d); assert list(N) == ['20261116'] and N['20261116']['partite'][0]['id'] == '1'

if __name__ == '__main__':
    import warnings; warnings.filterwarnings('ignore')
    prove = [(k, v) for k, v in sorted(globals().items()) if k.startswith('test_')]; falliti = 0
    for k, f in prove:
        try: f(); print('ok      ', k)
        except AssertionError as e: falliti += 1; print('FALLITO ', k, '·', e)
    print(f'{len(prove) - falliti}/{len(prove)} controlli superati'); sys.exit(1 if falliti else 0)
