// Replay della scelta del tris su partite passate, con probabilità individuali fuori campione.
// Per ogni stagione di prova s il modello è allenato solo sulle stagioni precedenti (stesse variabili della produzione:
// Serie A __FS_SA3, Champions __CFS3 senza lo spostamento di calibrazione). Formazioni = titolari reali (come con le ufficiali).
// Slot centrato = il titolare prende giallo/rosso, oppure lo prende chi entra al suo posto (regola del sostituto).
// Uso: node --max-old-space-size=6000 replay.mjs  → stampa le tabelle e scrive risultati.json
import fs from 'node:fs';
import { boot } from './boot.mjs';

const { all } = await boot();
const fitLogit = globalThis.fitLogit;
const ROLE = p => p === 1 ? 'D' : p === 3 ? 'F' : 'M';
const CARD = new Set(['Yellow', 'YellowRed', 'Red']);
const byTs = [...all].sort((a, b) => a.ts - b.ts || a.id - b.id);

// ---------- Elo semplice su tutte le gare dell'archivio (per il verso della sfavorita) ----------
const ELO = {}, GAP = {};
for (const m of byTs) {
  const h = m.h[0], a = m.a[0]; if (!Number.isFinite(m.hs) || !Number.isFinite(m.as)) continue;
  const eh = ELO[h] ?? 1500, ea = ELO[a] ?? 1500, d = eh + 60 - ea; GAP[m.id] = d;
  const exp = 1 / (1 + 10 ** (-d / 400)), s = m.hs > m.as ? 1 : m.hs === m.as ? .5 : 0, k = 20 * Math.log1p(Math.abs(m.hs - m.as));
  ELO[h] = eh + (k || 20) * (s - exp); ELO[a] = ea - (k || 20) * (s - exp);
}

// ---------- q del sostituto, ricostruita prima di ogni partita ----------
// pSub = uscite / titolarità nelle ultime 2 stagioni (tutte le competizioni), shrink 4 titolarità verso il ruolo;
// r = quota di subentrati (al posto di un giocatore di quel ruolo) ammoniti, nella stessa competizione, su tutto il passato.
const W = 730 * 86400, PL = new Map(), RQ = [], RC = { D: [0, 0], M: [0, 0], F: [0, 0] };
let qi = 0; const RS = {}; // RS[lg][role] = [subentrati, ammoniti]
const QAT = new Map(); // mid → Map(pid → {pSub, rPos, role})
const target = new Set(all.filter(m => m.lg === 55 || m.lg === 42).map(m => m.id));
for (const m of byTs) {
  const now = m.ts;
  while (qi < RQ.length && RQ[qi][0] < now - W) { const [, role, off] = RQ[qi++]; RC[role][0]--; if (off) RC[role][1]--; }
  const off = new Map((m.subs || []).map(s => [+s[1], +s[0]]));
  const booked = new Set((m.cards || []).filter(c => CARD.has(c[2])).map(c => +c[0]));
  const st = m.pl.filter(r => r[4] === 1 && r[3] !== 0);
  if (target.has(m.id)) {
    const Q = new Map();
    for (const r of st) {
      const role = ROLE(r[3]), ev = (PL.get(+r[0]) || []).filter(e => e[0] >= now - W);
      const prior = RC[role][0] ? RC[role][1] / RC[role][0] : .5, s = ev.length, o = ev.reduce((a, e) => a + e[1], 0);
      const rs = RS[m.lg]?.[role], rPos = rs && rs[0] > 50 ? rs[1] / rs[0] : null;
      Q.set(+r[0], { pSub: (o + 4 * prior) / (s + 4), s, o, prior, rPos, role, sub: off.get(+r[0]) ?? null, hitSub: off.has(+r[0]) && booked.has(off.get(+r[0])), hitSelf: booked.has(+r[0]) });
    }
    QAT.set(m.id, Q);
  }
  for (const r of st) {
    const role = ROLE(r[3]), o = off.has(+r[0]) ? 1 : 0;
    const a = PL.get(+r[0]) || []; a.push([now, o]); while (a.length && a[0][0] < now - W) a.shift(); PL.set(+r[0], a);
    RQ.push([now, role, o]); RC[role][0]++; RC[role][1] += o;
    if (o) { const t = ((RS[m.lg] ||= {})[role] ||= [0, 0]); t[0]++; if (booked.has(off.get(+r[0]))) t[1]++; }
  }
}

