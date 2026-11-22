"""NBA: probabilità di doppia doppia e tripla doppia per le partite ancora da giocare, con consigli e accoppiate.

Uso: python3 bot/nba/oggi.py <cartella nba del ramo dati> <oggi_input.json di cloud/nba/oggi.mjs> <uscita oggi.json>
Modello: quello «con il referto infortuni» del RUNBOOK (logistica + alberi, media sul logit), allenato su tutto l'archivio.
Chi è «out» per ESPN non gioca e conta come assenza per i compagni; i «dubbi» sono trattati come presenti e segnati.

Variabile NBA_MODELLO: dal 17/11/2026 pomeriggio il predefinito è v2 (bot/nba/modello2.py, numeri nel RUNBOOK); NBA_MODELLO=v1 = tutto come prima.
Con v2:
  doppia doppia allenata con assenze note a metà, tripla doppia mai sopra la doppia, P(gioca) al posto della regola «rischio riposo»
  (chiave nuova p_gioca; sotto 0,80 il giocatore è segnato «riposo» e resta fuori da giocate e combinazioni), i giocatori «in dubbio»
  fuori da giocate e combinazioni, «quota alta» = i più probabili a quota 3 o più (non più il «valore» p × quota più alto).
In uscita, sempre: modello {versione, commit}, quote_ora (istante in cui le quote sono state lette).
"""
import json, os, sys, itertools
import numpy as np, pandas as pd
sys.path.insert(0, __file__.rsplit('/', 1)[0])
from dataset import carica, costruisci
from prova import prepara, colonne, gbm, logit_, LG, GRUPPI
from mercato import norm, abbina

# dal 17/11/2026 pomeriggio v2 è il predefinito (variabile vuota o assente = v2); NBA_MODELLO=v1 torna al modello di prima
V2 = (os.environ.get('NBA_MODELLO') or 'v2').strip().lower() != 'v1'


# Combinazioni: per ogni fascia di quota, la combinazione PIÙ PROBABILE che paga almeno quella quota.
# Gambe = doppia doppia o tripla doppia di giocatori di partite diverse (indipendenti: vedi RUNBOOK), 2 o 3 gambe; quota = prodotto delle singole.
# dal 18/11/2026 (scelta dell'utente): niente più «Sicura» e «Media»; per le giocate sicure ci sono le tre giocate della notte e il Calcolatore
FASCE = (('Alta', 10), ('Altissima', 30), ('Colpo grosso', 100))
TIPI = [n for n, _ in FASCE] + ['Con una tripla doppia', 'Due triple doppie']
LIMITE = 2
# «quota bassa» dal 19/11/2026: fra 1,70 e 2,50 (prima sotto 2,00). Richiesta del proprietario: a 1,08-1,30 il guadagno è quasi nullo.
BASSA = (1.70, 2.50)          # dal 18/11/2026: lo stesso giocatore al massimo in 2 combinazioni (se salta lui, saltano al massimo due proposte)
CAMPI_GAMBA = ('n', 'id', 'sq', 'partita', 'cosa', 'p', 'q', 'dubbio', 'ex')

