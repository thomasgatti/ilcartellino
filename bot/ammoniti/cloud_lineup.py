"""Piano B senza PC: formazioni ufficiali prese dal web → probabilità dalla rosa calcolata in anticipo → export coppe aggiornato.

La rosa precalcolata (data/rose/<comp><giornata>.json, da cupSquad3 nella scheda FotMob quando il PC è acceso) contiene per ogni partita
tutti i giocatori possibili con la loro p di giallo se titolare: [nome, lato, ruolo, p, minuti, campionato estero, di fronte, diffidato, gialli, nell'XI probabile].

Uso:
  python3 cloud_lineup.py data/rose/ucl4.json formazioni.json tmp/ex5.json
    formazioni.json = {"<id partita>": {"h": ["Portiere", "Cognome", ...11], "a": [...11], "fonti": ["url1", "url2"]}} (11 nomi: il primo è il portiere e viene escluso)
  Sostituisce in tmp/ex5.json i titolari di quelle partite (formato compatto di cupExport3) e stampa chi non è stato trovato.
  Poi: python3 cup_to_data.py tmp/ex5.json 4 "<id ufficiali>" data/quote/oc_....txt  → build.py → build_vercel.py → push.
Regola: usare una formazione solo se almeno due fonti indipendenti la riportano uguale, con la panchina (mai una fonte sola).
"""
import json, sys, pathlib, statistics
sys.path.insert(0, str(pathlib.Path(__file__).parent))
from market_blend import match_names


def main():
    rose = {m['id']: m for m in json.load(open(sys.argv[1]))}
    form = json.load(open(sys.argv[2]))
    exp_path = pathlib.Path(sys.argv[3])
    exp = json.load(open(exp_path))
    byid = {e['id']: e for e in exp}
    for mid, f in form.items():
        mid = int(mid); R = rose.get(mid)
        if not R:
            print('rosa mancante per', mid); continue
        rows = []
        for side_key, side in (('h', 1), ('a', 0)):
            squad = [r for r in R['pl'] if r[1] == side]
            names = f[side_key][1:] if len(f[side_key]) == 11 else f[side_key]  # il primo è il portiere (escluso dal modello)
            mp = match_names(names, [(r[0], 0) for r in squad])  # indice nome sito → nome rosa
            med = statistics.median([r[3] for r in squad]) if squad else .15
            for i, n in enumerate(names):
                if i in mp:
                    r = next(r for r in squad if r[0] == mp[i])
                    rows.append([r[0], side, r[2], r[3], r[4], r[5], r[6], r[7], r[8]])
                else:
                    print(f'  {mid}: "{n}" non trovato nella rosa → p mediana {med:.3f}')
                    rows.append([n, side, 'M', round(med, 3), 9999, '', '', 0, 0])
        if len(rows) != 20:
            print(f'  {mid}: attenzione, {len(rows)} titolari di movimento invece di 20')
        e = byid.get(mid)
        if e:
            e['pl'] = rows; e['lt'] = 'web'
        else:
            exp.append({'id': mid, 'lt': 'web', 'ko': None, 'ref': '', 'teams': R['teams'], 'colors': {'home': '#888888', 'away': '#444444'}, 'odds': None, 'booked': [], 'pl': rows})
        print(mid, ' - '.join(t[1] for t in R['teams']), 'ok:', ', '.join(f"{r[0].split()[-1]} {r[3]*100:.0f}%" for r in sorted(rows, key=lambda r: -r[3])[:3]))
    exp_path.write_text(json.dumps(exp, ensure_ascii=False))


if __name__ == '__main__':
    main()
