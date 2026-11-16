/* Scout Volley — interfaccia. Tutto offline, dati salvati sul dispositivo. */
(function () {
  'use strict';

  const E = window.Engine;
  const $app = document.getElementById('app');
  const $sheet = document.getElementById('sheet-root');
  const $toast = document.getElementById('toast');

  const ROLES = ['Alzatore', 'Prima banda', 'Seconda banda', 'Primo centro', 'Secondo centro', 'Opposto', 'Libero'];
  const ROLE_SHORT = {
    Alzatore: 'AL', 'Prima banda': 'B1', 'Seconda banda': 'B2', 'Primo centro': 'C1', 'Secondo centro': 'C2', Opposto: 'OP', Libero: 'L',
    Palleggiatore: 'AL', Schiacciatore: 'B', Centrale: 'C', // vecchi nomi
  };
  // Nessuna squadra predefinita: la rosa parte vuota. A richiesta si carica un
  // esempio con nomi segnaposto (non persone reali), da sostituire con i propri giocatori.
  const EXAMPLE_ROSTER = [
    ['1', 'Alzatore'], ['2', 'Banda 1'], ['3', 'Banda 2'], ['4', 'Centro 1'], ['5', 'Centro 2'],
    ['6', 'Opposto'], ['7', 'Libero'],
  ].map(([number, r]) => ({ number, name: 'Esempio ' + r, role: { 'Banda 1': 'Prima banda', 'Banda 2': 'Seconda banda', 'Centro 1': 'Primo centro', 'Centro 2': 'Secondo centro' }[r] || r, example: true }));
  // Vecchia rosa predefinita delle prime versioni: se è rimasta tale e quale, non la consideriamo una rosa vera.
  const OLD_DEFAULT = ['7 Rossi', '10 Bianchi', '1 Verdi', '9 Neri', '4 Russo', '5 Gallo', '6 Costa', '11 Greco'];
  // Converte i vecchi ruoli (Palleggiatore/Centrale/Schiacciatore) nei nuovi.
  function migrateRoles(list) {
    let c = 0, b = 0;
    (list || []).forEach(p => {
      if (p.role === 'Palleggiatore') p.role = 'Alzatore';
      else if (p.role === 'Centrale') p.role = c++ === 0 ? 'Primo centro' : 'Secondo centro';
      else if (p.role === 'Schiacciatore') p.role = b++ === 0 ? 'Prima banda' : 'Seconda banda';
    });
    return list;
  }
  const roleShort = r => ROLE_SHORT[r] || '';
  // Famiglia di ruolo per i colori: al, b, c, op, l
  const roleClass = r => ({ AL: 'r-al', B1: 'r-b', B2: 'r-b', B: 'r-b', C1: 'r-c', C2: 'r-c', C: 'r-c', OP: 'r-op', L: 'r-l' }[roleShort(r)] || '');
  const GRADE_CLASS = { '#': 'gr-hash', '+': 'gr-plus', '!': 'gr-excl', '-': 'gr-minus', '/': 'gr-slash', '=': 'gr-eq' };
  const MODE_LABEL = { semplificata: 'Zone', avanzata: 'Maglie', skip: 'Rapida' };
  const REASON_LABEL = {
    errAvv: 'Errore avversario', noi: 'Punto nostro', arb: 'Arbitro / fallo',
    avv: 'Punto avversario', errNoi: 'Errore nostro', manuale: 'Manuale',
  };

  /* ------------------------------- icone ------------------------------- */
  // Icone a linea (SVG dentro al codice: funzionano anche senza internet).
  const ICONS = {
    back: '<path d="M15 18l-6-6 6-6"/>',
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10.5a5.5 5.5 0 010 11H11"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    help: '<circle cx="12" cy="12" r="9.5"/><path d="M9.2 9.3a2.9 2.9 0 015.6 1c0 1.9-2.8 2.6-2.8 4.2"/><path d="M12 17.6v.1"/>',
    users: '<path d="M16 20v-1.5a4 4 0 00-4-4H6.5a4 4 0 00-4 4V20"/><circle cx="9.2" cy="7.5" r="3.7"/><path d="M21.5 20v-1.5a4 4 0 00-3-3.85"/><path d="M15.5 3.9a3.7 3.7 0 010 7.2"/>',
    chart: '<path d="M4 20V11M10 20V5M16 20v-6M21 20H3"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 12.5a1.5 1.5 0 001.5 1.5h7a1.5 1.5 0 001.5-1.5L18 7M9 7V4.5h6V7"/>',
    lock: '<rect x="5" y="11" width="14" height="9.5" rx="2"/><path d="M8 11V8a4 4 0 018 0v3"/>',
    download: '<path d="M12 4v11M7 10.5l5 5 5-5M4.5 20h15"/>',
    share: '<path d="M12 15V4M7.5 8.5L12 4l4.5 4.5M5 13v6a1.5 1.5 0 001.5 1.5h11A1.5 1.5 0 0019 19v-6"/>',
    clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/>',
    swap: '<path d="M7 4L3.5 7.5 7 11M3.5 7.5h14M17 13l3.5 3.5L17 20M20.5 16.5h-14"/>',
    play: '<path d="M7 4.5v15l12.5-7.5z"/>',
    upload: '<path d="M12 20V9M7 13.5l5-5 5 5M4.5 4h15"/>',
    sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
    check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
    x: '<path d="M6 6l12 12M18 6L6 18"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
    whistle: '<path d="M10 6.5h11v4l-6 2a5.5 5.5 0 11-5-6z"/><circle cx="9" cy="14.5" r="1.6"/>',
  };
  const ic = name => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`;
  // Logo: pallone nei colori della squadra.
  const LOGO = `<svg class="logo" viewBox="0 0 40 40" aria-hidden="true">
    <circle cx="20" cy="20" r="17" fill="#0f2a4a" stroke="#f5c518" stroke-width="2.4"/>
    <path d="M20 3c-2 6 0 12 6 16s7.5 10 5 16M3.6 16c6-1.5 11.6 0 15.4 4.5S28 27 36.5 25.5M10 35c1-6.5 4.5-11 10-14.5S30.5 12 30.8 6.5" fill="none" stroke="#2b9cf0" stroke-width="2.4" stroke-linecap="round"/>
  </svg>`;

  /* ------------------------------ storage ------------------------------ */
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (e) { return false; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { /* niente */ } },
  };
  let saveFailed = false;

  const loadRoster = () => {
    const r = store.get('scout.roster', []);
    if (r.length && r.every(p => OLD_DEFAULT.includes(p.number + ' ' + p.name))) return [];
    return migrateRoles(r);
  };
  const saveRoster = r => store.set('scout.roster', r);
  const listMatches = () => store.get('scout.matches', []);
  const loadMatch = id => { const m = store.get('scout.match.' + id, null); if (m) migrateRoles(m.roster); return m; };

  function matchSummary(m, s) {
    if (!s) return '';
    const sets = s.setResults.map(r => `${r.noi}-${r.avv}`).join(', ');
    const live = (s.phase === 'serve' || s.phase === 'rally' || s.phase === 'setOver') ? ` (in corso ${s.score.noi}-${s.score.avv})` : '';
    return `Set ${s.setsWon.noi}-${s.setsWon.avv}${sets ? ' · ' + sets : ''}${live}`;
  }

  // Salva una partita e aggiorna l'elenco (s = stato già calcolato, se c'è).
  function storeMatch(m, s) {
    const ok = store.set('scout.match.' + m.id, m);
    const idx = listMatches().filter(x => x.id !== m.id);
    idx.unshift({ id: m.id, opponent: m.opponent, date: m.date, updated: m.updated, summary: matchSummary(m, s || E.computeState(m)) });
    idx.sort((a, b) => (b.updated || 0) - (a.updated || 0));
    return ok && store.set('scout.matches', idx);
  }

  function saveMatch() {
    if (!match) return;
    match.updated = Date.now();
    saveFailed = !storeMatch(match, st);
  }

  /* ------------------------------- backup ------------------------------- */
  // Per ogni partita ricordiamo fino a quale modifica è finita in un backup:
  // così la Home può avvisare se ci sono partite non ancora salvate fuori dall'app.
  const backups = () => store.get('scout.backups', {});
  function markBackedUp(list) {
    const b = backups();
    list.forEach(m => { b[m.id] = m.updated || 0; });
    store.set('scout.backups', b);
  }
  function pendingBackups() {
    const b = backups();
    return listMatches().filter(m => !(b[m.id] >= (m.updated || 0)));
  }
  function fullBackupData() {
    const matches = listMatches().map(x => loadMatch(x.id)).filter(Boolean);
    return { type: 'scout-volley-backup', version: 1, created: Date.now(), roster: loadRoster(), matches };
  }
  async function exportFullBackup(viaShare) {
    const data = fullBackupData();
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    const name = `scout_backup_completo_${today()}.json`;
    const ok = viaShare ? await share(blob, name) : (download(blob, name), true);
    if (!ok) return;
    markBackedUp(listMatches());
    toast(`Backup di ${data.matches.length} partite e della rosa scaricato`);
    render();
  }

  function deleteMatch(id) {
    store.del('scout.match.' + id);
    store.set('scout.matches', listMatches().filter(x => x.id !== id));
  }

  /* ------------------------------- stato ------------------------------- */
  let match = null;   // partita aperta
  let st = null;      // stato calcolato dagli eventi
  const ui = {
    view: 'home',     // home | match | stats
    sel: null,        // {team, pos}: giocatore selezionato
    sheet: null,      // funzione che disegna la finestra aperta
    sheetLocked: false,
    statsSet: null,
    draft: null,      // bozza formazione del set
    subStep: null,    // {team, pos}
    fund: null,       // fondamentale scelto a mano (scheda), altrimenti quello previsto
  };

  /* ------------------------------ utility ------------------------------ */
  const esc = s => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const today = () => new Date().toISOString().slice(0, 10);
  const fmtPct = v => (v == null ? '–' : v.toFixed(1).replace('.', ',') + '%');
  const teamLabel = t => (t === 'noi' ? 'NOI' : 'AVV');

  let toastTimer = null;
  function toast(msg, warn) {
    $toast.textContent = msg;
    $toast.className = 'toast show' + (warn ? ' warn' : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { $toast.className = 'toast'; }, warn ? 2600 : 1500);
  }
  function buzz(ms) { try { navigator.vibrate && navigator.vibrate(ms || 15); } catch (e) { /* niente */ } }

  function player(num) { return match.roster.find(p => p.number === num); }
  // Ruolo in questo momento della partita (dopo un cambio: quello di chi è uscito, fino a fine set).
  function roleNow(num) { return st ? E.roleOf(match, num, st) : ((player(num) || {}).role || ''); }
  function playerLabel(num) { const p = player(num); return p ? `#${p.number} ${p.name}` : `#${num}`; }
  function oppPlayerId(pos) { return st.oppMode === 'avanzata' ? st.oppLineup[pos] : pos; }
  function oppLabel(id) { return st.oppMode === 'avanzata' || !/^P\d$/.test(id) ? `#${id}` : `Zona ${id}`; }

  /* ---------------------------- azioni base ---------------------------- */
  function recompute() { st = E.computeState(match); }

  function resetSelection() {
    ui.sel = null;
    ui.fund = null;
    if (!st || !match) return;
    // in battuta il P1 è già selezionato: basta scegliere l'esito
    if (st.phase === 'serve' && !(st.serving === 'avv' && st.oppMode === 'skip')) { ui.sel = { team: st.serving, pos: 'P1' }; return; }
    // quando tocca alzare, l'alzatore è già selezionato (se non ha appena toccato lui)
    if (st.phase === 'rally') {
      const team = st.oppMode === 'skip' && st.turn === 'avv' ? 'noi' : st.turn;
      if (team === 'noi' && E.suggestFund(st, 'noi') === 'E') {
        const eff = E.effectiveLineup(match, st);
        const pos = E.POS.find(x => E.isSetter(roleNow(eff[x])));
        if (pos && st.lastKey !== 'noi_' + pos) ui.sel = { team: 'noi', pos };
      }
    }
  }

  function commit(ev) {
    const before = st.rallies.length;
    match.events.push(Object.assign({ t: Date.now() }, ev));
    recompute();
    saveMatch();
    resetSelection();
    if (st.rallies.length > before) {
      const r = st.rallies[st.rallies.length - 1];
      toast(`Punto ${teamLabel(r.winner)} · ${st.score.noi}–${st.score.avv}`);
      buzz(30);
    }
    if (st.phase === 'setOver') openSheet(sheetSetOver, true);
    render();
  }

  function undo() {
    if (!match || !match.events.length) return;
    const ev = match.events[match.events.length - 1];
    if (ev.type === 'setStart' && st.phase === 'serve' && st.rallies.filter(r => r.set === st.setNum).length === 0) {
      ui.draft = null; // torno alla formazione
    }
    match.events.pop();
    recompute();
    saveMatch();
    resetSelection();
    closeSheet();
    if (st.phase === 'setOver') openSheet(sheetSetOver, true);
    toast('Annullato: ' + describeEvent(ev));
    render();
  }

  function describeEvent(ev) {
    switch (ev.type) {
      case 'touch': return `${teamLabel(ev.team)} ${ev.team === 'noi' ? '#' + ev.player : ev.player} ${E.FUNDS[ev.fund].name} ${gradeLabel(ev.fund, ev.grade)}`;
      case 'point': return `punto ${teamLabel(ev.winner)}`;
      case 'setStart': return 'inizio set';
      case 'setEnd': return 'fine set';
      case 'sub': return 'cambio';
      case 'timeout': return 'time-out';
      case 'rotate': return 'rotazione';
      case 'libero': return 'libero';
      case 'oppMode': return 'modalità avversario';
      default: return ev.type;
    }
  }

  function openMatch(id) {
    const m = loadMatch(id);
    if (!m) { toast('Partita non trovata', true); return; }
    match = m;
    recompute();
    store.set('scout.current', id);
    ui.view = 'match';
    ui.draft = null;
    resetSelection();
    closeSheet();
    if (st.phase === 'setOver') openSheet(sheetSetOver, true);
    render();
    requestWakeLock();
  }

  function goHome() {
    match = null; st = null; ui.view = 'home'; ui.draft = null;
    store.del('scout.current');
    closeSheet();
    releaseWakeLock();
    render();
  }

  /* ----------------------------- wake lock ----------------------------- */
  let wakeLock = null;
  async function requestWakeLock() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* non supportato */ }
  }
  function releaseWakeLock() { try { wakeLock && wakeLock.release(); } catch (e) { /* niente */ } wakeLock = null; }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && match) requestWakeLock();
  });

  /* ------------------------------- render ------------------------------- */
  function render() {
    let html;
    if (ui.view === 'season') html = viewSeason();
    else if (ui.view === 'home' || !match) html = viewHome();
    else if (ui.view === 'stats') html = viewStats();
    else if (st.phase === 'setup' || st.phase === 'between') html = viewSetup();
    else if (st.phase === 'matchOver') html = viewMatchOver();
    else html = viewLive();
    $app.innerHTML = (saveFailed ? '<div class="savewarn">⚠ Salvataggio non riuscito: memoria piena o bloccata. Esporta un backup!</div>' : '') + html;
    renderSheet();
  }

  /* -------------------------------- home -------------------------------- */
  function viewHome() {
    const roster = loadRoster();
    const matches = listMatches();
    const nm = ui.newMatch || (ui.newMatch = { opponent: '', date: today(), oppMode: 'semplificata', format: '5' });
    const chk = rosterCheck(roster);
    const ready = chk.ok;
    const hasExample = roster.some(p => p.example);

    const guide = `
      <details class="card guide" ${matches.length ? '' : 'open'}>
        <summary><h2>Come si usa</h2><span class="muted">tocca per aprire/chiudere</span></summary>
        <ol class="steps">
          <li class="${ready ? 'done' : 'cur'}"><b>Inserisci la tua rosa</b> — maglia, nome e ruolo di ogni giocatore (si fa una volta sola). Servono almeno 1 alzatore, 1 opposto, 2 bande e 2 centri.</li>
          <li class="${ready ? 'cur' : ''}"><b>Crea la partita</b> — scrivi l'avversario e la formula.</li>
          <li><b>Formazione</b> — tocca dove parte l'alzatore: il resto si compone da solo.</li>
          <li><b>Scout</b> — per ogni tocco: <b>chi</b> ha giocato la palla, poi <b>com'è andata</b>. Il punteggio, le rotazioni e il libero vanno avanti da soli.</li>
          <li><b>Fine partita</b> — statistiche ed Excel; scarica sempre il backup.</li>
        </ol>
      </details>`;

    const rosterCard = `
        <div class="card">
          <div class="card-h">${ic('users')}<h2>${ready ? '' : '<span class="stepn">1</span>'}La tua squadra</h2>${roster.length ? `<span class="count">${roster.length} giocatori</span>` : ''}</div>
          <div class="muted" style="margin-bottom:8px">${roster.length
            ? 'Usata per tutte le nuove partite. Il ruolo serve per comporre la formazione da sola e per far entrare il libero al posto dei centri.'
            : 'Ancora nessun giocatore. Aggiungi i tuoi giocatori qui sotto (maglia, nome, ruolo): il ruolo proposto è quello che manca.'}</div>
          ${hasExample ? '<div class="hint">Questa è una <b>rosa di esempio</b> per provare l\'app: non sono giocatori veri. Sostituiscila con i tuoi giocatori.</div>' : ''}
          ${rosterCheckHtml(chk)}
          ${rosterEditor(roster, 'roster')}
          <div class="row" style="margin-top:10px">
            ${roster.length ? '' : '<button class="btn grow" data-a="roster-example">Prova con una rosa di esempio</button>'}
            ${hasExample ? '<button class="btn grow" data-a="roster-clear-example">Togli i giocatori di esempio</button>' : ''}
          </div>
        </div>`;

    const newCard = `
        <div class="card">
          <div class="card-h">${ic('whistle')}<h2>${ready ? '' : '<span class="stepn">2</span>'}Nuova partita</h2></div>
          ${ready ? '' : `<div class="hint">Per iniziare servono almeno 1 alzatore, 1 opposto, 2 bande e 2 centri nella squadra. Mancano: <b>${esc(chk.missing.join(', '))}</b>.</div>`}
          <div class="form-grid">
            <label class="full">Avversario<input data-c="nm.opponent" value="${esc(nm.opponent)}" placeholder="Nome squadra avversaria" autocomplete="off"></label>
            <label>Data<input type="date" data-c="nm.date" value="${esc(nm.date)}"></label>
            <label>Formula
              <select data-c="nm.format">
                ${[['5', '3 su 5 (25, tie-break 15)'], ['3', '2 su 3 (25, terzo a 15)'], ['3f', '3 set fissi a 25'], ['2f', '2 set fissi a 25']]
                  .map(([v, l]) => `<option value="${v}" ${nm.format === v ? 'selected' : ''}>${l}</option>`).join('')}
              </select>
            </label>
            <div class="full">
              <div class="muted" style="margin-bottom:4px">Avversari: quanto li vuoi registrare?</div>
              ${segOppMode(nm.oppMode, 'nm-mode')}
              <div class="muted" style="margin-top:6px">${modeHelp(nm.oppMode)}</div>
            </div>
          </div>
          <div style="margin-top:14px"><button class="btn primary block lg" data-a="create-match" ${ready ? '' : 'disabled'}>${ic('play')}Crea partita e imposta il 1° set</button></div>
        </div>`;

    const savedCard = `
        <div class="card">
          <div class="card-h">${ic('chart')}<h2>Partite salvate</h2>${matches.length ? `<span class="count">${matches.length}</span>` : ''}</div>
          ${matches.length ? matches.map(m => `
            <div class="list-item match-item">
              <div class="date-chip">${esc(fmtDayMonth(m.date))}</div>
              <div class="grow">
                <div class="mi-title">NOI <span class="muted">contro</span> ${esc(m.opponent || 'Avversario')}</div>
                <div class="muted">${esc(m.summary || '')}</div>
              </div>
              <button class="btn primary" data-a="open-match" data-id="${esc(m.id)}">Apri</button>
              <button class="btn icon-only quiet" data-a="ask-delete-match" data-id="${esc(m.id)}" aria-label="Elimina" title="Elimina">${ic('trash')}</button>
            </div>`).join('') : '<div class="empty-state">Nessuna partita salvata.</div>'}
          ${matches.length ? `<div style="margin-top:12px"><button class="btn primary block" data-a="season">${ic('chart')}Statistiche di stagione (tutte le partite)</button></div>` : ''}
          <div class="row" style="margin-top:8px">
            ${matches.length ? `<button class="btn grow" data-a="backup-all">${ic('download')}Backup completo</button>` : ''}
            <label class="btn grow">
              ${ic('upload')}Importa backup<input type="file" accept=".json,application/json" data-c="import" hidden>
            </label>
          </div>
          <div class="muted" style="margin-top:8px">Il backup completo è un solo file con tutte le partite e la rosa: tienilo su Drive, in mail o su un altro dispositivo.</div>
        </div>`;

    const pend = pendingBackups();
    const backupWarn = pend.length ? `
        <div class="card warn-card">
          <div class="card-h">${ic('download')}<h2>${pend.length === 1 ? '1 partita non è' : pend.length + ' partite non sono'} in nessun backup</h2></div>
          <div class="muted" style="margin-bottom:10px">I dati sono solo in questo browser: se si cancella la cronologia o cambi dispositivo vanno persi.
            ${esc(pend.slice(0, 3).map(m => m.opponent || 'Avversario').join(', '))}${pend.length > 3 ? '…' : ''}</div>
          <div class="row">
            <button class="btn primary grow" data-a="backup-all">${ic('download')}Scarica backup completo</button>
            ${canShareFiles() ? `<button class="btn grow" data-a="backup-all-share">${ic('share')}Condividi (Drive, mail…)</button>` : ''}
          </div>
        </div>` : '';

    return `
      <div class="topbar brandbar">
        <div class="brand">${LOGO}<div><h1>Scout Volley</h1><div class="tagline">Scouting pallavolo · funziona offline</div></div></div>
        <button class="btn ghost icon-only" data-a="novita" aria-label="Novità dell'app" title="Novità dell'app">${ic('sparkle')}</button>
      </div>
      <div class="page">
        ${backupWarn}
        ${guide}
        ${ready ? newCard + savedCard + rosterCard : rosterCard + newCard + savedCard}
        <footer class="foot">
          I dati restano su questo dispositivo. Esporta un backup dopo ogni partita.<br>
          Per usarla senza internet: aprila una volta e aggiungila alla schermata Home.
          <div style="margin-top:12px"><button class="btn sm" data-a="novita">${ic('sparkle')}Novità dell'app</button></div>
        </footer>
      </div>`;
  }

  function modeHelp(mode) {
    return {
      semplificata: 'Registri i tocchi avversari per zona (P1–P6), senza numeri di maglia.',
      avanzata: 'Registri i tocchi avversari con il numero di maglia: statistiche anche per loro.',
      skip: 'Registri solo noi. Quando la palla torna, tocchi direttamente il nostro giocatore.',
    }[mode];
  }

  function segOppMode(cur, action) {
    return `<div class="seg avv">${['semplificata', 'avanzata', 'skip'].map(m =>
      `<button class="${cur === m ? 'on' : ''}" data-a="${action}" data-mode="${m}">${MODE_LABEL[m]}</button>`).join('')}</div>`;
  }

  // Ruoli minimi per iniziare una partita (5-1): 1 alzatore, 1 opposto, 2 bande, 2 centri.
  // Il libero è facoltativo. Le bande e i centri contano insieme (prima + seconda).
  const ROLE_NEEDS = [
    { fam: 'r-al', label: 'Alzatore', one: 'alzatore', many: 'alzatori', need: 1, roles: ['Alzatore'] },
    { fam: 'r-op', label: 'Opposto', one: 'opposto', many: 'opposti', need: 1, roles: ['Opposto'] },
    { fam: 'r-b', label: 'Bande', one: 'banda', many: 'bande', need: 2, roles: ['Prima banda', 'Seconda banda'] },
    { fam: 'r-c', label: 'Centri', one: 'centro', many: 'centri', need: 2, roles: ['Primo centro', 'Secondo centro'] },
  ];
  function rosterCheck(roster) {
    const items = ROLE_NEEDS.map(n => {
      const have = roster.filter(p => roleClass(p.role) === n.fam).length;
      // ruolo da proporre: quello della coppia che manca ancora (es. Seconda banda se c'è già la prima)
      const next = n.roles.find(r => !roster.some(p => p.role === r)) || n.roles[n.roles.length - 1];
      return Object.assign({ have, ok: have >= n.need, next }, n);
    });
    const libs = roster.filter(p => E.isLibero(p.role)).length;
    const missing = items.filter(i => !i.ok).map(i => `${i.need - i.have} ${i.need - i.have === 1 ? i.one : i.many}`);
    return { items, libs, ok: items.every(i => i.ok), missing, nextRole: (items.find(i => !i.ok) || {}).next };
  }
  function rosterCheckHtml(chk) {
    const chip = (cls, ok, text) => `<span class="need ${ok ? 'ok' : 'ko'}"><i class="role ${cls}"></i>${text}</span>`;
    return `<div class="needs">
      <div class="needs-title">${chk.ok ? '✓ Ruoli completi: puoi creare la partita' : 'Ruoli che servono per iniziare una partita'}</div>
      <div class="needs-row">
        ${chk.items.map(i => chip(i.fam, i.ok, `${i.ok ? '✓' : '✗'} ${i.label} <b>${i.have}/${i.need}</b>`)).join('')}
        ${chip('r-l', true, `Libero <b>${chk.libs}</b> <span class="muted">(facoltativo)</span>`)}
      </div>
      ${chk.ok ? '' : `<div class="needs-miss">Mancano: <b>${esc(chk.missing.join(', '))}</b></div>`}
    </div>`;
  }

  function rosterEditor(roster, scope) {
    const chk = rosterCheck(roster);
    const defRole = chk.nextRole || 'Libero';
    const sorted = roster.slice().sort((a, b) => (+a.number || 0) - (+b.number || 0));
    return `
      ${sorted.map(p => `
        <div class="list-item">
          <span class="badge ${roleClass(p.role)}">#${esc(p.number)}</span>
          <div class="grow"><div class="pl-name">${esc(p.name)}</div><div class="muted">${esc(p.role)}</div></div>
          <button class="btn icon-only quiet" data-a="roster-del" data-scope="${scope}" data-num="${esc(p.number)}" aria-label="Rimuovi" title="Rimuovi">${ic('trash')}</button>
        </div>`).join('')}
      <div class="row" style="margin-top:10px">
        <input id="rp-num-${scope}" placeholder="Maglia" inputmode="numeric" style="width:70px;flex:none">
        <input id="rp-name-${scope}" placeholder="Cognome o nome" class="grow" style="width:auto;flex:1">
        <select id="rp-role-${scope}" style="width:auto;flex:1">${ROLES.map(r => `<option value="${r}" ${r === defRole ? 'selected' : ''}>${r}${chk.items.some(i => !i.ok && i.roles.includes(r)) ? ' — manca' : ''}</option>`).join('')}</select>
        <button class="btn primary" data-a="roster-add" data-scope="${scope}">${ic('plus')}Aggiungi</button>
      </div>`;
  }

  function rulesFromFormat(f) {
    switch (f) {
      case '3': return { maxSets: 3, points: 25, tiebreak: 15, bestOf: true, timeouts: 2, subs: 6 };
      case '3f': return { maxSets: 3, points: 25, tiebreak: 25, bestOf: false, timeouts: 2, subs: 6 };
      case '2f': return { maxSets: 2, points: 25, tiebreak: 25, bestOf: false, timeouts: 2, subs: 6 };
      default: return E.defaultRules();
    }
  }

  function createMatch() {
    const nm = ui.newMatch;
    const roster = loadRoster();
    const chk = rosterCheck(roster);
    if (!chk.ok) { toast('Mancano nella rosa: ' + chk.missing.join(', '), true); return; }
    match = {
      id: uid(),
      version: 1,
      opponent: (nm.opponent || '').trim() || 'Avversario',
      date: nm.date || today(),
      rules: rulesFromFormat(nm.format),
      oppMode: nm.oppMode,
      roster: roster.map(p => Object.assign({}, p)),
      events: [],
      created: Date.now(),
    };
    recompute();
    saveMatch();
    ui.newMatch = null;
    ui.view = 'match';
    ui.draft = null;
    store.set('scout.current', match.id);
    try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* niente */ }
    requestWakeLock();
    render();
  }

  /* ------------------------------- setup ------------------------------- */
  // Formazione: si sceglie dove parte l'alzatore (P1..P6) e l'app compone la 5-1
  // dai ruoli (bande e centri con "Inverti"). Chi batte si sceglie solo al 1° set
  // e al tie-break; negli altri set si alterna.
  const SLOT_ROLE = { AL: 'Alzatore', B1: 'Prima banda', B2: 'Seconda banda', C1: 'Primo centro', C2: 'Secondo centro', OP: 'Opposto' };
  const SLOT_LABEL = { AL: 'Alzatore', OP: 'Opposto', B1: 'Banda 1', B2: 'Banda 2', C1: 'Centro 1', C2: 'Centro 2' };

  function defaultSlots() {
    const slots = {};
    for (const sl in SLOT_ROLE) {
      const p = match.roster.find(x => x.role === SLOT_ROLE[sl]);
      slots[sl] = p ? p.number : '';
    }
    return slots;
  }

  function setStartEvents() { return match.events.filter(e => e.type === 'setStart'); }

  // Chi sceglie la battuta: 1° set e tie-break. Altrimenti alternata rispetto al set precedente.
  function serveIsChoice(n) { return n === 1 || (st.rules.bestOf && n === st.rules.maxSets); }

  function makeDraft() {
    const prev = st.lastSetStart;
    const nums = new Set(match.roster.map(p => p.number));
    const liberos = match.roster.filter(p => E.isLibero(p.role)).map(p => p.number);
    let slots = prev && prev.slots ? Object.assign({}, prev.slots) : store.get('scout.lastSlots', null);
    if (!slots || !Object.values(slots).every(v => !v || nums.has(v))) slots = defaultSlots();
    const n = st.setNum + 1;
    const last = setStartEvents().slice(-1)[0];
    return {
      slots,
      setterPos: (prev && prev.setterPos) || 'P1',
      oppLineup: prev ? Object.assign({}, prev.oppLineup) : { P1: '', P2: '', P3: '', P4: '', P5: '', P6: '' },
      liberos: prev ? prev.liberos.slice() : liberos.slice(0, 2),
      liberoAuto: prev ? prev.liberoAuto !== false : true,
      serve: !serveIsChoice(n) && last ? E.other(last.serve) : 'noi',
    };
  }

  function viewSetup() {
    if (!ui.draft) ui.draft = makeDraft();
    const d = ui.draft;
    const n = st.setNum + 1;
    const lineup = E.buildLineup(d.slots, d.setterPos);
    const nonLib = match.roster.filter(p => !E.isLibero(p.role));
    const opt = (cur, list, empty) => `<option value="">${empty || '—'}</option>` +
      list.map(p => `<option value="${esc(p.number)}" ${cur === p.number ? 'selected' : ''}>#${esc(p.number)} ${esc(p.name)} (${roleShort(p.role)})</option>`).join('');
    // Per ogni ruolo solo i giocatori di quel ruolo (bande e centri insieme, così "Inverti" resta utile).
    // Chi è già scelto resta in elenco; se nessuno ha quel ruolo si mostrano tutti.
    const forSlot = (sl, cur) => {
      const fam = roleClass(SLOT_ROLE[sl]);
      if (!nonLib.some(p => roleClass(p.role) === fam)) return nonLib;
      return nonLib.filter(p => roleClass(p.role) === fam || p.number === cur);
    };
    const libs = cur => {
      if (!match.roster.some(p => E.isLibero(p.role))) return match.roster;
      return match.roster.filter(p => E.isLibero(p.role) || p.number === cur);
    };
    const slotSel = sl => `<label class="slot"><span class="${roleClass(SLOT_ROLE[sl])}">${SLOT_LABEL[sl]}</span><select data-c="draft.slot.${sl}">${opt(d.slots[sl], forSlot(sl, d.slots[sl]))}</select></label>`;
    const slotOf = num => Object.keys(d.slots).find(k => d.slots[k] && d.slots[k] === num);
    const rotBtn = p => {
      const num = lineup[p], pl = player(num), sl = slotOf(num);
      const isSetter = p === d.setterPos;
      return `<button class="rot-btn ${pl ? roleClass(pl.role) : ''}${isSetter ? ' on' : ''}" data-a="draft-setter" data-pos="${p}">
        <span class="rp">${p}</span>
        <span class="rn">${num ? '#' + esc(num) : '—'}</span>
        <span class="rname">${esc(pl ? pl.name : '')}</span>
        <span class="rs">${sl ? SLOT_LABEL[sl] : ''}</span></button>`;
    };
    const oppIn = p => `<label>${p}<input data-c="draft.opp.${p}" value="${esc(d.oppLineup[p])}" inputmode="numeric" placeholder="N°"></label>`;
    const prevSets = st.setResults.map(r => `Set ${r.n}: ${r.noi}–${r.avv}`).join(' · ');
    const tiebreak = st.rules.bestOf && n === st.rules.maxSets;

    const serveCard = serveIsChoice(n)
      ? `<h2>${tiebreak ? 'Tie-break: chi batte?' : 'Chi batte per primo?'}</h2>
         <div class="seg"><button class="${d.serve === 'noi' ? 'on' : ''}" data-a="draft-serve" data-team="noi">Battiamo noi</button><button class="${d.serve === 'avv' ? 'on' : ''}" data-a="draft-serve" data-team="avv">Battono loro</button></div>`
      : `<h2>Battuta</h2><div class="serve-info">${d.serve === 'noi' ? 'Battiamo <b>noi</b>' : 'Battono <b>loro</b>'} <span class="muted">— alternata rispetto al set ${n - 1}</span></div>`;

    return `
      <div class="topbar">
        <button class="btn ghost" data-a="home">${ic('back')}Partite</button>
        <h1><span class="tb-eyebrow">Formazione · Set ${n}</span>NOI <span class="vs">contro</span> ${esc(match.opponent)}</h1>
        <button class="btn ghost" data-a="roster-edit">${ic('users')}<span class="hide-sm">Modifica rosa</span></button>
        ${st.setNum ? `<button class="btn ghost" data-a="stats">${ic('chart')}<span class="hide-sm">Statistiche</span></button>` : ''}
      </div>
      <div class="page wide">
        ${prevSets ? `<div class="card"><strong>Set ${st.setsWon.noi}–${st.setsWon.avv}</strong> <span class="muted">${prevSets}</span></div>` : ''}
        <div class="card">
          <div class="card-h"><h2>Formazione — Set ${n}</h2><button class="btn sm" data-a="roster-edit">${ic('users')}Correggi la rosa</button></div>
          <div class="setup-grid">
            <div>
              <div class="stepline"><span class="stepn">1</span><span>Tocca la casella dove parte l'<b>alzatore</b>: gli altri si mettono da soli.</span></div>
              <div class="net-label">RETE</div>
              <div class="rot-grid">${['P4', 'P3', 'P2', 'P5', 'P6', 'P1'].map(rotBtn).join('')}</div>
              <div class="muted" style="margin-top:8px">Alzatore in ${d.setterPos} · rotazione ${d.setterPos}</div>
              ${draftBenchHtml(d)}
            </div>
            <div>
              <div class="stepline"><span class="stepn">2</span><span>Controlla chi gioca in ogni ruolo (cambia dal menu se serve).</span></div>
              <div class="pair">${slotSel('AL')}</div>
              <div class="pair">${slotSel('OP')}</div>
              <div class="pair">${slotSel('B1')}${slotSel('B2')}<button class="btn swap" data-a="draft-swap" data-pair="B">${ic('swap')}Inverti bande</button></div>
              <div class="pair">${slotSel('C1')}${slotSel('C2')}<button class="btn swap" data-a="draft-swap" data-pair="C">${ic('swap')}Inverti centri</button></div>
              <div class="pair">
                <label class="slot"><span class="r-l">Libero 1</span><select data-c="draft.lib.0">${opt(d.liberos[0], libs(d.liberos[0]), 'nessuno')}</select></label>
                <label class="slot"><span class="r-l">Libero 2</span><select data-c="draft.lib.1">${opt(d.liberos[1], libs(d.liberos[1]), 'nessuno')}</select></label>
                <label class="check pair-check"><input type="checkbox" data-c="draft.liberoAuto" ${d.liberoAuto ? 'checked' : ''}> Libero automatico al posto dei centri in seconda linea</label>
              </div>
            </div>
          </div>
        </div>

        ${st.oppMode === 'avanzata' ? `
        <div class="card">
          <h2>Maglie avversari</h2>
          <div class="court-avv-bg">
            <div class="lineup-grid">${['P5', 'P6', 'P1'].map(oppIn).join('')}</div>
            <div class="lineup-grid" style="margin-top:8px">${['P4', 'P3', 'P2'].map(oppIn).join('')}</div>
          </div>
          <div class="net-label">RETE</div>
        </div>` : ''}

        <div class="card">
          <div class="stepline"><span class="stepn">3</span><span>Battuta e via.</span></div>
          ${serveCard}
          <div style="margin-top:14px"><button class="btn primary block lg" data-a="start-set">${ic('play')}Inizia set ${n}</button></div>
          ${match.events.length ? `<div class="row" style="margin-top:8px">
            ${st.setNum ? `<button class="btn grow" data-a="events">${ic('edit')}Correggi un'azione</button>` : ''}
            <button class="btn grow" data-a="undo">${ic('undo')}Annulla ultima azione (torna al set precedente)</button></div>` : ''}
        </div>
      </div>`;
  }

  // Panchina della bozza: chi non è tra i 6 titolari né tra i liberi scelti.
  // Si aggiorna a ogni cambio dei menu (chi diventa titolare sparisce, chi esce rientra).
  function draftBenchHtml(d) {
    const used = new Set(Object.values(d.slots).concat(d.liberos).filter(Boolean));
    const bench = match.roster.filter(p => !used.has(p.number))
      .sort((a, b) => (+a.number || 0) - (+b.number || 0));
    const rows = bench.map(p => `<div class="prow">
        <span class="pnum">${esc(p.number)}</span>
        <span class="pname">${esc(p.name)}</span>
        <span class="role ${roleClass(p.role)}">${esc(roleShort(p.role))}</span>
        <span class="note ${roleClass(p.role)}">${esc(p.role)}</span></div>`).join('');
    return `<div class="tpanel draft-bench">
        <div class="tp-head">Panchina <span class="muted">· ${bench.length}</span></div>
        <div class="plist bench">${rows || '<div class="muted">Nessuno: tutta la rosa è in formazione.</div>'}</div>
      </div>`;
  }

  function startSet() {
    const d = ui.draft;
    const lineup = E.buildLineup(d.slots, d.setterPos);
    const nums = E.POS.map(p => lineup[p]);
    if (nums.some(x => !x)) { toast('Scegli tutti e 6 i giocatori (alzatore, opposto, bande, centri)', true); return; }
    if (new Set(nums).size !== 6) { toast('Lo stesso giocatore è in due ruoli', true); return; }
    const libs = d.liberos.filter(Boolean);
    if (libs.some(l => nums.includes(l))) { toast('Il libero non può essere tra i 6 della formazione', true); return; }
    const opp = {};
    E.POS.forEach(p => { opp[p] = (d.oppLineup[p] || '').trim() || p; });
    store.set('scout.lastSlots', d.slots);
    ui.draft = null;
    const firstTime = !store.get('scout.seenHelp', false);
    commit({ type: 'setStart', lineup, slots: Object.assign({}, d.slots), setterPos: d.setterPos,
      oppLineup: opp, liberos: libs, liberoAuto: d.liberoAuto, serve: d.serve });
    if (firstTime) { store.set('scout.seenHelp', true); openSheet(sheetHelp); }
    requestWakeLock();
  }

  /* -------------------------------- live -------------------------------- */
  // Flusso: 1) tocca chi ha giocato la palla  2) tocca com'è andata.
  // Il fondamentale previsto in quel momento è evidenziato ("ADESSO").
  // In battuta il P1 è già selezionato: basta un tocco.
  function viewLive() {
    const eff = E.effectiveLineup(match, st);
    const skip = st.oppMode === 'skip';
    const to = t => {
      const used = st.timeouts[t], max = st.rules.timeouts;
      const dots = Array.from({ length: max }, (_, i) => `<i class="${i < used ? 'used' : ''}"></i>`).join('');
      return `<button class="to-btn" data-a="timeout" data-team="${t}" ${used >= max ? 'disabled' : ''}>${ic('clock')}Time-out <span class="dots">${dots}</span></button>`;
    };
    const serve = t => (st.serving === t ? '<span class="serve-tag">in battuta</span>' : '');
    const prev = st.setResults.map(r => `${r.noi}-${r.avv}`).join('  ');

    return `
      <div class="live">
        <div class="board">
          <div class="side noi">
            <div class="tname"><span class="swatch"></span>NOI</div>
            <div class="srow">${to('noi')}${serve('noi')}</div>
          </div>
          <div class="center">
            <div class="score"><span class="s">${st.score.noi}</span><span class="sep">–</span><span class="s">${st.score.avv}</span></div>
            <div class="setinfo"><span class="set-pill">SET ${st.setNum}</span> set vinti ${st.setsWon.noi}–${st.setsWon.avv}${prev ? ' · ' + esc(prev) : ''}</div>
            <button class="stats-btn" data-a="stats">${ic('chart')}Statistiche</button>
          </div>
          <div class="side avv">
            <div class="tname">${esc(match.opponent)}</div>
            <div class="srow">${serve('avv')}${to('avv')}</div>
          </div>
        </div>
        <div class="live-body">
          <div class="main-col">
            ${promptHtml(eff, skip)}
            ${courtHtml(eff, skip)}
            ${actionsHtml()}
          </div>
          <div class="info-col">
            ${rallyPanelHtml()}
            ${teamPanelHtml(eff)}
          </div>
        </div>
        <div class="bottombar">
          <button class="b-undo" data-a="undo">${ic('undo')}<span>Annulla</span></button>
          <button class="p-noi" data-a="point-sheet" data-team="noi"><b>+1</b> NOI</button>
          <button class="p-avv" data-a="point-sheet" data-team="avv"><b>+1</b> AVV</button>
          <button class="b-menu" data-a="menu">${ic('menu')}<span>Menu</span></button>
          <button class="b-help" data-a="help" aria-label="Guida">${ic('help')}</button>
        </div>
      </div>`;
  }

  // Azione in corso (tocchi del rally) + ultimi punti del set.
  function rallyPanelHtml() {
    const who = r => (r.team === 'noi' ? esc(playerLabel(r.player)) : 'AVV ' + esc(oppShort(r.player)));
    const touches = st.rally.map((r, i) => `<li class="${r.team}"><span class="n">${i + 1}</span><i class="fdot f-${r.fund}"></i>
        <span class="t">${who(r)}</span><span class="f">${E.FUNDS[r.fund].name}</span>
        <span class="g ${GRADE_CLASS[r.grade] || ''}">${esc(gradeLabel(r.fund, r.grade))}</span></li>`).join('');
    const last = st.rallies.filter(r => r.set === st.setNum).slice(-5).reverse().map(r => {
      const n = r.scoreNoi + (r.winner === 'noi' ? 1 : 0), a = r.scoreAvv + (r.winner === 'avv' ? 1 : 0);
      return `<li class="${r.winner}"><span class="sc">${n}-${a}</span><span class="w">${r.winner === 'noi' ? 'NOI' : 'AVV'}</span><span class="t">${esc(reasonLabel(r.reason))}</span></li>`;
    }).join('');
    return `
      <div class="rpanel">
        <div class="tp-head">Azione in corso <span class="muted">· Rotazione ${esc(E.rotationName(match, st))} · Cambi ${st.subs.noi}/${st.rules.subs}</span></div>
        <ol class="touches">${touches || '<li class="empty">Nessun tocco: si parte dalla battuta</li>'}</ol>
        <div class="tp-head tp-row">Ultimi punti <button class="link-btn" data-a="events">${ic('edit')}Correggi un'azione</button></div>
        <ul class="lastpts">${last || '<li class="empty">Ancora nessun punto in questo set</li>'}</ul>
      </div>`;
  }

  // In campo (con ruolo e "Sostituisci") e panchina, aggiornata in base alla rotazione e al libero.
  function teamPanelHtml(eff) {
    const order = ['P4', 'P3', 'P2', 'P5', 'P6', 'P1'];
    const twoLiberos = st.liberos.length > 1;
    const row = (num, pos, extra) => {
      const p = player(num);
      return `<div class="prow">
        <span class="pnum">${esc(num)}</span>
        <span class="pname">${esc(p ? p.name : '?')}</span>
        <span class="role ${p ? roleClass(roleNow(num)) : ''}">${esc(roleShort(p && roleNow(num)))}</span>
        ${pos && p && st.roles[num] && st.roles[num] !== p.role ? `<span class="note" title="Ruolo preso con il cambio, fino a fine set">al posto di ${esc(roleShort(st.roles[num]))}</span>` : ''}
        ${extra || ''}</div>`;
    };
    const onCourt = order.map(pos => {
      const num = eff[pos];
      const isLib = st.activeLibero && num === st.activeLibero && st.liberoAuto;
      const btn = isLib
        ? (twoLiberos ? '<button class="subbtn" data-a="libero-swap">Cambia libero</button>' : '<span class="note">entra/esce da solo</span>')
        : `<button class="subbtn" data-a="sub-direct" data-pos="${pos}">Sostituisci</button>`;
      return row(num, pos, btn);
    }).join('');

    const effSet = new Set(Object.values(eff));
    const base = new Set(Object.values(st.lineup));
    const bench = match.roster.filter(p => !effSet.has(p.number)).map(p => {
      let note, rank = 2;
      if (base.has(p.number)) {
        const pos = E.POS.find(x => st.lineup[x] === p.number);
        note = `fuori per il libero (${pos})`; rank = 0;
      } else if (st.liberos.includes(p.number)) {
        if (p.number === st.activeLibero && st.liberoAuto) note = 'libero: entra in 2ª linea';
        else note = twoLiberos ? 'secondo libero' : 'libero non attivo';
        rank = 1;
      } else note = 'riserva';
      return { p, note, rank };
    }).sort((a, b) => a.rank - b.rank || (+a.p.number || 0) - (+b.p.number || 0));

    return `
      <div class="tpanel">
        <div class="tp-head">In campo</div>
        <div class="plist">${onCourt}</div>
        <div class="tp-head">Panchina</div>
        <div class="plist bench">${bench.map(b => row(b.p.number, '', `<span class="note">${esc(b.note)}</span>`)).join('') || '<div class="muted">Nessuno</div>'}</div>
        <div class="legend">AL alzatore · B1 prima banda · B2 seconda banda · C1 primo centro · C2 secondo centro · OP opposto · L libero</div>
      </div>`;
  }

  function gradeLabel(fund, g) { const gi = E.gradeInfo(fund, g); return gi ? gi.label : g; }
  function oppShort(id) { return st.oppMode === 'avanzata' || !/^P\d$/.test(id) ? '#' + id : 'Z' + id.slice(1); }

  function selLabel(eff) {
    const { team, pos } = ui.sel;
    return team === 'noi' ? `${playerLabel(eff[pos])} (${pos})` : `AVV ${oppLabel(oppPlayerId(pos))}${st.oppMode === 'avanzata' ? ' (' + pos + ')' : ''}`;
  }

  const ASK = { B: 'Chi batte?', R: 'Chi ha ricevuto?', E: 'Chi ha alzato?', A: 'Chi ha attaccato?', M: 'Chi ha murato?', D: 'Chi ha difeso?' };

  function promptHtml(eff, skip) {
    const f = currentFund();
    if (ui.sel) {
      return `<div class="prompt pending">
        <span class="step">2</span>
        <div class="grow"><span class="pq">${esc(selLabel(eff))} · ${E.FUNDS[f].name}: com'è andata?</span>
          <span class="pc">Tocca l'esito nei pulsanti sotto il campo${ui.sel.team === 'noi' && st.phase === 'rally' ? ' · oppure un altro giocatore se ha toccato qualcun altro' : ''}</span></div>
        <button data-a="cancel-sel" aria-label="Annulla scelta">✕</button></div>`;
    }
    const team = refTeam();
    let ctx;
    if (st.phase === 'serve') ctx = st.serving === 'avv' ? (skip ? 'Battono loro · se è ace: Ricezione → Ace subito' : 'Battono loro') : 'Battiamo noi';
    else if (skip && st.turn === 'avv') ctx = 'Palla a loro · quando torna di qua tocca chi la gioca, o assegna il punto';
    else ctx = `Palla a ${teamLabel(st.turn)} · tocco ${Math.min(st.touches + 1, 3)} di 3`;
    const q = (team === 'avv' ? 'Avversari: ' : '') + ASK[f];
    return `<div class="prompt ${team}"><span class="step">1</span><div class="grow"><span class="pq">${esc(q)}</span><span class="pc">Tocca il giocatore sul campo · ${esc(ctx)}</span></div></div>`;
  }

  // Motivo per cui un giocatore non può essere scelto (testo breve) o null.
  function lockReason(team, pos) {
    if (st.phase === 'serve' && team === st.serving && pos !== 'P1') return 'batte il P1';
    if (st.lastKey === `${team}_${pos}` && st.turn === team) return 'doppio tocco';
    return null;
  }

  function tileHtml(team, pos, eff) {
    const why = lockReason(team, pos);
    const sel = ui.sel && ui.sel.team === team && ui.sel.pos === pos;
    let inner, cls = 'tile';
    if (team === 'noi') {
      const p = player(eff[pos]);
      const r = roleNow(eff[pos]);
      if (p && E.isLibero(r)) cls += ' libero';
      if (p) cls += ' ' + roleClass(r);
      inner = `<span class="num">${esc(eff[pos])}</span><span class="nm">${esc(p ? p.name : '?')}</span><span class="pos">${pos}${p ? ' · ' + roleShort(r) : ''}</span>`;
    } else {
      inner = st.oppMode === 'avanzata'
        ? `<span class="num">${esc(st.oppLineup[pos])}</span><span class="pos">${pos}</span>`
        : `<span class="num">${pos}</span>`;
    }
    if (sel) cls += ' sel';
    if (why) { cls += ' locked'; if (why !== 'batte il P1') inner += `<span class="why">${why}</span>`; }
    return `<button class="${cls}" data-a="tile" data-team="${team}" data-pos="${pos}">${inner}</button>`;
  }

  function courtHtml(eff, skip) {
    const opp = skip
      ? `<div class="skipbar">Avversari non registrati (modalità rapida)</div>`
      : `<div class="half avv">${['P1', 'P6', 'P5', 'P2', 'P3', 'P4'].map(p => tileHtml('avv', p, eff)).join('')}</div>`;
    return `<div class="court">${opp}<div class="net"></div>
      <div class="half noi">${['P4', 'P3', 'P2', 'P5', 'P6', 'P1'].map(p => tileHtml('noi', p, eff)).join('')}</div></div>`;
  }

  // Squadra di riferimento per il suggerimento: quella selezionata, altrimenti chi ha la palla.
  function refTeam() {
    if (ui.sel) return ui.sel.team;
    if (st.phase === 'serve') return st.serving === 'avv' && st.oppMode === 'skip' ? 'noi' : st.serving;
    return st.oppMode === 'skip' && st.turn === 'avv' ? 'noi' : st.turn;
  }

  // Fondamentale possibile per il giocatore selezionato (o in generale se nessuno è selezionato).
  function fundEnabled(f) {
    const team = refTeam();
    if (st.phase === 'serve') {
      if (team === st.serving) return f === 'B';
      return f === 'R'; // battuta non registrata: si parte dalla ricezione
    }
    if (f === 'B') return false;
    if (f === 'M' && ui.sel && ['P1', 'P5', 'P6'].includes(ui.sel.pos)) return false; // seconda linea non mura
    return true;
  }

  function suggestedFund() {
    const team = refTeam();
    if (st.phase === 'serve') return team === st.serving ? 'B' : 'R';
    return E.suggestFund(st, team);
  }

  // Fondamentale attivo: scelto a mano, altrimenti quello previsto, altrimenti il primo possibile.
  function currentFund() {
    if (ui.fund && fundEnabled(ui.fund)) return ui.fund;
    const s = suggestedFund();
    if (fundEnabled(s)) return s;
    return E.FUND_ORDER.find(fundEnabled) || s;
  }

  // Comandi dell'azione, sotto al campo: schede fondamentale + esiti grandi.
  function actionsHtml() {
    const cur = currentFund(), sugg = suggestedFund();
    const tabs = E.FUND_ORDER.map(f => {
      const ok = fundEnabled(f);
      return `<button class="ftab${f === cur ? ' on' : ''}${ok && f === sugg ? ' sugg' : ''}" data-a="fund-tab" data-f="${f}" ${ok ? '' : 'disabled'}>
        <i class="fdot f-${f}"></i>${E.FUNDS[f].name}</button>`;
    }).join('');
    const btns = E.FUNDS[cur].grades.filter(g => !g.hidden).map(g =>
      `<button class="${GRADE_CLASS[g.g]}" data-a="outcome" data-f="${cur}" data-g="${esc(g.g)}">${esc(g.label)}${g.sub ? `<small>${esc(g.sub)}</small>` : ''}</button>`).join('');
    return `<div class="actions${ui.sel ? '' : ' waiting'}">
      <div class="ahead">${ui.sel ? 'Com\'è andata?' : 'Prima tocca il giocatore, poi l\'esito'} <span class="muted">· fondamentale <i class="dot-sugg"></i> previsto, toccane un altro se serve</span></div>
      <div class="ftabs">${tabs}</div>
      <div class="obtns">${btns}</div></div>`;
  }

  function tapTile(team, pos) {
    const why = lockReason(team, pos);
    if (why) {
      toast({ 'batte il P1': 'In battuta si registra il giocatore in P1', 'doppio tocco': 'Ha appena toccato lui: doppio tocco' }[why], true);
      return;
    }
    ui.sel = { team, pos }; // per togliere la scelta c'è la ✕
    render();
  }

  function chooseOutcome(fund, g) {
    if (!ui.sel) { toast('Prima tocca il giocatore in campo', true); return; }
    if (!fundEnabled(fund)) return;
    if (fund === 'B' && g === '#' && ui.sel.team === 'avv') { openSheet(sheetAceOn); return; } // ace loro: su chi?
    recordTouch(ui.sel.team, ui.sel.pos, fund, g);
  }

  // Ace avversario: si sceglie quale nostro giocatore ha subito l'ace.
  function sheetAceOn() {
    const eff = E.effectiveLineup(match, st);
    const b = p => {
      const pl = player(eff[p]);
      return `<button data-a="ace-on" data-pos="${p}"><b>#${esc(eff[p])}</b> ${esc(pl ? pl.name : '')}<br><span class="muted">${p}</span></button>`;
    };
    return `<h2>Ace avversario: su chi?</h2>
      <div class="muted" style="margin-bottom:8px">Tocca il nostro giocatore che doveva ricevere.</div>
      <div class="opts three">${['P4', 'P3', 'P2', 'P5', 'P6', 'P1'].map(b).join('')}</div>
      <div class="opts" style="margin-top:8px">
        <button data-a="ace-on" data-pos="">Non so / nessuno</button>
        <button data-a="close">Annulla</button>
      </div>`;
  }

  function recordTouch(team, pos, fund, g, extra) {
    const info = E.gradeInfo(fund, g);
    if (!info) return;
    if (info.effect === 'keep' && st.turn === team && st.touches >= 3 && st.phase === 'rally') toast('Attenzione: 4° tocco', true);
    const eff = E.effectiveLineup(match, st);
    const pl = team === 'noi' ? eff[pos] : oppPlayerId(pos);
    buzz(12);
    commit(Object.assign({ type: 'touch', team, pos, player: pl, fund, grade: g }, extra || {}));
  }

  /* --------------------------- fine partita --------------------------- */
  function viewMatchOver() {
    const w = st.setsWon.noi > st.setsWon.avv ? 'Vittoria!' : (st.setsWon.noi < st.setsWon.avv ? 'Sconfitta' : 'Finita');
    return `
      <div class="topbar"><button class="btn ghost" data-a="home">${ic('back')}Partite</button><h1><span class="tb-eyebrow">Partita finita</span>NOI <span class="vs">contro</span> ${esc(match.opponent)}</h1></div>
      <div class="page">
        <div class="card result-card ${st.setsWon.noi > st.setsWon.avv ? 'win' : 'loss'}">
          <div class="rc-label">${w}</div>
          <div class="rc-score"><span>${st.setsWon.noi}</span><i>–</i><span>${st.setsWon.avv}</span></div>
          <div class="rc-sets">${st.setResults.map(r => `<span class="${r.winner}">${r.noi}–${r.avv}</span>`).join('')}</div>
        </div>
        ${pendingBackups().some(m => m.id === match.id) ? `<div class="hint">Partita non ancora in un backup: <b>scarica il backup</b> qui sotto (o il backup completo dalla Home) prima di chiudere.</div>` : ''}
        <div class="card">
          <button class="btn primary block lg" data-a="stats">${ic('chart')}Statistiche</button>
          <div style="height:10px"></div>
          ${exportButtons()}
          <div style="height:10px"></div>
          <div class="row">
            <button class="btn grow" data-a="roster-edit">${ic('users')}Modifica rosa</button>
            <button class="btn grow" data-a="events">${ic('edit')}Correggi un'azione</button>
            <button class="btn grow" data-a="undo">${ic('undo')}Annulla fine set</button>
          </div>
        </div>
      </div>`;
  }

  /* ----------------------------- statistiche ----------------------------- */
  function viewStats() {
    const sets = st.setResults.map(r => r.n);
    if (st.phase === 'serve' || st.phase === 'rally' || st.phase === 'setOver') sets.push(st.setNum);
    const S = E.computeStats(match, st, ui.statsSet);
    const segBtns = [`<button class="${ui.statsSet == null ? 'on' : ''}" data-a="stats-set" data-set="">Tutta</button>`]
      .concat(sets.map(n => `<button class="${ui.statsSet === n ? 'on' : ''}" data-a="stats-set" data-set="${n}">Set ${n}</button>`)).join('');

    const T = S.noiTeam;
    const playerRows = S.players.map(p => statRowHtml(`#${esc(p.number)} ${esc(p.name)}`, p)).join('');
    const oppRows = S.opp.map(p => statRowHtml(esc(oppLabel(p.number)), p)).join('');

    return `
      <div class="topbar"><button class="btn ghost" data-a="back-match">${ic('back')}Partita</button><h1><span class="tb-eyebrow">Statistiche</span>NOI <span class="vs">contro</span> ${esc(match.opponent)}</h1></div>
      <div class="page stats-page">
        <div class="card stats-head">
          <div class="sh-match"><span class="swatch"></span>NOI <span class="sh-vs">contro</span> ${esc(match.opponent)}</div>
          <div class="sh-meta">${esc(fmtDate(match.date))} · ${esc(resultLine())}</div>
          <div class="sh-scope">${esc(scopeTitle())}</div>
          <div class="muted" style="margin:4px 0 10px">Scegli se vedere tutta la partita o un solo set:</div>
          <div class="seg" style="flex-wrap:wrap">${segBtns}</div>
        </div>
        <div class="card">
          <h2>Riepilogo della squadra <span class="muted">· ${ui.statsSet == null ? 'tutta la partita' : 'set ' + ui.statsSet}</span></h2>
          ${genHtml(S)}
        </div>
        <div class="card">
          <h2>I nostri giocatori <span class="muted">· ${ui.statsSet == null ? 'tutta la partita' : 'set ' + ui.statsSet}</span></h2>
          <div class="tbl-wrap"><table class="stats">${statHead()}<tbody>${playerRows}${statRowHtml('Squadra', T, true)}</tbody></table></div>
          ${statLegend()}
        </div>
        <div class="card">
          <h2>Rotazioni <span class="muted">· ${ui.statsSet == null ? 'tutta la partita' : 'set ' + ui.statsSet}</span></h2>
          ${rotTableHtml(S)}
        </div>
        ${S.opp.length ? `<div class="card"><h2>Avversari: ${esc(match.opponent)} <span class="muted">· ${ui.statsSet == null ? 'tutta la partita' : 'set ' + ui.statsSet}</span></h2><div class="tbl-wrap"><table class="stats">${statHead()}<tbody>${oppRows}${statRowHtml('Squadra', S.avvTeam, true)}</tbody></table></div></div>` : ''}
        <div class="card">${exportButtons()}</div>
      </div>`;
  }

  function genHtml(S) {
    return S.general.map(g => `
      <div class="gen-group">${esc(g.group)}</div>
      <div class="gen">${g.items.map(i => `<div class="gen-item"><div class="v">${esc(i.pct ? fmtPct(i.value) : i.value)}</div><div class="l">${esc(i.label)}</div></div>`).join('')}</div>`).join('');
  }
  function rotTableHtml(S) {
    const rows = S.rotations.map(r => `
      <tr class="${r.rot === 'Totale' ? 'tot' : ''}"><td>${esc(r.rot)}</td>
        <td class="grp">${r.soWon}/${r.soTot}</td><td>${fmtPct(r.soPct)}</td>
        <td class="grp">${r.bpWon}/${r.bpTot}</td><td>${fmtPct(r.bpPct)}</td></tr>`).join('');
    return `<div class="muted" style="margin-bottom:6px">Rotazione = posizione del palleggiatore. Cambio palla = punti vinti in ricezione; Break = punti vinti in battuta.</div>
      <div class="tbl-wrap"><table class="stats">
        <thead><tr><th>Rot.</th><th class="grp">Cambio palla</th><th>%</th><th class="grp">Break</th><th>%</th></tr></thead>
        <tbody>${rows}</tbody></table></div>`;
  }
  function statLegend() {
    return `<div class="muted stat-legend">
      <b>Eff</b> = efficienza: in battuta (ace − errori) / battute, in attacco (punti − errori − murati) / attacchi ·
      <b>+ %</b> = percentuale di ricezioni (o difese) buone o migliori · <b>++ %</b> = ricezioni in testa all'alzatore.<br>
      <b>Muro</b>: <b>Secchi</b> muro punto · <b>Normali</b> toccato, torna di là · <b>Rigiocate</b> tocco a muro, resta a noi ·
      <b>Interd.</b> non tirano sul muro (sopra o altrove).
    </div>`;
  }

  /* ------------------------ statistiche di stagione ------------------------ */
  // Somma delle partite scelte (di base tutte). ui.seasonOff = partite escluse.
  function loadGames() {
    return listMatches().map(x => {
      try { const m = loadMatch(x.id); return m ? { match: m, st: E.computeState(m) } : null; } catch (e) { return null; }
    }).filter(Boolean);
  }

  function viewSeason() {
    const games = loadGames().sort((a, b) => String(b.match.date).localeCompare(String(a.match.date)));
    const off = new Set(ui.seasonOff || []);
    const sel = games.filter(g => !off.has(g.match.id));
    const pick = g => {
      const st2 = g.st, on = !off.has(g.match.id);
      const res = st2.setResults.length ? `${st2.setsWon.noi}–${st2.setsWon.avv}` : '—';
      const cls = st2.phase === 'matchOver' ? (st2.setsWon.noi > st2.setsWon.avv ? 'win' : 'loss') : 'ongoing';
      return `<button class="pick${on ? ' on' : ''}" data-a="season-toggle" data-id="${esc(g.match.id)}" aria-pressed="${on}">
        <span class="pk-box">${on ? ic('check') : ''}</span>
        <span class="date-chip">${esc(fmtDayMonth(g.match.date))}</span>
        <span class="grow pk-t">${esc(g.match.opponent || 'Avversario')}</span>
        <span class="res ${cls}">${res}${cls === 'ongoing' ? ' <small>in corso</small>' : ''}</span></button>`;
    };
    const head = `
      <div class="topbar"><button class="btn ghost" data-a="home">${ic('back')}Partite</button>
        <h1><span class="tb-eyebrow">Statistiche di stagione</span>NOI <span class="vs">· ${sel.length} ${sel.length === 1 ? 'partita' : 'partite'}</span></h1></div>`;
    const pickCard = `
      <div class="card">
        <div class="card-h">${ic('check')}<h2>Partite incluse</h2>
          <button class="btn sm" data-a="season-all">Tutte</button><button class="btn sm" data-a="season-none">Nessuna</button></div>
        <div class="picks">${games.map(pick).join('')}</div>
      </div>`;
    if (!sel.length) {
      return head + `<div class="page stats-page">${pickCard}<div class="empty-state">Scegli almeno una partita.</div></div>`;
    }
    const { S, perMatch, record: rec } = E.computeSeasonStats(sel);
    const kpi = (v, l, cls) => `<div class="kpi ${cls || ''}"><div class="v">${v}</div><div class="l">${l}</div></div>`;
    const players = S.players.map(p => statRowHtml(`#${esc(p.number)} ${esc(p.name)} <span class="muted">· ${p.games} ${p.games === 1 ? 'partita' : 'partite'}</span>`, p)).join('');
    const trend = perMatch.slice().reverse().map(m => `<tr>
        <td class="l">${esc(fmtDayMonth(m.date))} · ${esc(m.opponent || 'Avversario')}</td>
        <td class="grp"><span class="res ${m.over ? (m.win ? 'win' : 'loss') : 'ongoing'}">${m.setsNoi}–${m.setsAvv}</span></td>
        <td class="grp">${m.team.points}</td><td>${m.team.errors}</td>
        <td class="grp">${fmtPct(m.team.serveEff)}</td><td>${fmtPct(m.team.recPos)}</td>
        <td>${fmtPct(m.team.attEff)}</td><td>${m.team.blkPts}</td>
        <td class="grp">${fmtPct(m.soPct)}</td><td>${fmtPct(m.bpPct)}</td></tr>`).join('');
    return head + `
      <div class="page stats-page">
        <div class="card">
          <div class="kpis">
            ${kpi(rec.played, rec.played === 1 ? 'partita' : 'partite')}
            ${kpi(rec.won, 'vinte', 'win')}
            ${kpi(rec.lost, 'perse', 'loss')}
            ${kpi(`${rec.setsWon}–${rec.setsLost}`, 'set vinti–persi')}
          </div>
          ${rec.played > rec.finished ? `<div class="muted" style="margin-top:8px">${rec.played - rec.finished} ${rec.played - rec.finished === 1 ? 'partita è ancora in corso: è contata' : 'partite sono ancora in corso: sono contate'} nelle statistiche ma non tra vinte e perse.</div>` : ''}
        </div>
        ${pickCard}
        <div class="card">
          <h2>Partita per partita</h2>
          <div class="tbl-wrap"><table class="stats">
            <thead><tr><th class="l">Partita</th><th class="grp">Set</th><th class="grp">Punti</th><th>Errori</th>
              <th class="grp" title="(ace − errori) / battute">Eff batt</th><th title="Ricezioni ++ e buone">Ric + %</th><th title="(punti − errori − murati) / attacchi">Eff att</th><th>Muri</th>
              <th class="grp" title="Punti vinti in ricezione">Cambio palla</th><th title="Punti vinti in battuta">Break</th></tr></thead>
            <tbody>${trend}</tbody></table></div>
        </div>
        <div class="card"><h2>Riepilogo della squadra <span class="muted">· ${sel.length} partite</span></h2>${genHtml(S)}</div>
        <div class="card">
          <h2>I nostri giocatori <span class="muted">· somma delle partite scelte</span></h2>
          <div class="tbl-wrap"><table class="stats">${statHead()}<tbody>${players}${statRowHtml('Squadra', S.noiTeam, true)}</tbody></table></div>
          ${statLegend()}
        </div>
        <div class="card"><h2>Rotazioni <span class="muted">· somma delle partite scelte</span></h2>${rotTableHtml(S)}</div>
        <div class="card"><button class="btn primary block" data-a="season-xlsx">${ic('download')}Scarica Excel della stagione</button></div>
      </div>`;
  }

  // Testi del titolo delle statistiche: data, risultato, a cosa si riferiscono i numeri.
  function fmtDayMonth(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    return m ? `${+m[3]} ${['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic'][+m[2] - 1] || ''}` : '–';
  }
  function fmtDate(d) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(d || '');
    return m ? `${m[3]}/${m[2]}/${m[1]}` : (d || '');
  }
  function resultLine() {
    const live = st.phase === 'serve' || st.phase === 'rally' || st.phase === 'setOver';
    const sets = st.setResults.map(r => `${r.noi}-${r.avv}`).join(', ');
    let s = `Set ${st.setsWon.noi}-${st.setsWon.avv}${sets ? ' (' + sets + ')' : ''}`;
    if (live) s += ` · set ${st.setNum} in corso ${st.score.noi}-${st.score.avv}`;
    else if (st.phase === 'matchOver') s += ' · partita finita';
    return s;
  }
  function scopeTitle() {
    if (ui.statsSet == null) return 'Statistiche di tutta la partita';
    const r = st.setResults.find(x => x.n === ui.statsSet);
    if (r) return `Statistiche del set ${r.n} (finito ${r.noi}-${r.avv})`;
    return `Statistiche del set ${ui.statsSet} (in corso ${st.score.noi}-${st.score.avv})`;
  }

  // Intestazione su due righe: sopra il fondamentale (Battuta, Ricezione, …), sotto le colonne.
  function statHead() {
    const g = (f, n, label) => `<th class="grp gh${f ? ' gh-' + f : ''}" colspan="${n}">${f ? `<i class="fdot f-${f}"></i>` : ''}${label}</th>`;
    return `<thead>
      <tr class="groups"><th class="l"></th>${g('', 2, 'Totale')}${g('B', 4, 'Battuta')}${g('R', 4, 'Ricezione')}${g('A', 5, 'Attacco')}${g('M', 4, 'Muro')}${g('D', 2, 'Difesa')}</tr>
      <tr><th class="l">Giocatore</th><th class="grp" title="Punti fatti">Punti</th><th title="Errori">Errori</th>
      <th class="grp" title="Battute totali">Tot</th><th>Ace</th><th>Err</th><th title="(ace − errori) / battute">Eff</th>
      <th class="grp" title="Ricezioni totali">Tot</th><th title="++ e buone">+ %</th><th title="In testa all'alzatore">++ %</th><th>Err</th>
      <th class="grp" title="Attacchi totali">Tot</th><th>Punti</th><th>Err</th><th title="Attacchi murati">Murati</th><th title="(punti − errori − murati) / attacchi">Eff</th>
      <th class="grp" title="Muro secco: punto">Secchi</th><th title="Muro normale: torna di là">Normali</th><th title="Palla rigiocata: tocco a muro, resta a noi">Rigiocate</th><th title="Muro d'interdizione: non tirano sul muro">Interd.</th>
      <th class="grp" title="Difese totali">Tot</th><th title="Perfette e buone">+ %</th></tr></thead>`;
  }

  function statRowHtml(label, s, tot) {
    return `<tr class="${tot ? 'tot' : ''}"><td class="l">${label}</td><td class="grp">${s.points}</td><td>${s.errors}</td>
      <td class="grp">${s.serveTot}</td><td>${s.ace}</td><td>${s.serveErr}</td><td>${fmtPct(s.serveEff)}</td>
      <td class="grp">${s.recTot}</td><td>${fmtPct(s.recPos)}</td><td>${fmtPct(s.recPrf)}</td><td>${s.recErr}</td>
      <td class="grp">${s.attTot}</td><td>${s.kill}</td><td>${s.attErr}</td><td>${s.attBlk}</td><td>${fmtPct(s.attEff)}</td>
      <td class="grp">${s.blkPts}</td><td>${s.blkNorm}</td><td>${s.blkReplay}</td><td>${s.blkInt}</td><td class="grp">${s.defTot}</td><td>${fmtPct(s.defPos)}</td></tr>`;
  }

  /* ------------------------------ esporta ------------------------------ */
  const canShareFiles = () => {
    try { return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.txt', { type: 'text/plain' })] })); } catch (e) { return false; }
  };

  function exportButtons() {
    const share = canShareFiles();
    return `
      <div class="row">
        <button class="btn primary grow" data-a="export-xlsx">${ic('download')}Scarica Excel</button>
        ${share ? `<button class="btn grow" data-a="share-xlsx">${ic('share')}Condividi Excel</button>` : ''}
      </div>
      <div class="row" style="margin-top:8px">
        <button class="btn grow" data-a="export-json">${ic('download')}Scarica backup</button>
        ${share ? `<button class="btn grow" data-a="share-json">${ic('share')}Condividi backup</button>` : ''}
      </div>`;
  }

  function baseFilename() {
    const opp = (match.opponent || 'avversario').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    return `scout_${match.date}_${opp || 'partita'}`;
  }

  const xn = v => (v == null ? '' : v);
  const XL_HEAD = ['Giocatore', 'Ruolo', 'Punti', 'Errori', 'Battute', 'Ace', 'Err batt', 'Eff batt %',
    'Ricezioni', 'Ric + %', 'Ric ++ %', 'Err ric', 'Attacchi', 'Punti att', 'Err att', 'Murati', 'Kill %', 'Eff att %',
    'Muri secchi', 'Muri normali', 'Palle rigiocate', 'Muri interdizione', 'Err muro', 'Muri totali', 'Difese', 'Dif + %', 'Err dif', 'Alzate', 'Err alz'];
  const xlRow = (label, role, s) => [label, role, s.points, s.errors, s.serveTot, s.ace, s.serveErr, xn(s.serveEff),
    s.recTot, xn(s.recPos), xn(s.recPrf), s.recErr, s.attTot, s.kill, s.attErr, s.attBlk, xn(s.killPct), xn(s.attEff),
    s.blkPts, s.blkNorm, s.blkReplay, s.blkInt, s.blkErr, s.blkTot, s.defTot, xn(s.defPos), s.defErr, s.setTot, s.setErr];

  function buildSeasonWorkbook() {
    const off = new Set(ui.seasonOff || []);
    const sel = loadGames().filter(g => !off.has(g.match.id));
    const { S, perMatch, record: rec } = E.computeSeasonStats(sel);
    const riep = [['Voce', 'Valore'], ['Partite', rec.played], ['Vinte', rec.won], ['Perse', rec.lost],
      ['In corso', rec.played - rec.finished], ['Set vinti', rec.setsWon], ['Set persi', rec.setsLost]];
    S.general.forEach(g => {
      riep.push(['', ''], [g.group.toUpperCase(), '']);
      g.items.forEach(i => riep.push([i.label + (i.pct ? ' %' : ''), xn(i.value)]));
    });
    return Xlsx.makeXlsx([
      { name: 'Riepilogo', rows: riep, widths: [34, 14] },
      { name: 'Partite', widths: [12, 22, 10, 18, 8, 8, 10, 10, 10, 8, 14, 10],
        rows: [['Data', 'Avversario', 'Risultato', 'Parziali', 'Punti', 'Errori', 'Eff batt %', 'Ric + %', 'Eff att %', 'Muri', 'Cambio palla %', 'Break %']]
          .concat(perMatch.map(m => [m.date, m.opponent, `${m.setsNoi}-${m.setsAvv}${m.over ? '' : ' (in corso)'}`, m.setResults.map(r => `${r.noi}-${r.avv}`).join(' '),
            m.team.points, m.team.errors, xn(m.team.serveEff), xn(m.team.recPos), xn(m.team.attEff), m.team.blkPts, xn(m.soPct), xn(m.bpPct)])) },
      { name: 'Giocatori', widths: [22, 14, 8],
        rows: [[XL_HEAD[0], XL_HEAD[1], 'Partite'].concat(XL_HEAD.slice(2))]
          .concat(S.players.map(p => { const r = xlRow(`#${p.number} ${p.name}`, p.role, p); return [r[0], r[1], p.games].concat(r.slice(2)); }),
            [(() => { const r = xlRow('Squadra', '', S.noiTeam); return [r[0], r[1], rec.played].concat(r.slice(2)); })()]) },
      { name: 'Rotazioni', widths: [10, 14, 14, 12, 12, 12, 12],
        rows: [['Rotazione', 'Cambio palla vinti', 'Cambio palla tot', 'Cambio palla %', 'Break vinti', 'Break tot', 'Break %']]
          .concat(S.rotations.map(r => [r.rot, r.soWon, r.soTot, xn(r.soPct), r.bpWon, r.bpTot, xn(r.bpPct)])) },
    ]);
  }

  function buildWorkbook() {
    const S = E.computeStats(match, st, null);
    const n = xn, head = XL_HEAD, row = xlRow;

    const sheets = [];
    const riep = [['Voce', 'Valore'],
      ['Avversario', match.opponent], ['Data', match.date],
      ['Risultato (set)', `${st.setsWon.noi}-${st.setsWon.avv}`],
      ...st.setResults.map(r => [`Set ${r.n}`, `${r.noi}-${r.avv}`]),
      ['Efficienza attacco %', n(S.noiTeam.attEff)]];
    S.general.forEach(g => {
      riep.push(['', '']);
      riep.push([g.group.toUpperCase(), '']);
      g.items.forEach(i => riep.push([i.label + (i.pct ? ' %' : ''), n(i.value)]));
    });
    sheets.push({ name: 'Riepilogo', rows: riep, widths: [34, 20] });

    sheets.push({ name: 'Giocatori', widths: [22, 14],
      rows: [head].concat(S.players.map(p => row(`#${p.number} ${p.name}`, p.role, p)), [row('Squadra', '', S.noiTeam)]) });

    // Giocatori per set
    const perSet = [['Set'].concat(head)];
    for (const r of st.setResults.map(x => x.n).concat(st.phase === 'serve' || st.phase === 'rally' ? [st.setNum] : [])) {
      const SS = E.computeStats(match, st, r);
      SS.players.forEach(p => perSet.push([r].concat(row(`#${p.number} ${p.name}`, p.role, p))));
      perSet.push([r].concat(row('Squadra', '', SS.noiTeam)));
    }
    sheets.push({ name: 'Giocatori per set', rows: perSet, widths: [6, 22, 14] });

    sheets.push({ name: 'Rotazioni', widths: [10, 14, 14, 12, 12, 12, 12],
      rows: [['Rotazione', 'Cambio palla vinti', 'Cambio palla tot', 'Cambio palla %', 'Break vinti', 'Break tot', 'Break %']]
        .concat(S.rotations.map(r => [r.rot, r.soWon, r.soTot, n(r.soPct), r.bpWon, r.bpTot, n(r.bpPct)])) });

    if (S.opp.length) {
      sheets.push({ name: 'Avversari', widths: [16, 6],
        rows: [head].concat(S.opp.map(p => row(oppLabel(p.number), '', p)), [row('Squadra', '', S.avvTeam)]) });
    }

    sheets.push({ name: 'Rally', widths: [6, 10, 10, 10, 10, 10, 22, 14, 8],
      rows: [['Set', 'Punteggio', 'Battuta', 'Rotazione', 'Vince', 'Cambio palla', 'Motivo', 'Tocchi registrati']]
        .concat(st.rallies.map(r => [r.set, `${r.scoreNoi}-${r.scoreAvv}`, teamLabel(r.serving), r.rotNoi, teamLabel(r.winner),
          r.sideout ? 'sì' : 'no', reasonLabel(r.reason), r.touches])) });

    sheets.push({ name: 'Tocchi', widths: [6, 10, 8, 8, 8, 22, 12, 6, 14, 10],
      rows: [['Set', 'Punteggio', 'Rotazione', 'Squadra', 'Posizione', 'Giocatore', 'Fondamentale', 'Voto', 'Esito', 'Codice']]
        .concat(st.log.map(r => {
          const gi = E.gradeInfo(r.fund, r.grade);
          return [r.set, `${r.scoreNoi}-${r.scoreAvv}`, r.rotNoi, teamLabel(r.team), r.pos,
            r.team === 'noi' ? playerLabel(r.player) : oppLabel(r.player), E.FUNDS[r.fund].name, r.grade, gi ? gi.label : '',
            `${r.team === 'noi' ? '*' : 'a'}${r.player}${r.fund}${r.grade}`];
        })) });

    return Xlsx.makeXlsx(sheets);
  }

  function reasonLabel(r) {
    if (REASON_LABEL[r]) return REASON_LABEL[r];
    const f = r && E.FUNDS[r[0]];
    const gi = f && E.gradeInfo(r[0], r.slice(1));
    return gi ? `${f.name} ${r.slice(1)} (${gi.label})` : r;
  }

  function blobXlsx() {
    return new Blob([buildWorkbook()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  }
  function blobJson() {
    return new Blob([JSON.stringify(match, null, 1)], { type: 'application/json' });
  }

  function download(blob, name) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  }

  async function share(blob, name) {
    try {
      await navigator.share({ files: [new File([blob], name, { type: blob.type })], title: name });
    } catch (e) {
      if (e && e.name === 'AbortError') return false;
      download(blob, name);
    }
    return true;
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const valid = m => m && Array.isArray(m.events) && Array.isArray(m.roster);
        if (data && data.type === 'scout-volley-backup' && Array.isArray(data.matches)) {
          // backup completo: aggiunge le partite che mancano, aggiorna quelle più vecchie
          let added = 0, updated = 0, same = 0;
          const done = [];
          for (const m of data.matches) {
            if (!valid(m) || !m.id) continue;
            migrateRoles(m.roster);
            const s = E.computeState(m); // verifica che sia leggibile
            const ex = loadMatch(m.id);
            if (ex && (ex.updated || 0) >= (m.updated || 0)) { same++; continue; }
            storeMatch(m, s);
            done.push(m);
            if (ex) updated++; else added++;
          }
          markBackedUp(done);
          if (!loadRoster().length && Array.isArray(data.roster) && data.roster.length) saveRoster(migrateRoles(data.roster));
          toast(`Backup importato: ${added} nuove, ${updated} aggiornate${same ? `, ${same} già presenti` : ''}`);
          render();
          return;
        }
        const m = data;
        if (!valid(m)) throw new Error('formato');
        m.id = uid();
        migrateRoles(m.roster);
        E.computeState(m); // verifica che sia leggibile
        match = m;
        recompute();
        saveMatch();
        markBackedUp([match]);
        match = null; st = null;
        toast('Partita importata');
        render();
      } catch (e) {
        toast('File non valido', true);
      }
    };
    reader.readAsText(file);
  }

  /* ------------------------------- sheets ------------------------------- */
  function openSheet(fn, locked) { ui.sheet = fn; ui.sheetLocked = !!locked; renderSheet(); }
  function closeSheet() { ui.sheet = null; ui.sheetLocked = false; ui.subStep = null; ui.rosterEdit = null; ui.evEdit = null; renderSheet(); }
  function renderSheet() {
    if (!ui.sheet) { $sheet.innerHTML = ''; return; }
    $sheet.innerHTML = `<div class="sheet-backdrop" data-a="backdrop"><div class="sheet" role="dialog" aria-modal="true">${ui.sheet()}</div></div>`;
  }

  function renderSheetKeepScroll() {
    const a = $sheet.querySelector('.sheet'), top = a ? a.scrollTop : 0;
    renderSheet();
    const b = $sheet.querySelector('.sheet'); if (b) b.scrollTop = top;
  }

  function sheetSetOver() {
    const w = st.score.noi > st.score.avv ? 'NOI' : 'AVV';
    return `
      <h2>Fine set ${st.setNum}</h2>
      <p style="font-size:20px;font-weight:800;text-align:center">NOI ${st.score.noi} – ${st.score.avv} ${esc(match.opponent)}</p>
      <p class="muted" style="text-align:center">Set a ${w}.</p>
      <div class="opts">
        <button class="full noi" data-a="set-end">Conferma fine set</button>
        <button class="full" data-a="undo">Annulla ultimo punto</button>
        <button class="full" data-a="events">Correggi un'azione del set</button>
      </div>`;
  }

  function sheetPoint(team) {
    return () => {
      const reasons = team === 'noi'
        ? [['errAvv', 'Errore avversario'], ['noi', 'Punto nostro (non registrato)'], ['arb', 'Arbitro / fallo avversario']]
        : [['avv', 'Punto avversario'], ['errNoi', 'Errore nostro (non registrato)'], ['arb', 'Arbitro / fallo nostro']];
      return `
        <h2>Punto ${teamLabel(team)}</h2>
        <div class="opts">
          ${reasons.map(([k, l], i) => `<button class="full ${i === 0 ? team : ''}" data-a="point" data-team="${team}" data-reason="${k}">${l}</button>`).join('')}
          <button class="full" data-a="close">Chiudi</button>
        </div>`;
    };
  }

  function sheetHelp() {
    return `
      <h2>Come si usa</h2>
      <ol class="steps big">
        <li><b>Leggi la barra colorata</b> sopra il campo: ti dice cosa serve adesso (es. <i>Chi ha ricevuto?</i>).</li>
        <li><b>Tocca il giocatore</b> che ha giocato la palla: diventa giallo.</li>
        <li><b>Tocca com'è andata</b> nei pulsanti colorati sotto il campo. L'app passa da sola al tocco successivo.</li>
      </ol>
      <div class="sec">Utile da sapere</div>
      <ul class="tips">
        <li>Il fondamentale (Battuta, Ricezione, Alzata…) lo sceglie l'app: quello previsto ha il <i class="dot-sugg"></i> pallino giallo. Se è un altro (es. <b>Muro</b> invece di Difesa) tocca la sua scheda.</li>
        <li>In battuta il giocatore in P1 è già scelto e quando si alza è già scelto l'alzatore: basta toccare l'esito.</li>
        <li>Hai sbagliato? <b>↶ Annulla</b> toglie l'ultima cosa fatta (anche un punto o un cambio).</li>
        <li>Punto senza un tocco da registrare (errore loro, fallo, arbitro): <b>+1 NOI</b> / <b>+1 AVV</b>.</li>
        <li>Giocatori grigi: in quel momento non possono toccare (doppio tocco, seconda linea a muro).</li>
        <li>Rotazione, cambio palla e libero sono automatici. Correzioni, cambi e time-out: <b>Menu</b>.</li>
      </ul>
      <div class="sec">Muro</div>
      <ul class="tips">
        <li><b>Muro secco</b>: punto.</li>
        <li><b>Muro normale</b>: toccato, la palla torna nel campo avversario (non è punto).</li>
        <li><b>Palla rigiocata</b>: tocco a muro, la palla resta a noi e la rigiochiamo.</li>
        <li><b>Interdizione</b>: non tirano sul muro (sopra o altrove), il muro non tocca.</li>
      </ul>
      <div class="sec">Colori dei ruoli</div>
      <div class="role-legend">
        <span><i class="role r-al">AL</i> Alzatore</span><span><i class="role r-b">B</i> Bande</span><span><i class="role r-c">C</i> Centri</span>
        <span><i class="role r-op">OP</i> Opposto</span><span><i class="role r-l">L</i> Libero</span>
      </div>
      <div class="opts" style="margin-top:14px"><button class="full noi" data-a="close">Ho capito</button></div>`;
  }

  /* ------------------------------- novità ------------------------------- */
  const NOVITA = window.NOVITA || [];
  const latestV = () => (NOVITA[0] ? NOVITA[0].v : 0);

  // Prima apertura dopo un aggiornamento: mostra le novità non ancora viste.
  // Chi apre l'app per la prima volta in assoluto non le vede (per lui è tutto nuovo).
  function showNovitaIfNew() {
    const seen = store.get('scout.seenVersion', null);
    const used = store.get('scout.roster', null) || listMatches().length;
    if (seen == null && !used) { store.set('scout.seenVersion', latestV()); return; }
    const since = seen == null ? latestV() - 1 : seen;
    const news = NOVITA.filter(n => n.v > since);
    if (!news.length || ui.sheet) return; // con un'altra finestra aperta: la prossima volta
    store.set('scout.seenVersion', latestV());
    openSheet(sheetNovita(news));
  }

  function sheetNovita(list, all) {
    return () => `
      <h2>${all ? 'Novità dell\'app' : '🎉 App aggiornata: le novità'}</h2>
      ${list.map(n => `
        <div class="nov">
          <div class="nov-head"><b>${esc(n.titolo)}</b> <span class="muted">${esc(fmtDate(n.data))}</span></div>
          <ul class="tips">${n.voci.map(x => `<li>${esc(x)}</li>`).join('')}</ul>
        </div>`).join('')}
      <div class="opts" style="margin-top:14px"><button class="full noi" data-a="close">${all ? 'Chiudi' : 'Ho capito'}</button></div>`;
  }

  function sheetMenu() {
    const inServe = st.phase === 'serve';
    const libs = st.liberos;
    return `
      <div class="sheet-h"><h2>Menu</h2><button class="sheet-x" data-a="close" aria-label="Chiudi">${ic('x')}</button></div>
      <div class="sec">Partita</div>
      <div class="opts">
        <button data-a="timeout" data-team="noi">${ic('clock')}Time-out NOI <span class="cnt">${st.timeouts.noi}/${st.rules.timeouts}</span></button>
        <button data-a="timeout" data-team="avv">${ic('clock')}Time-out AVV <span class="cnt">${st.timeouts.avv}/${st.rules.timeouts}</span></button>
        <button data-a="sub-start" data-team="noi">${ic('swap')}Cambio NOI <span class="cnt">${st.subs.noi}/${st.rules.subs}</span></button>
        ${st.oppMode === 'avanzata' ? `<button data-a="sub-start" data-team="avv">${ic('swap')}Cambio AVV <span class="cnt">${st.subs.avv}</span></button>` : `<button data-a="stats">${ic('chart')}Statistiche</button>`}
      </div>
      <div class="opts" style="margin-top:8px">
        <button class="full feature" data-a="events">${ic('edit')}<span class="ft"><b>Correggi un'azione</b><small>Cambia giocatore o esito di un tocco vecchio, elimina un punto o un cambio</small></span></button>
      </div>
      <div class="sec">Squadra</div>
      <div class="opts">
        <button class="full feature" data-a="roster-edit">${ic('users')}<span class="ft"><b>Modifica rosa</b><small>Correggi maglie, nomi e ruoli · aggiungi o togli giocatori</small></span></button>
      </div>
      <div class="sec">Libero</div>
      <div class="opts">
        ${libs.map(l => `<button class="${st.activeLibero === l ? 'noi' : ''}" data-a="libero" data-num="${esc(l)}">${esc(playerLabel(l))}</button>`).join('')}
        <button class="${!st.liberoAuto || !st.activeLibero ? 'noi' : ''}" data-a="libero" data-num="">Senza libero</button>
      </div>
      <div class="sec">Correzioni</div>
      <div class="opts">
        <button data-a="rotate" data-team="noi" data-dir="1">NOI: ruota avanti</button>
        <button data-a="rotate" data-team="noi" data-dir="-1">NOI: ruota indietro</button>
        <button data-a="rotate" data-team="avv" data-dir="1">AVV: ruota avanti</button>
        <button data-a="rotate" data-team="avv" data-dir="-1">AVV: ruota indietro</button>
        ${inServe ? `<button class="full" data-a="serve-fix" data-team="${E.other(st.serving)}">Batte invece ${teamLabel(E.other(st.serving))}</button>` : ''}
      </div>
      <div class="sec">Avversari</div>
      ${segOppMode(st.oppMode, 'set-mode')}
      <div class="sec">Esporta</div>
      ${exportButtons()}
      <div class="sec">Altro</div>
      <div class="opts">
        ${st.oppMode === 'avanzata' ? `<button data-a="stats">${ic('chart')}Statistiche</button>` : ''}
        <button data-a="help">${ic('help')}Guida</button>
        <button data-a="novita">${ic('sparkle')}Novità dell'app</button>
        <button data-a="home">${ic('back')}Elenco partite</button>
        <button class="${st.oppMode === 'avanzata' ? 'full' : ''}" data-a="close">Chiudi</button>
      </div>`;
  }

  /* --------------------------- correggi un'azione --------------------------- */
  // Elenco delle azioni di un set: ogni tocco si può modificare (chi, fondamentale, esito)
  // o cancellare; punti, cambi, time-out e libero si possono cancellare. Lo stato si
  // ricalcola da capo. Non si accettano correzioni che cambierebbero un set già chiuso.
  const EDITABLE = ['touch', 'point', 'sub', 'timeout', 'libero', 'rotate', 'serveFix'];

  function openEvents() {
    ui.evEdit = { set: Math.max(1, st.setNum), idx: null, del: null };
    openSheet(sheetEvents);
  }

  function eventRows(setN) {
    const rows = [];
    E.computeState(match, (ev, i, s) => {
      if (s.setNum === setN && EDITABLE.includes(ev.type)) {
        rows.push({ i, ev, score: `${s.score.noi}–${s.score.avv}`, opp: s.oppMode === 'avanzata' ? s.oppLineup : null, oppMode: s.oppMode });
      }
    });
    return rows;
  }

  function eventText(r) {
    const ev = r.ev;
    const opp = id => (r.oppMode === 'avanzata' || !/^P\d$/.test(id) ? '#' + id : 'Zona ' + id);
    switch (ev.type) {
      case 'touch': {
        const who = ev.team === 'noi' ? playerLabel(ev.player) : 'AVV ' + opp(ev.player);
        return `<i class="fdot f-${ev.fund}"></i><span class="t ${ev.team}">${esc(who)}</span><span class="f">${E.FUNDS[ev.fund].name}</span>
          <span class="g ${GRADE_CLASS[ev.grade] || ''}">${esc(gradeLabel(ev.fund, ev.grade))}</span>`;
      }
      case 'point': return `<span class="t"><b>Punto ${teamLabel(ev.winner)}</b> <span class="muted">${esc(reasonLabel(ev.reason || 'manuale'))}</span></span>`;
      case 'sub': return `<span class="t">Cambio ${teamLabel(ev.team || 'noi')}: entra ${esc(ev.team === 'avv' ? '#' + ev.in : playerLabel(ev.in))} per ${esc(ev.team === 'avv' ? '#' + ev.out : playerLabel(ev.out))}</span>`;
      case 'timeout': return `<span class="t">Time-out ${teamLabel(ev.team)}</span>`;
      case 'libero': return `<span class="t">${ev.num ? 'Libero: ' + esc(playerLabel(ev.num)) : 'Senza libero'}</span>`;
      case 'rotate': return `<span class="t">Correzione rotazione ${teamLabel(ev.team)} (${ev.dir === -1 ? 'indietro' : 'avanti'})</span>`;
      case 'serveFix': return `<span class="t">Battuta corretta: batte ${teamLabel(ev.team)}</span>`;
      default: return esc(ev.type);
    }
  }

  function sheetEvents() {
    const X = ui.evEdit;
    if (X.idx != null) return sheetEditTouch();
    const sets = Array.from({ length: Math.max(1, st.setNum) }, (_, k) => k + 1);
    const rows = eventRows(X.set).reverse();
    const closed = st.setResults.some(r => r.n === X.set);
    const row = r => `<div class="ev-row ${r.ev.type}">
        <span class="ev-sc">${r.score}</span>
        <div class="ev-d">${eventText(r)}</div>
        ${r.ev.type === 'touch' ? `<button class="ev-b" data-a="ev-edit" data-i="${r.i}" aria-label="Modifica" title="Modifica">${ic('edit')}</button>` : ''}
        ${X.del === r.i
          ? `<button class="ev-b danger" data-a="ev-del" data-i="${r.i}">Elimina</button>`
          : `<button class="ev-b" data-a="ev-del-ask" data-i="${r.i}" aria-label="Elimina" title="Elimina">${ic('trash')}</button>`}
      </div>`;
    return `
      <div class="sheet-h"><h2>Correggi un'azione</h2><button class="sheet-x" data-a="close" aria-label="Chiudi">${ic('x')}</button></div>
      <div class="muted" style="margin-bottom:10px">Le più recenti in alto. A sinistra il punteggio in quel momento. Tocca ${ic('edit')} per cambiare giocatore o esito, ${ic('trash')} per eliminare: punteggio, rotazioni e statistiche si ricalcolano da soli.</div>
      ${sets.length > 1 ? `<div class="seg" style="margin-bottom:10px">${sets.map(n => `<button class="${n === X.set ? 'on' : ''}" data-a="ev-set" data-set="${n}">Set ${n}</button>`).join('')}</div>` : ''}
      ${closed ? '<div class="hint">Set già chiuso: puoi correggere chi ha toccato e gli esiti, ma non cose che cambierebbero il punteggio finale del set.</div>' : ''}
      <div class="ev-list">${rows.map(row).join('') || '<div class="empty-state">Nessuna azione in questo set.</div>'}</div>
      <div class="opts" style="margin-top:12px"><button class="full" data-a="close">Chiudi</button></div>`;
  }

  function sheetEditTouch() {
    const X = ui.evEdit, ev = match.events[X.idx], d = X.draft;
    const sb = E.stateBefore(match, X.idx);
    const eff = E.effectiveLineup(match, sb);
    const order = ['P4', 'P3', 'P2', 'P5', 'P6', 'P1'];
    const who = d.team === 'noi'
      ? order.map(p => { const pl = player(eff[p]); return `<button class="${d.pos === p ? 'noi' : ''}" data-a="ev-pos" data-pos="${p}"><b>#${esc(eff[p] || '?')}</b> ${esc(pl ? pl.name : '')}<br><span class="muted">${p}</span></button>`; }).join('')
      : ['P4', 'P3', 'P2', 'P5', 'P6', 'P1'].map(p => `<button class="${d.pos === p ? 'avv' : ''}" data-a="ev-pos" data-pos="${p}"><b>${sb.oppMode === 'avanzata' ? '#' + esc(sb.oppLineup[p]) : 'Zona ' + p}</b>${sb.oppMode === 'avanzata' ? `<br><span class="muted">${p}</span>` : ''}</button>`).join('');
    const funds = E.FUND_ORDER.map(f => `<button class="ftab${d.fund === f ? ' on' : ''}" data-a="ev-fund" data-f="${f}"><i class="fdot f-${f}"></i>${E.FUNDS[f].name}</button>`).join('');
    const grades = E.FUNDS[d.fund].grades.filter(g => !g.hidden || g.g === d.grade).map(g =>
      `<button class="${GRADE_CLASS[g.g]}${d.grade === g.g ? ' on' : ''}" data-a="ev-grade" data-g="${esc(g.g)}">${esc(g.label)}${g.sub ? `<small>${esc(g.sub)}</small>` : ''}</button>`).join('');
    // chi vince il punto con quel tocco (null = il gioco continua)
    const winnerOf = (team, f, g) => { const gi = E.gradeInfo(f, g); return !gi ? null : gi.effect === 'win' ? team : gi.effect === 'lose' ? E.other(team) : null; };
    const warn = winnerOf(ev.team, ev.fund, ev.grade) !== winnerOf(d.team, d.fund, d.grade);
    return `
      <div class="sheet-h"><button class="sheet-x" data-a="ev-back" aria-label="Indietro">${ic('back')}</button><h2>Modifica tocco</h2><button class="sheet-x" data-a="close" aria-label="Chiudi">${ic('x')}</button></div>
      <div class="ev-was">Prima: ${eventText({ ev, oppMode: sb.oppMode })} <span class="muted">· sul ${sb.score.noi}–${sb.score.avv}</span></div>
      ${sb.oppMode !== 'skip' ? `<div class="sec">Squadra</div><div class="seg"><button class="${d.team === 'noi' ? 'on' : ''}" data-a="ev-team" data-team="noi">NOI</button><button class="${d.team === 'avv' ? 'on' : ''}" data-a="ev-team" data-team="avv">Avversari</button></div>` : ''}
      <div class="sec">Chi ha toccato</div>
      <div class="opts three">${who}</div>
      <div class="sec">Fondamentale</div>
      <div class="ftabs">${funds}</div>
      <div class="sec">Esito</div>
      <div class="obtns ev-grades">${grades}</div>
      ${warn ? '<div class="hint" style="margin-top:12px">Attenzione: così cambia chi vince il punto (o se il punto finisce). Punteggio e rotazioni da lì in poi si ricalcolano.</div>' : ''}
      <div class="opts" style="margin-top:14px">
        <button class="noi" data-a="ev-save">${ic('check')}Salva</button>
        <button data-a="ev-back">Annulla</button>
      </div>`;
  }

  // Applica una correzione agli eventi; se rovina un set già chiuso, la annulla.
  function applyEventFix(mutate, okMsg) {
    const backup = JSON.stringify(match.events);
    const before = JSON.stringify(st.setResults);
    const setNumBefore = st.setNum;
    try {
      mutate(match.events);
      recompute();
    } catch (e) {
      match.events = JSON.parse(backup); recompute();
      toast('Correzione non riuscita', true);
      return false;
    }
    if (JSON.stringify(st.setResults) !== before || st.setNum !== setNumBefore) {
      match.events = JSON.parse(backup); recompute();
      toast('Non si può: cambierebbe il risultato di un set già chiuso', true);
      return false;
    }
    saveMatch();
    resetSelection();
    const live = ['serve', 'rally', 'setOver'].includes(st.phase) && (!ui.evEdit || ui.evEdit.set === st.setNum);
    toast(live ? `${okMsg} · ora ${st.score.noi}–${st.score.avv}` : okMsg);
    return true;
  }

  /* ----------------------------- modifica rosa ----------------------------- */
  // Si può correggere la rosa anche a partita iniziata: maglia, nome e ruolo.
  // Se cambia una maglia, tutto ciò che è già registrato passa al nuovo numero.
  // Chi ha già giocato (formazione, tocchi, cambi) non si può togliere.
  function openRosterEdit() {
    ui.rosterEdit = {
      rows: match.roster.slice().sort((a, b) => (+a.number || 0) - (+b.number || 0))
        .map(p => ({ orig: p.number, number: p.number, name: p.name, role: p.role, example: p.example })),
      sync: true,
    };
    openSheet(sheetRoster, true); // niente chiusura toccando fuori: si perderebbero le modifiche
  }

  function sheetRoster() {
    const R = ui.rosterEdit;
    const used = E.usedPlayers(match);
    const chk = rosterCheck(R.rows);
    const row = (r, i) => {
      const locked = r.orig != null && used.has(r.orig);
      const changed = r.orig != null && r.number.trim() !== r.orig;
      return `<div class="re-row ${roleClass(r.role)}">
        <input class="re-num" data-re="${i}.number" value="${esc(r.number)}" inputmode="numeric" placeholder="N°" aria-label="Maglia">
        <input class="re-name" data-re="${i}.name" value="${esc(r.name)}" placeholder="Nome" aria-label="Nome">
        <select class="re-role" data-re="${i}.role" aria-label="Ruolo">${ROLES.map(x => `<option ${x === r.role ? 'selected' : ''}>${x}</option>`).join('')}${ROLES.includes(r.role) ? '' : `<option selected>${esc(r.role)}</option>`}</select>
        ${locked
          ? `<span class="re-lock" title="Ha già giocato in questa partita: non si può togliere">${ic('lock')}</span>`
          : `<button class="re-del" data-a="re-del" data-i="${i}" aria-label="Togli" title="Togli">${ic('trash')}</button>`}
        ${changed ? `<div class="re-note">Maglia ${esc(r.orig)} → ${esc(r.number.trim() || '?')}: i tocchi già registrati passano al nuovo numero</div>` : ''}
      </div>`;
    };
    return `
      <div class="sheet-h"><h2>Rosa della partita</h2><button class="sheet-x" data-a="close" aria-label="Chiudi">${ic('x')}</button></div>
      <div class="muted" style="margin-bottom:10px">Correggi maglia, nome o ruolo, aggiungi chi manca. Il <span class="re-lock inline">${ic('lock')}</span> indica chi ha già giocato: non si può togliere, ma si può correggere.</div>
      ${rosterCheckHtml(chk)}
      <div class="re-head"><span>N°</span><span>Nome</span><span>Ruolo</span><span></span></div>
      <div class="re-list">${R.rows.map(row).join('')}</div>
      <button class="btn block dashed" data-a="re-add">${ic('plus')}Aggiungi giocatore</button>
      <label class="check" style="margin-top:8px"><input type="checkbox" data-re="sync" ${R.sync ? 'checked' : ''}> Applica anche alla squadra salvata (per le prossime partite)</label>
      <div class="opts" style="margin-top:12px">
        <button class="noi" data-a="re-save">${ic('check')}Salva modifiche</button>
        <button data-a="close">Annulla</button>
      </div>`;
  }

  function saveRosterEdit() {
    const R = ui.rosterEdit;
    const rows = R.rows.map(r => Object.assign({}, r, { number: (r.number || '').trim(), name: (r.name || '').trim() }))
      .filter(r => r.orig != null || r.number || r.name); // righe nuove lasciate vuote: ignorate
    if (rows.some(r => !r.number || !r.name)) { toast('Ogni giocatore deve avere maglia e nome', true); return; }
    const dup = rows.map(r => r.number).find((n, i, a) => a.indexOf(n) !== i);
    if (dup) { toast(`La maglia ${dup} è usata due volte`, true); return; }
    const used = E.usedPlayers(match);
    const kept = new Set(rows.filter(r => r.orig != null).map(r => r.orig));
    const removed = match.roster.map(p => p.number).filter(n => !kept.has(n));
    if (removed.some(n => used.has(n))) { toast('Chi ha già giocato non si può togliere', true); return; }

    const map = {};
    rows.forEach(r => { if (r.orig != null && r.orig !== r.number) map[r.orig] = r.number; });
    const mapNum = v => (v && Object.prototype.hasOwnProperty.call(map, v) ? map[v] : v);
    const backup = JSON.stringify(match);
    try {
      E.renumberPlayers(match, map);
      match.roster = rows.map(r => {
        const p = { number: r.number, name: r.name, role: r.role };
        const orig = r.orig != null && match.roster.find(x => x.number === r.orig);
        if (r.example && orig && orig.name === r.name) p.example = true;
        return p;
      });
      recompute();
    } catch (e) {
      match = JSON.parse(backup); recompute();
      toast('Modifica non riuscita: rosa lasciata com\'era', true);
      return;
    }
    // bozza della formazione e ultima formazione usata seguono i nuovi numeri
    const nums = new Set(match.roster.map(p => p.number));
    const fix = v => { const n = mapNum(v); return n && nums.has(n) ? n : ''; };
    if (ui.draft) {
      for (const k in ui.draft.slots) ui.draft.slots[k] = fix(ui.draft.slots[k]);
      ui.draft.liberos = ui.draft.liberos.map(fix);
    }
    const ls = store.get('scout.lastSlots', null);
    if (ls) { for (const k in ls) ls[k] = fix(ls[k]); store.set('scout.lastSlots', ls); }

    if (R.sync) {
      const byOrig = {};
      rows.forEach(r => { if (r.orig != null) byOrig[r.orig] = r; });
      let team = loadRoster().filter(p => !removed.includes(p.number))
        .map(p => (byOrig[p.number] ? { number: byOrig[p.number].number, name: byOrig[p.number].name, role: byOrig[p.number].role } : p));
      const edited = new Set(rows.map(r => r.number));
      // un giocatore della squadra non in partita con lo stesso numero di uno corretto: vince la correzione
      team = team.filter((p, i) => !edited.has(p.number) || team.findIndex(x => x.number === p.number) === i);
      rows.forEach(r => { if (!team.some(p => p.number === r.number)) team.push({ number: r.number, name: r.name, role: r.role }); });
      saveRoster(team);
    }
    saveMatch();
    ui.rosterEdit = null;
    closeSheet();
    resetSelection();
    if (st.phase === 'setOver') openSheet(sheetSetOver, true);
    render();
    toast(R.sync ? 'Rosa aggiornata, anche per le prossime partite' : 'Rosa della partita aggiornata');
  }

  function sheetSub() {
    const s = ui.subStep;
    if (s.team === 'avv') {
      if (!s.pos) {
        return `<h2>Cambio AVV — chi esce?</h2><div class="opts">
          ${E.POS.map(p => `<button data-a="sub-pos" data-pos="${p}">${p}: #${esc(st.oppLineup[p])}</button>`).join('')}
          <button class="full" data-a="close">Annulla</button></div>`;
      }
      return `<h2>Cambio AVV — ${s.pos} (esce #${esc(st.oppLineup[s.pos])})</h2>
        <input id="opp-sub-num" placeholder="Maglia che entra" inputmode="numeric">
        <div class="opts" style="margin-top:10px"><button class="avv" data-a="sub-opp-confirm">Conferma</button><button data-a="close">Annulla</button></div>`;
    }
    if (!s.pos) {
      return `<h2>Cambio NOI — chi esce?</h2>
        <div class="muted" style="margin-bottom:8px">Formazione base (con i centrali, il libero è gestito a parte).</div>
        <div class="opts">
          ${E.POS.map(p => `<button data-a="sub-pos" data-pos="${p}">${p}: ${esc(playerLabel(st.lineup[p]))}</button>`).join('')}
          <button class="full" data-a="close">Annulla</button></div>`;
    }
    const onCourt = new Set(Object.values(st.lineup));
    const bench = match.roster.filter(p => !onCourt.has(p.number) && !st.liberos.includes(p.number));
    const outRole = roleNow(st.lineup[s.pos]);
    return `<h2>Entra al posto di ${esc(playerLabel(st.lineup[s.pos]))}</h2>
      <div class="hint">Può entrare chiunque. Chi entra gioca da <b>${esc(outRole || 'stesso ruolo')}</b> fino a fine set; dal set dopo torna al suo ruolo.</div>
      <div class="opts">
        ${bench.map(p => `<button data-a="sub-in" data-num="${esc(p.number)}">#${esc(p.number)} ${esc(p.name)}<br><span class="muted">${esc(p.role)}${p.role !== outRole && outRole ? ' → ' + esc(outRole) : ''}</span></button>`).join('') || '<div class="muted full">Nessuno in panchina.</div>'}
        <button class="full" data-a="close">Annulla</button></div>`;
  }

  function sheetConfirmDelete(id) {
    const m = listMatches().find(x => x.id === id);
    return () => `<h2>Eliminare la partita?</h2>
      <p>${esc(m ? `${m.opponent} — ${m.date}` : '')}<br><span class="muted">Non si può annullare. Esporta prima un backup se ti serve.</span></p>
      <div class="opts"><button class="danger" data-a="delete-match" data-id="${esc(id)}">Elimina</button><button data-a="close">Annulla</button></div>`;
  }

  /* ------------------------------- eventi ------------------------------- */
  function addRosterPlayer(list, num, name, role) {
    num = (num || '').trim(); name = (name || '').trim();
    if (!num || !name) { toast('Inserisci numero e nome', true); return false; }
    const ex = list.findIndex(p => p.number === num && p.example);
    if (ex >= 0) list.splice(ex, 1); // un giocatore vero prende il posto di quello di esempio
    if (list.some(p => p.number === num)) { toast(`Il numero ${num} esiste già`, true); return false; }
    list.push({ number: num, name, role });
    return true;
  }

  function act(a, el) {
    const d = el.dataset;
    switch (a) {
      // home
      case 'nm-mode': ui.newMatch.oppMode = d.mode; render(); break;
      case 'create-match': createMatch(); break;
      case 'open-match': openMatch(d.id); break;
      case 'ask-delete-match': openSheet(sheetConfirmDelete(d.id)); break;
      case 'delete-match': deleteMatch(d.id); closeSheet(); toast('Partita eliminata'); render(); break;
      case 'roster-add': {
        const sc = d.scope;
        const r = loadRoster();
        if (addRosterPlayer(r, document.getElementById('rp-num-' + sc).value, document.getElementById('rp-name-' + sc).value, document.getElementById('rp-role-' + sc).value)) {
          saveRoster(r); render();
          const chk = rosterCheck(r);
          toast(chk.ok ? 'Ruoli completi: puoi creare la partita' : 'Aggiunto · mancano: ' + chk.missing.join(', '));
          const n = document.getElementById('rp-num-' + sc); if (n) n.focus(); // pronto per il prossimo
        }
        break;
      }
      case 'roster-del': saveRoster(loadRoster().filter(p => p.number !== d.num)); render(); break;
      case 'roster-example': saveRoster(EXAMPLE_ROSTER.map(p => Object.assign({}, p))); toast('Rosa di esempio caricata: sostituiscila con i tuoi giocatori'); render(); break;
      case 'roster-clear-example': saveRoster(loadRoster().filter(p => !p.example)); render(); break;
      case 'home': goHome(); break;

      // setup
      case 'draft-serve': ui.draft.serve = d.team; render(); break;
      case 'draft-setter': ui.draft.setterPos = d.pos; render(); break;
      case 'draft-swap': {
        const sl = ui.draft.slots, a = d.pair + '1', b = d.pair + '2';
        [sl[a], sl[b]] = [sl[b], sl[a]];
        render();
        break;
      }
      case 'start-set': startSet(); break;

      // live
      case 'tile': tapTile(d.team, d.pos); break;
      case 'outcome': chooseOutcome(d.f, d.g); break;
      case 'cancel-sel': ui.sel = null; render(); break;
      case 'fund-tab': ui.fund = d.f; render(); break;
      case 'sub-direct': ui.subStep = { team: 'noi', pos: d.pos }; openSheet(sheetSub); break;
      case 'libero-swap': {
        const other = st.liberos.find(l => l !== st.activeLibero);
        if (other) commit({ type: 'libero', num: other, auto: true });
        break;
      }
      case 'ace-on': {
        const sel = ui.sel;
        closeSheet();
        if (!sel) break;
        const eff = E.effectiveLineup(match, st);
        recordTouch(sel.team, sel.pos, 'B', '#', d.pos ? { receiver: { pos: d.pos, player: eff[d.pos] } } : null);
        break;
      }
      case 'undo': undo(); break;
      case 'point-sheet': openSheet(sheetPoint(d.team)); break;
      case 'point': closeSheet(); commit({ type: 'point', winner: d.team, reason: d.reason }); break;
      case 'menu': openSheet(sheetMenu); break;
      case 'help': openSheet(sheetHelp); break;
      case 'novita': openSheet(sheetNovita(NOVITA, true)); break;
      case 'close':
        closeSheet();
        if (match && st && ui.view === 'match' && st.phase === 'setOver') openSheet(sheetSetOver, true);
        break;
      case 'backdrop': if (el === lastTarget && !ui.sheetLocked) closeSheet(); break;
      case 'set-end': closeSheet(); ui.draft = null; commit({ type: 'setEnd' }); break;
      case 'timeout': {
        if (st.timeouts[d.team] >= st.rules.timeouts) toast(`${teamLabel(d.team)} ha già usato i time-out`, true);
        closeSheet(); commit({ type: 'timeout', team: d.team });
        toast(`Time-out ${teamLabel(d.team)} (${st.timeouts[d.team]}/${st.rules.timeouts})`);
        break;
      }
      case 'sub-start': ui.subStep = { team: d.team, pos: null }; openSheet(sheetSub); break;
      case 'sub-pos': ui.subStep.pos = d.pos; renderSheet(); break;
      case 'sub-in': {
        const s = ui.subStep;
        if (st.subs.noi >= st.rules.subs) toast('Attenzione: cambi esauriti', true);
        closeSheet();
        const outRole = roleNow(st.lineup[s.pos]);
        commit({ type: 'sub', team: 'noi', pos: s.pos, out: st.lineup[s.pos], in: d.num });
        toast(`Entra ${playerLabel(d.num)} · gioca da ${outRole || 'stesso ruolo'} fino a fine set`);
        break;
      }
      case 'sub-opp-confirm': {
        const v = (document.getElementById('opp-sub-num').value || '').trim();
        if (!v) return;
        const s = ui.subStep;
        closeSheet();
        commit({ type: 'sub', team: 'avv', pos: s.pos, out: st.oppLineup[s.pos], in: v });
        break;
      }
      case 'libero': closeSheet(); commit({ type: 'libero', num: d.num || null, auto: !!d.num }); break;
      case 'rotate': closeSheet(); commit({ type: 'rotate', team: d.team, dir: +d.dir }); toast(`Rotazione ${teamLabel(d.team)} corretta`); break;
      case 'serve-fix': closeSheet(); commit({ type: 'serveFix', team: d.team }); break;
      case 'set-mode': closeSheet(); commit({ type: 'oppMode', mode: d.mode }); break;
      case 'roster-edit': openRosterEdit(); break;
      case 'events': openEvents(); break;
      case 'ev-set': ui.evEdit.set = +d.set; ui.evEdit.del = null; renderSheet(); break;
      case 'ev-del-ask': ui.evEdit.del = +d.i; renderSheetKeepScroll(); break;
      case 'ev-del': {
        const i = +d.i;
        ui.evEdit.del = null;
        applyEventFix(evs => evs.splice(i, 1), 'Azione eliminata');
        render(); renderSheetKeepScroll();
        break;
      }
      case 'ev-edit': {
        const ev = match.events[+d.i];
        ui.evEdit.idx = +d.i;
        ui.evEdit.draft = { team: ev.team, pos: ev.pos, fund: ev.fund, grade: ev.grade };
        renderSheet();
        break;
      }
      case 'ev-back': ui.evEdit.idx = null; renderSheet(); break;
      case 'ev-team': {
        const dr = ui.evEdit.draft; dr.team = d.team; renderSheetKeepScroll(); break;
      }
      case 'ev-pos': ui.evEdit.draft.pos = d.pos; renderSheetKeepScroll(); break;
      case 'ev-fund': {
        const dr = ui.evEdit.draft; dr.fund = d.f;
        if (!E.gradeInfo(dr.fund, dr.grade)) dr.grade = E.FUNDS[d.f].grades[0].g;
        renderSheetKeepScroll(); break;
      }
      case 'ev-grade': ui.evEdit.draft.grade = d.g; renderSheetKeepScroll(); break;
      case 'ev-save': {
        const X = ui.evEdit, dr = X.draft, i = X.idx;
        const sb = E.stateBefore(match, i);
        const eff = E.effectiveLineup(match, sb);
        const playerId = dr.team === 'noi' ? eff[dr.pos] : (sb.oppMode === 'avanzata' ? sb.oppLineup[dr.pos] : dr.pos);
        if (!playerId) { toast('In quella posizione non c\'è nessuno', true); break; }
        if (applyEventFix(evs => {
          const ev = evs[i];
          Object.assign(ev, { team: dr.team, pos: dr.pos, player: playerId, fund: dr.fund, grade: dr.grade });
          if (!(ev.fund === 'B' && ev.grade === '#' && ev.team === 'avv')) delete ev.receiver;
        }, 'Tocco corretto')) X.idx = null;
        render(); renderSheet();
        break;
      }
      case 're-add': {
        const R = ui.rosterEdit;
        R.rows.push({ orig: null, number: '', name: '', role: rosterCheck(R.rows).nextRole || 'Libero' });
        renderSheet();
        const ins = $sheet.querySelectorAll('.re-num'); if (ins.length) ins[ins.length - 1].focus();
        break;
      }
      case 're-del': ui.rosterEdit.rows.splice(+d.i, 1); renderSheetKeepScroll(); break;
      case 're-save': saveRosterEdit(); break;

      // stagione
      case 'season': ui.view = 'season'; ui.seasonOff = ui.seasonOff || []; window.scrollTo(0, 0); render(); break;
      case 'season-toggle': {
        const off = new Set(ui.seasonOff || []);
        if (off.has(d.id)) off.delete(d.id); else off.add(d.id);
        ui.seasonOff = [...off]; render(); break;
      }
      case 'season-all': ui.seasonOff = []; render(); break;
      case 'season-none': ui.seasonOff = listMatches().map(m => m.id); render(); break;
      case 'season-xlsx': download(new Blob([buildSeasonWorkbook()], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }), `scout_stagione_${today()}.xlsx`); break;

      // stats / export
      case 'stats': closeSheet(); ui.view = 'stats'; window.scrollTo(0, 0); render(); break;
      case 'back-match': ui.view = 'match'; render(); break;
      case 'stats-set': ui.statsSet = d.set === '' ? null : +d.set; render(); break;
      case 'export-xlsx': download(blobXlsx(), baseFilename() + '.xlsx'); break;
      case 'share-xlsx': share(blobXlsx(), baseFilename() + '.xlsx'); break;
      case 'export-json': download(blobJson(), baseFilename() + '.json'); markBackedUp([match]); render(); break;
      case 'share-json': { const m = match; share(blobJson(), baseFilename() + '.json').then(ok => { if (ok) { markBackedUp([m]); render(); } }); break; }
      case 'backup-all': exportFullBackup(false); break;
      case 'backup-all-share': exportFullBackup(true); break;
    }
  }

  let lastTarget = null;
  document.addEventListener('click', e => {
    lastTarget = e.target;
    const el = e.target.closest('[data-a]');
    if (!el) return;
    act(el.dataset.a, el);
  });

  function onField(e) {
    const el = e.target;
    const re = el.dataset && el.dataset.re;
    if (re && ui.rosterEdit) {
      if (re === 'sync') { ui.rosterEdit.sync = el.checked; return; }
      const [i, f] = re.split('.');
      const r = ui.rosterEdit.rows[+i];
      r[f] = el.value;
      // ruolo cambiato: aggiorna colori e ruoli mancanti (solo per i menu, così non si perde il tocco sulla casella dopo)
      if (f === 'role' && e.type === 'change') renderSheetKeepScroll();
      // maglia cambiata: avviso sotto la riga, senza ridisegnare
      if (f === 'number' && r.orig != null) {
        const rowEl = el.closest('.re-row');
        let note = rowEl.querySelector('.re-note');
        const n = el.value.trim();
        if (n === r.orig) { if (note) note.remove(); }
        else {
          if (!note) { note = document.createElement('div'); note.className = 're-note'; rowEl.appendChild(note); }
          note.textContent = `Maglia ${r.orig} → ${n || '?'}: i tocchi già registrati passano al nuovo numero`;
        }
      }
      return;
    }
    const c = el.dataset && el.dataset.c;
    if (!c) return;
    const v = el.type === 'checkbox' ? el.checked : el.value;
    if (c.startsWith('nm.')) { ui.newMatch[c.slice(3)] = v; return; }
    if (c === 'import') { if (el.files && el.files[0]) importFile(el.files[0]); el.value = ''; return; }
    if (!ui.draft) return;
    const parts = c.split('.');
    if (parts[1] === 'slot') ui.draft.slots[parts[2]] = v;
    else if (parts[1] === 'opp') ui.draft.oppLineup[parts[2]] = v;
    else if (parts[1] === 'lib') ui.draft.liberos[+parts[2]] = v;
    else if (parts[1] === 'liberoAuto') ui.draft.liberoAuto = v;
    if (e.type === 'change' && el.tagName === 'SELECT') render(); // aggiorna eventuali doppioni
  }
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);

  /* ------------------------------- avvio ------------------------------- */
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    // Se arriva una versione nuova mentre l'app è aperta, ricarica una volta per usarla subito
    // (i dati della partita sono già salvati). Al primo avvio in assoluto non serve.
    const hadController = !!navigator.serviceWorker.controller;
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (!hadController || reloading) return;
      reloading = true;
      location.reload();
    });
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline non disponibile */ });
  }

  const cur = store.get('scout.current', null);
  if (cur && loadMatch(cur)) openMatch(cur);
  else render();
  showNovitaIfNew();
})();
