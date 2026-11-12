# Rigenera il CSS degli sfondi per competizione (template.html, blocco "Sfondi per competizione"): python3 sfondi.py → sfondi.css (da incollare nel template)
# Genera gli sfondi (SVG originali, solo forme e colori, nessun marchio) e il CSS dei temi per competizione.
import random, math, urllib.parse, pathlib, re
def uri(svg): return "url(\"data:image/svg+xml," + urllib.parse.quote(re.sub(r'\s+', ' ', svg).strip(), safe=" =:/,.'()-") + "\")"
W, H = 1280, 720
def svg(body, defs=''): return f"<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 {W} {H}' preserveAspectRatio='xMidYMid slice'><defs>{defs}</defs>{body}</svg>"
# 1) Serie A: triangoli e parallelogrammi a 60 gradi, blu e ciano su indaco
r = random.Random(7); pal = ['#00e5e0', '#0a8cff', '#2348e8', '#0057ff', '#1a2a9e', '#18208a', '#3ee6d8']
sh = []
for _ in range(46):
    x, y, s, c = r.uniform(-40, W), r.uniform(-40, H), r.choice([18, 26, 40, 56, 64]), r.choice(pal)
    h = s * math.sqrt(3) / 2
    pts = [(x, y), (x + s, y), (x + s / 2, y + h)] if r.random() < .55 else [(x + s / 2, y), (x + s, y + h), (x, y + h)]
    sh.append(f"<polygon points='{' '.join(f'{a:.0f},{b:.0f}' for a, b in pts)}' fill='{c}' opacity='{r.choice([.55, .7, .85])}'/>")
for _ in range(14):
    x, y, w, l, c = r.uniform(0, W), r.uniform(0, H), r.choice([34, 46, 56]), r.choice([110, 150, 200]), r.choice(pal)
    dx = l / math.tan(math.radians(60))
    sh.append(f"<polygon points='{x:.0f},{y:.0f} {x + w:.0f},{y:.0f} {x + w - dx:.0f},{y + l:.0f} {x - dx:.0f},{y + l:.0f}' fill='{c}' opacity='{r.choice([.6, .75])}'/>")
SA = svg(''.join(sh))
# 2) Champions: grandi archi luminosi ciano, blu, viola, magenta
UCL = svg(''.join(f"<path d='M{-200 + i * 30},{620 - i * 40} Q640,{-260 + i * 70} {1480 - i * 30},{560 - i * 40}' fill='none' stroke='url(#u{i % 2})' stroke-width='{14 - i * 2}' opacity='.75'/>" for i in range(5)),
          "<linearGradient id='u0' x1='0' x2='1'><stop offset='0' stop-color='#19d3ff'/><stop offset='.45' stop-color='#3a5bff'/><stop offset='.75' stop-color='#9b3dff'/><stop offset='1' stop-color='#ff3fb4'/></linearGradient>"
          "<linearGradient id='u1' x1='0' x2='1'><stop offset='0' stop-color='#57ffd0'/><stop offset='.5' stop-color='#19d3ff'/><stop offset='1' stop-color='#b14dff'/></linearGradient>")
# 3) Premier League: fasce oblique spezzate rosa e viola su prugna
def bolt(x, w, c):
    return f"<polygon points='{x},{-20} {x + w},{-20} {x + w - 120},{300} {x + w - 60},{300} {x + w - 210},{740} {x - 150},{740} {x - 20},{360} {x - 80},{360}' fill='url(#{c})' opacity='.8'/>"
PL = svg(bolt(620, 70, 'p0') + bolt(760, 54, 'p1') + bolt(180, 40, 'p1') + bolt(1180, 46, 'p0'),
         "<linearGradient id='p0' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#ff2d8f'/><stop offset='1' stop-color='#8b3dff'/></linearGradient>"
         "<linearGradient id='p1' x1='0' y1='0' x2='0' y2='1'><stop offset='0' stop-color='#c43bff'/><stop offset='1' stop-color='#ff4fa8'/></linearGradient>")
