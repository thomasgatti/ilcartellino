// Modello angoli (13/11/2026): angoli attesi per squadra e probabilità di «almeno 14 angoli» nella partita.
// Usato sia dalla sezione Angoli (cloud/angoli.mjs) sia dalla ricerca (bot/ammoniti/ricerca/angoli/angoli14.mjs),
// così la prova sul passato e il calcolo in pagina passano dallo stesso codice.
//  1. Per ogni squadra: medie delle ultime N gare in archivio (angoli, tiri, tocchi in area, xG, possesso; fatti e concessi).
//  2. Regressione di Poisson (ridge) per gli angoli della squadra di casa e di quella in trasferta, su tutte le competizioni insieme.
//  3. Totale: binomiale negativa con media = somma dei due attesi e dispersione stimata sui totali;
//     poi una correzione logistica  logit P(≥ soglia) = a + b·logit(P binomiale negativa)  stimata sulle stesse gare.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';

export const K = ['angoli', 'tiri', 'tocchi_area', 'xg', 'possesso'];
export const SOGLIA = 14;

// lgAs: tutte le partite della cartella sotto un'unica competizione (le nazionali: troppe poche gare per competizione)
export function loadExtra(dir, only = null, lgAs = null) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json.gz'))) {
    const [lg, season] = f.replace('.json.gz', '').split('_');
    if (only && !only.includes(lg)) continue;
    for (const [id, m] of Object.entries(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f))))))
      if (m.ts && K.every(k => Array.isArray(m.t?.[k]) && m.t[k].every(Number.isFinite))) out.push({ id: +id, lg: lgAs || lg, season: +season.slice(0, 4), ts: m.ts, h: m.h[0], a: m.a[0], hn: m.h[1], an: m.a[1], t: m.t });
  }
  return out.sort((a, b) => a.ts - b.ts);
}

const lx = v => Math.log(Math.max(v, .05));
const dot = (x, b) => { let s = 0; for (let i = 0; i < x.length; i++) s += x[i] * b[i]; return s; };
const logit = p => Math.log(p / (1 - p)), sig = z => 1 / (1 + Math.exp(-z));