// ---------- probabilità individuali fuori campione ----------
function oos(rows, fs, seasons, minSeason) {
  const out = new Map();
  for (const s of seasons) {
    const tr = rows.filter(d => d.season < s && (!minSeason || d.season >= minSeason)), te = rows.filter(d => d.season === s);
    const mdl = fitLogit(tr, fs, 2);
    for (const d of te) { const p = Math.min(.95, Math.max(.005, mdl.pred(d))); (out.get(d.mid) || out.set(d.mid, []).get(d.mid)).push({ d, p }); }
  }
  return out;
}
const SEAS = ['2024/2025', '2025/2026', '2026/2027'];
const SA = oos(globalThis.__ROWS, globalThis.__FS_SA3, SEAS, '2021/2022');
const UCL = oos(globalThis.__CROWS2.filter(d => d.lg === 42), globalThis.__CFS3, SEAS);

// ---------- dataset per partita ----------
const ROLEQ = { D: .019, M: .042, F: .039 };
function matches(P, comp) {
  const res = [];
  for (const [mid, arr] of P) {
    const Q = QAT.get(+mid); if (!Q) continue;
    const pl = arr.map(({ d, p }) => {
      const q = Q.get(+d.pid); if (!q) return null;
      return { pid: +d.pid, n: d.name, side: d.home ? 'h' : 'a', role: d.role, p, qRole: ROLEQ[d.role], qPl: q.rPos != null ? q.pSub * q.rPos : ROLEQ[d.role],
        pSub: q.pSub, rPos: q.rPos, qK: Object.fromEntries([4, 10, 20, 40].map(k => [k, ROLEQ[d.role] * ((q.o + k * q.prior) / (q.s + k)) / q.prior])), subbed: q.sub != null, hit: q.hitSelf || q.hitSub, hitSelf: q.hitSelf, hitSub: q.hitSub, y: d.y };
    }).filter(Boolean);
    if (pl.length < 16) continue;
    res.push({ mid: +mid, comp, season: arr[0].d.season, gap: GAP[+mid] ?? 0, pl });
  }
  return res;
}
const DATA = [...matches(SA, 'sa'), ...matches(UCL, 'ucl')];

// ---------- regole di scelta ----------
const slot = (x, qk) => 1 - (1 - x.p) * (1 - (!qk ? 0 : qk.startsWith('k') ? x.qK[qk.slice(1)] : x[qk]));
function choose(m, o) {
  const ps = m.pl.map(x => ({ ...x, sp: slot(x, o.q) })).sort((a, b) => b.sp - a.sp), out = [];
  if (o.free) { const t = ps.slice(0, 9); for (let i = 0; i < t.length; i++) for (let j = i + 1; j < t.length; j++) for (let k = j + 1; k < t.length; k++) out.push([t[i], t[j], t[k]]); }
  else for (const two of ['h', 'a']) {
    const A = ps.filter(x => x.side === two).slice(0, 7), B = ps.filter(x => x.side !== two).slice(0, 7);
    for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) for (const b of B) out.push([A[i], A[j], b]);
  }
  const K = t => new Set(t.map(x => x.side)).size > 1 ? o.kMix : o.kSame;
  const score = o.score || (t => t.reduce((a, x) => a * x.sp, 1) * K(t));
  const res = out.map(t => ({ t, p3: t.reduce((a, x) => a * x.sp, 1) * K(t), s: score(t), two: o.free ? null : (t.filter(x => x.side === 'h').length === 2 ? 'h' : 'a') })).sort((a, b) => b.s - a.s);
  if (o.tie && !o.free && res.length > 1) {
    const alt = res.find(c => c.two !== res[0].two);
    if (alt && alt.s >= res[0].s * .95 && o.tie(m, ps, alt.two, res[0].two)) { res.splice(res.indexOf(alt), 1); res.unshift(alt); }
  }
  return res[0];
}
const sumP = (ps, sd) => ps.filter(x => x.side === sd).reduce((a, x) => a + x.sp, 0);
const tieSum = (m, ps, alt, cur) => sumP(ps, alt) > sumP(ps, cur);
const underdog = sd => m => (m.gap >= 0 ? 'a' : 'h') === sd;           // la sfavorita secondo l'Elo
const tieDog = (m, ps, alt, cur) => underdog(alt)(m) && Math.abs(m.gap) >= 100;