# 4) LaLiga: cerchi concentrici spezzati rossi su nero
r = random.Random(3); arcs = []
for i, rad in enumerate([120, 200, 290, 380, 480, 600]):
    w = [26, 40, 30, 52, 36, 60][i]; circ = 2 * math.pi * rad; segs = []
    for _ in range(4): segs += [r.uniform(.08, .22) * circ, r.uniform(.04, .1) * circ]
    arcs.append(f"<circle cx='640' cy='360' r='{rad}' fill='none' stroke='#ff1a1a' stroke-width='{w}' stroke-dasharray='{' '.join(f'{v:.0f}' for v in segs)}' transform='rotate({r.uniform(0, 360):.0f} 640 360)' opacity='{.85 - i * .08:.2f}'/>")
LIGA = svg(''.join(arcs))
# 6) Ligue 1: archi gialli spessi su blu notte
L1 = svg("<circle cx='980' cy='250' r='190' fill='none' stroke='#f5e400' stroke-width='70' stroke-dasharray='520 140 300 233' opacity='.85'/>"
         "<circle cx='300' cy='640' r='240' fill='none' stroke='#f5e400' stroke-width='60' stroke-dasharray='700 300 200 308' opacity='.7'/>"
         "<circle cx='640' cy='60' r='120' fill='none' stroke='#f5e400' stroke-width='40' stroke-dasharray='300 200 254' opacity='.6'/>"
         "<path d='M0,560 Q640,420 1280,600 L1280,720 L0,720 Z' fill='#0b1240' opacity='.85'/>")
dark = lambda paper, surf, ink, muted, line: f"--paper: {paper}; --surface: {surf}; --ink: {ink}; --muted: {muted}; --line: {line}; --good: #3ee08f; color-scheme: dark;"
cards = ".match, {r} .panel, {r} .stat, {r} .tile, {r} .hist-card, {r} .duel-card, {r} .tabs, {r} .histbtn, {r} .comps, {r} .hfilter button:not([aria-pressed=\"true\"])"
def skin(r, vars_, bg, surf_rgba):
    return (f"{r} {{ {vars_} }}\n{r} body {{ background-color: var(--paper); background-image: {bg}; background-size: cover; background-position: center top; background-attachment: fixed; }}\n"
            f"{r} {cards.format(r=r)} {{ background: {surf_rgba}; border-color: color-mix(in srgb, var(--line) 80%, transparent); backdrop-filter: blur(3px); }}\n"
            f"{r} .list {{ background: transparent; }}\n@media (max-width: 820px) {{ {r} .list {{ background: color-mix(in srgb, var(--paper) 90%, transparent); backdrop-filter: blur(6px); }} }}\n")
css = ["/* ---- Sfondi per competizione (12/11): solo colori e forme originali, nessun marchio ---- */"]
R = ':root[data-comp="sa"]'
css.append(skin(R, dark('#1b0f5c', '#22197a', '#eef3ff', '#aab6ec', '#36359a') + " --sa1: #2348e8; --sa2: #0a8cff; --sa3: #00e5e0;",
                f"linear-gradient(180deg, rgba(27,15,92,.55), rgba(27,15,92,.82)), {uri(SA)}", "linear-gradient(180deg, rgba(38,30,128,.93), rgba(28,20,104,.93))"))
