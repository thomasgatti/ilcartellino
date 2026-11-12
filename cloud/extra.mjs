// Sezione EXTRA: big match dei grandi campionati esteri e delle coppe nazionali (più le partite scelte dall'utente),
// con tris di ammoniti (modello Serie A FotMob riallenato sul campionato del paese) e angoli previsti per squadra
// (regressione di Poisson su angoli, tiri, tocchi in area, xG e possesso delle ultime 10 gare di campionato).
// Scrive data.json → extra = { updated, matches: [...], storico: [...] }. Gira dopo cloud/giornata.mjs nel workflow.
// Uso: node cloud/extra.mjs [archivio fotmob] [archivio extra]
import fs from 'node:fs'; import path from 'node:path'; import zlib from 'node:zlib';
import { loadLib } from './lib_node.mjs';
import { makeTagger } from './etichette.mjs';

const HIST = process.argv[2] || 'dati/fotmob', XDIR = process.argv[3] || 'dati/extra';
const DATA = 'bot/webapp/data.json', CFG = 'bot/webapp/extra_scelte.json';
const hour = 3600, day = 86400;
const now = (process.env.CARTELLINO_ORA ? Date.parse(process.env.CARTELLINO_ORA) : Date.now()) / 1000;
const FORCE = process.env.EXTRA_FORZA === '1';

// competizioni: campionati (con classifica) e coppe nazionali
const COMPS = {
  47: ['Premier League', 'ENG'], 87: ['LaLiga', 'ESP'], 54: ['Bundesliga', 'GER'], 53: ['Ligue 1', 'FRA'],
  132: ['FA Cup', 'ENG'], 133: ['EFL Cup', 'ENG'], 138: ['Copa del Rey', 'ESP'], 209: ['DFB Pokal', 'GER'], 134: ['Coupe de France', 'FRA'], 141: ['Coppa Italia', 'ITA'],
};
const LEAGUE_OF = { ENG: 47, ESP: 87, GER: 54, FRA: 53, ITA: 55 };
const DERBY = [['Real Madrid', 'Barcelona'], ['Real Madrid', 'Atlético Madrid'], ['Barcelona', 'Atlético Madrid'], ['Sevilla', 'Real Betis'], ['Athletic Club', 'Real Sociedad'],
  ['Barcelona', 'Espanyol'], ['Valencia', 'Villarreal'], ['Liverpool', 'Everton'], ['Manchester United', 'Manchester City'], ['Arsenal', 'Tottenham Hotspur'],
  ['Liverpool', 'Manchester United'], ['Arsenal', 'Chelsea'], ['Chelsea', 'Tottenham Hotspur'], ['Liverpool', 'Manchester City'], ['Newcastle United', 'Sunderland'],
  ['Borussia Dortmund', 'Bayern München'], ['Borussia Dortmund', 'Schalke 04'], ['Hamburger SV', 'Werder Bremen'], ['1. FC Köln', 'Borussia Mönchengladbach'],
  ['Paris Saint-Germain', 'Marseille'], ['Lyon', 'Saint-Étienne'], ['Nice', 'Monaco'], ['Lens', 'Lille'],
  ['Inter', 'AC Milan'], ['Juventus', 'Torino'], ['Roma', 'Lazio'], ['Inter', 'Juventus'], ['Genoa', 'Sampdoria'], ['Napoli', 'Roma']];
const TOP = 7, MAX_AUTO = 8, AHEAD = 14 * day;

const read = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const data = read(DATA);
const cfg = fs.existsSync(CFG) ? read(CFG) : { aggiunte: [], escluse: [] };
const ex = data.extra ||= { updated: 0, matches: [], storico: [] };
ex.storico ||= [];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const get = async u => { for (let k = 0; k < 4; k++) { try { const r = await fetch(u); if (r.status === 200) return await r.json(); if (r.status === 429) await sleep(4000); } catch {} await sleep(800); } return null; };
const short = n => { const w = String(n || '').trim().split(/\s+/); return w.length > 1 ? w[0][0] + '. ' + w.slice(1).join(' ') : w[0]; };

// --- quando ricalcolare: ogni 3 ore, oppure se una partita inizia entro 2 ore senza formazioni ufficiali, oppure se c'è un esito da archiviare
const due = ex.matches.some(m => (m.ko > now && m.ko - now < 2 * hour && !m.uff) || now > m.ko + 2.5 * hour);
if (!FORCE && now - (ex.updated || 0) < 3 * hour && !due) { console.log('EXTRA: niente da fare'); process.exit(0); }

