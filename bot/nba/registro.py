"""NBA: registro delle previsioni di prima della partita (17/11/2026).

Uso: python3 bot/nba/registro.py <oggi_input.json di cloud/nba/oggi.mjs> <oggi.json pubblicato> <cartella nba del ramo dati>
Scrive <nba>/registro/<AAAA-MM>/<giorno USA>_<AAAAMMGGTHHMMSS>Z.json.gz e non riscrive mai un file esistente: ogni giro lascia
la fotografia di ciò che il modello SAPEVA (rose, stato degli infortunati, quote per bookmaker, ora) e di ciò che ha DETTO
(probabilità, giocate, combinazioni). Senza questo registro non si può provare il modello «in avanti» né sapere quali quote
erano davvero giocabili al momento del consiglio. Lettura: bot/nba/rapporto.py.
"""
import gzip, json, os, sys, time

def scrivi(f_in, f_out, cartella, adesso=None):
    I, O = json.load(open(f_in)), json.load(open(f_out)); adesso = adesso or int(time.time())
    quando = time.strftime('%Y%m%dT%H%M%S', time.gmtime(adesso)); giorno = str(O.get('giorno') or I.get('giorno'))
    d = os.path.join(cartella, 'registro', f'{giorno[:4]}-{giorno[4:6]}'); os.makedirs(d, exist_ok=True)
    f = os.path.join(d, f'{giorno}_{quando}Z.json.gz')
    if os.path.exists(f): raise SystemExit(f'registro: {f} esiste già, non lo riscrivo')
    rec = dict(v=1, giorno=giorno, scritto=adesso, commit=os.environ.get('GITHUB_SHA', ''), giro=os.environ.get('GITHUB_RUN_ID', ''),
               modello=(O.get('modello') or {}).get('versione', 'v1'), ingresso=I, uscita=O)
    with gzip.open(f, 'wt') as h: json.dump(rec, h, ensure_ascii=False)
    return f

if __name__ == '__main__':
    print('registro:', scrivi(*sys.argv[1:4]))
