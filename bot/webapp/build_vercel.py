"""Versione per Vercel: stessa pagina di index.html, ma senza account Claude.
I tris di ognuno restano nel suo browser (localStorage). Lo storico legge gli esiti e i tris prepartita salvati.
Uscita: vercel/sito/index.html (cartella da trascinare su Vercel)."""
import json, pathlib
here = pathlib.Path(__file__).parent
html = (here / 'index.html').read_text(encoding='utf-8')
ris = json.loads((here / 'vercel' / 'risultati.json').read_text(encoding='utf-8'))
tris = json.loads((here / 'tris_app.json').read_text(encoding='utf-8'))
shim = """<script>
(() => { const RIS = %s; const K = 'ammoniti_tris_v1';
  window.cartellinoRisultati = RIS;
  window.cartellinoTris = %s;
  const load = () => { try { return JSON.parse(localStorage.getItem(K) || '{}'); } catch (e) { return {}; } };
  const save = o => { try { localStorage.setItem(K, JSON.stringify(o)); } catch (e) {} };
  const snap = arr => ({ docs: arr.map(v => ({ data: () => v })) });
  const db = {
    collection: path => ({
      get: async () => path === 'risultati' ? snap(RIS) : snap(Object.values(load())),
      doc: id => ({ set: async v => { const o = load(); o[id] = v; save(o); } }) }),
    doc: path => ({ get: async () => { const id = +path.split('/')[1]; const r = RIS.find(x => x.matchId === id); return { exists: !!r, data: () => r }; } }) };
  const user = { id: async () => 'browser', profiles: async () => ({}) };
  window.claude = { use: async k => k === 'db' ? db : k === 'user' ? user : null };
})();
</script>
""" % tuple(json.dumps(rows, ensure_ascii=False).replace('</', '<\\/') for rows in (ris, tris))
import datetime
stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')
html = html.replace('<head>', f'<head>\n<meta name="build" content="{stamp}">\n<link rel="manifest" href="/manifest.webmanifest">', 1)
import re as _re
html = _re.sub(r'<link rel="apple-touch-icon" href="[^"]+">', '<link rel="apple-touch-icon" href="/apple-touch-icon.png">', html)
i = html.index('<script')
html = html[:i] + shim + html[i:]
html = html.replace('i tuoi tris sono salvati nella tua area privata', 'i tuoi tris restano salvati in questo browser')
html = html.replace("Ciao${MYNAME ? ', <b></b>' : ''}: ", '')
out = here / 'vercel' / 'sito'; out.mkdir(parents=True, exist_ok=True)
(out / 'index.html').write_text(html, encoding='utf-8')
print('vercel/sito/index.html', len(html), 'byte,', len(ris), 'esiti')
