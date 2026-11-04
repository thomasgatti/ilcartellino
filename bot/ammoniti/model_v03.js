// v0.3 — regressione logistica (IRLS con ridge), validazione incrociata per gruppi di variabili, previsione partite future
function _solve(A, b) { const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let i = 0; i < n; i++) { let p = i; for (let k = i + 1; k < n; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k; [M[i], M[p]] = [M[p], M[i]];
    for (let k = i + 1; k < n; k++) { const f = M[k][i] / M[i][i]; for (let j = i; j <= n; j++) M[k][j] -= f * M[i][j]; } }
  const x = new Array(n).fill(0); for (let i = n - 1; i >= 0; i--) { let s = M[i][n]; for (let j = i + 1; j < n; j++) s -= M[i][j] * x[j]; x[i] = s / M[i][i]; } return x; }
function fitLogit(rows, fs, ridge = 2) {
  const X = rows.map(r => [1, ...fs.map(f => f(r))]); const k = X[0].length; const mu = new Array(k).fill(0), sd = new Array(k).fill(1);
  for (let j = 1; j < k; j++) { mu[j] = X.reduce((s, x) => s + x[j], 0) / X.length; sd[j] = Math.sqrt(X.reduce((s, x) => s + (x[j] - mu[j]) ** 2, 0) / X.length) || 1; }
  const Z = X.map(x => x.map((v, j) => j ? (v - mu[j]) / sd[j] : 1)); let w = new Array(k).fill(0);
  for (let it = 0; it < 10; it++) { const Hm = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (let i = 0; i < Z.length; i++) { let z = 0; for (let j = 0; j < k; j++) z += w[j] * Z[i][j]; const p = 1 / (1 + Math.exp(-z)), e = rows[i].y - p, v = p * (1 - p);
      for (let a = 0; a < k; a++) { g[a] += e * Z[i][a]; const za = v * Z[i][a]; for (let b = a; b < k; b++) Hm[a][b] += za * Z[i][b]; } }
    for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) Hm[a][b] = Hm[b][a];
    for (let a = 1; a < k; a++) { Hm[a][a] += ridge; g[a] -= ridge * w[a]; } const d = _solve(Hm, g); w = w.map((x, j) => x + d[j]); }
  return { w, mu, sd, pred: r => { const x = [1, ...fs.map(f => f(r))]; let z = 0; for (let j = 0; j < k; j++) z += w[j] * (j ? (x[j] - mu[j]) / sd[j] : 1); return 1 / (1 + Math.exp(-z)); } };
}
function evalPreds(D, p) {
  const ll = -D.reduce((s, r, i) => { const q = Math.min(Math.max(p[i], 1e-6), 1 - 1e-6); return s + (r.y ? Math.log(q) : Math.log(1 - q)); }, 0) / D.length;
  const s = D.map((r, i) => [p[i], r.y]).sort((a, b) => a[0] - b[0]); let pos = 0, sum = 0; s.forEach((x, i) => { if (x[1]) { pos++; sum += i + 1; } });
  const auc = (sum - pos * (pos + 1) / 2) / (pos * (s.length - pos));
  const g = {}; D.forEach((r, i) => (g[r.eid] = g[r.eid] || []).push([p[i], r.y])); let h = 0, c3 = 0, c2 = 0, n = 0, prod = 0;
  for (const a of Object.values(g)) { a.sort((x, y) => y[0] - x[0]); const t = a.slice(0, 3); const hits = t.reduce((s, x) => s + x[1], 0); h += hits; c3 += hits === 3; c2 += hits >= 2; prod += t[0][0] * t[1][0] * t[2][0]; n++; }
  return { logloss: +ll.toFixed(4), AUC: +auc.toFixed(3), giusti_su3: +(h / n).toFixed(3), P3: +(c3 / n * 100).toFixed(2), P2piu: +(c2 / n * 100).toFixed(1), P3_stimata: +(prod / n * 100).toFixed(2), partite: n };
}
function featureGroups(D) {
  const mean = k => { const a = D.filter(d => d[k] != null); return a.reduce((s, d) => s + d[k], 0) / a.length; };
  const M = {}; for (const k of ['faced', 'fct', 'fts', 'fsp', 'lam', 'pT']) M[k] = mean(k);
  const v = (d, k) => d[k] ?? M[k];
  return [
    ['base', [d => Math.log(d.ycr), d => Math.log(d.flr), d => d.pos === 'M' ? 1 : 0, d => d.pos === 'F' ? 1 : 0, d => d.home, d => d.tyc, d => d.ofd]],
    ['duelli', [d => v(d, 'faced')]],
    ['duelli_estesi', [d => v(d, 'fct'), d => v(d, 'fts'), d => v(d, 'fsp')]],
    ['proteste', [d => Math.log(d.argr)]],
    ['arbitro', [d => d.ref]],
    ['quota_cartellini', [d => Math.log(v(d, 'lam'))]],
    ['quote_1x2', [d => v(d, 'pO') - v(d, 'pT'), d => Math.abs(v(d, 'pO') - v(d, 'pT'))]],
    ['riposo_coppe', [d => d.rest, d => d.restO, d => d.cup]],
    ['classifica_posta', [d => d.ppg - d.ppgO, d => d.rankDiff <= 3 ? 1 : 0, d => d.salv, d => d.europa, d => d.late]],
    ['ex_precedenti_derby', [d => d.ex, d => d.h2h, d => d.derby]],
    ['diffida_rientro', [d => d.diff, d => d.syc, d => d.back]],
  ];
}
function cvV03(data, minMi = 150) {
  const D = data.filter(d => d.mi >= minMi); const groups = featureGroups(D); const out = {}; let fs = [];
  for (const [name, f] of groups) { fs = [...fs, ...f]; const p = new Array(D.length);
    for (let k = 0; k < 5; k++) { const tr = D.filter(d => d.mi % 5 !== k); const m = fitLogit(tr, fs); D.forEach((d, i) => { if (d.mi % 5 === k) p[i] = m.pred(d); }); }
    out['+' + name] = evalPreds(D, p); }
  const final = fitLogit(D, fs);
  return { cv: out, final, fs, names: groups.map(g => g[0]), D };
}
