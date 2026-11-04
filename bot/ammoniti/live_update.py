"""live_update.py — aggiorna data.json con la situazione live (FotMob) delle partite in corso.
Uso: python3 live_update.py tmp/live.json [../webapp/data.json]
tmp/live.json = {id: {t:"41'", sc:"2 - 0", fin:bool, ev:[[min,'Yellow'|'Red'|'YellowRed',nome,'h'|'a']], fl:[[nome,'h'|'a',falli_fatti,falli_subiti]]}}
Probabilità live: liveProb (live_model.js) + falli finora (indicativo: quota x1,3 per fallo fatto, max 4)."""
import json, math, sys, re, datetime
from market_blend import norm
LIVE_B = {'sa': [-0.103, 0.891, -0.198, 0.034, 0.103, -0.015, -0.066, -0.023],
          'ucl': [0.090, 0.894, 0.025, 0.006, 0.086, -0.063, -0.117, 0.020]}
FOUL_OR = 1.3
def live_prob(p0, t, cards_all, own, opp, sd, comp):
    lgY = 4.2 if comp == 'sa' else 3.6; rem = max(0, (95 - t) / 95)
    base = 1 - (1 - p0) ** rem; L = lambda x: math.log(max(1e-4, x) / (1 - min(.9999, x)))
    sd = max(-2, min(2, sd)); b = LIVE_B[comp]
    x = [1, L(base), math.log((cards_all + 1) / (lgY * t / 95 + 1)), own, opp, sd, abs(sd), 1 if t >= 45 else 0]
    return 1 / (1 + math.exp(-sum(v * c for v, c in zip(x, b))))
def same(app, fm):
    a, f = norm(app), norm(fm)
    if not a or not f: return False
    if a == f: return True
    if a[-1] != f[-1]: return False
    if len(a) == 1: return True
    return f[0].startswith(a[0]) if len(a[0]) == 1 else a[0] in f
def main(src, dpath=str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'webapp' / 'data.json')):
    live = json.load(open(src)); d = json.load(open(dpath))
    ms = [m for sec in ('cups',) for m in d['cups']['ucl']['matches']] + d.get('matches', [])
    now = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=1))).strftime('%H:%M')
    for m in ms:
        L = live.get(str(m['id']))
        if not L: continue
        comp = 'sa' if m.get('comp', 'sa') == 'sa' else 'ucl'
        t = int(re.sub(r'\D', '', L['t'] or '0') or 0) if not L.get('fin') else 95
        gh, ga = [int(x) for x in re.findall(r'\d+', L['sc'] or '0 - 0')[:2]] or [0, 0]
        yc = {'h': 0, 'a': 0}; card = {}
        for mn, c, nm, s in L['ev']:
            yc[s] += 1
            hit = [p[0] for p in m['pl'] if p[1] == s and same(p[0], nm)]
            card[hit[0] if hit else nm] = [mn, 'R' if 'Red' in c else 'G']
        fl = {}
        for nm, s, fc, fs in L['fl']:
            for p in m['pl']:
                if p[1] == s and same(p[0], nm): fl[p[0]] = [fc, fs]
        out = {p[0] for mn, nm, s in L.get('subs', []) for p in m['pl'] if p[1] == s and same(p[0], nm)}
        P = {}
        for p in m['pl']:
            n, s, p0 = p[0], p[1], p[4]
            if n in card: P[n] = 1.0; continue
            if n in out: P[n] = 0.0; continue
            o = 'a' if s == 'h' else 'h'; sd = (gh - ga) if s == 'h' else (ga - gh)
            q = live_prob(p0, t, yc['h'] + yc['a'], yc[s], yc[o], sd, comp)
            k = min(4, fl.get(n, [0])[0]); q = q * FOUL_OR ** k / (1 - q + q * FOUL_OR ** k)
            P[n] = round(q, 3)
        m['live'] = {'t': L['t'].replace('‎', ''), 'sc': L['sc'], 'fin': bool(L.get('fin')), 'agg': now,
                     'cards': [[v[0], n, v[1]] for n, v in sorted(card.items(), key=lambda kv: kv[1][0])],
                     'fl': fl, 'p': P, 'out': sorted(out)}
        print(m['h'], m['a'], L['t'], L['sc'], 'cartellini:', m['live']['cards'],
              'rischio:', sorted(((v, k) for k, v in P.items() if 0 < v < 1), reverse=True)[:4])
    json.dump(d, open(dpath, 'w'), ensure_ascii=False)
if __name__ == '__main__': main(*sys.argv[1:])