css.append(f"""{R} h1, {R}[data-theme="dark"] h1 {{ background-image: linear-gradient(90deg, #ffffff 0%, #8fd3ff 50%, #00e5e0 100%); }}
@media (prefers-color-scheme: dark) {{ {R}:not([data-theme="light"]) h1 {{ background-image: linear-gradient(90deg, #ffffff 0%, #8fd3ff 50%, #00e5e0 100%); }} }}
{R} .tabs button[aria-pressed="true"], {R} .histbtn[aria-pressed="true"] {{ background: linear-gradient(90deg, #2348e8, #0a8cff); color: #fff; }}
{R} .day {{ color: #5fe3ff; }}
{R} .match[aria-current="true"] {{ box-shadow: 0 0 0 2px #00e5e0 inset, 0 0 18px rgba(0,229,224,.3); }}
{R} body::before {{ background: linear-gradient(90deg, #0057ff, #0a8cff 50%, #00e5e0); }}
""")
R = ':root[data-comp="ucl"]'
css.append(f"""{R} body {{ background-image: linear-gradient(180deg, rgba(4,10,44,.35), rgba(4,10,44,.7)), {uri(UCL)}, radial-gradient(1200px 520px at 85% -120px, rgba(47,107,255,.55), transparent 70%), radial-gradient(900px 420px at -10% 10%, rgba(177,77,255,.28), transparent 70%); background-size: cover, cover, auto, auto; background-attachment: fixed; }}
""")
X = ':root[data-comp="extra"]'
for lg, vars_, bg, surf, xa, xb in [
    ('pl', dark('#2d0a40', '#3a0f52', '#fbefff', '#d2b3e6', '#5a2577'), f"linear-gradient(180deg, rgba(45,10,64,.45), rgba(45,10,64,.8)), {uri(PL)}, linear-gradient(160deg, #5a1a72, #2d0a40)", "linear-gradient(180deg, rgba(66,18,92,.93), rgba(48,12,70,.93))", '#ff2d8f', '#b14dff'),
    ('liga', dark('#140709', '#220d11', '#fff1f1', '#d9a9ad', '#4a1a20'), f"linear-gradient(180deg, rgba(20,7,9,.5), rgba(20,7,9,.82)), {uri(LIGA)}, radial-gradient(900px 600px at 50% 40%, #4a0d14, #140709)", "linear-gradient(180deg, rgba(40,14,18,.94), rgba(28,10,13,.94))", '#ff2a2a', '#ff7a5c'),
    ('l1', dark('#11134a', '#1a1d5e', '#f4f6ff', '#b4b9e8', '#2f347f'), f"linear-gradient(180deg, rgba(17,19,74,.45), rgba(17,19,74,.8)), {uri(L1)}, linear-gradient(180deg, #23286e, #11134a)", "linear-gradient(180deg, rgba(30,34,104,.94), rgba(22,25,84,.94))", '#f5e400', '#ffd000')]:
    R = f'{X}[data-lg="{lg}"]'
    css.append(skin(R, vars_ + f" --xa: {xa}; --xb: {xb};", bg, surf))
    css.append(f"""{R} .comps button[aria-pressed="true"] {{ background: linear-gradient(90deg, {xa}, {xb}); color: {'#1a1600' if lg == 'l1' else '#fff'}; box-shadow: 0 0 14px color-mix(in srgb, {xa} 45%, transparent); }}
{R} .panel {{ background: linear-gradient(90deg, {xa}, {xb}) top / 100% 5px no-repeat, {surf}; }}
{R} h1 {{ background-image: linear-gradient(90deg, #ffffff, {xa} 70%, {xb}); }}
{R} .tabs button[aria-pressed="true"], {R} .histbtn[aria-pressed="true"] {{ background: {xa}; color: {'#1a1600' if lg == 'l1' else '#fff'}; }}
""")
def tri(pal, seed, n=46, bars=14, op=(.55, .7, .85)):
    r = random.Random(seed); sh = []
    for _ in range(n):
        x, y, s_, c = r.uniform(-40, W), r.uniform(-40, H), r.choice([18, 26, 40, 56, 64]), r.choice(pal); h = s_ * math.sqrt(3) / 2
        pts = [(x, y), (x + s_, y), (x + s_ / 2, y + h)] if r.random() < .55 else [(x + s_ / 2, y), (x + s_, y + h), (x, y + h)]
        sh.append(f"<polygon points='{' '.join(f'{a:.0f},{b:.0f}' for a, b in pts)}' fill='{c}' opacity='{r.choice(op)}'/>")
    for _ in range(bars):
        x, y, w, l, c = r.uniform(0, W), r.uniform(0, H), r.choice([34, 46, 56]), r.choice([110, 150, 200]), r.choice(pal); dx = l / math.tan(math.radians(60))
        sh.append(f"<polygon points='{x:.0f},{y:.0f} {x + w:.0f},{y:.0f} {x + w - dx:.0f},{y + l:.0f} {x - dx:.0f},{y + l:.0f}' fill='{c}' opacity='{r.choice(op[:2])}'/>")
    return svg(''.join(sh))