function solve(Hm, g) {
  const k = g.length, A = Hm.map((r, i) => [...r, g[i]]);
  for (let i = 0; i < k; i++) { let mx = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]];
    for (let r = 0; r < k; r++) if (r !== i) { const q = A[r][i] / A[i][i]; for (let c = i; c <= k; c++) A[r][c] -= q * A[i][c]; } }
  return A.map((r, i) => r[k] / r[i]);
}
export function fitPoisson(X, y, lam = 1) {
  const k = X[0].length; let b = new Array(k).fill(0); b[0] = Math.log(y.reduce((s, v) => s + v, 0) / y.length);
  for (let it = 0; it < 50; it++) {
    const Hm = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (let n = 0; n < X.length; n++) { const x = X[n], mu = Math.exp(dot(x, b)); for (let i = 0; i < k; i++) { g[i] += (y[n] - mu) * x[i]; for (let c = 0; c < k; c++) Hm[i][c] += mu * x[i] * x[c]; } }
    for (let i = 1; i < k; i++) { Hm[i][i] += lam; g[i] -= lam * b[i]; }
    const step = solve(Hm, g); b = b.map((v, i) => v + step[i]); if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return b;
}
export function fitLogistic(X, y, lam = 0) {
  const k = X[0].length; let b = new Array(k).fill(0); const m = y.reduce((s, v) => s + v, 0) / y.length; b[0] = logit(Math.min(.99, Math.max(.01, m)));
  for (let it = 0; it < 50; it++) {
    const Hm = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (let n = 0; n < X.length; n++) { const x = X[n], p = sig(dot(x, b)), w = p * (1 - p); for (let i = 0; i < k; i++) { g[i] += (y[n] - p) * x[i]; for (let c = 0; c < k; c++) Hm[i][c] += w * x[i] * x[c]; } }
    for (let i = 1; i < k; i++) { Hm[i][i] += lam; g[i] -= lam * b[i]; }
    const step = solve(Hm, g); b = b.map((v, i) => v + step[i]); if (Math.max(...step.map(Math.abs)) < 1e-8) break;
  }
  return b;
}
export const nbPmf = (mu, r, n = 40) => { const p = r / (r + mu), out = [Math.pow(p, r)]; for (let k = 1; k <= n; k++) out.push(out[k - 1] * (k - 1 + r) / k * (1 - p)); return out; };
export const nbAtLeast = (mu, r, s) => Math.min(.999, Math.max(.001, 1 - nbPmf(mu, r, s).slice(0, s).reduce((a, x) => a + x, 0)));
// dispersione dai residui: var = mu + mu²/r
const dispersion = (mus, ys) => { let num = 0, den = 0; for (let i = 0; i < mus.length; i++) { num += mus[i] * mus[i]; den += (ys[i] - mus[i]) ** 2 - mus[i]; } return den > 0 ? Math.min(200, num / den) : 200; };

// Stato «prima di ogni partita»: scorre le gare in ordine di tempo e produce le righe con le variabili note prima del via.
// opts: n (ultime gare, 10), min (minimo 3), variante (0 = solo media di competizione, 1 = + angoli, 2 = + tiri/tocchi/xG/possesso)
export function walk(ms, opts = {}) {
  const N = opts.n ?? 10, MIN = opts.min ?? 3, V = opts.variante ?? 2;
  const hist = {}, lgH = {}, rows = [];
  const avg = (H, k, i) => { let s = 0; for (const x of H) s += x[k][i]; return s / H.length; };
  const lgMean = lg => { const L = (lgH[lg] || []).slice(-380); if (L.length < 100) return null; let h = 0, a = 0; for (const x of L) { h += x[0]; a += x[1]; } return [h / L.length, a / L.length]; };
  const side = (A, B, lgm) => { const x = [1, lx(lgm)];
    if (V >= 1) x.push(lx(avg(A, 'angoli', 0)), lx(avg(B, 'angoli', 1)));
    if (V >= 2) x.push(lx(avg(A, 'tiri', 0)), lx(avg(B, 'tiri', 1)), lx(avg(A, 'tocchi_area', 0)), lx(avg(B, 'tocchi_area', 1)), lx(avg(A, 'xg', 0)), lx(avg(B, 'xg', 1)), lx(avg(A, 'possesso', 0)), lx(avg(B, 'possesso', 0)));
    return x; };
  // lgFallback: competizione senza media propria (coppe nazionali) → media del campionato indicato
  const feats = (lg, th, ta, lgFallback = null) => { const Hh = (hist[th] || []).slice(-N), Ha = (hist[ta] || []).slice(-N), L = lgMean(lg) || (lgFallback && lgMean(lgFallback));
    if (Hh.length < MIN || Ha.length < MIN || !L) return null; return { xh: side(Hh, Ha, L[0]), xa: side(Ha, Hh, L[1]), lg: L, nh: Hh.length, na: Ha.length,
      med: { h: [avg(Hh, 'angoli', 0), avg(Hh, 'angoli', 1)], a: [avg(Ha, 'angoli', 0), avg(Ha, 'angoli', 1)] } }; };
  for (const m of ms) {
    const f = feats(m.lg, m.h, m.a); if (f) rows.push({ m, f, yh: m.t.angoli[0], ya: m.t.angoli[1] });
    for (const [team, o] of [[m.h, 0], [m.a, 1]]) (hist[team] ||= []).push(Object.fromEntries(K.map(k => [k, [m.t[k][o], m.t[k][1 - o]]])));
    (lgH[m.lg] ||= []).push(m.t.angoli);
  }
  const freq = (lg, s = SOGLIA) => { const L = (lgH[lg] || []).slice(-380); return L.length < 100 ? null : (L.filter(x => x[0] + x[1] >= s).length + 2) / (L.length + 16); };
  return { rows, feats, freq, lgMean };
}

// Allena sulle righe date; restituisce pred(f) → { mh, ma, p (≥ soglia), nb (prima della correzione) }
export function train(rows, soglia = SOGLIA) {
  const bh = fitPoisson(rows.map(r => r.f.xh), rows.map(r => r.yh)), ba = fitPoisson(rows.map(r => r.f.xa), rows.map(r => r.ya));
  const mu = r => [Math.exp(dot(r.f.xh, bh)), Math.exp(dot(r.f.xa, ba))];
  const M = rows.map(mu), tot = rows.map(r => r.yh + r.ya);
  const rt = dispersion(M.map(x => x[0] + x[1]), tot), rh = dispersion(M.map(x => x[0]), rows.map(r => r.yh)), ra = dispersion(M.map(x => x[1]), rows.map(r => r.ya));
  const nb = M.map(x => nbAtLeast(x[0] + x[1], rt, soglia));
  const cal = fitLogistic(nb.map(p => [1, logit(p)]), tot.map(t => t >= soglia ? 1 : 0));
  const pred = f => { const mh = Math.exp(dot(f.xh, bh)), ma = Math.exp(dot(f.xa, ba)), p0 = nbAtLeast(mh + ma, rt, soglia); return { mh, ma, nb: p0, p: sig(cal[0] + cal[1] * logit(p0)) }; };
  return { bh, ba, rt, rh, ra, cal, pred, n: rows.length };
}
