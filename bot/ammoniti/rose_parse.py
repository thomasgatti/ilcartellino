"""Converte l'esportazione compatta della rosa (id|idCasa~Casa^idOspite~Ospite|nome~lato~ruolo~p*1000~minuti~campionato~di fronte~diffidato~nell'XI;...)
nel formato JSON di data/rose/*.json usato da cloud_lineup.py. Uso: python3 rose_parse.py in.txt [in2.txt ...] out.json"""
import json, sys
out = []
for f in sys.argv[1:-1]:
    for line in open(f, encoding='utf-8'):
        line = line.strip()
        if not line: continue
        mid, teams, pl = line.split('|', 2)
        T = [[int(t.split('~')[0]), t.split('~', 1)[1]] for t in teams.split('^')]
        rows = []
        for x in pl.split(';'):
            n, side, role, p, mn, lgs, vs, diff, xi = x.split('~')
            rows.append([n, int(side), role, int(p) / 1000, int(mn), lgs, vs, int(diff), 0, int(xi)])
        out.append({'id': int(mid), 'teams': T, 'pl': rows})
json.dump(out, open(sys.argv[-1], 'w'), ensure_ascii=False)
print(len(out), 'partite,', sum(len(m['pl']) for m in out), 'giocatori')
