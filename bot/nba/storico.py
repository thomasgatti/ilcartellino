"""NBA: come stanno andando le proposte della pagina, tipo per tipo (18/11/2026).

Uso: python3 bot/nba/storico.py <cartella nba del ramo dati> <uscita nba/storico.json> [--pagina file.json ...]
Per ogni notte prende l'ultima fotografia del registro scritta prima della prima palla a due (bot/nba/rapporto.py: quella che
si poteva davvero leggere e giocare) e la confronta con i tabellini in archivio. Una proposta conta solo quando tutte le sue
partite sono in archivio. Chi non scende in campo: gamba annullata (quota 1), come fanno di solito i bookmaker italiani;
se tutte le gambe sono annullate la giocata è rimborsata. Resa = guadagno netto giocando 1 € su ogni proposta, alle quote in pagina.
"""
import json, os, sys
from collections import OrderedDict
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from rapporto import esiti, fotografie
from mercato import norm, abbina

GIOCATE = (('bassa', 'dd', 'Doppia doppia · quota bassa'), ('alta', 'dd', 'Doppia doppia · quota alta'), ('td', 'td', 'Tripla doppia'))
COMBO = ('Alta', 'Altissima', 'Colpo grosso', 'Con una tripla doppia', 'Due triple doppie')

def valuta(O, E, gioc):
    """notte → elenco di (tipo, p, q, esito) con esito 'si' / 'no' / 'rimborso' e quota pagata"""
    part = {}
    for P in O['partite']:
        for g in P['giocatori']: part.setdefault(g['n'], (str(P['id']), g.get('id')))
    def gamba(n, cosa, partita=None, pid=None):
        pa, pi = part.get(n, (None, None)); pa = str(partita or pa or ''); pid = pid or pi
        es = E.get(pa)
        if es is None: return None                                   # partita non ancora in archivio
        if pid not in es:
            nomi = {norm(gioc[str(p)][0]): p for p in es if str(p) in gioc}; pid = nomi.get(abbina(n, nomi) or '')
        if pid not in es: return 'ng'
        return 'si' if es[pid][1 if cosa == 'td' else 0] else 'no'
    out, C = [], O.get('consigli') or {}
    for k, y, nome in GIOCATE:
        g = (C.get(k) or [None])[0]
        if not g or not g.get('n') or not g.get('q_' + y): continue
        e = gamba(g['n'], y, g.get('partita'), g.get('id'))
        if e is None: continue
        out.append((nome, g['p_' + y], g['q_' + y], 'rimborso' if e == 'ng' else e, g['q_' + y] if e == 'si' else 1 if e == 'ng' else 0))
    for c in C.get('combinazioni') or []:
        if c.get('tipo') not in COMBO or not c.get('gambe'): continue
        es = [gamba(x['n'], x['cosa'], x.get('partita'), x.get('id')) for x in c['gambe']]
        if any(e is None for e in es): continue
        if 'no' in es: out.append((c['tipo'], c['p'], c['q'], 'no', 0)); continue
        if all(e == 'ng' for e in es): out.append((c['tipo'], c['p'], c['q'], 'rimborso', 1)); continue
        pag = 1.0
        for x, e in zip(c['gambe'], es): pag *= x['q'] if e == 'si' else 1
        out.append((c['tipo'], c['p'], c['q'], 'si', round(pag, 2)))
    return out

def main(cartella, f_out, pagine=()):
    """incrementale: le notti già in storico.json restano come sono; si aggiungono solo notti nuove con tutte le partite in archivio"""
    E, gioc = esiti(cartella); N = fotografie(cartella)
    for f in pagine:
        try: O = json.load(open(f)); N.setdefault(str(O['giorno']), O)
        except (OSError, ValueError, KeyError): pass
    S = json.load(open(f_out)) if os.path.exists(f_out) else {}
    voci = S.get('voci', {})
    for g in sorted(N):
        if g in voci or not N[g].get('partite'): continue
        if any(str(P['id']) not in E for P in N[g]['partite']): continue      # notte non ancora tutta in archivio
        V = valuta(N[g], E, gioc)
        if V: voci[g] = [list(v) for v in V]
    tipi = OrderedDict((n, dict(tipo=n, giocate=0, prese=0, rimborsi=0, p=0.0, incassato=0.0)) for _, _, n in GIOCATE)
    for n in COMBO: tipi[n] = dict(tipo=n, giocate=0, prese=0, rimborsi=0, p=0.0, incassato=0.0)
    for g in sorted(voci):
        for tipo, p, q, e, pag in voci[g]:
            if tipo not in tipi: continue
            t = tipi[tipo]; t['giocate'] += 1; t['p'] += p; t['incassato'] += pag; t['prese'] += e == 'si'; t['rimborsi'] += e == 'rimborso'
    righe = [dict(tipo=t['tipo'], giocate=t['giocate'], prese=t['prese'], rimborsi=t['rimborsi'], attese=round(t['p'], 2), resa=round(t['incassato'] - t['giocate'], 2))
             for t in tipi.values() if t['giocate']]
    notti = sorted(voci)
    json.dump(dict(notti=len(notti), dal=notti[0] if notti else None, al=notti[-1] if notti else None, tipi=righe, voci=voci), open(f_out, 'w'), ensure_ascii=False)
    for r in righe: print(f"{r['tipo']:28s} {r['prese']}/{r['giocate']} (attese {r['attese']}) rimborsi {r['rimborsi']} resa {r['resa']:+.2f} €")
    print('notti:', ', '.join(notti) or 'nessuna')

if __name__ == '__main__':
    a = sys.argv[1:]; pagine = [a[i + 1] for i, x in enumerate(a) if x == '--pagina']; resto = [x for i, x in enumerate(a) if x != '--pagina' and (i == 0 or a[i - 1] != '--pagina')]
    main(resto[0], resto[1], pagine)