def dark_lg(lg, vars_, bg, surf, xa, xb, ink_on_accent='#fff'):
    R = f'{X}[data-lg="{lg}"]'
    return skin(R, vars_ + f" --xa: {xa}; --xb: {xb};", bg, surf) + f"""{R} .comps button[aria-pressed="true"] {{ background: linear-gradient(90deg, {xa}, {xb}); color: {ink_on_accent}; box-shadow: 0 0 14px color-mix(in srgb, {xa} 45%, transparent); }}
{R} .panel {{ background: linear-gradient(90deg, {xa}, {xb}) top / 100% 5px no-repeat, {surf}; }}
{R} h1 {{ background-image: linear-gradient(90deg, #ffffff, {xa} 70%, {xb}); }}
{R} .tabs button[aria-pressed="true"], {R} .histbtn[aria-pressed="true"] {{ background: {xa}; color: {ink_on_accent}; }}
"""
def light_lg(lg, paper, bg, xa, xb, press_bg, press_ink, tab_bg):
    R = f'{X}[data-lg="{lg}"]'
    return f"""{R} {{ --paper: {paper}; --xa: {xa}; --xb: {xb}; }}
{R} body {{ background-color: {paper}; background-image: {bg}; background-size: cover; background-position: center top; background-attachment: fixed; }}
{R} h1 {{ background-image: linear-gradient(90deg, #ffffff, #ffe9e9); }}
{R} h1 span, {R} .meta, {R} .xintro, {R} #extra > .note, {R} .day, {R} .who-chip, {R} .footer-credit, {R} .footer-privacy > summary {{ color: #fff !important; -webkit-text-fill-color: #fff; }}
{R} .comps button[aria-pressed="true"] {{ background: {press_bg}; color: {press_ink}; }}
{R} .panel {{ background: linear-gradient(90deg, {xa}, {xb}) top / 100% 5px no-repeat, var(--surface); }}
{R} .histbtn[aria-pressed="true"], {R} .tabs button[aria-pressed="true"] {{ background: {tab_bg}; color: #fff; }}
"""
# 5) Bundesliga: rosso pieno con un taglio diagonale più chiaro, schede bianche
css.append(light_lg('bl', '#c8000f', "linear-gradient(160deg, rgba(255,255,255,.10) 0 38%, transparent 38.2%), linear-gradient(200deg, transparent 0 55%, rgba(0,0,0,.12) 55.2%), linear-gradient(180deg, #e30613, #a8000c)",
                    '#d20515', '#ff3b3b', '#fff', '#c8000f', '#a8000c'))
# 7) FA Cup: rosso pieno con tagli neri ai lati, schede bianche
FA = svg("<polygon points='0,0 90,0 0,260' fill='#111' opacity='.55'/><polygon points='1280,720 1150,720 1280,380' fill='#111' opacity='.55'/>"
         "<polygon points='1180,0 1280,0 1280,120' fill='#111' opacity='.35'/><polygon points='0,600 70,720 0,720' fill='#111' opacity='.35'/>")
