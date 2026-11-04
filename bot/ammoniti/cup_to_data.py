"""Converte l'esportazione FotMob delle partite di coppa (cupExport, solo titolari) nella sezione cups.ucl di webapp/data.json.
Uso: python3 cup_to_data.py export.json "4" [uff_ids_separati_da_virgola] [quote_oddschecker.txt]
Con il file delle quote 'ammonito' (Oddschecker) la probabilità finale è la media in logit tra modello e mercato (market_blend.py).
Ogni riga giocatore: [nome, lato h/a, ruolo, numero, p, di fronte, titolare %, q]."""
import json, sys, unicodedata, datetime, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from market_blend import load_oc, slug_for, blend_match, W_MARKET, lg, ex
import math, re as _re
def _pois_over(lam, k):  # P(X >= k) per X ~ Poisson(lam)
    return 1 - sum(math.exp(-lam) * lam ** i / math.factorial(i) for i in range(k))
def _lam_from(spec):
    """spec 'O4.5:2.05,U4.5:1.9,...' → (linea principale, lambda Poisson stimato)."""
    L = {}
    for x in spec.split(','):
        if not x: continue
        k, q = x.split(':'); L.setdefault(float(k[1:]), {})[k[0]] = float(q)
    best = None
    for line, d in L.items():
        if 'O' in d and 'U' in d:
            po = (1 / d['O']) / (1 / d['O'] + 1 / d['U'])
            if best is None or abs(po - .5) < abs(best[1] - .5): best = (line, po)
    if not best: return None, None
    line, po = best; k = int(line + .5); lo, hi = .05, 15
    for _ in range(60):
        mid = (lo + hi) / 2
        if _pois_over(mid, k) < po: lo = mid
        else: hi = mid
    return line, (lo + hi) / 2
def load_linee(path):
    out = {}
    if not pathlib.Path(path).exists(): return out
    for l in open(path, encoding='utf-8'):
        l = l.strip()
        if not l: continue
        slug, tot, h, a = (l.split('|') + ['', '', ''])[:4]
        out[slug] = {'tot': _lam_from(tot), 'h': _lam_from(h), 'a': _lam_from(a)}
    return out
def load_contesto(path):
    out = {}
    if not pathlib.Path(path).exists(): return out
    for l in open(path, encoding='utf-8'):
        l = l.strip()
        if not l: continue
        f = l.split('|')
        out[int(f[0])] = {'ref': f[2], 'n': int(f[3] or 0), 'avg': f[4], 'ratio': f[5], 'form': f[6], 'inj_h': f[7], 'inj_a': f[8] if len(f) > 8 else ''}
    return out


DATA = pathlib.Path(__file__).resolve().parent.parent / 'webapp' / 'data.json'
IT_COLORS = {}  # colori delle italiane presi dalla Serie A
NAMES_IT = {}


def short(n):
    p = n.split()
    if len(p) == 1:
        return n
    # nomi composti tipo "Van der Brempt" / "De Roon": tieni le particelle
    parts = p[1:]
    return f"{p[0][0]}. {' '.join(parts)}"


def norm(s):
    return unicodedata.normalize('NFKD', s).encode('ascii', 'ignore').decode().lower()


# regola del sostituto: q = prob. di essere sostituito (ultime 2 stagioni, shrink 4 titolarità verso il ruolo) × giallo del subentrato in Champions per ruolo
# (D .070, M .079, F .059). File data/subq_ucl.json {nome FotMob: q}, da __SUBQ nella scheda FotMob (4/11).
import pathlib as _pl
_sq = _pl.Path(__file__).parent / 'data' / 'subq_ucl.json'
SUBQ_UCL = json.loads(_sq.read_text(encoding='utf-8')) if _sq.exists() else {}

