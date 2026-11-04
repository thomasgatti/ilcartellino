// v0.4 — ruoli fini da posizione abituale, peso alle stagioni recenti, modello non lineare (gradient boosting),
// valutati con test TEMPORALE: alleno su tutto ciò che precede una stagione e provo su quella stagione.

// 1) aggiunge pid e posizione abituale (pre-partita) alle righe: patch del costruttore v0.3
function patchBuild() {
  const src = buildV03.toString().replace('data.push({ eid, mi,', 'data.push({ eid, mi, pid: r[2], hx: h ? h[0] : null, hy: h ? h[1] : null,');
  return eval('(' + src + ')');
}

// ruolo fine: profondità (x) e distanza dalla fascia centrale (|y-50|), separati per reparto
function roleFeats(M) {
  const hx = d => d.hx ?? M.hx, lat = d => Math.abs((d.hy ?? 50) - 50);
  const isD = d => d.pos === 'D' ? 1 : 0, isM = d => d.pos === 'M' ? 1 : 0, isF = d => d.pos === 'F' ? 1 : 0;
  return [d => hx(d) * isD(d), d => lat(d) * isD(d), d => hx(d) * isM(d), d => lat(d) * isM(d), d => hx(d) * isF(d), d => lat(d) * isF(d), d => lat(d) ** 2 / 100];
}

// regressione logistica pesata (IRLS + ridge)
function fitLogitW(rows, fs, wts, ridge = 2) {
  const X = rows.map(r => [1, ...fs.map(f => f(r))]); const k = X[0].length; const mu = new Array(k).fill(0), sd = new Array(k).fill(1);
  for (let j = 1; j < k; j++) { mu[j] = X.reduce((s, x) => s + x[j], 0) / X.length; sd[j] = Math.sqrt(X.reduce((s, x) => s + (x[j] - mu[j]) ** 2, 0) / X.length) || 1; }
  const Z = X.map(x => x.map((v, j) => j ? (v - mu[j]) / sd[j] : 1)); let w = new Array(k).fill(0); const W = wts || rows.map(() => 1);
  const sw = W.reduce((a, b) => a + b, 0) / W.length;
  for (let it = 0; it < 10; it++) { const Hm = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (let i = 0; i < Z.length; i++) { let z = 0; for (let j = 0; j < k; j++) z += w[j] * Z[i][j]; const p = 1 / (1 + Math.exp(-z)), e = (rows[i].y - p) * W[i] / sw, v = p * (1 - p) * W[i] / sw;
      for (let a = 0; a < k; a++) { g[a] += e * Z[i][a]; const za = v * Z[i][a]; for (let b = a; b < k; b++) Hm[a][b] += za * Z[i][b]; } }
    for (let a = 0; a < k; a++) for (let b = 0; b < a; b++) Hm[a][b] = Hm[b][a];
    for (let a = 1; a < k; a++) { Hm[a][a] += ridge; g[a] -= ridge * w[a]; } const d = _solve(Hm, g); w = w.map((x, j) => x + d[j]); }
  return { w, pred: r => { const x = [1, ...fs.map(f => f(r))]; let z = 0; for (let j = 0; j < k; j++) z += w[j] * (j ? (x[j] - mu[j]) / sd[j] : 1); return 1 / (1 + Math.exp(-z)); } };
}