def combinazioni(tutti, fisse=None):
    """fisse: {tipo: combinazione} già decise (proposte del pomeriggio ancora valide); le altre fasce si riempiono intorno a loro,
    senza ripeterle e rispettando LIMITE anche contando i giocatori delle fisse."""
    fisse = fisse or {}; gambe = []
    for g in tutti:
        if g.get('riposo'): continue
        base = dict(n=g['n'], id=g.get('id'), sq=g['sq'], partita=g['partita'], dubbio=g.get('dubbio', 0), ex=g.get('ex', 0))
        if g.get('q_dd') and g['p_dd'] >= 0.08: gambe.append(dict(base, cosa='dd', p=g['p_dd'], q=g['q_dd']))
        if g.get('q_td') and g['p_td'] >= 0.03: gambe.append(dict(base, cosa='td', p=g['p_td'], q=g['q_td']))
    gambe = sorted(gambe, key=lambda x: -x['p']); tutte_gambe = list(gambe); gambe = gambe[:40]; cand = []
    for k in (2, 3):
        for c in itertools.combinations(gambe, k):
            if len({x['partita'] for x in c}) < k: continue
            cand.append((float(np.prod([x['p'] for x in c])), float(np.prod([x['q'] for x in c])), c))
    visti, conta = set(), {}
    def registra(legs):
        visti.add(frozenset((x['n'], x['cosa']) for x in legs))
        for x in legs: conta[x['n']] = conta.get(x['n'], 0) + 1
    for f in fisse.values(): registra(f['gambe'])
    def scegli(nome, buone):
        for p, q, c in buone:
            if frozenset((x['n'], x['cosa']) for x in c) in visti or any(conta.get(x['n'], 0) >= LIMITE for x in c): continue
            registra(c); return dict(tipo=nome, p=round(p, 4), q=round(q, 2), gambe=[{a: x[a] for a in CAMPI_GAMBA if a in x} for x in c])
    fasce = []
    for i, (nome, minimo) in enumerate(FASCE):
        tetto = FASCE[i + 1][1] if i + 1 < len(FASCE) else 1e9
        fasce.append((nome, lambda c, a=minimo, b=tetto: a <= c[1] < b, lambda c: (-c[0], len(c[2]))))
    # con le triple doppie (le più probabili non ne contengono mai: sono le quote col margine più alto): la più probabile con una tripla, e con due
    for nome, quante in (('Con una tripla doppia', 1), ('Due triple doppie', 2)):
        fasce.append((nome, lambda c, n=quante: len(c[2]) == 2 and sum(x['cosa'] == 'td' for x in c[2]) == n, lambda c: -c[0]))
    out = []
    for nome, filtro, ordine in fasce:
        if nome in fisse: out.append(fisse[nome]); continue
        r = scegli(nome, sorted([c for c in cand if filtro(c)], key=ordine))
        if r: out.append(r)
    for c in out: alternative(c, tutte_gambe, dict(FASCE).get(c['tipo']))
    return out

def alternative(c, tutte_gambe, minimo=None, quante=3):
    """Per ogni gamba, i migliori sostituti dello stesso tipo (DD con DD, TD con TD): giocatori non già nella combinazione, di partite
    diverse dalle altre gambe, in ordine di probabilità; con la combinazione che ne verrebbe fuori (cp, cq). Solo informazione: il
    limite per giocatore non vale qui. Prima chi lascia la combinazione nella sua fascia di quota (quota ≥ minimo), poi gli altri."""
    nomi = {x['n'] for x in c.get('gambe', [])}
    for i, g in enumerate(c.get('gambe', [])):
        altre = {x['partita'] for j, x in enumerate(c['gambe']) if j != i}
        alt = [x for x in tutte_gambe if x['cosa'] == g['cosa'] and x['n'] not in nomi and x['partita'] not in altre]
        if minimo: alt = sorted(alt, key=lambda x: (c['q'] / g['q'] * x['q'] < minimo, -x['p']))
        alt = alt[:quante]
        g['alt'] = [dict(n=x['n'], id=x.get('id'), sq=x['sq'], partita=x['partita'], p=round(x['p'], 4), q=x['q'],
                         cp=round(c['p'] / g['p'] * x['p'], 4) if g['p'] else None, cq=round(c['q'] / g['q'] * x['q'], 2)) for x in alt]

