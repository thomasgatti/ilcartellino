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
# 5) Bundesliga: rosso pieno con un taglio diagonale più chiaro, schede bianche
R = f'{X}[data-lg="bl"]'
css.append(f"""{R} {{ --paper: #c8000f; --xa: #d20515; --xb: #ff3b3b; }}
{R} body {{ background-color: #c8000f; background-image: linear-gradient(160deg, rgba(255,255,255,.10) 0 38%, transparent 38.2%), linear-gradient(200deg, transparent 0 55%, rgba(0,0,0,.12) 55.2%), linear-gradient(180deg, #e30613, #a8000c); background-size: auto; background-attachment: fixed; }}
{R} h1 {{ background-image: linear-gradient(90deg, #ffffff, #ffe1e1); }}
{R} h1 span, {R} .meta, {R} .xintro, {R} #extra > .note, {R} .day, {R} .who-chip, {R} footer, {R} footer a {{ color: #fff !important; -webkit-text-fill-color: #fff; }}
{R} .comps button[aria-pressed="true"] {{ background: #fff; color: #c8000f; }}
{R} .panel {{ background: linear-gradient(90deg, #e30613, #ff3b3b) top / 100% 5px no-repeat, var(--surface); }}
{R} .histbtn[aria-pressed="true"], {R} .tabs button[aria-pressed="true"] {{ background: #a8000c; color: #fff; }}
""")
open('sfondi.css', 'w').write('\n'.join(css))
print(len('\n'.join(css)))