loadLib(['fotmob_scrape.js', 'fm_model.js']);
const loadGz = f => JSON.parse(zlib.gunzipSync(fs.readFileSync(f)));
const archive = (dir, lg) => fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.startsWith(lg + '_') && f.endsWith('.json.gz')).flatMap(f => Object.values(loadGz(path.join(dir, f)))) : [];

// --- 1. esiti delle partite finite
for (const m of [...ex.matches]) {
  if (now < m.ko + 2.5 * hour) continue;
  const j = await get('/api/data/matchDetails?matchId=' + m.id);
  const st = j?.header?.status;
  if (st?.cancelled || st?.awarded || (now > m.ko + 2 * day && !st?.finished)) { ex.matches = ex.matches.filter(x => x.id !== m.id); continue; }
  if (!st?.finished) continue;
  const ev = j.content?.matchFacts?.events?.events || [], H = j.header.teams;
  const names = {}; for (const p of Object.values(j.content?.playerStats || {})) names[p.id] = short(p.name);
  const cards = ev.filter(e => e.type === 'Card' && e.player?.name && ['Yellow', 'YellowRed', 'Red'].includes(e.card))
    .map(e => [e.time, short(e.player.name), e.card === 'Red' ? 'R' : e.card === 'YellowRed' ? 'GR' : 'G', e.isHome ? 'h' : 'a']).filter(c => Object.values(names).includes(c[1]));
  const subs = {}; for (const e of ev.filter(e => e.type === 'Substitution' && e.swap?.length === 2)) subs[short(e.swap[1].name)] = short(e.swap[0].name);
  const corners = (j.content?.stats?.Periods?.All?.stats || []).flatMap(g => g.stats || []).find(s => s.key === 'corners')?.stats;
  ex.storico.unshift({ id: m.id, comp: m.comp, h: m.h, a: m.a, hc: m.hc, ac: m.ac, ko: m.ko, finale: `${H[0].score}-${H[1].score}`, tris: m.tris, angoli_prev: m.corners ? [m.corners.h.mu, m.corners.a.mu] : null,
    ammoniti: cards, sostituzioni: subs, angoli: Array.isArray(corners) && corners.every(Number.isFinite) ? corners : null });
  ex.matches = ex.matches.filter(x => x.id !== m.id);
  console.log('EXTRA archiviata', m.h, m.a);
}
ex.storico = ex.storico.slice(0, 150);

// --- 2. calendario e classifiche
const comps = {};
for (const id of Object.keys(COMPS).concat(['55'])) { comps[id] = await get('/api/data/leagues?id=' + id); await sleep(150); }
const rank = {};   // id squadra → posizione nel suo campionato
for (const lg of [47, 87, 54, 53, 55]) {
  const t = comps[lg]?.table?.[0]?.data; const rows = t?.table?.all || t?.tables?.flatMap(x => x.table?.all || []) || [];
  for (const r of rows) rank[r.id] = r.idx;
}
const isDerby = (a, b) => DERBY.some(([x, y]) => (a === x && b === y) || (a === y && b === x));
const cand = [];
for (const [cid, [cname, country]] of Object.entries(COMPS)) {
  for (const f of comps[cid]?.fixtures?.allMatches || []) {
    const ko = Date.parse(f.status?.utcTime) / 1000;
    if (!(ko > now) || ko > now + AHEAD || f.status?.cancelled) continue;
    const rh = rank[f.home?.id] ?? 99, ra = rank[f.away?.id] ?? 99, derby = isDerby(f.home?.name, f.away?.name);
    const chosen = (cfg.aggiunte || []).includes(+f.id);
    if (!chosen && (cfg.escluse || []).includes(+f.id)) continue;
    if (chosen || derby || (rh <= TOP && ra <= TOP)) cand.push({ id: +f.id, comp: cname, cid: +cid, country, ko, h: f.home.name, a: f.away.name, hid: f.home.id, aid: f.away.id, derby, chosen, score: rh + ra - (derby ? 6 : 0) });
  }
}
cand.sort((a, b) => b.chosen - a.chosen || a.score - b.score);
const picked = [...cand.filter(c => c.chosen), ...cand.filter(c => !c.chosen).slice(0, MAX_AUTO)].sort((a, b) => a.ko - b.ko);
console.log('EXTRA partite:', picked.map(c => `${c.h}-${c.a} (${c.comp})`).join(', ') || 'nessuna');

