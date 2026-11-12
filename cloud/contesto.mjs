// Contesto per il modello (12/11): quote storiche di football-data.co.uk (ramo dati, cartella quote/) abbinate alle partite FotMob
// dell'archivio, e possesso palla dall'archivio extra (dati/extra). Usato da cloud/giornata.mjs (startModel → globalThis.__CTX) e dalla ricerca.
// Chiave: stessa lega, data entro ±1 giorno, nomi delle squadre più simili (trigrammi). Restituisce Map(id FotMob → quote).
// Quote senza margine: p = (1/q) / Σ(1/q). Si usa la media di mercato di chiusura (AvgC*), altrimenti la media pre-chiusura (Avg*), poi Bet365.
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
export const FD_LG = { I1: 55, E0: 47, E1: 48, SC0: 64, D1: 54, SP1: 87, F1: 53, N1: 57, B1: 40, P1: 61, T1: 71, G1: 135 };
const norm = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/\b(fc|ac|as|ss|us|calcio|sc|cf|afc|club|de|sv|vfb|vfl|tsg|1\.)\b/g, ' ').replace(/[^a-z0-9]+/g, ' ').trim();
const tri = s => { const t = new Set(), x = '  ' + norm(s) + ' '; for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3)); return t; };
const sim = (a, b) => { const A = tri(a), B = tri(b); let k = 0; for (const x of A) if (B.has(x)) k++; return k / Math.max(1, Math.min(A.size, B.size)); };
function csv(txt) {
  const L = txt.replace(/^﻿/, '').split(/\r?\n/).filter(Boolean), H = L[0].split(',');
  return L.slice(1).map(l => { const v = l.split(','), o = {}; H.forEach((h, i) => o[h] = v[i]); return o; });
}
const num = x => { const n = parseFloat(x); return Number.isFinite(n) && n > 1 ? n : null; };
function trio(o, pre) { const q = ['H', 'D', 'A'].map(k => num(o[pre + k])); return q.every(Boolean) ? q : null; }
export function loadFD(dir, all) {
  const out = new Map(), byLgDay = new Map();
  for (const m of all) { const d = Math.floor(m.ts / 86400); for (const dd of [d - 1, d, d + 1]) { const k = m.lg + '|' + dd; (byLgDay.get(k) || byLgDay.set(k, []).get(k)).push(m); } }
  let righe = 0, ok = 0;
  for (const f of fs.readdirSync(dir).filter(f => /^fd_[A-Z0-9]+_\d{4}\.csv$/.test(f))) {
    const code = f.split('_')[1], lg = FD_LG[code]; if (!lg) continue;
    for (const o of csv(fs.readFileSync(path.join(dir, f), 'utf8'))) {
      if (!o.Date || !o.HomeTeam) continue; righe++;
      const [dd, mm, yy] = o.Date.split('/'), y = yy.length === 2 ? 2000 + +yy : +yy, day = Math.floor(Date.UTC(y, mm - 1, +dd) / 86400000);
      const cand = (byLgDay.get(lg + '|' + day) || []).map(m => ({ m, s: sim(o.HomeTeam, m.h[1]) + sim(o.AwayTeam, m.a[1]) })).sort((a, b) => b.s - a.s);
      if (!cand.length || cand[0].s < .7 || (cand[1] && cand[1].m.id !== cand[0].m.id && cand[1].s > cand[0].s - .15)) continue;
      const q = trio(o, 'AvgC') || trio(o, 'Avg') || trio(o, 'B365C') || trio(o, 'B365'); if (!q) continue;
      const inv = q.map(x => 1 / x), s = inv.reduce((a, b) => a + b, 0), p = inv.map(x => x / s);
      const o25 = [num(o['AvgC>2.5']) || num(o['Avg>2.5']), num(o['AvgC<2.5']) || num(o['Avg<2.5'])];
      const pO = o25.every(Boolean) ? (1 / o25[0]) / (1 / o25[0] + 1 / o25[1]) : null;
      out.set(+cand[0].m.id, { p, pO, ref: o.Referee || null, fd: [o.HomeTeam, o.AwayTeam] }); ok++;
    }
  }
  return { map: out, righe, ok };
}

// { quote: Map(id → {p:[casa, pari, trasferta], pO}), poss: Map(id → [casa, trasferta]) } dalla radice del ramo dati.
export function loadContesto(root, all) {
  const quote = fs.existsSync(path.join(root, 'quote')) ? loadFD(path.join(root, 'quote'), all).map : new Map(), poss = new Map();
  const dir = path.join(root, 'extra');
  if (fs.existsSync(dir)) for (const f of fs.readdirSync(dir).filter(f => f.endsWith('.json.gz')))
    for (const [id, e] of Object.entries(JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(dir, f)))))) if (e.t?.possesso) poss.set(+id, e.t.possesso);
  return { quote, poss };
}
