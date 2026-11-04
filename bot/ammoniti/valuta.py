"""Valutazione a fine giornata: modello vs mercato vs media, e peso ottimale delle quote.

Uso:
  python3 valuta.py <export.json> <quote.txt> <ammoniti.json> [etichetta]
    export.json  : export coppe (cupExport3, righe [nome, lato, ruolo, p, ...]) oppure Serie A (tmp/saNN.json, p se titolare in r[7])
    quote.txt    : file Oddschecker "slug|Nome:quota;..."
    ammoniti.json: {"<id partita>": {"titolari": ["Nome FotMob", ...] (opzionale), "ammoniti": ["Nome FotMob", ...]}}
                   (nomi come in FotMob; i titolari servono per escludere chi non ha giocato)
Scrive una riga per giocatore in data/quote/valutazione.jsonl e stampa:
  log loss di modello, mercato e media; calibrazione per fasce; tris (primi 3) azzeccati; peso del mercato che minimizza
  la log loss su TUTTE le righe accumulate finora (con avviso se le righe sono poche).
"""
import json, sys, math, pathlib, datetime
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from market_blend import load_oc, slug_for, match_names, devig, lg, ex, norm

BASE = pathlib.Path(__file__).parent
LOG = BASE / 'data' / 'quote' / 'valutazione.jsonl'


def ll(p, y):
    p = min(max(p, 1e-4), 1 - 1e-4)
    return -(y * math.log(p) + (1 - y) * math.log(1 - p))


def rows_from_export(exp, OC, esiti, tag):
    out = []
    for e in exp:
        teams = [t[1] for t in e['teams']]
        ok = esiti.get(str(e['id']))
        if not ok:
            continue
        sa = len(e['pl'][0]) >= 9 and isinstance(e['pl'][0][8], list)  # export Serie A (saFinal)
        pl = [[r[0], (r[7] if sa else r[3])] for r in e['pl']]
        if sa:
            pl = [x for x, r in zip(pl, e['pl']) if r[6] >= 50]
        tit = {norm(n)[-1] + '|' + ' '.join(norm(n)) for n in ok.get('titolari', [])}
        boo = [' '.join(norm(n)) for n in ok.get('ammoniti', [])]
        sb = slug_for(teams, OC) if OC else None
        mk = {}
        if sb:
            names = [x[0] for x in pl]
            mp = match_names(names, sb[1])
            E = sum(pl[i][1] for i in mp)
            P, _ = devig([(mp[i], dict(sb[1])[mp[i]]) for i in mp], E) if mp else ({}, 1)
            mk = {i: P[mp[i]] for i in mp}
        for i, (n, p) in enumerate(pl):
            nn = ' '.join(norm(n))
            if tit and not any(nn == t.split('|', 1)[1] or norm(n)[-1] == t.split('|')[0] for t in tit):
                continue
            y = 1 if any(nn == b or norm(n)[-1] == b.split()[-1] for b in boo) else 0
            pm = mk.get(i)
            out.append({'tag': tag, 'match': e['id'], 'partita': ' - '.join(teams), 'n': n, 'p_mod': round(p, 4),
                        'p_mkt': round(pm, 4) if pm is not None else None, 'y': y})
    return out


def report(R, title):
    if not R:
        print(title, ': nessuna riga'); return
    both = [r for r in R if r['p_mkt'] is not None]
    print(f"\n== {title}: {len(R)} titolari, {sum(r['y'] for r in R)} ammoniti, {len(both)} con quota ==")
    print(f"log loss modello {sum(ll(r['p_mod'], r['y']) for r in R) / len(R):.4f}")
    if both:
        for w in (0, .25, .5, .75, 1):
            L = sum(ll(ex((1 - w) * lg(r['p_mod']) + w * lg(r['p_mkt'])), r['y']) for r in both) / len(both)
            print(f"  peso mercato {w:.2f}: log loss {L:.4f}")
    for lo, hi in ((0, .1), (.1, .15), (.15, .2), (.2, .25), (.25, 1)):
        s = [r for r in R if lo <= r['p_mod'] < hi]
        if s:
            print(f"  fascia {lo:.2f}-{hi:.2f}: {len(s)} giocatori, previsti {sum(r['p_mod'] for r in s):.1f}, veri {sum(r['y'] for r in s)}")
    by = {}
    for r in R:
        by.setdefault(r['match'], []).append(r)
    t3m = sum(sum(x['y'] for x in sorted(v, key=lambda x: -x['p_mod'])[:3]) for v in by.values())
    print(f"  ammoniti tra i primi 3 del modello: {t3m} su {3 * len(by)} caselle ({len(by)} partite)")
    vb = [v for v in by.values() if all(x['p_mkt'] is not None for x in v[:1])]
    if vb:
        t3k = sum(sum(x['y'] for x in sorted([x for x in v if x['p_mkt'] is not None], key=lambda x: -x['p_mkt'])[:3]) for v in vb)
        print(f"  ammoniti tra i primi 3 del mercato: {t3k} su {3 * len(vb)} caselle")


def best_weight(R):
    both = [r for r in R if r['p_mkt'] is not None]
    if not both:
        return None, 0
    best = min((sum(ll(ex((1 - w) * lg(r['p_mod']) + w * lg(r['p_mkt'])), r['y']) for r in both), w) for w in [i / 20 for i in range(21)])
    return best[1], len(both)


def main():
    exp = json.load(open(sys.argv[1]))
    OC = load_oc(sys.argv[2]) if sys.argv[2] != '-' else None
    esiti = json.load(open(sys.argv[3]))
    tag = sys.argv[4] if len(sys.argv) > 4 else datetime.date.today().isoformat()
    R = rows_from_export(exp, OC, esiti, tag)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    old = [json.loads(l) for l in open(LOG)] if LOG.exists() else []
    old = [r for r in old if not (r['tag'] == tag and r['match'] in {x['match'] for x in R})]
    ALL = old + R
    LOG.write_text(''.join(json.dumps(r, ensure_ascii=False) + '\n' for r in ALL))
    report(R, f'Questa volta ({tag})')
    report(ALL, 'Tutto lo storico')
    w, n = best_weight(ALL)
    if w is not None:
        nota = '' if n >= 600 else f'  (solo {n} righe: serve ~600 titolari, circa 30 partite, prima di cambiare W_MARKET)'
        print(f"\nPeso del mercato che minimizza la log loss su tutto lo storico: {w:.2f}{nota}")


if __name__ == '__main__':
    main()