def main():
    exp = json.load(open(sys.argv[1]))
    rnd = sys.argv[2] if len(sys.argv) > 2 else '4'
    uff = set(int(x) for x in sys.argv[3].split(',')) if len(sys.argv) > 3 and sys.argv[3] else set()
    OC = load_oc(sys.argv[4]) if len(sys.argv) > 4 else None
    qdir = pathlib.Path(sys.argv[4]).parent if len(sys.argv) > 4 else pathlib.Path(__file__).parent / 'data' / 'quote'
    LINEE = load_linee(qdir / f'linee_ucl{rnd}.txt'); CTXF = load_contesto(qdir / f'contesto_ucl{rnd}.txt')
    nblend = 0
    d = json.loads(DATA.read_text())
    # colori e nomi delle squadre italiane dalla Serie A (stessi colori in tutta l'app)
    for m in d['matches']:
        IT_COLORS[m['h']] = m['hc']; IT_COLORS[m['a']] = m['ac']
        for r in m['pl']:
            NAMES_IT[norm(r[0].split()[-1]) + '|' + (m['h'] if r[1] == 'h' else m['a'])] = r[0]
    matches = []
    for e in exp:
        (hid, hn), (aid, an) = e['teams']
        hc = IT_COLORS.get(hn) or [e['colors']['home'], '#ffffff']
        ac = IT_COLORS.get(an) or [e['colors']['away'], '#ffffff']
        ko = int(datetime.datetime.fromisoformat(e['ko'].replace('Z', '+00:00')).timestamp())
        pl, tags = [], {}
        booked = {norm(n).split()[-1]: o for n, o in (e.get('booked') or [])}
        od = e.get('odds')
        odds_app = None
        if od:
            ph, px, pa = (int(x) for x in od.split('/'))
            odds_app = f"{ph}/{pa}"
        BL = None
        if OC and isinstance(e['pl'][0][5], str):
            sb = slug_for([hn, an], OC)
            if sb:
                BL, _k = blend_match(e['pl'], sb[1]); nblend += 1
        LN = None
        if LINEE:
            sb2 = slug_for([hn, an], [(k, []) for k in LINEE])
            LN = LINEE.get(sb2[0]) if sb2 else None
        if LN and LN['h'][1] and LN['a'][1] and isinstance(e['pl'][0][5], str):
            P = [BL[i][0] if BL else r[3] for i, r in enumerate(e['pl'])]
            Sh = sum(p for p, r in zip(P, e['pl']) if r[1]); Sa = sum(p for p, r in zip(P, e['pl']) if not r[1])
            mh = LN['h'][1] / (LN['h'][1] + LN['a'][1]); target = .5 * Sh / (Sh + Sa) + .5 * mh
            def side_sum(side, d): return sum(ex(lg(p) + d) for p, r in zip(P, e['pl']) if bool(r[1]) == side)
            def shift_for(side, goal):
                lo, hi = -2, 2
                for _ in range(50):
                    mid = (lo + hi) / 2
                    if side_sum(side, mid) < goal: lo = mid
                    else: hi = mid
                return (lo + hi) / 2
            tot = Sh + Sa; dh = shift_for(True, target * tot); da = shift_for(False, (1 - target) * tot)
            newP = [ex(lg(p) + (dh if r[1] else da)) for p, r in zip(P, e['pl'])]
            BL = [(np_, (BL[i][1] if BL else None), (BL[i][2] if BL else None)) for i, np_ in enumerate(newP)]
        for ri, row in enumerate(e['pl']):
            if not isinstance(row[5], str):  # formato vecchio cupExport: [nome, lato, ruolo, p, titolare, minuti, campionati]
                name, side, role, p, st, mins, lgs = row; vs = ''
                if not st:
                    continue
            else:  # formato compatto cupExport2/3: [nome, lato, ruolo, p, minuti, campionato principale estero, di fronte, (diffidato, gialli in Champions)]
                name, side, role, p, mins, lgs, vs = row[:7]
                diff = row[7] if len(row) > 7 else 0
            qmk = None
            if BL:
                p, qmk = BL[ri][0], BL[ri][1]
            team = hn if side else an
            nm = NAMES_IT.get(norm(name.split()[-1]) + '|' + team) or short(name)
            pl.append([nm, 'h' if side else 'a', role, '', round(p, 3), short(vs) if vs else '', 100, (row[9] if len(row) > 9 and row[9] is not None else SUBQ_UCL.get(name))])
            t = []
            if lgs:
                parts = []
                for x in lgs.split(', '):
                    nm_l, mm = x.rsplit(' ', 1)
                    if nm_l in ('Champions', 'Europa League', 'Conference'):
                        continue
                    parts.append(f"{nm_l} {int(mm):,}'".replace(',', '.'))
                if parts and not lgs.startswith('Serie A'):
                    t.append('Storico: ' + ', '.join(parts))
            bo = qmk or booked.get(norm(name).split()[-1])
            if bo:
                t.append(f"Quota bookmaker per il giallo: {bo:.2f}".replace('.', ','))
            if not isinstance(row[5], str):
                diff = 0
            if diff:
                t.append("Diffidato: col prossimo giallo salta una partita")
            if mins < 900:
                t.append(f"Poca esperienza: {mins}' nello storico")
            if t:
                tags[nm] = t
        matches.append({'id': e['id'], 'comp': 'ucl', 'ko': ko, 'h': hn, 'a': an, 'hc': hc, 'ac': ac, 'ref': e.get('ref') or '–',
                        'odds': odds_app, 'line': None, 'uff': 1 if (e['lt'] != 'predicted' or e['id'] in uff) else 0, 'tags': tags, 'derby': False,
                        'src': 'fotmob'})
        matches[-1]['pl'] = pl
        if LN and LN['tot'][0] is not None:
            matches[-1]['line'] = f"{LN['tot'][0]:.1f}".replace('.', ',')
        C = CTXF.get(e['id'])
        rx, hh = e.get('refx'), e.get('h2h')
        if C and C['n'] >= 10 and C['avg']:
            rx = float(C['ratio'])
        if rx and abs(rx - 1) > 0.005:
            pc = round((rx - 1) * 100)
            matches[-1]['refnote'] = (f"severo: +{pc}% gialli" if pc >= 8 else f"permissivo: {pc}% gialli".replace('-', '−') if pc <= -8 else "nella media per i gialli")
            if C and C['n'] >= 10 and C['avg']:
                matches[-1]['refnote'] += f" · {C['avg'].replace('.', ',')} gialli a partita ({C['n']} partite)"
        ctx = []
        if hh and hh >= 1.15:
            ctx.append(f"Precedenti tesi: nelle ultime sfide tra queste due squadre +{round((hh - 1) * 100)}% gialli rispetto alla media")
        elif hh and hh <= 0.85:
            ctx.append(f"Precedenti tranquilli: nelle ultime sfide tra queste due squadre {round((hh - 1) * 100)}% gialli rispetto alla media".replace('-', '−'))
        if LN and LN['h'][1] and LN['a'][1]:
            lh, la = LN['h'][1], LN['a'][1]
            if abs(lh - la) / max(lh, la) >= .12:
                more, less = (hn, an) if lh > la else (an, hn)
                ctx.append(f"Il bookmaker si aspetta più cartellini per {more} ({max(lh, la):.1f} contro {min(lh, la):.1f})".replace('.', ','))
        if C:
            fm = C['form'].split('/')
            tr = str.maketrans({'W': 'V', 'D': 'N', 'L': 'P'})
            if len(fm) == 2 and fm[0] and fm[1]:
                ctx.append(f"Forma ultime 5: {hn} {fm[0].translate(tr)} · {an} {fm[1].translate(tr)}")
            for team, inj in ((hn, C['inj_h']), (an, C['inj_a'])):
                if inj:
                    ctx.append(f"Assenti {team}: {inj.replace(',', ', ')}")
        dn = [(NAMES_IT.get(norm(r[0].split()[-1]) + '|' + (hn if r[1] else an)) or short(r[0])) + f" ({hn if r[1] else an})" for r in e['pl'] if len(r) > 7 and r[7]]
        if dn:
            ctx.append(f"{len(dn)} diffidat{'o' if len(dn) == 1 else 'i'} in campo: {', '.join(dn)}. Di solito stanno più attenti")
        if ctx:
            matches[-1]['ctx'] = ctx
    matches.sort(key=lambda m: m['ko'])
    d.setdefault('cups', {})['ucl'] = {
        'name': 'Champions League', 'round': rnd, 'season': '2026-27',
        'updated': datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec='minutes'),
        'model': 'coppe v3 + quote' if OC else 'coppe v2',
        'lineups_note': "Champions League: formazioni probabili di FotMob fino a circa un'ora prima, poi le ufficiali. Probabilità dal modello per le coppe: storico di gialli e falli di ogni giocatore in tutti i campionati (Serie A, Premier, LaLiga, Bundesliga, Ligue 1, Eredivisie, Portogallo e altri) e nelle coppe europee, riportato alla scala della Champions, più chi ha di fronte, quanto è severo l'arbitro, i precedenti tra le due squadre e i diffidati.",
        'matches': matches}
    if OC:
        d['cups']['ucl']['lineups_note'] += f" Dove c'è la quota del bookmaker per il giallo, la probabilità è una media tra modello e mercato (peso mercato {W_MARKET:.0%})."
    DATA.write_text(json.dumps(d, ensure_ascii=False))
    if OC: print('partite con quote:', nblend)
    for m in matches:
        top = sorted(m['pl'], key=lambda r: -r[4])[:4]
        print(m['h'], '-', m['a'], 'uff' if m['uff'] else 'prob', [(r[0], r[4]) for r in top])


if __name__ == '__main__':
    main()
