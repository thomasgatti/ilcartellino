"""Seconda metà della prova «miscela col mercato in Champions» (17/11/2026).
Legge le righe di miscela_righe.mjs e l'archivio OddsPapi, e applica la miscela con le STESSE funzioni della produzione
(market_blend.blend_match: abbinamento dei nomi uno a uno, de-vig a potenza con k in [1, 6], spostamento medio per chi non ha quota).
Quote come le prepara cloud/giornata.mjs: per giocatore 1 / media delle probabilità implicite di Sisal, bet365.it, Eurobet,
arrotondata a 3 decimali, partita usata solo con almeno 10 giocatori quotati. Prezzo: l'ultimo prima del via ([0] nell'archivio).
Uso: python3 miscela_confronto.py righe.json quote_ucl.json"""
import json, sys, os, math, random, collections
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', '..'))
from market_blend import blend_match, lg, ex

R = json.load(open(sys.argv[1]))['righe']; Q = json.load(open(sys.argv[2]))
BOOKS = ['sisal.it', 'bet365.it', 'eurobet.it']
by = collections.defaultdict(list)
for r in R: by[r['id']].append(r)
G, info = [], collections.Counter()
for mid, rows in by.items():
    rec = Q.get(str(mid)); bets = {}
    for b in BOOKS:
        for n, v in ((rec or {}).get('q', {}).get(b) or {}).items():
            if v and v[0] and v[0] > 1: bets.setdefault(n, []).append(v[0])
    bets = [(n, round(len(v) / sum(1 / x for x in v), 3)) for n, v in bets.items()]
    if len(bets) < 10:
        info['senza quote'] += 1; G.append({'id': mid, 'ts': rows[0]['ts'], 'R': [dict(r, b={w: r['p'] for w in (.3, .5, .7)}) for r in rows], 'cop': 0}); continue
    pl = [[r['n'], 0, 0, r['p']] for r in rows]; out = {}
    for w in (.3, .5, .7):
        bl, k = blend_match(pl, bets, w=w); out[w] = [x[0] for x in bl]
        if w == .5: matched = sum(1 for x in bl if x[1]); info['k al bordo 1'] += k < 1.0001; info['partite con quote'] += 1
    G.append({'id': mid, 'ts': rows[0]['ts'], 'cop': matched / len(rows), 'R': [dict(r, b={w: out[w][i] for w in out}) for i, r in enumerate(rows)]})
# controllo omonimi: due titolari con stesse iniziale e cognome
dup = sum(1 for g in G for k, c in collections.Counter((r['n'].split()[0][0] + ' ' + r['n'].split()[-1]).lower() for r in g['R']).items() if c > 1)
ll = lambda y, p: -(math.log(p) if y else math.log(1 - p))
top3 = lambda R, f: sum(r['y'] for r in sorted(R, key=f, reverse=True)[:3])
def per_partita(g, w):
    R = g['R']; base = [r['p'] for r in R]; bl = [r['b'][w] for r in R]
    # controllo: stesso totale della miscela ottenuto spostando il modello di un offset comune (nessun esito usato)
    lo, hi = -3, 3
    for _ in range(60):
        d = (lo + hi) / 2
        if sum(ex(lg(p) + d) for p in base) < sum(bl): lo = d
        else: hi = d
    off = [ex(lg(p) + (lo + hi) / 2) for p in base]
    return dict(dll=sum(ll(r['y'], b) - ll(r['y'], p) for r, p, b in zip(R, base, bl)), doff=sum(ll(r['y'], o) - ll(r['y'], p) for r, p, o in zip(R, base, off)),
                n=len(R), t0=top3(R, lambda r: r['p']), t1=top3(R, lambda r: r['b'][w]),
                camb={r['n'] for r in sorted(R, key=lambda r: r['p'], reverse=True)[:3]} != {r['n'] for r in sorted(R, key=lambda r: r['b'][w], reverse=True)[:3]})
def boot(D, f, B=4000, seed=1):
    rnd = random.Random(seed); v = sorted(f([D[rnd.randrange(len(D))] for _ in D]) for _ in range(B)); return v[int(.025 * B)], v[int(.975 * B) - 1]
def rep(nome, GG):
    print(f'\n{nome}: {len(GG)} partite, {sum(len(g["R"]) for g in GG)} titolari, ammoniti {sum(r["y"] for g in GG for r in g["R"])}, copertura quote {100 * sum(g["cop"] for g in GG) / len(GG):.0f}%')
    LL0 = sum(ll(r['y'], r['p']) for g in GG for r in g['R']) / sum(len(g['R']) for g in GG)
    print(f'  modello v4: LL {LL0:.4f} · ammoniti tra i primi 3 {sum(top3(g["R"], lambda r: r["p"]) for g in GG) / len(GG):.3f}')
    for w in (.3, .5, .7):
        D = [per_partita(g, w) for g in GG]
        f = lambda X: sum(x['dll'] for x in X) / sum(x['n'] for x in X); ft = lambda X: sum(x['t1'] - x['t0'] for x in X) / len(X)
        lo, hi = boot(D, f); tlo, thi = boot(D, ft)
        print(f'  peso {w}: ΔLL {f(D):+.5f} [{lo:+.5f}; {hi:+.5f}] (di cui solo livello comune {sum(x["doff"] for x in D) / sum(x["n"] for x in D):+.5f}) · Δprimi3 {ft(D):+.3f} [{tlo:+.3f}; {thi:+.3f}] · primi 3 diversi in {sum(x["camb"] for x in D)} partite (nomi centrati base {sum(x["t0"] for x in D if x["camb"])}, miscela {sum(x["t1"] for x in D if x["camb"])})')
print('controlli:', dict(info), '· coppie di titolari con stessa iniziale e cognome:', dup)
con = [g for g in G if g['cop'] > 0]; rep('Tutte le partite', G); rep('Solo con quote', con)
print('\nPer giornata (peso 0,5; le 18 partite di ogni giornata stanno in due-tre giorni consecutivi):')
gior = []
for g in sorted(con, key=lambda g: g['ts']):
    if not gior or g['ts'] - gior[-1][-1]['ts'] > 4 * 86400: gior.append([])
    gior[-1].append(g)
for i, GG in enumerate(gior, 1):
    D = [per_partita(g, .5) for g in GG]
    print(f'  giornata {i}: {len(GG)} partite · ΔLL {sum(x["dll"] for x in D) / sum(x["n"] for x in D):+.5f} · Δprimi3 {sum(x["t1"] - x["t0"] for x in D) / len(D):+.3f}')