css.append(light_lg('fa', '#d42027', f"{uri(FA)}, linear-gradient(180deg, #d42027, #b8161d)", '#d42027', '#111111', '#111', '#fff', '#111'))
# 8) Copa del Rey: nastri curvi oro e rosso su nero
CDR = svg("<path d='M-60,760 C220,420 300,140 520,-40' fill='none' stroke='url(#g)' stroke-width='70' opacity='.8'/>"
          "<path d='M60,780 C330,470 420,180 640,-40' fill='none' stroke='url(#rr)' stroke-width='46' opacity='.75'/>"
          "<path d='M1340,-40 C1060,300 980,520 760,780' fill='none' stroke='url(#rr)' stroke-width='64' opacity='.7'/>"
          "<path d='M1240,-60 C980,260 900,500 680,780' fill='none' stroke='url(#g)' stroke-width='30' opacity='.6'/>",
          "<linearGradient id='g' x1='0' y1='1' x2='1' y2='0'><stop offset='0' stop-color='#a8742e'/><stop offset='.5' stop-color='#f0c470'/><stop offset='1' stop-color='#c38a3c'/></linearGradient>"
          "<linearGradient id='rr' x1='0' y1='0' x2='1' y2='1'><stop offset='0' stop-color='#ff2a3a'/><stop offset='1' stop-color='#a3121f'/></linearGradient>")
css.append(dark_lg('cdr', dark('#070707', '#141012', '#fff6ea', '#cdb79a', '#3a2a22'), f"linear-gradient(180deg, rgba(7,7,7,.4), rgba(7,7,7,.78)), {uri(CDR)}", "linear-gradient(180deg, rgba(24,18,20,.95), rgba(14,10,12,.95))", '#e8b864', '#e0283a', '#1a1000'))
# Coppa Italia: triangoli rossi e arancio su bordeaux
CIT = tri(['#ff4a38', '#e03028', '#c42222', '#a00000', '#ff6a4a'], 11)
css.append(dark_lg('cit', dark('#6a0000', '#7e0a0a', '#fff2ef', '#f0b3aa', '#9c2a26'), f"linear-gradient(180deg, rgba(106,0,0,.45), rgba(106,0,0,.8)), {uri(CIT)}", "linear-gradient(180deg, rgba(128,12,12,.95), rgba(100,4,4,.95))", '#ff5a40', '#ffb02e'))
# EFL Cup: verde (il colore della coppa di lega) con fasce lime e oro
EFL = svg("<polygon points='760,-20 900,-20 520,740 380,740' fill='#00a651' opacity='.75'/><polygon points='930,-20 990,-20 610,740 550,740' fill='#8dc63f' opacity='.7'/>"
          "<polygon points='1040,-20 1070,-20 690,740 660,740' fill='#e2b13c' opacity='.7'/><polygon points='120,-20 170,-20 -210,740 -260,740' fill='#00a651' opacity='.5'/>")
css.append(dark_lg('efl', dark('#06291c', '#0b3a28', '#effff6', '#a9d8bf', '#1e5a40'), f"linear-gradient(180deg, rgba(6,41,28,.4), rgba(6,41,28,.8)), {uri(EFL)}", "linear-gradient(180deg, rgba(14,64,44,.95), rgba(8,46,31,.95))", '#00c25e', '#e2b13c', '#03170e'))
# DFB Pokal: viola con linee curve oro (coriandoli) e un tocco di verde
r = random.Random(5)
DFB = svg(''.join(f"<path d='M{x:.0f},{y:.0f} q{r.uniform(20, 60):.0f},{-r.uniform(30, 90):.0f} {r.uniform(60, 140):.0f},{-r.uniform(10, 60):.0f}' fill='none' stroke='{c}' stroke-width='{w}' stroke-linecap='round' opacity='.8'/>"
               for x, y, c, w in [(r.uniform(0, W), r.uniform(60, H), r.choice(['#e8c15a', '#e8c15a', '#f3d98a', '#3ddc84']), r.choice([6, 9, 12])) for _ in range(40)]))
