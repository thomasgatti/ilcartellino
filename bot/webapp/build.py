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
    for m in data['matches'] + data.get('cups', {}).get('ucl', {}).get('matches', []) + data.get('cups', {}).get('naz', {}).get('matches', []):
        if m['id'] in LU and LU[m['id']]['h']: m['lu'] = LU[m['id']]
# Bandiere delle nazionali (flag-icons, MIT; le bandiere sono di pubblico dominio): solo quelle delle partite in pagina, come PNG incorporati
import base64
FLAG = {'Italia': 'it', 'Francia': 'fr', 'Belgio': 'be', 'Turchia': 'tr', 'Olanda': 'nl', 'Grecia': 'gr', 'Germania': 'de', 'Serbia': 'rs', 'Spagna': 'es',
        'Inghilterra': 'gb-eng', 'Croazia': 'hr', 'Rep. Ceca': 'cz', 'Portogallo': 'pt', 'Danimarca': 'dk', 'Galles': 'gb-wls', 'Norvegia': 'no', 'Scozia': 'gb-sct',
        'Svizzera': 'ch', 'Austria': 'at', 'Polonia': 'pl', 'Ungheria': 'hu', 'Ucraina': 'ua', 'Svezia': 'se', 'Slovenia': 'si', 'Slovacchia': 'sk', 'Romania': 'ro',
        'Irlanda': 'ie', 'Irlanda del Nord': 'gb-nir', 'Islanda': 'is', 'Finlandia': 'fi', 'Albania': 'al', 'Bosnia': 'ba', 'Georgia': 'ge', 'Israele': 'il',
        'Kosovo': 'xk', 'Macedonia del Nord': 'mk', 'Montenegro': 'me', 'Bulgaria': 'bg', 'Bielorussia': 'by', 'San Marino': 'sm', 'Lussemburgo': 'lu',
        'Armenia': 'am', 'Azerbaigian': 'az', 'Cipro': 'cy', 'Estonia': 'ee', 'Lettonia': 'lv', 'Lituania': 'lt', 'Kazakistan': 'kz', 'Moldavia': 'md',
        'Malta': 'mt', 'Andorra': 'ad', 'Gibilterra': 'gi', 'Liechtenstein': 'li', 'Isole Faroe': 'fo', 'Russia': 'ru'}
flags = {}
for m in data.get('cups', {}).get('naz', {}).get('matches', []):
    for n in (m['h'], m['a']):
        f = here / 'bandiere' / f"{FLAG.get(n, '-')}.png"
        if f.exists(): flags[n] = 'data:image/png;base64,' + base64.b64encode(f.read_bytes()).decode()
data['bandiere'] = flags
html = (here / 'template.html').read_text(encoding='utf-8').replace('/*__DATA__*/', json.dumps(data, ensure_ascii=False).replace('</', '<\\/'))
(here / 'index.html').write_text(html, encoding='utf-8')
print('index.html', len(html), 'byte,', len(data['matches']), 'partite')
