"""NBA, doppie e triple doppie: costruisce la tabella giocatore-partita con le variabili note PRIMA della partita.

Uso: python3 bot/nba/dataset.py <cartella nba del ramo dati> <file di uscita .pkl>
Ogni riga = un giocatore entrato in campo in una partita (stagione regolare, play-in, playoff).
Tutte le variabili sono calcolate solo dalle partite precedenti (passata unica in ordine di tempo); fanno eccezione, e sono
segnate, quelle che presuppongono un'informazione disponibile poco prima della palla a due:
  tit        = è nel quintetto (i quintetti escono ~30 minuti prima)
  ass_*      = compagni della rotazione che non giocano questa partita (referto infortuni)
  linea_*    = handicap e totale punti prepartita (ESPN «pickcenter»)

Versione 2 (17/11/2026, vedi RUNBOOK «NBA: banco di prova e modello v2»). Senza opzioni la tabella è IDENTICA a quella di prima
(il modello attuale resta il riferimento); le opzioni aggiungono soltanto:
  universo=True         anche le righe dei giocatori di rotazione che NON sono entrati (gioca=0): servono a P(gioca) e alla prova
                        sull'universo vero di prima della partita. Chi usa il modello attuale deve filtrare gioca == 1.
  lega_per_giorno=True  le medie di lega si aggiornano a fine giornata, non dopo ogni partita: le partite della stessa sera
                        (il 58% ha lo stesso orario di un'altra) non si vedono più fra loro.
Colonne nuove sempre presenti (nessun modello attuale le usa): gioca, ieri, min_ult, min_sd, rientro, pf36, disp, gare7, n_sq_st,
emin_red_gia, emin_red_ass.
"""
import gzip, json, math, os, sys
from collections import defaultdict, deque
import numpy as np, pandas as pd

CAT = ('pts', 'reb', 'ast', 'stl', 'blk')
A_LENTA, A_VELOCE, A_MIN = 0.06, 0.20, 0.25          # pesi delle medie mobili esponenziali
K_STAG = 8                                           # partite «finte» con cui la media di stagione parte dalla media storica

def carica(cartella):
    partite = []
    for f in sorted(os.listdir(cartella)):
        if f.endswith('.json.gz') and f[:4].isdigit():
            st = f[:9]
            for gid, m in json.load(gzip.open(os.path.join(cartella, f), 'rt')).items():
                m['id'] = gid; m['st'] = st; partite.append(m)
    partite.sort(key=lambda m: (m['ts'], m['id']))
    gioc = json.load(open(os.path.join(cartella, 'giocatori.json')))
    return partite, gioc

def ruolo(p):
    p = (p or '').upper()
    return 'C' if 'C' in p else 'F' if 'F' in p else 'G'

class Mobile:
    """media e varianza mobili esponenziali"""
    __slots__ = ('m', 'v', 'n')
    def __init__(self): self.m = None; self.v = 0.0; self.n = 0
    def agg(self, x, a):
        if self.m is None: self.m = float(x)
        else:
            a = max(a, 1.0 / (self.n + 1)); d = x - self.m; self.m += a * d; self.v = (1 - a) * (self.v + a * d * d)
        self.n += 1

def p_almeno10(media, var):
    """P(X >= 10) con una normale (correzione di continuità); la varianza non scende sotto quella di Poisson"""
    if media is None: return 0.0
    sd = math.sqrt(max(var, media, 0.5))
    return 0.5 * math.erfc((9.5 - media) / sd / math.sqrt(2))

def strutturale(ps):
    """da P(categoria >= 10) indipendenti a P(almeno 2) e P(almeno 3)"""
    n = len(ps); d = [1.0] + [0.0] * n
    for p in ps:
        for k in range(n, 0, -1): d[k] = d[k] * (1 - p) + d[k - 1] * p
        d[0] *= (1 - p)
    return 1 - d[0] - d[1], 1 - d[0] - d[1] - d[2]

