"""Quote 'ammonito' (Oddschecker, William Hill) → probabilità, abbinate ai titolari dell'export coppe.
Metodo: de-vig a potenza per partita sui titolari abbinati, Σ (1/q)^k = Σ p del modello (il mercato redistribuisce, non cambia il totale).
Uso: from market_blend import load_oc, match_market"""
import unicodedata, re, math, difflib

TR = str.maketrans({'ø': 'o', 'Ø': 'o', 'ł': 'l', 'Ł': 'l', 'ß': 'ss', 'æ': 'ae', 'đ': 'd', 'Đ': 'd', 'ı': 'i', "'": '', '’': ''})
def norm(s):
    s = unicodedata.normalize('NFD', s.translate(TR)).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'[^a-z ]', ' ', s).split()

def load_oc(path):
    out = []
    for line in open(path, encoding='utf-8'):
        slug, rest = line.rstrip('\n').split('|', 1)
        bets = []
        for x in rest.split(';'):
            n, q = x.rsplit(':', 1); bets.append((n, float(q)))
        out.append((slug, bets))
    return out

def devig(bets, E):
    lo, hi = 1.0, 6.0
    for _ in range(60):
        k = (lo + hi) / 2
        s = sum((1 / q) ** k for _, q in bets)
        if s > E: lo = k
        else: hi = k
    k = (lo + hi) / 2
    return {n: (1 / q) ** k for n, q in bets}, k

def match_names(players, bets):
    """players: lista di nomi FotMob; bets: nomi mercato. Ritorna {indice giocatore: nome mercato}."""
    res, used = {}, set()
    T = [(i, set(norm(p))) for i, p in enumerate(players)]
    B = [(n, set(norm(n))) for n, _ in bets]
    for i, tp in T:
        best, bs = None, 0
        for n, tb in B:
            if n in used: continue
            common = {w for w in tp & tb if len(w) >= 3}
            fl, ml = norm(players[i])[-1], norm(n)[-1]
            ok = fl == ml or len(common) >= 2 or (len(tp) == 1 and tp <= tb) or (len(tb) == 1 and tb <= tp)
            sc = len(common) + (1 if fl == ml else 0)
            if ok and common and sc > bs: best, bs = n, sc
        if not best:  # grafie diverse (Matviyenko/Matvienko, Targhalline/Targhaline)
            fl = norm(players[i])[-1]
            for n, tb in B:
                if n in used: continue
                if len(fl) >= 5 and difflib.SequenceMatcher(None, fl, norm(n)[-1]).ratio() >= 0.85: best = n; break
        if best: res[i] = best; used.add(best)
    return res

def lg(p): p = min(max(p, 1e-4), 1 - 1e-4); return math.log(p / (1 - p))
def ex(z): return 1 / (1 + math.exp(-z))

def slug_for(teams, oc):
    """teams: [nome casa, nome ospite]; oc: lista (slug, bets). Sceglie lo slug con più parole in comune."""
    tw = set(norm(teams[0]) + norm(teams[1]))
    best, bs = None, 0
    for slug, bets in oc:
        sw = set(slug.replace('-', ' ').split())
        sc = len({w for w in tw & sw if len(w) >= 3})
        if sc > bs: best, bs = (slug, bets), sc
    return best

W_MARKET = 0.5  # peso provvisorio del mercato nella media in logit (da ricalibrare con gli esiti)

def blend_match(pl, bets, name_idx=0, p_idx=3, w=W_MARKET):
    """pl: righe export; ritorna lista (p_finale, quota o None, p_mercato o None) per riga."""
    names = [r[name_idx] for r in pl]
    mp = match_names(names, bets)
    # de-vig solo sui titolari abbinati: il mercato redistribuisce, il livello totale resta quello del modello
    # (chi parte dalla panchina ha quote "se gioca", quindi non va contato nel totale)
    E = sum(pl[i][p_idx] for i in mp)
    P, k = devig([(mp[i], dict(bets)[mp[i]]) for i in mp], E) if mp else ({}, 1)
    q = dict(bets)
    out, sh = [], []
    for i, r in enumerate(pl):
        if i in mp:
            pm = P[mp[i]]
            z = (1 - w) * lg(r[p_idx]) + w * lg(pm); sh.append(z - lg(r[p_idx]))
            out.append((ex(z), q[mp[i]], pm))
        else:
            out.append(None)
    # chi non è quotato: stesso spostamento medio di livello della partita
    d = sum(sh) / len(sh) if sh else 0
    out = [o if o else (ex(lg(r[p_idx]) + d), None, None) for o, r in zip(out, pl)]
    return out, k