// --- 3. modelli per paese
let tagger = null;
const LINES = [2.5, 3.5, 4.5, 5.5, 6.5, 7.5];
function cornerModel(lg) {
  const ms = archive(XDIR, lg).filter(m => ['angoli', 'tiri', 'tocchi_area', 'xg', 'possesso'].every(k => m.t?.[k])).sort((a, b) => a.ts - b.ts);
  const K = ['angoli', 'tiri', 'tocchi_area', 'xg', 'possesso'], hist = {}, lgH = [], rowsH = [], rowsA = [];
  const avg = (H, k, i) => H.reduce((s, x) => s + x[k][i], 0) / H.length;
  const feats = (th, ta) => { const Hh = (hist[th] || []).slice(-10), Ha = (hist[ta] || []).slice(-10); if (Hh.length < 3 || Ha.length < 3 || lgH.length < 100) return null;
    const L = lgH.slice(-380), lh = L.reduce((s, x) => s + x[0], 0) / L.length, la = L.reduce((s, x) => s + x[1], 0) / L.length, lx = v => Math.log(Math.max(v, .05));
    const side = (A, B, lgm) => [1, lx(lgm), lx(avg(A, 'angoli', 0)), lx(avg(B, 'angoli', 1)), lx(avg(A, 'tiri', 0)), lx(avg(B, 'tiri', 1)), lx(avg(A, 'tocchi_area', 0)), lx(avg(B, 'tocchi_area', 1)),
      lx(avg(A, 'xg', 0)), lx(avg(B, 'xg', 1)), lx(avg(A, 'possesso', 0)), lx(avg(B, 'possesso', 0))];
    return [side(Hh, Ha, lh), side(Ha, Hh, la)]; };
  for (const m of ms) {
    const f = feats(m.h[0], m.a[0]); if (f) { rowsH.push([f[0], m.t.angoli[0]]); rowsA.push([f[1], m.t.angoli[1]]); }
    for (const [team, o] of [[m.h[0], 0], [m.a[0], 1]]) (hist[team] ||= []).push(Object.fromEntries(K.map(k => [k, [m.t[k][o], m.t[k][1 - o]]])));
    lgH.push(m.t.angoli);
  }
  const fit = rows => { const k = rows[0][0].length; let b = new Array(k).fill(0); b[0] = Math.log(rows.reduce((s, r) => s + r[1], 0) / rows.length);
    for (let it = 0; it < 40; it++) { const Hm = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
      for (const [x, y] of rows) { const mu = Math.exp(x.reduce((s, v, i) => s + v * b[i], 0)); for (let i = 0; i < k; i++) { g[i] += (y - mu) * x[i]; for (let c = 0; c < k; c++) Hm[i][c] += mu * x[i] * x[c]; } }
      for (let i = 1; i < k; i++) { Hm[i][i] += 1; g[i] -= b[i]; }
      const A = Hm.map((r, i) => [...r, g[i]]); for (let i = 0; i < k; i++) { let mx = i; for (let r = i + 1; r < k; r++) if (Math.abs(A[r][i]) > Math.abs(A[mx][i])) mx = r; [A[i], A[mx]] = [A[mx], A[i]];
        for (let r = 0; r < k; r++) if (r !== i) { const q = A[r][i] / A[i][i]; for (let c = i; c <= k; c++) A[r][c] -= q * A[i][c]; } }
      const step = A.map((r, i) => r[k] / r[i]); b = b.map((v, i) => v + step[i]); if (Math.max(...step.map(Math.abs)) < 1e-7) break; }
    // dispersione (binomiale negativa): var = mu + mu^2 / r
    let num = 0, den = 0; for (const [x, y] of rows) { const mu = Math.exp(x.reduce((s, v, i) => s + v * b[i], 0)); num += mu * mu; den += (y - mu) ** 2 - mu; }
    return { b, r: den > 0 ? num / den : 50 }; };
  if (rowsH.length < 300) return null;
  const MH = fit(rowsH), MA = fit(rowsA);
  return (th, ta) => { const f = feats(th, ta); if (!f) return null; return { h: [Math.exp(f[0].reduce((s, v, i) => s + v * MH.b[i], 0)), MH.r], a: [Math.exp(f[1].reduce((s, v, i) => s + v * MA.b[i], 0)), MA.r] }; };
}
const nbPmf = (mu, r, n = 30) => { const p = r / (r + mu), out = [Math.pow(p, r)]; for (let k = 1; k <= n; k++) out.push(out[k - 1] * (k - 1 + r) / k * (1 - p)); return out; };
const cornerOut = c => {
  if (!c) return null;
  const ph = nbPmf(...c.h), pa = nbPmf(...c.a), over = pm => LINES.map(L => +(1 - pm.slice(0, Math.floor(L) + 1).reduce((s, x) => s + x, 0)).toFixed(3));
  let hw = 0, dr = 0; for (let i = 0; i < ph.length; i++) for (let k = 0; k < pa.length; k++) { if (i > k) hw += ph[i] * pa[k]; else if (i === k) dr += ph[i] * pa[k]; }
  return { h: { mu: +c.h[0].toFixed(2), o: over(ph) }, a: { mu: +c.a[0].toFixed(2), o: over(pa) }, piu_casa: +hw.toFixed(3), pari: +dr.toFixed(3), linee: LINES };
};