// fattori congiunti ricalcolati sullo sviluppo (2024/25): osservati / prodotto, sulle terne candidate (prime 7 per lato)
function estimateK(ms, q) {
  let em = 0, om = 0, es = 0, os = 0;
  for (const m of ms) {
    const ps = m.pl.map(x => ({ ...x, sp: slot(x, q) })).sort((a, b) => b.sp - a.sp);
    for (const two of ['h', 'a']) {
      const A = ps.filter(x => x.side === two).slice(0, 7), B = ps.filter(x => x.side !== two).slice(0, 7);
      for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) {
        for (const b of B) { em += A[i].sp * A[j].sp * b.sp; om += A[i].hit && A[j].hit && b.hit ? 1 : 0; }
        for (let k = j + 1; k < A.length; k++) { es += A[i].sp * A[j].sp * A[k].sp; os += A[i].hit && A[j].hit && A[k].hit ? 1 : 0; }
      }
    }
  }
  return { kMix: om / em, kSame: os / es, om, em, os, es };
}

const dev = DATA.filter(m => m.season === '2024/2025'), test = DATA.filter(m => m.season !== '2024/2025');
const KD = {}; for (const c of ['sa', 'ucl']) KD[c] = estimateK(dev.filter(m => m.comp === c), 'qRole');

const V = {
  A: { label: 'Regola attuale (1,16/1,04, 2+1, parità 5%, q di ruolo)', q: 'qRole', kMix: 1.16, kSame: 1.04, tie: tieSum },
  B: { label: 'Prodotto puro (senza fattore congiunto)', q: 'qRole', kMix: 1, kSame: 1, tie: tieSum },
  C: { label: 'Fattore ricalcolato sullo sviluppo 2024/25', q: 'qRole', kMix: null, kSame: null, tie: tieSum, kd: true },
  D: { label: 'Senza regola di parità del 5%', q: 'qRole', kMix: 1.16, kSame: 1.04, tie: null },
  E: { label: 'Parità: due posti alla sfavorita (Elo, divario ≥100)', q: 'qRole', kMix: 1.16, kSame: 1.04, tie: tieDog },
  F: { label: 'q del sostituto per giocatore', q: 'qPl', kMix: 1.16, kSame: 1.04, tie: tieSum },
  G: { label: 'Tris libero (prime 9, nessun vincolo 2+1)', q: 'qRole', kMix: 1.16, kSame: 1.04, free: true },
  H: { label: 'Massimi nomi attesi (somma delle p nel 2+1)', q: 'qRole', kMix: 1.16, kSame: 1.04, tie: null, score: t => t.reduce((a, x) => a + x.sp, 0) },
};

function run(ms, key) {
  return ms.map(m => {
    const o = { ...V[key] }; if (o.kd) Object.assign(o, KD[m.comp]);
    const c = choose(m, o), h = c.t.filter(x => x.hit).length;
    return { mid: m.mid, comp: m.comp, h, hs: c.t.filter(x => !x.hitSelf && x.hitSub).length, p3: Math.min(.5, c.p3), e: c.t.reduce((a, x) => a + x.sp, 0), two: c.two, names: c.t.map(x => x.n) };
  });
}
function summ(r) {
  const n = r.length, ll = r.reduce((a, x) => a - (x.h === 3 ? Math.log(x.p3) : Math.log(1 - x.p3)), 0) / n;
  return { n, nomi: r.reduce((a, x) => a + x.h, 0) / n, attesi: r.reduce((a, x) => a + x.e, 0) / n, ge2: r.filter(x => x.h >= 2).length / n,
    tre: r.filter(x => x.h === 3).length, tre_attesi: r.reduce((a, x) => a + x.p3, 0), ll3: ll, brier3: r.reduce((a, x) => a + ((x.h === 3) - x.p3) ** 2, 0) / n };
}
function boot2(a, b, f, B = 4000) { // differenza appaiata b − a, ricampionando le partite
  const n = a.length, d = a.map((x, i) => f(b[i]) - f(x)), mu = d.reduce((s, x) => s + x, 0) / n; const bs = [];
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let k = 0; k < B; k++) { let s = 0; for (let i = 0; i < n; i++) s += d[Math.floor(rnd() * n)]; bs.push(s / n); }
  bs.sort((x, y) => x - y); return [mu, bs[Math.floor(B * .025)], bs[Math.floor(B * .975)]];
}

