// Ricostruisce dalla storia git di bot/webapp/data.json il tris dell'app (2 + 1, regola del sostituto, come pick(m,'21',0,true,true))
// in tre istanti per ogni partita archiviata: ~24 ore prima, prime formazioni ufficiali, ultimo dato prima del via.
// Uso (dalla radice del repo, con storia completa): node bot/ammoniti/ricerca/tris/fotografie_git.mjs
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 1 << 28 });
const commits = git('log', '--reverse', '--format=%H %ct', '--', 'bot/webapp/data.json').trim().split('\n').map(l => { const [h, t] = l.split(' '); return { h, t: +t }; });
const ris = JSON.parse(fs.readFileSync('bot/webapp/vercel/risultati.json', 'utf8'));

function pick(m, subq) {
  const SUBQ = subq || { D: .019, M: .042, F: .039 }, jointK = t => (new Set(t.map(x => x.side)).size > 1 ? 1.16 : 1.04);
  const ps = m.pl.map(([n, side, pos, num, p0, vs, st = 100, q = null]) => ({ n, side, st, p: 1 - (1 - p0) * (1 - (q ?? SUBQ[pos] ?? .03)) }))
    .sort((x, y) => y.p - x.p).filter(p => !m.uff || p.st === 100), out = [];
  for (const two of ['h', 'a']) {
    const A = ps.filter(x => x.side === two).slice(0, 7), B = ps.filter(x => x.side !== two).slice(0, 7);
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) for (const b of B) out.push([A[i], A[j], b]);
  }
  const res = out.map(t => ({ trio: t.sort((x, y) => y.p - x.p), p3: t.reduce((a, x) => a * x.p, 1) * jointK(t), two: t.filter(x => x.side === 'h').length === 2 ? 'h' : 'a' })).sort((x, y) => y.p3 - x.p3);
  if (res.length > 1) {
    const E = sd => ps.filter(x => x.side === sd).reduce((a, x) => a + x.p, 0), alt = res.find(c => c.two !== res[0].two);
    if (alt && alt.p3 >= res[0].p3 * .95 && E(alt.two) > E(res[0].two)) { res.splice(res.indexOf(alt), 1); res.unshift(alt); }
  }
  return res[0] ? { trio: res[0].trio.map(x => ({ n: x.n, p: +x.p.toFixed(4) })), p3: +res[0].p3.toFixed(5) } : null;
}

const want = new Map(ris.map(r => [+r.matchId, r]));
const seen = new Map(); // id → [{t, uff, src, model, trio, p3}]
for (const c of commits) {
  let d; try { d = JSON.parse(git('show', `${c.h}:bot/webapp/data.json`)); } catch { continue; }
  const ms = [...(d.matches || []).map(m => ['sa', m]), ...Object.entries(d.cups || {}).flatMap(([k, s]) => (s.matches || []).map(m => [k, m]))];
  for (const [comp, m] of ms) {
    if (!want.has(+m.id) || c.t >= m.ko || !m.pl?.length) continue;
    const pk = pick(m, d.subq); if (!pk) continue;
    const arr = seen.get(+m.id) || seen.set(+m.id, []).get(+m.id), last = arr[arr.length - 1];
    const rec = { t: c.t, commit: c.h.slice(0, 10), comp, uff: !!m.uff, src: m.src || null, model: d.model || null, ...pk };
    if (!last || last.uff !== rec.uff || last.trio.map(x => x.n).join() !== rec.trio.map(x => x.n).join() || Math.abs(last.p3 - rec.p3) > 1e-4) arr.push(rec);
    else last.fino = c.t;
  }
}
const hitsOf = (trio, r) => { const am = new Set(r.ammoniti || []), sb = r.sostituzioni || {}; return trio.filter(x => am.has(x.n) || (sb[x.n] && am.has(sb[x.n]))).length; };
const out = [];
for (const [id, arr] of seen) {
  const r = want.get(id), ko = r.ko;
  const h24 = [...arr].reverse().find(x => x.t <= ko - 24 * 3600) || null, uff = arr.find(x => x.uff) || null, last = arr[arr.length - 1];
  const snap = x => x && { ore_prima: +((ko - x.t) / 3600).toFixed(1), uff: x.uff, src: x.src, trio: x.trio.map(t => t.n), p3: x.p3, centrati: hitsOf(x.trio, r) };
  out.push({ id, comp: arr[0].comp, partita: r.partita, ko, versioni: arr.length, a24h: snap(h24), ufficiali: snap(uff), ultimo: snap(last),
    pubblicato: { trio: (r.tris_app || []).map(t => t.n), p3: r.p3_app, centrati: hitsOf(r.tris_app || [], r) } });
}
out.sort((a, b) => a.ko - b.ko);
fs.writeFileSync('bot/ammoniti/ricerca/tris/fotografie_git.json', JSON.stringify(out, null, 1));
const S = k => out.filter(x => x[k]).reduce((a, x) => [a[0] + 1, a[1] + x[k].centrati, a[2] + (x[k].centrati >= 2), a[3] + (x[k].centrati === 3), a[4] + x[k].p3], [0, 0, 0, 0, 0]);
for (const k of ['a24h', 'ufficiali', 'ultimo', 'pubblicato']) { const s = S(k); console.log(k, 'partite', s[0], 'centrati', s[1], '≥2/3', s[2], '3/3', s[3], 'attesi 3/3', s[4].toFixed(2)); }
const both = out.filter(x => x.a24h && x.ultimo);
console.log('con fotografia a 24h e finale:', both.length, 'tris cambiato:', both.filter(x => x.a24h.trio.slice().sort().join() !== x.ultimo.trio.slice().sort().join()).length,
  'centrati 24h', both.reduce((a, x) => a + x.a24h.centrati, 0), 'finale', both.reduce((a, x) => a + x.ultimo.centrati, 0));
const lu = out.filter(x => x.ultimo && !x.ultimo.uff); console.log('partite senza ufficiali prima del via:', lu.map(x => x.partita).join(', ') || 'nessuna');
const diff = out.filter(x => x.ultimo && x.pubblicato.trio.length && x.ultimo.trio.slice().sort().join() !== x.pubblicato.trio.slice().sort().join());
console.log('ultimo prima del via ≠ pubblicato:', diff.map(x => x.partita + ` (${x.ultimo.trio.join(', ')} | ${x.pubblicato.trio.join(', ')})`).join('; ') || 'nessuna');
