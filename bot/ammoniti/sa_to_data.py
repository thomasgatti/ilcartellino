"""Giornata di Serie A da FotMob (saExport in pagina → tmp/saNN.json) a webapp/data.json, conservando la sezione cups.
Uso: python3 sa_to_data.py tmp/sa11.json 11 [file_quote_oddschecker.txt]
Riga giocatore: [nome breve, h/a, ruolo, numero, p (= p se titolare × titolare%), di fronte, titolare %, q sostituto]."""
import json, sys, datetime, pathlib
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from market_blend import load_oc, slug_for, blend_match

DATA = pathlib.Path(__file__).resolve().parent.parent / 'webapp' / 'data.json'

def short(n):
    p = n.split()
    return n if len(p) == 1 else f"{p[0][0]}. {' '.join(p[1:])}"

def main():
    exp = json.load(open(sys.argv[1])); rnd = int(sys.argv[2])
    OC = load_oc(sys.argv[3]) if len(sys.argv) > 3 else None
    d = json.loads(DATA.read_text())
    colors = {}
    for m in d['matches']:
        colors[m['h']] = m['hc']; colors[m['a']] = m['ac']
    out = []
    for e in exp:
        (hid, hn), (aid, an) = e['teams']
        ko = int(datetime.datetime.fromisoformat(e['ko'].replace('Z', '+00:00')).timestamp())
        rows = e['pl']
        if OC:  # mercato sulla p SE titolare (indice 7), poi × titolare%
            sb = slug_for([hn, an], OC)
            if sb:
                tmp = [[r[0], r[7]] for r in rows]
                BL, _ = blend_match(tmp, sb[1], 0, 1)
                for r, b in zip(rows, BL):
                    r[7] = round(b[0], 3); r[4] = round(b[0] * r[6] / 100, 3)
                    if b[1]: r[8] = [t for t in r[8] if not t.startswith('Quota')] + [f"Quota bookmaker per il giallo: {b[1]:.2f}".replace('.', ',')]
        pl, tags = [], {}
        for r in sorted(rows, key=lambda r: -r[4]):
            pl.append([r[0], r[1], r[2], r[3], r[4], short(r[5]) if r[5] else '', r[6], None])
            if r[8]: tags[r[0]] = r[8]
        ctx = []
        hh = e.get('h2h')
        if hh and hh >= 1.15:
            ctx.append(f"Precedenti tesi: nelle ultime sfide tra queste due squadre +{round((hh - 1) * 100)}% gialli rispetto alla media")
        elif hh and hh <= 0.85:
            ctx.append(f"Precedenti tranquilli: nelle ultime sfide tra queste due squadre {round((hh - 1) * 100)}% gialli rispetto alla media".replace('-', '−'))
        dn = [f"{r[0]} ({hn if r[1] == 'h' else an})" for r in rows if r[6] >= 50 and any(t.startswith('Diffidato') for t in r[8])]
        if dn:
            ctx.append(f"{len(dn)} diffidat{'o' if len(dn) == 1 else 'i'} tra i probabili titolari: {', '.join(dn)}. Di solito stanno più attenti")
        ph, px, pa = (int(x) for x in e['odds'].split('/')) if e.get('odds') else (None, None, None)
        m = {'id': e['id'], 'ko': ko, 'h': hn, 'a': an, 'hc': colors.get(hn, [e['colors']['home'], '#ffffff']), 'ac': colors.get(an, [e['colors']['away'], '#ffffff']),
             'ref': e.get('ref') or '–', 'odds': f"{ph}/{pa}" if ph else None, 'line': None, 'uff': 0, 'pl': pl, 'tags': tags, 'derby': False, 'src': 'provv' if e.get('lt') != 'standard' else 'fotmob'}
        if ctx: m['ctx'] = ctx
        out.append(m)
    out.sort(key=lambda m: m['ko'])
    d['matches'] = out; d['round'] = rnd; d['model'] = 'v0.7' + (' + quote' if OC else '')
    d['updated'] = datetime.datetime.now(datetime.timezone.utc).astimezone().isoformat(timespec='minutes')
    d['lineups_note'] = ("Formazioni PROVVISORIE: finché i giornali non pubblicano le probabili (di solito da giovedì-venerdì), la probabilità di essere titolare "
                         "viene dall'ultima formazione e dalle presenze da titolare nelle ultime 5 giornate. Probabilità di giallo = titolare % × giallo se gioca "
                         "(modello FotMob con arbitro e precedenti; per i nuovi arrivati conta anche lo storico negli altri campionati).")
    DATA.write_text(json.dumps(d, ensure_ascii=False))
    for m in out:
        top = sorted(m['pl'], key=lambda r: -r[4])[:3]
        print(m['h'], '-', m['a'], '|', ', '.join(f"{r[0]} {r[4]*100:.0f}% (tit. {r[6]}%)" for r in top))

main()
