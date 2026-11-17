// Idea dell'utente (Italia-Francia 12/11: Jacquet e Pio Esposito, che si marcavano, ammoniti tutti e due): i gialli di due
// avversari che si fronteggiano arrivano insieme più spesso di due avversari qualsiasi? Coppie "di fronte" = vicini reciproci
// sulle posizioni della partita (FotMob, specchiate). Rapporto osservato/atteso con le probabilità fuori campione del modello.
// Uso: node --max-old-space-size=7000 coppie_fronte.mjs
import { boot } from './boot.mjs';
const { all } = await boot();
const fitLogit = globalThis.fitLogit, CARD = new Set(['Yellow', 'YellowRed', 'Red']), M = new Map(all.map(m => [+m.id, m]));
function oos(rows, fs, seasons, min) { const out = new Map();
  for (const s of seasons) { const mdl = fitLogit(rows.filter(d => d.season < s && (!min || d.season >= min)), fs, 2);
    for (const d of rows.filter(d => d.season === s)) (out.get(d.mid) || out.set(d.mid, []).get(d.mid)).push({ pid: +d.pid, p: mdl.pred(d), home: d.home }); }
  return out; }
const SEAS = ['2023/2024', '2024/2025', '2025/2026', '2026/2027'];
const SA = oos(globalThis.__ROWS, globalThis.__FS_SA3, SEAS, '2021/2022'), UC = oos(globalThis.__CROWS2.filter(d => d.lg === 42), globalThis.__CFS3, SEAS);
const SEA = new Map([...globalThis.__ROWS, ...globalThis.__CROWS2].map(d => [d.mid, d.season]));
const part = (P, ss) => new Map([...P].filter(([mid]) => ss.includes(SEA.get(mid))));
const DEV = ['2023/2024', '2024/2025'], TEST = ['2025/2026', '2026/2027'];
const SETS = { 'Serie A': SA, Champions: UC, 'Champions 2023-25 (sviluppo)': part(UC, DEV), 'Champions 2025-27 (verifica)': part(UC, TEST), 'Serie A 2023-25': part(SA, DEV), 'Serie A 2025-27': part(SA, TEST) };
for (const [nome, P] of Object.entries(SETS)) {
  const acc = { fronte: [], altri: [], compagni: [] }; // per partita: [osservate, attese]
  for (const [mid, arr] of P) {
    const m = M.get(+mid); if (!m) continue;
    const booked = new Set((m.cards || []).filter(c => CARD.has(c[2])).map(c => +c[0]));
    const pos = new Map(m.pl.filter(r => r[4] === 1 && r[3] !== 0 && Number.isFinite(r[12]) && Number.isFinite(r[13])).map(r => [+r[0], [r[12], r[13]]]));
    const pl = arr.filter(x => pos.has(x.pid)); if (pl.length < 16) continue;
    const H = pl.filter(x => x.home), A = pl.filter(x => !x.home);
    const dist = (a, b) => { const p = pos.get(a.pid), q = pos.get(b.pid); return Math.hypot(p[0] - (1 - q[0]), p[1] - (1 - q[1])); };
    const near = (x, O) => O.reduce((b, o) => !b || dist(x, o) < dist(x, b) ? o : b, null);
    const face = new Set(); for (const h of H) { const a = near(h, A); if (a && near(a, H) === h) face.add(h.pid + '|' + a.pid); }
    const t = { fronte: [0, 0], altri: [0, 0], compagni: [0, 0] };
    for (const h of H) for (const a of A) { const k = face.has(h.pid + '|' + a.pid) ? 'fronte' : 'altri'; t[k][0] += booked.has(h.pid) && booked.has(a.pid) ? 1 : 0; t[k][1] += h.p * a.p; }
    for (const S of [H, A]) for (let i = 0; i < S.length; i++) for (let j = i + 1; j < S.length; j++) { t.compagni[0] += booked.has(S[i].pid) && booked.has(S[j].pid) ? 1 : 0; t.compagni[1] += S[i].p * S[j].p; }
    for (const k in acc) acc[k].push(t[k]);
  }
  const ratio = v => v.reduce((a, x) => a + x[0], 0) / v.reduce((a, x) => a + x[1], 0);
  let seed = 3; const rnd = () => (seed = (Math.imul(seed, 1103515245) + 12345) & 0x7fffffff) / 2147483648 /* 17/11: prodotto intero esatto (prima perdeva precisione oltre 2^53) */;
  const ci = (v, f = ratio) => { const b = []; for (let k = 0; k < 2000; k++) { const s = []; for (let i = 0; i < v.length; i++) s.push(v[Math.floor(rnd() * v.length)]); b.push(f(s)); } b.sort((x, y) => x - y); return [b[50], b[1950]]; };
  console.log(`\n== ${nome}: ${acc.fronte.length} partite ==`);
  for (const k of ['fronte', 'altri', 'compagni']) { const v = acc[k], c = ci(v); console.log(`${k.padEnd(9)} coppie entrambe ammonite ${v.reduce((a, x) => a + x[0], 0)} · attese ${v.reduce((a, x) => a + x[1], 0).toFixed(1)} · rapporto ${ratio(v).toFixed(3)} [${c[0].toFixed(3)}; ${c[1].toFixed(3)}]`); }
  const idx = acc.fronte.map((_, i) => i), rr = s => ratio(s.map(i => acc.fronte[i])) / ratio(s.map(i => acc.altri[i]));
  const c = ci(idx, rr); console.log(`di fronte / altri avversari: ${rr(idx).toFixed(3)} [${c[0].toFixed(3)}; ${c[1].toFixed(3)}]`);
}