// 3) gradient boosting con alberi di profondità 3 su variabili discretizzate (32 classi), perdita logistica
function fitGBM(rows, fs, wts, { trees = 150, lr = 0.05, depth = 3, minLeaf = 300, bins = 32, lambda = 5 } = {}) {
  const n = rows.length, F = fs.length, W = wts || rows.map(() => 1);
  const X = fs.map(f => rows.map(r => f(r)));
  const edges = X.map(col => { const s = [...col].sort((a, b) => a - b); const e = []; for (let b = 1; b < bins; b++) e.push(s[Math.floor(b * n / bins)]); return [...new Set(e)]; });
  const bin = (j, v) => { const e = edges[j]; let lo = 0, hi = e.length; while (lo < hi) { const m = (lo + hi) >> 1; v > e[m] ? lo = m + 1 : hi = m; } return lo; };
  const XB = X.map((col, j) => Uint8Array.from(col, v => bin(j, v)));
  const base = Math.log(rows.reduce((s, r, i) => s + r.y * W[i], 0) / rows.reduce((s, r, i) => s + (1 - r.y) * W[i], 0));
  const F0 = new Float64Array(n).fill(base); const model = [];
  for (let t = 0; t < trees; t++) {
    const g = new Float64Array(n), h = new Float64Array(n);
    for (let i = 0; i < n; i++) { const p = 1 / (1 + Math.exp(-F0[i])); g[i] = (p - rows[i].y) * W[i]; h[i] = p * (1 - p) * W[i]; }
    const tree = []; const build = (idx, d) => {
      let G = 0, Hh = 0; for (const i of idx) { G += g[i]; Hh += h[i]; }
      const node = { leaf: -G / (Hh + lambda) * lr }; if (d >= depth || idx.length < 2 * minLeaf) return node;
      let best = null;
      for (let j = 0; j < F; j++) { const gs = new Float64Array(bins + 1), hs = new Float64Array(bins + 1), cs = new Int32Array(bins + 1);
        for (const i of idx) { const b = XB[j][i]; gs[b] += g[i]; hs[b] += h[i]; cs[b]++; }
        let gl = 0, hl = 0, cl = 0;
        for (let b = 0; b < bins; b++) { gl += gs[b]; hl += hs[b]; cl += cs[b]; const cr = idx.length - cl; if (cl < minLeaf || cr < minLeaf) continue;
          const gain = gl * gl / (hl + lambda) + (G - gl) ** 2 / (Hh - hl + lambda) - G * G / (Hh + lambda); if (!best || gain > best.gain) best = { gain, j, b }; } }
      if (!best || best.gain <= 0) return node;
      const L = [], R = []; for (const i of idx) (XB[best.j][i] <= best.b ? L : R).push(i);
      return { j: best.j, b: best.b, l: build(L, d + 1), r: build(R, d + 1) }; };
    const root = build([...Array(n).keys()], 0); model.push(root);
    const walk = (nd, i) => nd.leaf !== undefined && nd.j === undefined ? nd.leaf : walk(XB[nd.j][i] <= nd.b ? nd.l : nd.r, i);
    for (let i = 0; i < n; i++) F0[i] += walk(root, i);
  }
  return { pred: r => { let z = base; const xb = fs.map((f, j) => bin(j, f(r)));
    for (const root of model) { let nd = root; while (nd.j !== undefined) nd = xb[nd.j] <= nd.b ? nd.l : nd.r; z += nd.leaf; } return 1 / (1 + Math.exp(-z)); } };
}

// valutazione temporale: per ogni stagione test, alleno su tutte le partite precedenti
function temporalEval(D, fs, { recency = 0, gbm = false, testSeasons = [63515, 76457, 95836] } = {}) {
  const order = [42415, 52760, 63515, 76457, 95836]; const preds = [], rowsT = [];
  for (const s of testSeasons) {
    const si = order.indexOf(s); const tr = D.filter(d => order.indexOf(d.sid) < si && d.mi >= 150), te = D.filter(d => d.sid === s);
    const wts = recency ? tr.map(d => Math.pow(recency, si - 1 - order.indexOf(d.sid))) : null;
    const m = gbm ? fitGBM(tr, fs, wts) : fitLogitW(tr, fs, wts);
    te.forEach(d => { preds.push(m.pred(d)); rowsT.push(d); });
  }
  const r = evalPreds(rowsT, preds);
  r.calib = +(preds.reduce((a, b) => a + b, 0) / rowsT.reduce((a, d) => a + d.y, 0)).toFixed(3); // >1 = sovrastima
  return r;
}
