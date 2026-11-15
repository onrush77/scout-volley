/* Scout Volley — motore della partita.
 *
 * Tutto lo stato della partita deriva dalla lista di eventi (match.events):
 * lo stato si ricostruisce rigiocando gli eventi dall'inizio. Così "Annulla"
 * è semplicemente togliere l'ultimo evento, e funziona per tutto (tocchi,
 * punti, rotazioni, cambi, fine set).
 *
 * Nessuna dipendenza dal DOM: funziona nel browser e in Node (per i test).
 */
(function (root) {
  'use strict';

  const POS = ['P1', 'P2', 'P3', 'P4', 'P5', 'P6'];
  const BACK_ROW = ['P5', 'P6', 'P1']; // ordine di preferenza per il libero
  const TEAMS = ['noi', 'avv'];

  // Effetti di un tocco:
  //  win   -> punto alla squadra che tocca
  //  lose  -> punto all'altra squadra
  //  other -> la palla passa all'altra squadra (3 nuovi tocchi)
  //  keep  -> la stessa squadra continua, conta come tocco
  //  reset -> la stessa squadra continua con 3 nuovi tocchi (dopo un muro)
  // label: testo sul pulsante. hidden: esito valido nei dati ma non proposto a schermo.
  // sub: spiegazione breve mostrata sotto l'esito, per chi usa l'app la prima volta.
  const FUNDS = {
    B: { name: 'Battuta', grades: [
      { g: '#', label: 'Ace', sub: 'punto diretto', effect: 'win' },
      { g: '+', label: 'Buona', sub: 'ricezione in difficoltà', effect: 'other' },
      { g: '!', label: 'Media', sub: 'ricezione discreta', effect: 'other' },
      { g: '-', label: 'Facile', sub: 'ricezione comoda', effect: 'other' },
      { g: '/', label: 'Rimandata', effect: 'other', hidden: true },
      { g: '=', label: 'Errore', sub: 'rete o fuori', effect: 'lose' },
    ] },
    R: { name: 'Ricezione', grades: [
      { g: '#', label: '++', sub: 'in testa all\'alzatore', effect: 'keep' },
      { g: '+', label: 'Buona', sub: 'si attacca bene', effect: 'keep' },
      { g: '!', label: 'Media', effect: 'keep', hidden: true },
      { g: '-', label: 'Scarsa', sub: 'attacco difficile', effect: 'keep' },
      { g: '/', label: 'Rimandata di là', sub: 'senza attaccare', effect: 'other' },
      { g: '=', label: 'Errore / ace subito', sub: 'punto loro', effect: 'lose' },
    ] },
    E: { name: 'Alzata', grades: [
      { g: '#', label: 'Perfetta', sub: 'attaccante libero', effect: 'keep' },
      { g: '+', label: 'Buona', sub: 'attaccabile', effect: 'keep' },
      { g: '-', label: 'Scarsa', sub: 'attacco forzato', effect: 'keep' },
      { g: '/', label: 'Di là', effect: 'other', hidden: true },
      { g: '=', label: 'Errore', sub: 'doppia / fallo', effect: 'lose' },
    ] },
    A: { name: 'Attacco', grades: [
      { g: '#', label: 'Punto', sub: 'palla a terra', effect: 'win' },
      { g: '+', label: 'Difeso male', sub: 'loro in difficoltà', effect: 'other' },
      { g: '-', label: 'Difeso bene', sub: 'loro contrattaccano', effect: 'other' },
      { g: '!', label: 'Coperto', sub: 'murato ma rigiocato', effect: 'reset' },
      { g: '/', label: 'Murato', sub: 'muro punto loro', effect: 'lose' },
      { g: '=', label: 'Errore', sub: 'fuori o in rete', effect: 'lose' },
    ] },
    // Muro: secco = punto; normale = toccato, torna nel campo avversario;
    // palla rigiocata = toccato, resta a noi; interdizione = non tirano sul muro
    // (sopra o altrove), nessun tocco. I codici + e - restano quelli di prima.
    M: { name: 'Muro', grades: [
      { g: '#', label: 'Muro secco', sub: 'punto', effect: 'win' },
      { g: '-', label: 'Muro normale', sub: 'toccato, torna di là', effect: 'other' },
      { g: '+', label: 'Palla rigiocata', sub: 'tocco a muro, resta a noi', effect: 'reset' },
      { g: '!', label: 'Interdizione', sub: 'non tirano sul muro', effect: 'reset' },
      { g: '/', label: 'Mani out', sub: 'punto loro', effect: 'lose' },
      { g: '=', label: 'Invasione', sub: 'fallo a rete', effect: 'lose' },
    ] },
    D: { name: 'Difesa', grades: [
      { g: '#', label: 'Perfetta', sub: 'contrattacco facile', effect: 'keep' },
      { g: '+', label: 'Buona', sub: 'si può attaccare', effect: 'keep' },
      { g: '!', label: 'Non attacc.', effect: 'keep', hidden: true },
      { g: '-', label: 'Scarsa', sub: 'palla difficile', effect: 'keep' },
      { g: '/', label: 'Di là', sub: 'rimandata', effect: 'other' },
      { g: '=', label: 'Errore', sub: 'punto loro', effect: 'lose' },
    ] },
  };
  const FUND_ORDER = ['B', 'R', 'E', 'A', 'M', 'D'];

  function gradeInfo(fund, g) {
    const f = FUNDS[fund];
    return f && f.grades.find(x => x.g === g);
  }

  const other = t => (t === 'noi' ? 'avv' : 'noi');

  // P2 -> P1 -> P6 -> P5 -> P4 -> P3 -> P2
  function rotateLineup(l) {
    return { P1: l.P2, P6: l.P1, P5: l.P6, P4: l.P5, P3: l.P4, P2: l.P3 };
  }

  // Formazione 5-1 a partire dalla posizione dell'alzatore.
  // Seguendo P1 -> P2 -> ... dalla posizione dell'alzatore: AL, B1, C1, OP, B2, C2
  // (alzatore/opposto, bande e centri sempre in diagonale).
  const SLOT_SEQ = ['AL', 'B1', 'C1', 'OP', 'B2', 'C2'];
  function buildLineup(slots, setterPos) {
    const k = POS.indexOf(setterPos);
    const l = {};
    SLOT_SEQ.forEach((sl, i) => { l[POS[(k + i) % 6]] = (slots && slots[sl]) || ''; });
    return l;
  }

  function defaultRules() {
    return { maxSets: 5, points: 25, tiebreak: 15, bestOf: true, timeouts: 2, subs: 6 };
  }

  function emptyState(match) {
    return {
      phase: 'setup',       // setup | serve | rally | setOver | between | matchOver
      setNum: 0,
      score: { noi: 0, avv: 0 },
      setsWon: { noi: 0, avv: 0 },
      setResults: [],       // [{n, noi, avv, winner}]
      lineup: null,         // formazione "base" nostra (i centrali, non il libero)
      oppLineup: null,
      liberos: [],
      activeLibero: null,
      liberoAuto: true,
      serving: 'noi',
      turn: 'noi',
      touches: 0,
      lastKey: null,        // "noi_P3": chi ha toccato per ultimo (doppio tocco)
      rally: [],            // tocchi del rally in corso
      timeouts: { noi: 0, avv: 0 },
      subs: { noi: 0, avv: 0 },
      roles: {},            // ruoli presi con un cambio, validi fino a fine set
      log: [],              // tutti i tocchi registrati (per le statistiche)
      rallies: [],          // tutti i rally conclusi
      lastSetStart: null,
      rules: Object.assign(defaultRules(), match.rules || {}),
      oppMode: match.oppMode || 'semplificata',
    };
  }

  // Ruoli: Alzatore, Prima banda, Seconda banda, Primo centro, Secondo centro, Opposto, Libero.
  // (accetta anche i vecchi nomi Palleggiatore/Centrale/Schiacciatore)
  const isMiddle = r => /centr/i.test(r || '');
  const isSetter = r => /alzator|palleggiator/i.test(r || '');
  const isLibero = r => /libero/i.test(r || '');

  // Ruolo di un giocatore in questo momento: chi entra con un cambio prende il ruolo
  // di chi esce per tutto il set (st.roles); al set dopo torna il ruolo della rosa.
  function roleOf(match, num, st) {
    if (st && st.roles && st.roles[num]) return st.roles[num];
    const p = match.roster.find(x => x.number === num);
    return p ? p.role : '';
  }

  // Formazione effettiva in campo: la formazione base con il libero al posto
  // del centrale in seconda linea (tranne il centrale in P1 quando battiamo noi).
  function effectiveLineup(match, st) {
    if (!st.lineup) return null;
    const eff = Object.assign({}, st.lineup);
    if (st.liberoAuto && st.activeLibero) {
      for (const p of BACK_ROW) {
        if (p === 'P1' && st.serving === 'noi') continue;
        if (isMiddle(roleOf(match, eff[p], st))) { eff[p] = st.activeLibero; break; }
      }
    }
    return eff;
  }

  // Rotazione nominata dalla posizione del palleggiatore (P1..P6),
  // oppure dalla posizione del primo battitore del set se non c'è un palleggiatore.
  function rotationName(match, st) {
    if (!st.lineup) return '-';
    for (const p of POS) {
      if (isSetter(roleOf(match, st.lineup[p], st))) return 'P' + p.slice(1);
    }
    return 'R' + (POS.find(p => st.lineup[p] === (st.lastSetStart && st.lastSetStart.lineup.P1)) || 'P1').slice(1);
  }

  function setTarget(st) {
    const r = st.rules;
    return st.setNum === r.maxSets ? r.tiebreak : r.points;
  }

  function isSetOver(st) {
    const a = st.score.noi, b = st.score.avv, t = setTarget(st);
    return Math.max(a, b) >= t && Math.abs(a - b) >= 2;
  }

  function isMatchOver(st) {
    const r = st.rules;
    if (r.bestOf) {
      const need = Math.floor(r.maxSets / 2) + 1;
      return st.setsWon.noi >= need || st.setsWon.avv >= need;
    }
    return st.setResults.length >= r.maxSets;
  }

  function newRally(st) {
    st.phase = 'serve';
    st.turn = st.serving;
    st.touches = 0;
    st.lastKey = null;
    st.rally = [];
  }

  function awardPoint(match, st, winner, reason) {
    const receiving = other(st.serving);
    st.rallies.push({
      set: st.setNum,
      scoreNoi: st.score.noi,
      scoreAvv: st.score.avv,
      serving: st.serving,
      rotNoi: rotationName(match, st),
      winner,
      reason,
      sideout: winner === receiving,
      touches: st.rally.length,
    });
    st.score[winner] += 1;
    if (winner !== st.serving) {
      // cambio palla: chi conquista la battuta ruota
      if (winner === 'noi') st.lineup = rotateLineup(st.lineup);
      else st.oppLineup = rotateLineup(st.oppLineup);
      st.serving = winner;
    }
    if (isSetOver(st)) {
      st.phase = 'setOver';
      st.rally = [];
    } else {
      newRally(st);
    }
  }

  function applyTouch(match, st, ev) {
    if (st.phase !== 'serve' && st.phase !== 'rally') return;
    const info = gradeInfo(ev.fund, ev.grade);
    if (!info) return;
    const team = ev.team;

    // La palla era dall'altra parte: tocchi dell'avversario non registrati
    // (modalità rapida o tocco saltato). Nuovi 3 tocchi a chi tocca ora.
    if (st.turn !== team) {
      st.turn = team;
      st.touches = 0;
      st.lastKey = null;
    }
    st.phase = 'rally';

    const rec = {
      set: st.setNum,
      team,
      pos: ev.pos,
      player: ev.player,
      fund: ev.fund,
      grade: ev.grade,
      scoreNoi: st.score.noi,
      scoreAvv: st.score.avv,
      serving: st.serving,
      rotNoi: rotationName(match, st),
      rallyIdx: st.rallies.length,
    };
    st.rally.push(rec);
    st.log.push(rec);

    // Ace con il ricevitore indicato: registra anche il suo errore in ricezione
    // (stesso punto, conta solo nelle statistiche del ricevitore).
    if (ev.fund === 'B' && ev.grade === '#' && ev.receiver) {
      const r2 = Object.assign({}, rec, { team: other(team), pos: ev.receiver.pos, player: ev.receiver.player, fund: 'R', grade: '=' });
      st.rally.push(r2);
      st.log.push(r2);
    }

    switch (info.effect) {
      case 'win': awardPoint(match, st, team, ev.fund + ev.grade); break;
      case 'lose': awardPoint(match, st, other(team), ev.fund + ev.grade); break;
      case 'other':
        st.turn = other(team); st.touches = 0; st.lastKey = null; break;
      case 'reset':
        st.turn = team; st.touches = 0; st.lastKey = null; break;
      case 'keep':
        st.turn = team; st.touches += 1; st.lastKey = team + '_' + ev.pos; break;
    }
  }

  function apply(match, st, ev) {
    switch (ev.type) {
      case 'setStart':
        st.setNum += 1;
        st.score = { noi: 0, avv: 0 };
        st.lineup = Object.assign({}, ev.lineup);
        st.oppLineup = Object.assign({}, ev.oppLineup);
        st.liberos = (ev.liberos || []).filter(Boolean);
        st.activeLibero = st.liberos[0] || null;
        st.liberoAuto = ev.liberoAuto !== false;
        st.serving = ev.serve;
        st.timeouts = { noi: 0, avv: 0 };
        st.subs = { noi: 0, avv: 0 };
        st.roles = {};
        st.lastSetStart = ev;
        newRally(st);
        break;
      case 'touch':
        applyTouch(match, st, ev);
        break;
      case 'point':
        if (st.phase === 'serve' || st.phase === 'rally') awardPoint(match, st, ev.winner, ev.reason || 'manuale');
        break;
      case 'setEnd': {
        if (st.phase !== 'setOver') break;
        const winner = st.score.noi > st.score.avv ? 'noi' : 'avv';
        st.setsWon[winner] += 1;
        st.setResults.push({ n: st.setNum, noi: st.score.noi, avv: st.score.avv, winner });
        st.phase = isMatchOver(st) ? 'matchOver' : 'between';
        break;
      }
      case 'sub':
        if (!st.lineup) break;
        if (ev.team === 'avv') { st.oppLineup[ev.pos] = ev.in; }
        else {
          st.roles[ev.in] = roleOf(match, st.lineup[ev.pos], st); // prende il ruolo di chi esce
          st.lineup[ev.pos] = ev.in;
        }
        st.subs[ev.team || 'noi'] += 1;
        st.lastKey = null;
        break;
      case 'timeout':
        st.timeouts[ev.team] += 1;
        break;
      case 'libero':
        st.activeLibero = ev.num || null;
        if (ev.auto !== undefined) st.liberoAuto = ev.auto;
        break;
      case 'rotate':
        // correzione manuale (avanti o indietro)
        if (!st.lineup) break;
        for (let i = 0; i < (ev.dir === -1 ? 5 : 1); i++) {
          if (ev.team === 'noi') st.lineup = rotateLineup(st.lineup);
          else st.oppLineup = rotateLineup(st.oppLineup);
        }
        st.lastKey = null;
        break;
      case 'serveFix':
        // correzione manuale di chi batte
        if (st.phase === 'serve') { st.serving = ev.team; st.turn = ev.team; }
        break;
      case 'oppMode':
        st.oppMode = ev.mode;
        break;
    }
  }

  function computeState(match) {
    const st = emptyState(match);
    for (const ev of match.events) apply(match, st, ev);
    return st;
  }

  // Fondamentale suggerito per il prossimo tocco di "team".
  function suggestFund(st, team) {
    if (st.phase === 'serve') return team === st.serving ? 'B' : 'R';
    const last = st.rally[st.rally.length - 1];
    if (!last) return 'D';
    if (st.turn === team && st.touches > 0 && last.team === team) {
      // stessa azione: ricezione/difesa -> alzata -> attacco
      if (last.fund === 'R' || last.fund === 'D') return 'E';
      if (last.fund === 'E') return 'A';
      return 'D';
    }
    // nuova azione: dopo la battuta avversaria si riceve, altrimenti si difende
    if (last.team !== team && last.fund === 'B') return 'R';
    return 'D';
  }

  /* ---------------------------- statistiche ---------------------------- */

  const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : null);

  function emptyCounts() {
    return { tot: 0, '#': 0, '+': 0, '!': 0, '-': 0, '/': 0, '=': 0 };
  }

  function playerStats(log, filter) {
    const by = {};
    for (const r of log) {
      if (!filter(r)) continue;
      const k = r.player;
      by[k] = by[k] || {};
      by[k][r.fund] = by[k][r.fund] || emptyCounts();
      by[k][r.fund].tot += 1;
      by[k][r.fund][r.grade] += 1;
    }
    return by;
  }

  // Riga di statistiche per un giocatore (o per la squadra) a partire dai conteggi.
  function statRow(counts) {
    const g = (fund, k) => (counts[fund] ? counts[fund][k] : 0);
    const t = fund => (counts[fund] ? counts[fund].tot : 0);
    const bT = t('B'), rT = t('R'), aT = t('A'), mT = t('M'), dT = t('D'), eT = t('E');
    const points = g('B', '#') + g('A', '#') + g('M', '#');
    const errors = FUND_ORDER.reduce((s, f) => s + g(f, '='), 0) + g('A', '/') + g('M', '/');
    return {
      points, errors,
      serveTot: bT, ace: g('B', '#'), serveErr: g('B', '='),
      serveEff: pct(g('B', '#') - g('B', '='), bT),
      recTot: rT, recErr: g('R', '='),
      recPos: pct(g('R', '#') + g('R', '+'), rT),
      recPrf: pct(g('R', '#'), rT),
      attTot: aT, kill: g('A', '#'), attErr: g('A', '='), attBlk: g('A', '/'),
      killPct: pct(g('A', '#'), aT),
      attEff: pct(g('A', '#') - g('A', '=') - g('A', '/'), aT),
      blkPts: g('M', '#'), blkNorm: g('M', '-'), blkReplay: g('M', '+'), blkInt: g('M', '!'),
      blkErr: g('M', '/') + g('M', '='), blkTot: mT,
      defTot: dT, defPos: pct(g('D', '#') + g('D', '+') + g('D', '!'), dT), defErr: g('D', '='),
      setTot: eT, setErr: g('E', '='),
    };
  }

  function mergeCounts(a, b) {
    const out = {};
    for (const src of [a, b]) {
      for (const f in src) {
        out[f] = out[f] || emptyCounts();
        for (const k in src[f]) out[f][k] += src[f][k];
      }
    }
    return out;
  }

  function rotationStats(rallies) {
    const rows = {};
    for (const r of rallies) {
      const k = r.rotNoi;
      rows[k] = rows[k] || { rot: k, soTot: 0, soWon: 0, bpTot: 0, bpWon: 0 };
      if (r.serving === 'avv') { rows[k].soTot++; if (r.winner === 'noi') rows[k].soWon++; }
      else { rows[k].bpTot++; if (r.winner === 'noi') rows[k].bpWon++; }
    }
    const list = Object.values(rows).sort((a, b) => a.rot.localeCompare(b.rot));
    const tot = list.reduce((s, r) => ({
      rot: 'Totale', soTot: s.soTot + r.soTot, soWon: s.soWon + r.soWon,
      bpTot: s.bpTot + r.bpTot, bpWon: s.bpWon + r.bpWon,
    }), { rot: 'Totale', soTot: 0, soWon: 0, bpTot: 0, bpWon: 0 });
    return list.concat([tot]).map(r => Object.assign(r, {
      soPct: pct(r.soWon, r.soTot), bpPct: pct(r.bpWon, r.bpTot),
    }));
  }

  // Statistiche complete; setFilter = null per tutta la partita.
  function computeStats(match, st, setFilter) {
    const inSet = r => setFilter == null || r.set === setFilter;
    const noiCounts = playerStats(st.log, r => r.team === 'noi' && inSet(r));
    const avvCounts = playerStats(st.log, r => r.team === 'avv' && inSet(r));

    const players = match.roster
      .filter(p => noiCounts[p.number])
      .map(p => Object.assign({ number: p.number, name: p.name, role: p.role }, statRow(noiCounts[p.number])));
    const noiTeam = statRow(Object.values(noiCounts).reduce(mergeCounts, {}));

    const opp = Object.keys(avvCounts).sort().map(k => Object.assign({ number: k }, statRow(avvCounts[k])));
    const avvTeam = statRow(Object.values(avvCounts).reduce(mergeCounts, {}));

    const rallies = st.rallies.filter(inSet);
    const countReason = (w, reason) => rallies.filter(r => r.winner === w && r.reason === reason).length;

    // Riepilogo generale della squadra: solo numeri, senza nomi.
    const T = noiTeam;
    const acesAgainst = rallies.filter(r => r.winner === 'avv' && (r.reason === 'B#' || r.reason === 'R=')).length;
    const oppErr = countReason('noi', 'errAvv');
    const it = (label, value, isPct) => ({ label, value, pct: !!isPct });
    const general = [
      { group: 'Battuta', items: [
        it('Punti in battuta (ace)', T.ace), it('Battute totali', T.serveTot), it('Errori in battuta', T.serveErr)] },
      { group: 'Ricezione', items: [
        it('Ace subiti', acesAgainst), it('Ricezioni totali', T.recTot), it('Ricezione positiva (++ e buone)', T.recPos, true), it('Ricezione ++ (in testa all\'alzatore)', T.recPrf, true)] },
      { group: 'Attacco', items: [
        it('Punti in attacco', T.kill), it('Palle attaccate', T.attTot), it('Attacchi sbagliati', T.attErr),
        it('Attacchi murati', T.attBlk), it('Attacchi a punto', T.killPct, true)] },
      { group: 'Alzata', items: [
        it('Alzate sbagliate', T.setErr), it('Alzate totali', T.setTot)] },
      { group: 'Muro', items: [
        it('Muri secchi (punto)', T.blkPts), it('Muri normali (torna di là)', T.blkNorm),
        it('Palle rigiocate (tocco a muro)', T.blkReplay), it('Muri d\'interdizione', T.blkInt),
        it('Errori a muro (mani out, invasione)', T.blkErr)] },
      { group: 'Totali', items: [
        it('Punti fatti', T.points), it('Punti da errori avversari', oppErr),
        it('Errori nostri', T.errors + countReason('avv', 'errNoi'))] },
    ];

    return {
      general,
      players, noiTeam, opp, avvTeam,
      rotations: rotationStats(rallies),
      rallies,
      oppErrPoints: countReason('noi', 'errAvv'),
      ourErrPoints: countReason('avv', 'errNoi'),
    };
  }

  const api = {
    POS, FUNDS, FUND_ORDER, TEAMS, gradeInfo, rotateLineup, defaultRules,
    computeState, effectiveLineup, rotationName, suggestFund, computeStats,
    statRow, roleOf, isSetOver, setTarget, other, isMiddle, isSetter, isLibero, buildLineup, SLOT_SEQ,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.Engine = api;
})(typeof window !== 'undefined' ? window : globalThis);
