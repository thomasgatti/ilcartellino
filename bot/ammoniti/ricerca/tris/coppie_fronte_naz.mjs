// Stessa prova di coppie_fronte.mjs sulle 1.124 partite di nazionali in archivio (dati/nazionali). Senza modello individuale:
// atteso = tasso del ruolo (D/M/F) × tasso del ruolo, quindi conta il confronto "di fronte" contro "altri avversari" nella stessa partita.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
const dir = (process.env.DATI || '/home/claude/datib/fotmob').replace(/fotmob$/, 'nazionali');
const all = fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')).flatMap(f => Object.values(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))))));
const CARD = new Set(['Yellow', 'YellowRed', 'Red']), ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M', R = { D: [0, 0], M: [0, 0], F: [0, 0] };
for (const m of all) { const b = new Set((m.cards || []).filter(c => CARD.has(c[2])).map(c => +c[0])); for (const r of m.pl) if (r[4] === 1 && r[3] !== 0) { R[ROLE(r[3])][0] += b.has(+r[0]); R[ROLE(r[3])][1]++; } }
const rate = k => R[k][0] / R[k][1], acc = [];
for (const m of all) {
  const b = new Set((m.cards || []).filter(c => CARD.has(c[2])).map(c => +c[0]));
  const st = m.pl.filter(r => r[4] === 1 && r[3] !== 0 && Number.isFinite(r[12]) && Number.isFinite(r[13])); const H = st.filter(r => r[2] === 1), A = st.filter(r => r[2] === 0);
  if (H.length < 8 || A.length < 8) continue;
  const dist = (a, c) => Math.hypot(a[12] - (1 - c[12]), a[13] - (1 - c[13])), near = (x, O) => O.reduce((bb, o) => !bb || dist(x, o) < dist(x, bb) ? o : bb, null);
  const t = [0, 0, 0, 0];
  for (const h of H) for (const a of A) { const f = near(h, A) === a && near(a, H) === h, o = b.has(+h[0]) && b.has(+a[0]) ? 1 : 0, e = rate(ROLE(h[3])) * rate(ROLE(a[3]));
    if (f) { t[0] += o; t[1] += e; } else { t[2] += o; t[3] += e; } }
  acc.push(t);
}
const rr = v => (v.reduce((s, x) => s + x[0], 0) / v.reduce((s, x) => s + x[1], 0)) / (v.reduce((s, x) => s + x[2], 0) / v.reduce((s, x) => s + x[3], 0));
let seed = 5; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 2147483648 /* 17/11: prodotto intero esatto (prima perdeva precisione oltre 2^53) */, B = [];
for (let k = 0; k < 2000; k++) { const s = []; for (let i = 0; i < acc.length; i++) s.push(acc[Math.floor(rnd() * acc.length)]); B.push(rr(s)); } B.sort((a, c) => a - c);
console.log(`Nazionali: ${acc.length} partite · coppie di fronte entrambe ammonite ${acc.reduce((s, x) => s + x[0], 0)} · di fronte / altri avversari ${rr(acc).toFixed(3)} [${B[50].toFixed(3)}; ${B[1950].toFixed(3)}]`);
