"""ucl_results.py — documenti risultati/<id> (comp 'ucl') per area e storico, dagli esiti FotMob (fmResult in fm_model.js).
Uso: python3 ucl_results.py tmp/res.json  → scrive tmp/res_docs.json e aggiunge/aggiorna webapp/vercel/risultati.json"""
import json, sys, datetime
from live_update import same
W = str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'webapp') + '/'
def abbr(n):
    w = n.split()
    return n if len(w) == 1 else w[0][0] + '. ' + ' '.join(w[1:])
def main(src):
    res = json.load(open(src)); d = json.load(open(W + 'data.json'))
    ms = {m['id']: m for m in d['cups']['ucl']['matches']}
    tris = {t['id']: t for t in json.load(open(W + 'tris_app.json')) if t.get('comp') == 'ucl'}
    docs = []
    for r in res:
        m = ms[r['id']]
        def nm(n, s):
            hit = [p[0] for p in m['pl'] if p[1] == s and same(p[0], n)]
            return hit[0] if hit else abbr(n)
        side = {p[0]: p[1] for p in r['played']}
        falli = {nm(p[0], p[1]): p[2] for p in r['played'] if not p[5]}
        falli_s = {nm(p[0], p[1]): p[3] for p in r['played'] if not p[5]}
        pn = {p[0] for p in r['played']}
        amm = [nm(c[2], c[3]) for c in r['cards'] if ('Yellow' in c[1] or 'Red' in c[1]) and c[2] in pn]
        subs = {nm(o, s): nm(i, s) for _, o, i, s in r['subs']}
        t = tris[r['id']]
        docs.append({'matchId': r['id'], 'comp': 'ucl', 'partita': f"{m['h']} - {m['a']}", 'giornata': int(d['cups']['ucl']['round']), 'ko': m['ko'],
                     'finale': r['sc'].replace(' ', ''), 'p3_app': round(t['p3'], 4), 'ammoniti': list(dict.fromkeys(amm)), 'falli': falli,
                     'falli_subiti': falli_s, 'sostituzioni': subs, 'tris_app': [{'n': x['n'], 'p': round(x['p'], 4)} for x in t['trio']],
                     'aggiornato': datetime.datetime.now(datetime.timezone.utc).isoformat(timespec='seconds')})
        hits = sum(x['n'] in amm or (subs.get(x['n']) in amm) for x in t['trio'])
        print(m['h'], '-', m['a'], r['sc'], 'tris', [x['n'] for x in t['trio']], 'presi', hits, 'ammoniti', amm)
    json.dump(docs, open(src.replace('.json', '_docs.json'), 'w'), ensure_ascii=False)
    vp = W + 'vercel/risultati.json'; V = json.load(open(vp)); ids = {x['matchId'] for x in docs}
    V = [x for x in V if x['matchId'] not in ids] + [{k: v for k, v in x.items() if k != 'falli_subiti'} for x in docs]
    json.dump(V, open(vp, 'w'), ensure_ascii=False); print('risultati.json:', len(V))
if __name__ == '__main__': main(*sys.argv[1:])