const OUT = { creato: new Date().toISOString(), partite: {}, kd: KD, varianti: {} };
const fmt = (x, d = 3) => x.toFixed(d).replace('.', ',');
for (const [nome, set] of [['sviluppo 2024/25', dev], ['verifica 2025/26 + 2026/27', test]]) {
  for (const comp of ['sa', 'ucl', 'tutte']) {
    const ms = set.filter(m => comp === 'tutte' || m.comp === comp); if (!ms.length) continue;
    const base = run(ms, 'A');
    console.log(`\n== ${nome} · ${comp} · ${ms.length} partite ==`);
    console.log('var | nomi | attesi | >=2/3 | 3/3 oss/att | LL 3/3 | Δnomi [IC95] | Δ>=2/3 [IC95] | Δ3/3 per 100 [IC95] | cambia tris');
    for (const k of Object.keys(V)) {
      const r = k === 'A' ? base : run(ms, k), s = summ(r);
      const dn = boot2(base, r, x => x.h), d2 = boot2(base, r, x => x.h >= 2 ? 1 : 0), d3 = boot2(base, r, x => x.h === 3 ? 100 : 0);
      const ch = r.filter((x, i) => x.names.slice().sort().join() !== base[i].names.slice().sort().join()).length;
      console.log(`${k} | ${fmt(s.nomi)} | ${fmt(s.attesi)} | ${fmt(s.ge2)} | ${s.tre}/${fmt(s.tre_attesi, 1)} | ${fmt(s.ll3, 4)} | ${fmt(dn[0])} [${fmt(dn[1])}; ${fmt(dn[2])}] | ${fmt(d2[0])} [${fmt(d2[1])}; ${fmt(d2[2])}] | ${fmt(d3[0], 2)} [${fmt(d3[1], 2)}; ${fmt(d3[2], 2)}] | ${ch}`);
      (OUT.varianti[nome + '|' + comp] ||= {})[k] = { ...s, dnomi: dn, dge2: d2, d3: d3, cambiati: ch };
    }
    OUT.partite[nome + '|' + comp] = ms.length;
  }
}

// ---------- verifica della q: chi entra al posto del titolare prende il giallo? ----------
console.log('\n== q del sostituto: log loss dell\'evento "il subentrato al suo posto è ammonito" ==');
for (const comp of ['sa', 'ucl']) for (const [nome, set] of [['sviluppo', dev], ['verifica', test]]) {
  const xs = set.filter(m => m.comp === comp).flatMap(m => m.pl); let a = 0, b = 0, o = 0, ea = 0, eb = 0;
  for (const x of xs) { const y = x.hitSub ? 1 : 0; o += y; ea += x.qRole; eb += x.qPl; a -= y ? Math.log(x.qRole) : Math.log(1 - x.qRole); b -= y ? Math.log(x.qPl) : Math.log(1 - x.qPl); }
  console.log(`${comp} ${nome}: titolari ${xs.length}, subentrati ammoniti ${o} (ruolo attesi ${fmt(ea, 0)}, per giocatore ${fmt(eb, 0)}), LL ruolo ${fmt(a / xs.length, 5)} per giocatore ${fmt(b / xs.length, 5)} Δ ${fmt((b - a) / xs.length, 5)}`);
  (OUT.q ||= {})[comp + '|' + nome] = { n: xs.length, oss: o, att_ruolo: ea, att_pl: eb, ll_ruolo: a / xs.length, ll_pl: b / xs.length };
}
// calibrazione degli slot dei titolari (p individuale + q di ruolo) per decili
console.log('\n== calibrazione slot (verifica, q di ruolo) ==');
for (const comp of ['sa', 'ucl']) {
  const xs = test.filter(m => m.comp === comp).flatMap(m => m.pl).map(x => [slot(x, 'qRole'), x.hit ? 1 : 0]).sort((a, b) => a[0] - b[0]);
  const k = 5, rows = []; for (let i = 0; i < k; i++) { const s = xs.slice(Math.floor(i * xs.length / k), Math.floor((i + 1) * xs.length / k)); rows.push(`${fmt(s.reduce((a, x) => a + x[0], 0) / s.length)}→${fmt(s.reduce((a, x) => a + x[1], 0) / s.length)}`); }
  console.log(comp, rows.join('  '), 'totale', fmt(xs.reduce((a, x) => a + x[0], 0), 0), 'vs', xs.reduce((a, x) => a + x[1], 0));
}
console.log('\nfattori ricalcolati sullo sviluppo:', JSON.stringify(KD));
fs.writeFileSync(new URL('./risultati.json', import.meta.url), JSON.stringify(OUT, null, 1));