def costruisci(partite, gioc, universo=False, lega_per_giorno=False):
    G = {}                                            # stato del giocatore
    T = defaultdict(lambda: dict(n=0, ult=None, poss=Mobile(), conc={k: Mobile() for k in ('pts', 'reb', 'ast')}, fatti={k: Mobile() for k in ('pts', 'reb', 'ast')},
                                 rot={}, conc_r={r: {k: Mobile() for k in ('pts', 'reb', 'ast')} for r in 'GFC'}, tss=deque(maxlen=6), nst={}))
    lega = {k: Mobile() for k in ('poss', 'pts', 'reb', 'ast')}
    righe = []; coda_lega = []; giorno_lega = None
    for m in partite:
        st, ts = m['st'], m['ts']; lati = {1: m['h'], 0: m['a']}
        if lega_per_giorno and m.get('g') != giorno_lega:          # giornata nuova: entrano nelle medie di lega le partite del giorno prima
            for k, v in coda_lega: lega[k].agg(v, 0.01)
            coda_lega = []; giorno_lega = m.get('g')
        per_lato = {1: [], 0: []}
        for r in m['p']: per_lato[r[1]].append(r)
        tot = {}
        for L in (0, 1):
            t = m.get('t', {}).get('h' if L else 'a') or {}
            s = lambda i: sum(r[i] for r in per_lato[L])
            fga = t.get('fga') or s(11); fta = t.get('fta') or s(15); oreb = t.get('oreb') or s(16); to = t.get('to') or s(9)
            tot[L] = dict(poss=fga + 0.44 * fta - oreb + to, pts=lati[L][2], reb=t.get('reb') or s(5), ast=t.get('ast') or s(6))
        ctx = {}
        for L in (0, 1):
            tid, oid = lati[L][0], lati[1 - L][0]; a, b = T[tid], T[oid]
            ripo = None if a['ult'] is None else (ts - a['ult']) / 86400
            ripo_avv = None if b['ult'] is None else (ts - b['ult']) / 86400
            if ripo is not None and ripo > 30: ripo = None            # prima partita della stagione
            if ripo_avv is not None and ripo_avv > 30: ripo_avv = None
            # rotazione: chi ha giocato almeno 3 delle ultime 10 partite della squadra con almeno 12 minuti di media
            presenti = {r[0] for r in per_lato[L]}; rot = []
            for pid, (ultime, mm) in a['rot'].items():
                gio = sum(1 for k in ultime if k > a['n'] - 10)
                if gio >= 3 and mm['min'].m is not None and mm['min'].m >= 12: rot.append((pid, mm, (a['n'] in ultime)))
            ass = [(pid, mm, ieri) for pid, mm, ieri in rot if pid not in presenti]
            gia = [(pid, mm) for pid, mm, ieri in rot if not ieri]     # già fuori nella partita precedente della squadra (noto di sicuro prima)
            lin = m.get('linea') or [None, None]; hc = lin[0]; totp = lin[1]
            ctx[L] = dict(ripo=ripo, ripo_avv=ripo_avv, rot=rot, ass=ass, gia=gia,
                          ritmo=a['poss'].m, ritmo_avv=b['poss'].m, ritmo_lega=lega['poss'].m,
                          conc={k: (b['conc'][k].m, lega[k].m) for k in ('pts', 'reb', 'ast')}, conc_r=b['conc_r'],
                          sq={k: a['fatti'][k].m for k in ('pts', 'reb', 'ast')},
                          hc=None if hc is None else (hc if L else -hc), totp=totp,
                          rotd={pid: ieri for pid, mm, ieri in rot}, s_rot=sum(mm['min'].m for _, mm, _ in rot),
                          s_ass=sum(mm['min'].m for _, mm, _ in ass), s_gia=sum(mm['min'].m for _, mm in gia),
                          gare7=sum(1 for t_ in a['tss'] if ts - t_ < 7 * 86400), n_sq_st=a['nst'].get(st, 0))
        for L in (0, 1):
            c = ctx[L]; tid, oid = lati[L][0], lati[1 - L][0]
            elenco = [(r, 1) for r in per_lato[L]]
            if universo and not m.get('futura'):     # di rotazione, ancora di questa squadra, non entrati: riga con gioca=0
                dentro = {r[0] for r in per_lato[L]}
                elenco += [([pid_, L, 0, 0, 0, 0, 0, 0, 0], 0) for pid_ in c['rotd'] if pid_ not in dentro and pid_ in G and G[pid_]['sq'] == tid]
            for r, gioca in elenco:
                pid, _, tit, mn, pts, reb, ast, stl, blk = r[:9]
                val = dict(pts=pts, reb=reb, ast=ast, stl=stl, blk=blk)
                n10 = sum(1 for k in CAT if val[k] >= 10)
                g = G.get(pid); rl = ruolo((gioc.get(str(pid)) or ['', ''])[1])
                riga = dict(id=m['id'], ts=ts, st=st, tipo=m['tipo'], pid=pid, sq=tid, avv=oid, casa=L, ruolo=rl, tit=tit, futura=int(bool(m.get('futura'))),
                            min=mn, pts=pts, reb=reb, ast=ast, stl=stl, blk=blk, dd=int(n10 >= 2), td=int(n10 >= 3), n_prec=0 if g is None else g['n'],
                            gioca=gioca, ieri=int(bool(c['rotd'].get(pid))), gare7=c['gare7'], n_sq_st=c['n_sq_st'])
                if g is not None and g['n'] > 0:
                    ns = g['ns'].get(st, 0); em = g['emin'].m
                    riga.update(n_stag=ns, emin=em, emin_lenta=g['lenta']['min'].m, tit_rec=g['etit'].m, tit_ult=g['tit_ult'],
                                gg_fermo=min((ts - g['ult']) / 86400, 60.0), cambio_sq=int(g['sq'] != tid),
                                dd_lenta=g['dd'].m, td_lenta=g['td'].m, dd_10=float(np.mean(g['u10dd'])), td_10=float(np.mean(g['u10td'])),
                                dd_stag=(g['sdd'].get(st, 0) + K_STAG * g['dd'].m) / (ns + K_STAG), td_stag=(g['std'].get(st, 0) + K_STAG * g['td'].m) / (ns + K_STAG),
                                dd_car=g['cdd'] / g['n'], td_car=g['ctd'] / g['n'])
                    ps = []
                    for k in CAT:
                        lenta, vel = g['lenta'][k], g['vel'][k]; sm = g['ssum'].get((st, k), 0.0)
                        riga[k + '_lenta'] = lenta.m; riga[k + '_vel'] = vel.m; riga[k + '_stag'] = (sm + K_STAG * lenta.m) / (ns + K_STAG)
                        riga[k + '_sd'] = math.sqrt(max(lenta.v, 0.0))
                        # media attesa: tasso al minuto (lento) x minuti attesi (veloci)
                        tasso = g['lenta'][k].m / max(g['lenta']['min'].m, 4.0); att = tasso * em
                        riga[k + '_att'] = att
                        scala = (att / lenta.m) if lenta.m and lenta.m > 0 else 1.0
                        ps.append(p_almeno10(att, lenta.v * scala))
                    riga['u10_min'] = float(np.mean(g['u10min']))
                    for k in ('pts', 'reb', 'ast'): riga[k + '_10'] = float(np.mean(g['u10'][k]))
                    p2, p3 = strutturale(ps); riga['p_dd_strut'] = p2; riga['p_td_strut'] = p3
                    ordn = sorted((riga[k + '_att'] for k in ('pts', 'reb', 'ast')), reverse=True)
                    riga['att_2a'] = ordn[1]; riga['att_3a'] = ordn[2]
                    # v2: minuti più fini e presenza (nessun modello attuale usa queste colonne)
                    fermo = (ts - g['ult']) / 86400
                    riga.update(min_ult=g['min_ult'], min_sd=math.sqrt(max(g['lenta']['min'].v, 0.0)), rientro=0 if fermo > 10 else min(g['rientro'], 10),
                                pf36=36 * g['pf'].m / max(g['lenta']['min'].m, 4.0) if g['pf'].m is not None else None, disp=g['disp'].m)
                    for nome_, s_ in (('gia', c['s_gia']), ('ass', c['s_ass'])):      # minuti attesi se i minuti degli assenti si spartiscono fra i presenti
                        s_ = s_ - (em if (nome_ == 'ass' and not gioca and pid in c['rotd']) else 0)
                        riga['emin_red_' + nome_] = em * min(c['s_rot'] / max(c['s_rot'] - s_, 100.0), 1.5) if c['s_rot'] > 150 else em
                # contesto di squadra
                riga.update(riposo=c['ripo'], riposo_avv=c['ripo_avv'], b2b=None if c['ripo'] is None else int(c['ripo'] < 1.6), b2b_avv=None if c['ripo_avv'] is None else int(c['ripo_avv'] < 1.6),
                            ritmo=c['ritmo'], ritmo_avv=c['ritmo_avv'], ritmo_lega=c['ritmo_lega'], linea_hc=c['hc'], linea_tot=c['totp'], playoff=int(m['tipo'] != 2))
                for k in ('pts', 'reb', 'ast'):
                    a_, l_ = c['conc'][k]; riga['conc_' + k] = None if a_ is None or l_ is None else a_ - l_
                    cr = c['conc_r'][rl][k].m; riga['concr_' + k] = cr
                    riga['sq_' + k] = c['sq'][k]
                # ex di turno: ha giocato almeno 10 partite (in archivio, dal 2020/21) con la squadra avversaria
                exn = 0 if g is None else g['sqn'].get(oid, 0)
                riga['ex'] = int(exn >= 10); riga['ex_n'] = exn; riga['ex_primo'] = int(exn >= 10 and g is not None and oid not in g['exvisti'])
                # riposi: seconde serate di back-to-back in cui poteva giocare (aveva giocato la sera prima) e quante ne ha giocate
                riga['b2b_occ'] = 0 if g is None else g['b2b'][0]; riga['b2b_gio'] = 0 if g is None else g['b2b'][1]
                # assenze dello stesso ruolo (chi gioca al suo posto)
                stesso = [(p_, mm) for p_, mm, _ in c['ass'] if p_ != pid and ruolo((gioc.get(str(p_)) or ['', ''])[1]) == rl]
                riga['assr_n'] = len(stesso)
                for k in ('min', 'reb', 'ast'): riga['assr_' + k] = sum(mm[k].m or 0 for _, mm in stesso)
                for nome, lista in (('ass', [(p_, mm) for p_, mm, _ in c['ass'] if p_ != pid]), ('gia', [(p_, mm) for p_, mm in c['gia'] if p_ != pid])):
                    riga[nome + '_n'] = len(lista)
                    for k in ('min', 'pts', 'reb', 'ast'): riga[f'{nome}_{k}'] = sum(mm[k].m or 0 for _, mm in lista)
                righe.append(riga)
        if m.get('futura'): continue                   # partita ancora da giocare: solo le righe, lo stato non cambia
        # ---- aggiornamento dello stato, DOPO aver scritto le righe ----
        for L in (0, 1):
            tid, oid = lati[L][0], lati[1 - L][0]; a = T[tid]
            if ctx[L]['ripo'] is not None and ctx[L]['ripo'] < 1.6:      # seconda serata di un back-to-back: chi aveva giocato ieri, gioca anche oggi?
                oggi_ = {r[0] for r in per_lato[L]}
                for pid_, (ult_, _) in a['rot'].items():
                    if ult_ and ult_[-1] == a['n'] and pid_ in G: G[pid_]['b2b'][0] += 1; G[pid_]['b2b'][1] += int(pid_ in oggi_)
            for pid_ in ctx[L]['rotd']:                                  # presenza: quante partite della squadra gioca chi è di rotazione
                if pid_ in G and G[pid_]['sq'] == tid: G[pid_]['disp'].agg(int(any(r[0] == pid_ for r in per_lato[L])), 0.1)
            a['n'] += 1; a['ult'] = ts; a['tss'].append(ts); a['nst'][st] = a['nst'].get(st, 0) + 1
            a['poss'].agg((tot[0]['poss'] + tot[1]['poss']) / 2, 0.08)
            for k in ('pts', 'reb', 'ast'): a['fatti'][k].agg(tot[L][k], 0.08); a['conc'][k].agg(tot[1 - L][k], 0.08)
            # concesso per ruolo: somma dei giocatori avversari di quel ruolo
            for rl in 'GFC':
                avv = [r for r in per_lato[1 - L] if ruolo((gioc.get(str(r[0])) or ['', ''])[1]) == rl]
                for k, i in (('pts', 4), ('reb', 5), ('ast', 6)): a['conc_r'][rl][k].agg(sum(r[i] for r in avv), 0.08)
            for r in per_lato[L]:
                pid = r[0]; ult, mm = a['rot'].setdefault(pid, (deque(maxlen=10), {k: Mobile() for k in ('min', 'pts', 'reb', 'ast')}))
                ult.append(a['n']); mm['min'].agg(r[3], 0.2); mm['pts'].agg(r[4], 0.2); mm['reb'].agg(r[5], 0.2); mm['ast'].agg(r[6], 0.2)
                val = dict(min=r[3], pts=r[4], reb=r[5], ast=r[6], stl=r[7], blk=r[8]); n10 = sum(1 for k in CAT if val[k] >= 10)
                g = G.get(pid)
                if g is None:
                    g = G[pid] = dict(n=0, ns={}, ult=ts, sq=tid, min_ult=0, rientro=0, pf=Mobile(), disp=Mobile(), sqn={}, exvisti=set(), b2b=[0, 0], emin=Mobile(), etit=Mobile(), tit_ult=0, dd=Mobile(), td=Mobile(), cdd=0, ctd=0, sdd={}, std={}, ssum={},
                                      lenta={k: Mobile() for k in CAT + ('min',)}, vel={k: Mobile() for k in CAT}, u10dd=deque(maxlen=10), u10td=deque(maxlen=10), u10min=deque(maxlen=10),
                                      u10={k: deque(maxlen=10) for k in ('pts', 'reb', 'ast')})
                g['rientro'] = 0 if (ts - g['ult']) / 86400 > 10 else g['rientro'] + 1
                g['min_ult'] = r[3]; g['pf'].agg(r[18] if len(r) > 18 else 0, A_LENTA)
                st = m['st']; g['n'] += 1; g['ns'][st] = g['ns'].get(st, 0) + 1; g['ult'] = ts; g['sq'] = tid
                g['sqn'][tid] = g['sqn'].get(tid, 0) + 1
                if g['sqn'].get(oid, 0) >= 10: g['exvisti'].add(oid)
                g['emin'].agg(val['min'], A_MIN); g['etit'].agg(r[2], 0.3); g['tit_ult'] = r[2]
                g['dd'].agg(int(n10 >= 2), A_LENTA); g['td'].agg(int(n10 >= 3), A_LENTA); g['cdd'] += int(n10 >= 2); g['ctd'] += int(n10 >= 3)
                g['sdd'][st] = g['sdd'].get(st, 0) + int(n10 >= 2); g['std'][st] = g['std'].get(st, 0) + int(n10 >= 3)
                g['u10dd'].append(int(n10 >= 2)); g['u10td'].append(int(n10 >= 3)); g['u10min'].append(val['min'])
                for k in ('pts', 'reb', 'ast'): g['u10'][k].append(val[k])
                for k in CAT + ('min',): g['lenta'][k].agg(val[k], A_LENTA)
                for k in CAT: g['vel'][k].agg(val[k], A_VELOCE); g['ssum'][(st, k)] = g['ssum'].get((st, k), 0.0) + val[k]
        for k in ('pts', 'reb', 'ast', 'poss'):
            if lega_per_giorno: coda_lega.append((k, (tot[0][k] + tot[1][k]) / 2))
            else: lega[k].agg((tot[0][k] + tot[1][k]) / 2, 0.01)
    return pd.DataFrame(righe)

if __name__ == '__main__':
    src, out = sys.argv[1], sys.argv[2]; v2 = '--v2' in sys.argv      # --v2: universo completo e medie di lega per giorno
    partite, gioc = carica(src)
    D = costruisci(partite, gioc, universo=v2, lega_per_giorno=v2)
    D.to_pickle(out)
    print(f'partite {len(partite)} · righe {len(D)} · stagioni:')
    print(D.groupby('st').agg(partite=('id', 'nunique'), righe=('id', 'size'), dd=('dd', 'sum'), td=('td', 'sum'), playoff=('playoff', 'mean')).to_string())
