"""Inserisce data.json dentro template.html e scrive index.html (pagina unica, pronta per artifact, localhost o Vercel)."""
import json, sys, pathlib
here = pathlib.Path(__file__).parent
data = json.loads((here / (sys.argv[1] if len(sys.argv) > 1 else 'data.json')).read_text(encoding='utf-8'))
lu_path = here / 'lineups.txt'
if lu_path.exists():
    LU = {}
    for line in lu_path.read_text(encoding='utf-8').splitlines():
        if not line.strip(): continue
        mid, t, f, sides = line.split('|', 3)
        hs, as_ = (sides.split('^') + [''])[:2]
        side = lambda txt: [[r.split('~')[0], r.split('~')[1], float(r.split('~')[2]), float(r.split('~')[3]), int(r.split('~')[4])] for r in txt.split(';') if r]
        LU[int(mid)] = {'t': t, 'f': f.split('/'), 'h': side(hs), 'a': side(as_)}
    for m in data['matches'] + data.get('cups', {}).get('ucl', {}).get('matches', []):
        if m['id'] in LU and LU[m['id']]['h']: m['lu'] = LU[m['id']]
html = (here / 'template.html').read_text(encoding='utf-8').replace('/*__DATA__*/', json.dumps(data, ensure_ascii=False).replace('</', '<\\/'))
(here / 'index.html').write_text(html, encoding='utf-8')
print('index.html', len(html), 'byte,', len(data['matches']), 'partite')