// ---------- criterio del progetto sullo slot: log loss titolare+sostituto e centrati tra i primi 3 per partita ----------
console.log('\n== slot (p + q): log loss e primi 3, q di ruolo contro q per giocatore ==');
for (const comp of ['sa', 'ucl']) for (const [nome, set] of [['sviluppo', dev], ['verifica', test]]) {
  const ms = set.filter(m => m.comp === comp); let la = 0, lb = 0, n = 0; const d3 = [];
  for (const m of ms) {
    for (const x of m.pl) { const y = x.hit ? 1 : 0, a = slot(x, 'qRole'), b = slot(x, 'qPl'); la -= y ? Math.log(a) : Math.log(1 - a); lb -= y ? Math.log(b) : Math.log(1 - b); n++; }
    const t = k => m.pl.map(x => [slot(x, k), x.hit]).sort((p, q) => q[0] - p[0]).slice(0, 3).filter(z => z[1]).length;
    d3.push(t('qPl') - t('qRole'));
  }
  const mu = d3.reduce((a, x) => a + x, 0) / d3.length, sd = Math.sqrt(d3.reduce((a, x) => a + (x - mu) ** 2, 0) / (d3.length - 1));
  console.log(`${comp} ${nome}: ΔLL slot ${fmt((lb - la) / n, 5)}  Δtop3 ${fmt(mu)} ± ${fmt(sd / Math.sqrt(d3.length))}`);
}

console.log('\n== q ridistribuita (media di ruolo invariata, shrink k titolarità) ==');
for (const k of ['k4','k10','k20','k40']) for (const comp of ['sa', 'ucl']) for (const [nome, set] of [['sviluppo', dev], ['verifica', test]]) {
  const ms = set.filter(m => m.comp === comp); let la = 0, lb = 0, n = 0; const d3 = [];
  for (const m of ms) {
    for (const x of m.pl) { const y = x.hit ? 1 : 0, a = slot(x, 'qRole'), b = slot(x, k); la -= y ? Math.log(a) : Math.log(1 - a); lb -= y ? Math.log(b) : Math.log(1 - b); n++; }
    const t = q => m.pl.map(x => [slot(x, q), x.hit]).sort((p, r) => r[0] - p[0]).slice(0, 3).filter(z => z[1]).length;
    d3.push(t(k) - t('qRole'));
  }
  const mu = d3.reduce((a, x) => a + x, 0) / d3.length, sd = Math.sqrt(d3.reduce((a, x) => a + (x - mu) ** 2, 0) / (d3.length - 1));
  const r = run(ms.length ? ms : [], 'A'), r2 = ms.map(m => { const c = choose(m, { ...V.A, q: k }); return { h: c.t.filter(x => x.hit).length }; });
  const dn = boot2(r, r2, x => x.h);
  console.log(`${k} ${comp} ${nome}: ΔLL slot ${fmt((lb - la) / n, 5)}  Δtop3 ${fmt(mu)} ± ${fmt(sd / Math.sqrt(d3.length))}  Δnomi tris ${fmt(dn[0])} [${fmt(dn[1])}; ${fmt(dn[2])}]`);
}

{ const r = run(DATA, 'A'), h = r.reduce((a, x) => a + x.h, 0), hs = r.reduce((a, x) => a + x.hs, 0);
  console.log(`\n== idea 55: nomi centrati dal solo sostituto (regola attuale, tutte le partite) == ${hs} su ${h} (${(100 * hs / h).toFixed(1)}%); tris completi grazie al sostituto: ${r.filter(x => x.h === 3 && x.hs > 0).length} su ${r.filter(x => x.h === 3).length}`); }