def controllo(V, C, tutti, tutti_tutti, stato_nome, congelati=()):
    """Controllo delle 23:30 (dal 19/11/2026): le proposte del pomeriggio sono «probabili»; qui diventano ufficiali.
    Con gli infortuni e le quote appena riletti:
    - una combinazione del pomeriggio resta solo se tutti i suoi giocatori giocano e la quota nuova sta ancora nella fascia del suo titolo
      (Alta 10-30, Altissima 30-100, Colpo grosso da 100), con probabilità e quota aggiornate;
    - se la quota è scesa o salita fuori fascia, la combinazione passa al titolo della fascia in cui è finita, se quel titolo ha perso la sua
      e se non è meno probabile della nuova che il modello proporrebbe lì (es. Colpo grosso sceso a 32 → Altissima);
      i titoli rimasti vuoti si riempiono con combinazioni nuove;
    - Con una / Due triple doppie restano se tutti giocano;
    - le giocate singole restano se il giocatore gioca e la quota sta nella sua fascia (bassa da 1,70 a 2,50, alta da 3), altrimenti si prende la prima nuova.
    Le proposte vecchie non si mostrano più (niente «sostituita»): fino alle 23:30 la pagina dice che sono probabili.
    Se il controllo si rifà sulla pagina già ufficiale, la regola è la stessa: ciò che è ancora valido resta.
    congelati (22/11/2026): i giocatori delle partite già cominciate, presi così com'erano nella pagina; le proposte che li contengono restano
    (con le loro probabilità e quote di allora), ma non entrano in combinazioni nuove."""
    validi = {g['n']: g for g in list(congelati) + list(tutti)}; minimo = dict(FASCE)
    fascia = {n: (m, FASCE[i + 1][1] if i + 1 < len(FASCE) else 1e9) for i, (n, m) in enumerate(FASCE)}
    def rinfresca(c):
        if not c.get('gambe') or c['tipo'] not in TIPI or any(x['n'] not in validi for x in c['gambe']): return None
        k = {a: b for a, b in c.items() if a not in ('prima', 'motivo', 'q_prima', 'nessuna')}; k['gambe'] = []
        for x in c['gambe']:
            g = validi[x['n']]; q = g.get('q_' + x['cosa']) or x['q']
            k['gambe'].append(dict({a: b for a, b in x.items() if a != 'alt'}, p=round(float(g['p_' + x['cosa']]), 4), q=q))
        k['p'] = round(float(np.prod([x['p'] for x in k['gambe']])), 4); k['q'] = round(float(np.prod([x['q'] for x in k['gambe']])), 2)
        return k
    vecchio = V.get('consigli') or {}
    vive = [k for k in (rinfresca(c) for c in vecchio.get('combinazioni', [])) if k]
    # 1) ogni titolo tiene la sua combinazione se è ancora nella sua fascia
    fisse = {k['tipo']: k for k in vive if k['tipo'] not in minimo or fascia[k['tipo']][0] <= k['q'] < fascia[k['tipo']][1]}
    nuove = combinazioni(tutti, fisse)
    # 2) un titolo che l'ha persa prende una combinazione del pomeriggio finita nella sua fascia (es. Colpo grosso sceso a 32 → Altissima),
    #    ma solo se ha probabilità almeno pari a quella nuova che il modello proporrebbe: una quota crollata vuol dire che il mercato sa
    #    qualcosa che il modello non sa, e di solito la combinazione scalata è peggiore (18/11: Lendeborg + Thompson TD a 42,90, 0,9%,
    #    contro 4,5% della nuova Altissima a 30,13)
    scalate = {}
    for tipo, _ in FASCE:
        if tipo in fisse: continue
        a, b = fascia[tipo]; fresca = next((c for c in nuove if c['tipo'] == tipo), None)
        dentro = [k for k in vive if k['tipo'] in minimo and k['tipo'] not in fisse and id(k) not in {id(x) for x in scalate.values()} and a <= k['q'] < b]
        if dentro:
            k = max(dentro, key=lambda k: k['p'])
            if fresca is None or k['p'] >= fresca['p']: scalate[tipo] = k
    if scalate:
        fisse.update({t: dict(k, tipo=t) for t, k in scalate.items()})
        nuove = combinazioni(tutti, fisse)
    nuove.sort(key=lambda c: TIPI.index(c['tipo']) if c['tipo'] in TIPI else 99)
    C['combinazioni'] = nuove
    for k, y, ok in (('bassa', 'dd', lambda q: BASSA[0] <= q < BASSA[1]), ('alta', 'dd', lambda q: q >= 3.0), ('td', 'td', lambda q: True)):
        v = (vecchio.get(k) or [None])[0]
        if not v or v.get('nessuna') or v.get('n') not in validi: continue
        g = validi[v['n']]; q = g.get('q_' + y) or v.get('q_' + y)
        if q and not ok(q): continue
        v = {a: b for a, b in v.items() if a not in ('prima', 'motivo', 'q_prima_dd', 'q_prima_td')}
        for z in ('dd', 'td'):
            v['p_' + z] = g['p_' + z]
            if g.get('q_' + z): v['q_' + z], v['b_' + z] = g['q_' + z], g['b_' + z]
        C[k] = [v] + [x for x in C.get(k, []) if x['n'] != v['n']][:2]
    return C

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
    partite, gioc = carica(cartella); I = json.load(open(f_in)); stato = {}; nomi = {}; quote_ora = I.get('quote_creato')
    # storico per la pagina (20/11/2026): partite, doppie e triple doppie di questa stagione e della precedente, ultime 5 righe punti-rimbalzi-assist
    st_ora = f"{I['partite'][0]['anno'] - 1}-{I['partite'][0]['anno']}" if I['partite'] else None
    st_prima = f"{int(st_ora[:4]) - 1}-{st_ora[:4]}" if st_ora else None
    sto, ult5 = {}, {}
    for Pg in sorted(partite, key=lambda x: x['ts']):
        if Pg['st'] not in (st_ora, st_prima): continue
        for r in Pg['p']:
            if r[3] <= 0: continue
            c10 = sum(1 for x in r[4:9] if x >= 10); a = sto.setdefault(r[0], {}).setdefault(Pg['st'], [0, 0, 0])
            a[0] += 1; a[1] += c10 >= 2; a[2] += c10 >= 3
            if Pg['st'] == st_ora: ult5.setdefault(r[0], []).append([r[4], r[5], r[6], r[3]]); ult5[r[0]] = ult5[r[0]][-5:]
    V_stessa = None
    if f_quote:                                        # rifacimento della stessa notte: le quote si riprendono dalla pagina già pubblicata
        V = json.load(open(f_quote)); vecchie = {str(P['id']): P for P in V.get('partite', [])} if V.get('giorno') == I['giorno'] else {}
        if V.get('giorno') == I['giorno'] and V.get('consigli'): V_stessa = V
        if vecchie and not quote_ora: quote_ora = V.get('quote_ora') or V.get('creato')          # quote riusate: vale l'ora in cui erano state lette
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
    if V2:
        import modello2 as M2
        U = M2.prepara2(costruisci(partite, gioc, universo=True, lega_per_giorno=True)); U = U[U.n_prec >= 5].sort_values('ts').reset_index(drop=True)
        D = U[U.gioca == 1]; tr, te = D[D.futura == 0], D[D.futura == 1].copy()                    # D: chi è entrato in campo + le partite da giocare
        te['p_dd'], te['p_td'] = M2.prevedi(tr, te)
        te['p_gioca'] = np.nan; m = (te.ieri == 1) & (te.emin >= 12)                              # P(gioca): solo per chi era in campo nella partita prima
        if m.any(): te.loc[m, 'p_gioca'] = M2.prevedi_gioca(M2.universo_gioca(U[U.futura == 0]), te[m])
    else:
        D = prepara(costruisci(partite, gioc)); tr, te = D[D.futura == 0], D[D.futura == 1].copy()
        c = [x for x in colonne('assenze del giorno') if x not in GRUPPI['linea prepartita']]
        for y in ('dd', 'td'):
            a = gbm(y == 'td').fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]; b = logit_().fit(tr[c], tr[y].values).predict_proba(te[c])[:, 1]
            te['p_' + y] = 1 / (1 + np.exp(-(LG(a) + LG(b)) / 2))
    # triple segnate (20/11/2026, prova): media attesa e P(almeno k) per ogni giocatore di stanotte, vedi triple.py
    try:
        import triple as T3
        tr3 = tr[tr.emin.notna() & (tr.n_prec >= 5)]; m3, a3 = T3.adatta(tr3); mu3, P3 = T3.prevedi(m3, a3, te)
        te['mu3'] = mu3; te['p3'] = [list(np.round(r_[:7], 4)) for r_ in P3]; print(f'triple: allenamento {len(tr3)} righe, dispersione {a3:.3f}')
    except Exception as e:
        print('triple: modello non disponibile:', e); te['mu3'] = np.nan; te['p3'] = None
    out = dict(giorno=I['giorno'], creato=I['creato'], modello=dict(versione='v2' if V2 else 'v1', commit=os.environ.get('GITHUB_SHA', '')[:7]), partite=[]); tutti = []
    if quote_ora: out['quote_ora'] = quote_ora
    out['proposte_ora'] = I['creato']
    # 22/11/2026: il controllo della sera si fa anche se qualche partita è già cominciata (sabato e domenica ce n'è spesso una nel
    # pomeriggio americano, e prima il controllo saltava: le partite della notte restavano senza quote). Il calendario ESPN contiene
    # solo le partite da giocare: quelle già cominciate si riprendono intere dalla pagina pubblicata, senza toccarle.
    cominciate = []
    if V_stessa:
        nuove_id = {str(P['id']) for P in I['partite']}
        cominciate = [P for P in V_stessa.get('partite', []) if str(P['id']) not in nuove_id]
        if cominciate: print('partite già cominciate, riprese dalla pagina pubblicata:', ', '.join(f"{P['a']['sigla']} @ {P['h']['sigla']}" for P in cominciate))
    for P in I['partite']:
        Z = te[te.id == P['id']]; per_nome = {norm(nomi[p]): p for p in Z.pid}
        q = {'dd': {}, 'td': {}}
        for y in ('dd', 'td'):
            for bk, d in P['quote'][y].items():
                for nome, prezzo in d.items():
                    pid = per_nome.get(abbina(nome, per_nome) or '')
                    if pid is None: continue
                    # l'utente gioca in Italia: vale la quota migliore fra i bookmaker italiani; quelli americani solo se in Italia non è quotato
                    it = bk.endswith('.it'); vecchia = q[y].get(pid)
                    if vecchia is None or (it and not vecchia[2]) or (it == vecchia[2] and prezzo > vecchia[0]): q[y][pid] = (prezzo, bk.replace('.it', ''), it)
        q3 = {}                                           # triple: linea → giocatore → (quota, bookmaker), la migliore fra gli italiani
        for lin, per_bk in (P['quote'].get('tre') or {}).items():
            for bk, d in per_bk.items():
                if not bk.endswith('.it'): continue
                for nome, prezzo in d.items():
                    pid = per_nome.get(abbina(nome, per_nome) or '')
                    if pid is None: continue
                    v_ = q3.setdefault(lin, {}).get(pid)
                    sis = prezzo if bk == 'sisal.it' else (v_[2] if v_ else None)
                    if v_ is None or prezzo > v_[0]: q3[lin][pid] = (prezzo, bk.replace('.it', ''), sis)
                    else: q3[lin][pid] = (v_[0], v_[1], sis)     # terzo campo: quota Sisal (il sistema integrale si gioca tutto sullo stesso bookmaker)
        G = []
        for r in Z.itertuples():
            if r.emin < 12 or r.gg_fermo > 30: continue
            g = dict(id=int(r.pid), n=nomi[r.pid], sq=P['h'][1] if r.casa else P['a'][1], ruolo=r.ruolo, dubbio=int(stato[r.pid][0] == 'dubbio'), min=round(r.emin, 1), pts=round(r.pts_stag, 1), reb=round(r.reb_stag, 1), ast=round(r.ast_stag, 1),
                     p_dd=round(float(r.p_dd), 4), p_td=round(float(r.p_td), 4))
            # etichette: ex di turno; seconda serata di back-to-back per uno che di solito la salta; minuti in crescita
            if r.ex: g['ex'] = 1
            if V2:
                if r.p_gioca == r.p_gioca:                     # non NaN
                    g['p_gioca'] = round(float(r.p_gioca), 3)
                    if r.p_gioca < M2.SOGLIA_GIOCA: g['riposo'] = 1
            elif r.b2b == 1 and r.b2b_occ >= 4 and r.b2b_gio / r.b2b_occ < 0.6: g['riposo'] = 1
            if r.emin - r.emin_lenta >= 4: g['su'] = round(float(r.emin - r.emin_lenta), 1)
            s_ = sto.get(r.pid, {}); g['sto'] = s_.get(st_ora, [0, 0, 0]) + s_.get(st_prima, [0, 0, 0])    # [partite, DD, TD] quest'anno + anno scorso
            if r.pid in ult5: g['u5'] = ult5[r.pid]                                                       # ultime 5: [pt, rb, as, min]
            for y in ('dd', 'td'):
                if r.pid in q[y]: g['q_' + y], g['b_' + y] = q[y][r.pid][:2]; g['v_' + y] = round(g['p_' + y] * g['q_' + y], 3)
            if r.p3 is not None and r.mu3 == r.mu3:
                g['t3'] = dict(mu=round(float(r.mu3), 2), p=[float(x) for x in r.p3])                   # p[k-1] = P(almeno k triple)
                lq = {lin: list(d[r.pid]) for lin, d in q3.items() if r.pid in d}
                if lq: g['q3'] = lq                                                                       # linea («2.5») → [quota, bookmaker]
            G.append(g); tutti.append(dict(g, partita=P['id']))
        G.sort(key=lambda g: -g['p_dd'])
        cand = {k: next((g['n'] for g in G if g['sq'] == P[k][1]), None) for k in ('h', 'a')}
        fuori = {}
        # assenti che contano: «out» con almeno 15 minuti di media nell'ultima stagione giocata
        ult = D[D.futura == 0].groupby('pid').emin.last()
        for k in ('h', 'a'):
            fuori[k] = [dict(n=n_, perche=pc, **sostituto(partite, P[k][0], pid, {g_['id'] for g_ in G}, nomi)) for pid, n_, _, st, pc in P['rosa'][k] if st == 'out' and ult.get(pid, 0) >= 15]
        out['partite'].append(dict(id=P['id'], **({'fx': P['fx']} if P.get('fx') else {}), ts=P['ts'], h=dict(sigla=P['h'][1], nome=P['h'][2]), a=dict(sigla=P['a'][1], nome=P['a'][2]), giocatori=G[:14], tre=[{k_: g_[k_] for k_ in ('id', 'n', 'sq', 't3', 'q3', 'dubbio', 'riposo', 'min') if k_ in g_} for g_ in sorted([g_ for g_ in G if g_.get('t3') and (g_.get('q3') or g_['t3']['mu'] >= 1.5)], key=lambda g_: -g_['t3']['mu'])[:12]], candidati=cand, fuori=fuori, quote=int(bool(q['dd']))))
    out['partite'] = sorted(cominciate + out['partite'], key=lambda P: P['ts'])
    congelati = [dict(g, partita=P['id']) for P in cominciate for g in P['giocatori']]
    tutti_tutti = list(tutti)
    tutti = [g for g in tutti if not g.get('riposo')]          # chi rischia il turno di riposo non entra in giocate e combinazioni
    if V2: tutti = [g for g in tutti if not g.get('dubbio')]   # v2: nemmeno chi è «in dubbio» (nelle prime notti misurate salta la partita 4 volte su 10)
    con = [g for g in tutti if 'q_dd' in g]
    breve = lambda g: {k: g[k] for k in ('n', 'id', 'partita', 'sq', 'p_dd', 'p_td', 'q_dd', 'b_dd', 'v_dd', 'q_td', 'b_td', 'v_td', 'dubbio', 'ex', 'su') if k in g}
    C = dict(
        bassa=[breve(g) for g in sorted([g for g in con if BASSA[0] <= g['q_dd'] < BASSA[1]], key=lambda g: -g['p_dd'])[:3]],
        # v1: il «valore» p × quota più alto. v2: i più probabili (il valore più alto sceglie i casi in cui il modello contraddice di più il mercato, e lì sbaglia più spesso)
        alta=[breve(g) for g in sorted([g for g in con if g['q_dd'] >= 3.0 and g['p_dd'] >= 0.10], key=lambda g: -(g['p_dd'] if V2 else g['v_dd']))[:3]],
        td=[breve(g) for g in sorted([g for g in tutti if g['p_td'] >= 0.03], key=lambda g: -g['p_td'])[:4]])
    if not con: C['bassa'] = [breve(g) for g in sorted(tutti, key=lambda g: -g['p_dd'])[:3]]
    C['combinazioni'] = combinazioni(tutti)
    if V_stessa:                                               # controllo delle 23:30 sulla stessa notte (vedi controllo)
        stato_nome = {nomi[p_]: st for p_, (st, _) in stato.items() if p_ in nomi}
        C = controllo(V_stessa, C, tutti, tutti_tutti, stato_nome, congelati)
    if os.environ.get('NBA_UFFICIALE') == '1' or (V_stessa or {}).get('ufficiale'): out['ufficiale'] = 1
    out['consigli'] = C
    out['ieri'] = diario(partite, gioc, D)
    if V2: assert all(g['p_td'] <= g['p_dd'] for P in out['partite'] for g in P['giocatori']), 'P(TD) > P(DD)'
    json.dump(out, open(f_out, 'w'), ensure_ascii=False)
    for P in out['partite']:
        print(f"\n{P['a']['sigla']} @ {P['h']['sigla']}  ·  fuori: {', '.join(x['n'] for k in 'ha' for x in P['fuori'][k]) or '-'}")
        for g in P['giocatori'][:5]: print(f"   {g['n']:26s} {g['sq']:4s} DD {g['p_dd']:.0%}  TD {g['p_td']:.1%}  quota DD {g.get('q_dd', '-')} {g.get('b_dd', '')}  valore {g.get('v_dd', '-')}")
    print('\nconsigli:', json.dumps(C, ensure_ascii=False)[:1500])

if __name__ == '__main__':
    if sys.argv[1] == '--ricombina': ricombina(sys.argv[2])
    else: main(*[x for x in sys.argv[1:5] if x])