css.append(dark_lg('dfb', dark('#24104f', '#2e1663', '#f6f0ff', '#c3b2e8', '#4a2f86'), f"linear-gradient(180deg, rgba(36,16,79,.4), rgba(36,16,79,.8)), {uri(DFB)}, linear-gradient(160deg, #4a1f96, #24104f)", "linear-gradient(180deg, rgba(56,26,118,.95), rgba(40,18,90,.95))", '#e8c15a', '#3ddc84', '#1a1000'))
# Coupe de France: blu federale con esagoni bianchi, rossi e oro
def hexa(cx, cy, rr, col, w, op): return "<polygon points='" + ' '.join(f"{cx + rr * math.cos(math.radians(60 * k + 30)):.0f},{cy + rr * math.sin(math.radians(60 * k + 30)):.0f}" for k in range(6)) + f"' fill='none' stroke='{col}' stroke-width='{w}' opacity='{op}'/>"
CDF = svg(hexa(1040, 200, 220, '#ffffff', 26, .35) + hexa(1040, 200, 150, '#e1000f', 18, .7) + hexa(220, 600, 260, '#ffffff', 22, .25) + hexa(220, 600, 180, '#c9a24a', 16, .6) + hexa(640, -40, 140, '#e1000f', 14, .45))
css.append(dark_lg('cdf', dark('#0a1f66', '#10297a', '#f2f6ff', '#aebde8', '#2a4294'), f"linear-gradient(180deg, rgba(10,31,102,.4), rgba(10,31,102,.8)), {uri(CDF)}, linear-gradient(180deg, #0b2a8a, #0a1f66)", "linear-gradient(180deg, rgba(20,48,140,.95), rgba(14,36,112,.95))", '#e1000f', '#c9a24a'))
# Nazionali (Nations League): blu notte con triangoli multicolori, i colori delle bandiere
NZ = tri(['#e4002b', '#ffd200', '#00b2a9', '#1e5bff', '#ffffff', '#ff7a00'], 23, n=40, bars=10)
R = ':root[data-comp="naz"]'
css.append(skin(R, dark('#0a1446', '#111d5e', '#f2f5ff', '#aab4e6', '#28337e') + " --na1: #1e5bff; --na2: #ffd200; --na3: #00b2a9;",
                f"linear-gradient(180deg, rgba(10,20,70,.5), rgba(10,20,70,.82)), {uri(NZ)}", "linear-gradient(180deg, rgba(24,36,116,.94), rgba(16,27,92,.94))"))
css.append(f"""{R} h1, {R}[data-theme="dark"] h1 {{ background-image: linear-gradient(90deg, #ffffff 0%, #ffd200 55%, #00b2a9 100%); }}
@media (prefers-color-scheme: dark) {{ {R}:not([data-theme="light"]) h1 {{ background-image: linear-gradient(90deg, #ffffff 0%, #ffd200 55%, #00b2a9 100%); }} }}
{R} body::before {{ background: linear-gradient(90deg, #e4002b 0 25%, #ffd200 25% 50%, #00b2a9 50% 75%, #1e5bff 75%); }}
{R} .comps button[aria-pressed="true"] {{ background: linear-gradient(90deg, #1e5bff, #00b2a9); color: #fff; box-shadow: 0 0 14px rgba(0,178,169,.45); }}
{R} .tabs button[aria-pressed="true"], {R} .histbtn[aria-pressed="true"] {{ background: #1e5bff; color: #fff; }}
{R} .day {{ color: #ffd200; }}
{R} .match[aria-current="true"] {{ box-shadow: 0 0 0 2px #ffd200 inset, 0 0 18px rgba(255,210,0,.25); }}
{R} .panel {{ background: linear-gradient(90deg, #e4002b, #ffd200, #00b2a9, #1e5bff) top / 100% 5px no-repeat, linear-gradient(180deg, rgba(24,36,116,.94), rgba(16,27,92,.94)); }}
{R} .sectabs button[aria-selected="true"] {{ border-bottom-color: #ffd200; }}
{R} .posta {{ background: color-mix(in srgb, #ffd200 8%, var(--surface)); border-color: color-mix(in srgb, #ffd200 35%, var(--line)); border-left-color: #ffd200; }}
{R} .posta .pk {{ color: #ffd200; }}
""")
open('sfondi.css', 'w').write('\n'.join(css))
print(len('\n'.join(css)))