// --- 4. previsioni
const byCountry = {}; for (const c of picked) (byCountry[c.country] ||= []).push(c);
const out = [];
for (const [country, list] of Object.entries(byCountry)) {
  const lg = LEAGUE_OF[country];
  const ms = archive(HIST, lg).filter(m => m.pl?.length > 20 && m.ts < now);
  window.__FMM = Object.fromEntries(ms.map(m => [m.id, m])); fmBuild();
  const seasons = [...new Set(window.__ROWS.map(d => d.season))].sort();
  // + divario di forza con il segno (Elo del campionato, casa +60): la sfavorita prende più gialli di quanto dicono le sole variabili di squadra.
  // Studio 12/11 (ricerca/nazionali/sfavorita_campionati.mjs, test per stagione): log loss Premier −0,00068, LaLiga −0,00040, Bundesliga −0,00023,
  // Ligue 1 −0,00043, Serie A −0,00097 con questo modello (nel modello Serie A di produzione invece non aggiunge nulla: c'è già forza_ruolo).
  const ELO = {}, GAP = {};
  for (const m of [...ms].filter(m => m.ts && m.hs != null).sort((a, b) => a.ts - b.ts)) { const eh = ELO[m.h[0]] ?? 1500, ea = ELO[m.a[0]] ?? 1500; GAP[m.id] = ea - eh - 60;
    const e = 1 / (1 + 10 ** ((ea - eh - 60) / 400)), r = m.hs > m.as ? 1 : m.hs === m.as ? .5 : 0; ELO[m.h[0]] = eh + 20 * (r - e); ELO[m.a[0]] = ea - 20 * (r - e); }
  const sg = d => (d.home ? 1 : -1) * (GAP[d.mid] ?? globalThis.__CURGAP ?? 0) / 100;
  const G = fmGroups(window.__ROWS), FS = [...G.filter(g => ['base', 'lega', 'squadre', 'duelli'].includes(g[0])).flatMap(g => g[1]), d => Math.max(0, sg(d)), d => Math.max(0, -sg(d))];
  const fin = { model: fitLogit(window.__ROWS.filter(d => seasons.slice(0, -1).includes(d.season)), FS) };
  const cm = cornerModel(lg);
  for (const c of list) {
    const old = ex.matches.find(m => m.id === c.id);
    let pl = [], lt = null, ref = null; const tags = {};
    try {
      globalThis.__CURGAP = (ELO[c.aid] ?? 1500) - (ELO[c.hid] ?? 1500) - 60;   // squadre di altri campionati (coppe): 1500
      const r = await fmPredictMatch(c.id, fin.model);
      lt = r.lineupType || null; ref = r.ref || null;
      const num = {}; const j = await get('/api/data/matchDetails?matchId=' + c.id);
      for (const T of [j?.content?.lineup?.homeTeam, j?.content?.lineup?.awayTeam]) for (const p of [...(T?.starters || []), ...(T?.subs || [])]) num[p.id] = p.shirtNumber;
      const tc = j?.general?.teamColors?.lightMode; if (tc) { c.hc = [tc.home, '#ffffff']; c.ac = [tc.away, '#ffffff']; }
      pl = r.out.filter(x => x.st).map(x => [short(x.name), x.side ? 'h' : 'a', +x.p.toFixed(4), x.role, num[x.id] ?? null]).sort((a, b) => b[2] - a[2]);
      // etichette (ex di turno, gialli contro l'avversaria, rientro da squalifica, testa calda) dall'archivio di tutti i campionati
      tagger ??= makeTagger(fs.readdirSync(HIST).filter(f => f.endsWith('.json.gz')).flatMap(f => Object.values(loadGz(path.join(HIST, f)))));
      for (const x of r.out.filter(x => x.st)) {
        const t = tagger(+x.id, +(x.side ? c.hid : c.aid), +(x.side ? c.aid : c.hid), x.side ? c.a : c.h, c.ko, true);
        if (t.length) tags[short(x.name)] = t;
      }
    } catch (e) { console.log('EXTRA senza formazioni', c.h, c.a, String(e).slice(0, 80)); }
    const best = side => pl.filter(p => p[1] === side);
    let tris = [];
    if (best('h').length && best('a').length) {
      const A = [...best('h').slice(0, 2), best('a')[0]], B = [...best('a').slice(0, 2), best('h')[0]];
      const prod = t => t.reduce((s, p) => s * p[2], 1);
      tris = (prod(A) >= prod(B) ? A : B).map(p => ({ n: p[0], s: p[1], p: p[2], r: p[3], num: p[4] }));
    }
    if (!pl.length) lt = null;           // FotMob segna 'standard' anche quando non ci sono ancora titolari
    const uff = lt === 'standard' ? 1 : 0;
    // 1X2 dalle quote FotMob (bet365, senza margine), come per Serie A e Champions
    let odds = old?.odds || null;
    const oj = await get('/api/data/matchOdds?matchId=' + c.id + '&ccode3=ESP');
    const r1 = (oj?.odds?.oddsTabMarkets || []).flatMap(x => x.markets || []).find(x => x.headerTranslationKey === 'who_will_win');
    if (r1?.selections?.length === 3) { const q = r1.selections.map(x => 1 / +x.oddsDecimal), t = q.reduce((a, b) => a + b, 0); odds = `${Math.round(q[0] / t * 100)}/${Math.round(q[2] / t * 100)}`; }
    const lgAvg = ms.slice(-380).reduce((a, m) => a + (m.cards || []).length, 0) / Math.max(1, ms.slice(-380).length);
    out.push({ id: c.id, comp: c.comp, ko: c.ko, h: c.h, a: c.a, hc: c.hc || old?.hc || null, ac: c.ac || old?.ac || null, derby: c.derby ? 1 : 0, scelta: c.chosen ? 1 : 0, lt, uff, ref, odds, lgAvg,
      tags: Object.keys(tags).length ? tags : old?.tags || {}, tris: tris.length ? tris : old?.tris || [], pl: pl.length ? pl.slice(0, 22) : old?.pl || [], corners: cornerOut(cm && cm(c.hid, c.aid)) || old?.corners || null });
  }
}
// linea cartellini stimata (come in giornata.mjs): media cartellini del campionato × √(somma probabilità titolari / media delle partite EXTRA)
const sumP = m => (m.pl || []).reduce((a, p) => a + p[2], 0), withPl = out.filter(m => m.pl?.length >= 20), meanP = withPl.reduce((a, m) => a + sumP(m), 0) / Math.max(1, withPl.length);
for (const m of out) {
  const lambda = m.lgAvg * (m.pl?.length >= 20 && meanP ? Math.sqrt(sumP(m) / meanP) : 1); delete m.lgAvg;
  if (!(lambda > 0)) continue;
  let k = 0, term = Math.exp(-lambda), cdf = term; while (cdf < .5) { k++; term *= lambda / k; cdf += term; }
  m.line = (k + .5).toFixed(1).replace('.', ','); m.line_est = 1;
}
// arbitro: cartellini e gialli a gara in tutto l'archivio
if (out.some(m => m.ref)) {
  const all = fs.readdirSync(HIST).filter(f => f.endsWith('.json.gz')).flatMap(f => Object.values(loadGz(path.join(HIST, f))));
  const nrm = n => String(n).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}]/gu, '');
  for (const m of out.filter(m => m.ref)) {
    const g = all.filter(x => x.ref?.[1] && nrm(x.ref[1]) === nrm(m.ref) && x.ts < m.ko); if (!g.length) continue;
    const c = g.reduce((a, x) => a + (x.cards || []).length, 0), y = g.reduce((a, x) => a + (x.cards || []).filter(k => k[2] !== 'Red').length, 0), d = v => v.toFixed(1).replace('.', ',');
    m.refnote = `${d(c / g.length)} cartellini/gara · ${d(y / g.length)} gialli · ${g.length} gare in archivio`;
  }
}
ex.matches = out.sort((a, b) => a.ko - b.ko);
ex.updated = Math.round(now);
fs.writeFileSync(DATA, JSON.stringify(data));
console.log('EXTRA aggiornata:', ex.matches.length, 'partite,', ex.storico.length, 'nello storico');
