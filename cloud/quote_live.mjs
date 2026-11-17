// Quote "giocatore ammonito" in pagina (OddsPapi, 13/11/2026): per le partite delle prossime 36 ore chiede le quote correnti di
// Sisal, bet365.it ed Eurobet e le salva in m.qg = { agg: secondi, q: { "N. Cognome": { sisal: 3.5, bet365: 3.4, eurobet: 3.25 } } }.
// Aggiorna ogni partita al massimo ogni 90 minuti, e subito quando arrivano le ufficiali. Al massimo 4 partite per giro (limite del piano).
// Serve il segreto ODDSPAPI_KEY; senza, non fa nulla. Gli errori non fermano la Giornata.
const B = 'https://api.oddspapi.io/v4', CARD = '102732', BOOKS = 'sisal.it,bet365.it,eurobet.it';
const TOUR = { sa: 23, ucl: 7, naz: 23755 }, LABEL = { 'sisal.it': 'sisal', 'bet365.it': 'bet365', 'eurobet.it': 'eurobet' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const norm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tri = s => { const t = new Set(), x = '  ' + norm(s) + ' '; for (let i = 0; i < x.length - 2; i++) t.add(x.slice(i, i + 3)); return t; };
const sim = (a, b) => { const A = tri(a), C = tri(b); let k = 0; for (const x of A) if (C.has(x)) k++; return k / Math.max(1, Math.min(A.size, C.size)); };
async function get(key, p, q) {
  for (let k = 0; k < 4; k++) {
    await sleep(3500); const u = new URL(B + p); for (const [a, v] of Object.entries({ ...q, apiKey: key })) u.searchParams.set(a, v);
    const r = await fetch(u, { signal: AbortSignal.timeout(20000) }); if (r.status === 429) { await sleep(2500); continue; }
    if (!r.ok) return null; return r.json();
  }
  return null;
}
// "Bijol, Jaka" ↔ "J. Bijol"; "Wesley" ↔ "Wesley"; cognomi composti ↔ "Gnezda Čerin, Adam"
export function sameName(ours, theirs) {
  const [sur, given = ''] = String(theirs).split(',').map(s => norm(s));
  const o = norm(ours), m = String(ours).match(/^(\S)\.\s+(.+)$/);
  if (m) return norm(m[2]) === sur && (!given || given[0] === norm(m[1])[0]);
  return o === sur || o === norm(given + ' ' + sur) || o === given;
}
// stesso giocatore con traslitterazione diversa (Markhiev/Markhiyev): iniziale uguale e cognome simile, solo se il migliore è unico
export function fuzzyRow(pl, theirs) {
  const [sur, given = ''] = String(theirs).split(',').map(s => norm(s));
  const c = pl.map(r => { const m = String(r[0]).match(/^(\S)\.\s+(.+)$/); if (!m || (given && norm(m[1])[0] !== given[0])) return null; const so = x => norm(x).replace(/ /g, '').split('').sort().join(''); return { r, s: so(m[2]) === so(sur) ? .95 : sim(m[2], sur) }; })
    .filter(x => x && x.s >= .6).sort((a, b) => b.s - a.s);
  return c.length && (c.length === 1 || c[0].s - c[1].s > .15) ? c[0].r : null;
}
const xiDi = m => m.pl.filter(r => (r[6] ?? 100) === 100).map(r => r[0]).sort().join('|');   // titolari della scheda: lega la cache delle quote alla formazione
export async function updateQuoteLive(rounds, now) {
  const key = process.env.ODDSPAPI_KEY; if (!key) return false;
  let touched = false, budget = 4;
  try {
    for (const round of rounds) {
      const t = TOUR[round.comp]; if (!t) continue;
      const due = round.section.matches.filter(m => m.ko > now && m.ko - now < 36 * 3600 && m.pl?.length &&
        (!m.qg || now - m.qg.agg > 90 * 60 || (m.uff && !m.qg.uff) || (m.uff && m.qg.xi && m.qg.xi !== xiDi(m)))).sort((a, b) => a.ko - b.ko);   // 17/11: XI cambiato → quote da rileggere
      if (!due.length || budget <= 0) continue;
      const d0 = new Date((now - 86400) * 1000).toISOString().slice(0, 10), d1 = new Date((now + 3 * 86400) * 1000).toISOString().slice(0, 10);
      const fx = await get(key, '/fixtures', { tournamentId: t, from: d0, to: d1 }); const F = Array.isArray(fx) ? fx : fx?.data || [];
      for (const m of due) {
        if (budget-- <= 0) break;
        const en = m.en || [m.h, m.a];
        const best = F.map(f => ({ f, s: sim(en[0], f.participant1Name) + sim(en[1], f.participant2Name), dt: Math.abs(Date.parse(f.startTime) / 1000 - m.ko) }))
          .filter(x => x.dt < 6 * 3600).sort((a, b) => b.s - a.s)[0];
        if (!best || best.s < .9) { m.qg = { agg: now, uff: m.uff ? 1 : 0, q: {}, nota: 'partita non trovata' }; touched = true; continue; }
        const o = await get(key, '/odds', { fixtureId: best.f.fixtureId, bookmakers: BOOKS }); if (!o) continue;
        const q = {};
        for (const [b, v] of Object.entries(o.bookmakerOdds || {})) {
          const P = Object.values(v.markets?.[CARD]?.outcomes || {})[0]?.players || {};
          for (const x of Object.values(P)) {
            if (!x?.active || !x.playerName || !(x.price > 1)) continue;
            const row = m.pl.find(r => sameName(r[0], x.playerName)) || fuzzyRow(m.pl, x.playerName); if (!row) continue;
            if (m.pl.filter(r => r[0] === row[0]).length > 1) continue;   // 17/11: nome abbreviato condiviso (es. due «S. Camara»): meglio nessuna quota che quella dell'altro
            (q[row[0]] ||= {})[LABEL[b] || b] = x.price;
          }
        }
        // 17/11: la stima della Champions legge m.qg prima di questo passo. Se qui arrivano per la prima volta almeno 10 quote sulle
        // ufficiali, la partita va ricalcolata al giro dopo (prima del via) perché tris e percentuali usino queste quote.
        const xi = m.uff ? xiDi(m) : null, utili = (x, sig) => Object.entries(x?.q || {}).filter(([n, b]) => (!sig || sig.split('|').includes(n)) && Object.values(b).some(v => v > 1)).length;
        if (round.comp === 'ucl' && m.uff && utili({ q }, xi) >= 10 && !(m.qg?.uff && m.qg.xi === xi && utili(m.qg, xi) >= 10)) m.qg_ricalcola = 1;
        m.qg = { agg: now, uff: m.uff ? 1 : 0, ...(xi ? { xi } : {}), q }; touched = true;
        // linea cartellini della partita: la più equilibrata fra Over/Under (mercati 10914 + 4·(linea − 0,5); Over = id, Under = id + 1)
        for (const b of ['sisal.it', 'bet365.it', 'eurobet.it']) {
          const mk = o.bookmakerOdds?.[b]?.markets; if (!mk) continue; let best = null;
          for (let h = .5; h <= 14.5; h += .5) { const id = 10914 + 4 * (h - .5), oc = mk[id]?.outcomes; if (!oc) continue;
            const pr = k => { const x = Object.values(oc[k]?.players || {})[0]; return x?.active !== false && x?.price > 1 ? x.price : null; }, ov = pr(id), un = pr(id + 1);
            if (ov && un && (!best || Math.abs(Math.log(ov / un)) < Math.abs(Math.log(best[1] / best[2])))) best = [h, ov, un]; }
          if (best) { const line = String(best[0]).replace('.', ','); if (m.line !== line || m.line_src !== LABEL[b]) { m.line = line; delete m.line_est; m.line_src = { sisal: 'Sisal', bet365: 'bet365', eurobet: 'Eurobet' }[LABEL[b]]; m.line_q = [best[1], best[2]]; } break; }
        }
        console.log(`Quote giocatore ${m.h}-${m.a}: ${Object.keys(q).length} giocatori (${[...new Set(Object.values(q).flatMap(Object.keys))].join(', ') || 'nessun bookmaker'})`);
      }
    }
  } catch (e) { console.warn('Quote giocatore:', e.message); }
  return touched;
}
