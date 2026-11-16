// Test del motore: node tests/engine.test.js
const assert = require('assert');
const path = require('path');
const E = require(path.join(__dirname, '../app/engine.js'));
const X = require(path.join(__dirname, '../app/xlsx.js'));

const roster = [
  { number: '12', name: 'Rossi', role: 'Prima banda' },
  { number: '40', name: 'Bianchi', role: 'Primo centro' },
  { number: '16', name: 'Verdi', role: 'Alzatore' },
  { number: '33', name: 'Neri', role: 'Opposto' },
  { number: '35', name: 'Russo', role: 'Seconda banda' },
  { number: '87', name: 'Gallo', role: 'Libero' },
  { number: '43', name: 'Costa', role: 'Libero' },
  { number: '39', name: 'Greco', role: 'Secondo centro' },
];
// 5-1 classico: palleggiatore P1, schiacciatore P2, centrale P3, opposto P4, schiacciatore P5, centrale P6
const lineup = { P1: '16', P2: '12', P3: '40', P4: '33', P5: '35', P6: '39' };
const opp = { P1: '1', P2: '2', P3: '3', P4: '4', P5: '5', P6: '6' };

function newMatch(extra) {
  return Object.assign({ roster, events: [], oppMode: 'semplificata', rules: E.defaultRules() }, extra);
}
let m, st;
const push = ev => { m.events.push(ev); st = E.computeState(m); };
const touch = (team, pos, fund, grade) => {
  const eff = E.effectiveLineup(m, st);
  push({ type: 'touch', team, pos, player: team === 'noi' ? eff[pos] : pos, fund, grade });
};

let passed = 0;
function test(name, fn) { fn(); passed++; console.log('ok -', name); }

test('inizio set e libero automatico', () => {
  m = newMatch();
  push({ type: 'setStart', lineup, oppLineup: opp, liberos: ['87', '43'], liberoAuto: true, serve: 'noi' });
  assert.strictEqual(st.phase, 'serve');
  assert.strictEqual(st.turn, 'noi');
  const eff = E.effectiveLineup(m, st);
  assert.strictEqual(eff.P6, '87', 'libero al posto del centrale in P6');
  assert.strictEqual(eff.P3, '40', 'centrale in prima linea resta');
  assert.strictEqual(E.rotationName(m, st), 'P1');
});

test('battuta ace: punto, nessuna rotazione (battevamo noi)', () => {
  touch('noi', 'P1', 'B', '#');
  assert.deepStrictEqual(st.score, { noi: 1, avv: 0 });
  assert.strictEqual(st.serving, 'noi');
  assert.strictEqual(st.lineup.P1, '16');
  assert.strictEqual(st.phase, 'serve');
});

test('break perso: gli avversari ruotano e battono', () => {
  touch('noi', 'P1', 'B', '+');
  assert.strictEqual(st.turn, 'avv');
  touch('avv', 'P6', 'R', '#');
  touch('avv', 'P3', 'E', '#');
  touch('avv', 'P4', 'A', '#');
  assert.deepStrictEqual(st.score, { noi: 1, avv: 1 });
  assert.strictEqual(st.serving, 'avv');
  assert.strictEqual(st.oppLineup.P1, '2', 'avversari ruotati');
  assert.strictEqual(st.lineup.P1, '16', 'noi non ruotiamo');
});

test('cambio palla nostro: ruotiamo, libero segue i centrali', () => {
  touch('avv', 'P1', 'B', '+');
  touch('noi', 'P5', 'R', '+');
  assert.strictEqual(st.touches, 1);
  touch('noi', 'P1', 'E', '#');
  touch('noi', 'P4', 'A', '#');
  assert.deepStrictEqual(st.score, { noi: 2, avv: 1 });
  assert.strictEqual(st.serving, 'noi');
  // dopo la rotazione: P1=12, P6=16, P5=39 (centrale), P4=35, P3=33, P2=40
  assert.deepStrictEqual(st.lineup, { P1: '12', P6: '16', P5: '39', P4: '35', P3: '33', P2: '40' });
  const eff = E.effectiveLineup(m, st);
  assert.strictEqual(eff.P5, '87', 'libero in P5 al posto del 39');
  assert.strictEqual(Object.values(eff).filter(x => x === '87').length, 1);
  assert.strictEqual(E.rotationName(m, st), 'P6');
});

test('il centrale in P1 batte (niente libero quando battiamo noi)', () => {
  // ruoto manualmente finché il 40 arriva in P1
  for (let i = 0; i < 1; i++) push({ type: 'rotate', team: 'noi', dir: 1 });
  assert.strictEqual(st.lineup.P1, '40');
  let eff = E.effectiveLineup(m, st);
  assert.strictEqual(eff.P1, '40', 'batte il centrale');
  // perdiamo il punto: ora battono loro, il libero entra in P1
  push({ type: 'point', winner: 'avv', reason: 'avv' });
  eff = E.effectiveLineup(m, st);
  assert.strictEqual(eff.P1, '87');
  m.events.pop(); m.events.pop(); st = E.computeState(m); // annulla punto e rotazione
  assert.strictEqual(st.lineup.P1, '12');
});

test('muro: non conta come tocco, chi mura può ritoccare', () => {
  touch('noi', 'P1', 'B', '-');
  touch('avv', 'P5', 'R', '+');
  touch('avv', 'P2', 'E', '+');
  touch('avv', 'P4', 'A', '-');
  touch('noi', 'P2', 'M', '+');
  assert.strictEqual(st.turn, 'noi');
  assert.strictEqual(st.touches, 0);
  assert.strictEqual(st.lastKey, null);
  touch('noi', 'P2', 'D', '+'); // stesso giocatore: ammesso
  assert.strictEqual(st.touches, 1);
  assert.strictEqual(E.suggestFund(st, 'noi'), 'E');
  touch('noi', 'P6', 'E', '+');
  assert.strictEqual(E.suggestFund(st, 'noi'), 'A');
  touch('noi', 'P4', 'A', '/'); // murato: punto loro
  assert.deepStrictEqual(st.score, { noi: 2, avv: 2 });
  assert.strictEqual(st.serving, 'avv');
});

test('attacco coperto: stessa squadra, 3 nuovi tocchi', () => {
  touch('avv', 'P1', 'B', '!');
  touch('noi', 'P6', 'R', '-');
  touch('noi', 'P1', 'E', '-');
  touch('noi', 'P3', 'A', '!');
  assert.strictEqual(st.turn, 'noi');
  assert.strictEqual(st.touches, 0);
  touch('noi', 'P5', 'D', '+');
  touch('noi', 'P1', 'E', '+');
  touch('noi', 'P2', 'A', '=');
  assert.deepStrictEqual(st.score, { noi: 2, avv: 3 });
});

test('modalità rapida: battuta avversaria implicita, si riceve direttamente', () => {
  push({ type: 'oppMode', mode: 'skip' });
  assert.strictEqual(st.phase, 'serve');
  assert.strictEqual(st.serving, 'avv');
  assert.strictEqual(E.suggestFund(st, 'noi'), 'R');
  touch('noi', 'P5', 'R', '#'); // senza registrare la battuta avversaria
  assert.strictEqual(st.phase, 'rally');
  assert.strictEqual(st.turn, 'noi');
  touch('noi', 'P1', 'E', '#');
  touch('noi', 'P4', 'A', '-');
  assert.strictEqual(st.turn, 'avv');
  touch('noi', 'P6', 'D', '+'); // la palla torna: nuovi 3 tocchi
  assert.strictEqual(st.turn, 'noi');
  assert.strictEqual(st.touches, 1);
  push({ type: 'point', winner: 'noi', reason: 'errAvv' });
  assert.deepStrictEqual(st.score, { noi: 3, avv: 3 });
  assert.strictEqual(st.serving, 'noi');
});

test('fine set a 25 con 2 punti di scarto, poi conferma', () => {
  while (st.score.noi < 24) push({ type: 'point', winner: 'noi', reason: 'noi' });
  while (st.score.avv < 24) push({ type: 'point', winner: 'avv', reason: 'avv' });
  push({ type: 'point', winner: 'noi', reason: 'noi' });
  assert.strictEqual(st.phase, 'serve', '25-24 non chiude');
  push({ type: 'point', winner: 'noi', reason: 'noi' });
  assert.strictEqual(st.phase, 'setOver');
  push({ type: 'point', winner: 'noi' }); // ignorato a set chiuso
  assert.deepStrictEqual(st.score, { noi: 26, avv: 24 });
  push({ type: 'setEnd' });
  assert.strictEqual(st.phase, 'between');
  assert.deepStrictEqual(st.setsWon, { noi: 1, avv: 0 });
});

test('annulla fine set e ultimo punto', () => {
  const n = m.events.length;
  m.events.splice(n - 3); // setEnd, punto ignorato, ultimo punto
  st = E.computeState(m);
  assert.strictEqual(st.phase, 'serve');
  assert.deepStrictEqual(st.score, { noi: 25, avv: 24 });
});

test('tie-break a 15 e partita finita 3-0', () => {
  push({ type: 'point', winner: 'noi' });
  push({ type: 'setEnd' });
  for (let s = 2; s <= 3; s++) {
    push({ type: 'setStart', lineup, oppLineup: opp, liberos: ['87'], serve: s % 2 ? 'noi' : 'avv' });
    while (st.phase !== 'setOver') push({ type: 'point', winner: 'noi' });
    assert.strictEqual(st.score.noi, 25);
    push({ type: 'setEnd' });
  }
  assert.strictEqual(st.phase, 'matchOver');
  const m2 = newMatch();
  m2.events.push({ type: 'setStart', lineup, oppLineup: opp, liberos: [], serve: 'noi' });
  const s2 = E.computeState(m2);
  s2.setNum = 5;
  s2.score = { noi: 15, avv: 13 };
  assert.ok(E.isSetOver(s2), '15-13 al quinto chiude');
});

test('cambio giocatore', () => {
  m = newMatch();
  push({ type: 'setStart', lineup, oppLineup: opp, liberos: ['87'], serve: 'noi' });
  push({ type: 'sub', team: 'noi', pos: 'P2', out: '12', in: '35x' });
  assert.strictEqual(st.lineup.P2, '35x');
  assert.strictEqual(st.subs.noi, 1);
});

test('statistiche', () => {
  m = newMatch();
  push({ type: 'setStart', lineup, oppLineup: opp, liberos: ['87'], serve: 'avv' });
  // 4 ricezioni: #, +, -, = ; 3 attacchi: #, =, /
  touch('noi', 'P5', 'R', '#'); touch('noi', 'P1', 'E', '+'); touch('noi', 'P4', 'A', '#');
  touch('noi', 'P1', 'B', '='); // errore battuta
  touch('noi', 'P5', 'R', '+'); touch('noi', 'P1', 'E', '+'); touch('noi', 'P4', 'A', '=');
  touch('noi', 'P5', 'R', '-'); touch('noi', 'P1', 'E', '+'); touch('noi', 'P4', 'A', '/');
  touch('noi', 'P5', 'R', '=');
  const S = E.computeStats(m, st, null);
  const T = S.noiTeam;
  assert.strictEqual(T.recTot, 4);
  assert.strictEqual(T.recPos, 50);
  assert.strictEqual(T.recPrf, 25);
  assert.strictEqual(T.attTot, 3);
  assert.strictEqual(T.attEff, Math.round((1 - 1 - 1) / 3 * 1000) / 10);
  assert.strictEqual(T.points, 1);
  assert.strictEqual(T.errors, 4); // B=, A=, A/, R=
  const tot = S.rotations.find(r => r.rot === 'Totale');
  assert.strictEqual(tot.soTot + tot.bpTot, st.rallies.length);
  assert.strictEqual(tot.soWon, 1);
  const gv = label => S.general.flatMap(g => g.items).find(i => i.label === label).value;
  assert.strictEqual(gv('Punti in attacco'), 1);
  assert.strictEqual(gv('Palle attaccate'), 3);
  assert.strictEqual(gv('Ace subiti'), 1); // ricezione sbagliata = ace subito
  assert.strictEqual(gv('Errori in battuta'), 1);
});

test('ace avversario su un nostro ricevitore: un solo punto, errore di ricezione al ricevitore', () => {
  m = newMatch();
  push({ type: 'setStart', lineup, oppLineup: opp, liberos: ['87'], serve: 'avv' });
  push({ type: 'touch', team: 'avv', pos: 'P1', player: 'P1', fund: 'B', grade: '#', receiver: { pos: 'P6', player: '87' } });
  assert.deepStrictEqual(st.score, { noi: 0, avv: 1 });
  const S = E.computeStats(m, st, null);
  const lib = S.players.find(p => p.number === '87');
  assert.strictEqual(lib.recTot, 1);
  assert.strictEqual(lib.recErr, 1);
  assert.strictEqual(S.avvTeam.ace, 1);
  assert.strictEqual(S.noiTeam.errors, 1);
  const gv = label => S.general.flatMap(g => g.items).find(i => i.label === label).value;
  assert.strictEqual(gv('Ace subiti'), 1, 'un solo ace subito anche se registrato su battuta e ricezione');
});

test('formazione automatica dalla posizione dell\'alzatore', () => {
  const slots = { AL: '16', B1: '12', C1: '40', OP: '33', B2: '35', C2: '39' };
  assert.deepStrictEqual(E.buildLineup(slots, 'P1'), lineup, 'alzatore in P1 = formazione classica');
  const l4 = E.buildLineup(slots, 'P4');
  assert.strictEqual(l4.P4, '16'); assert.strictEqual(l4.P1, '33', 'opposto in diagonale');
  assert.strictEqual(l4.P5, '12'); assert.strictEqual(l4.P2, '35', 'bande in diagonale');
  assert.strictEqual(l4.P6, '40'); assert.strictEqual(l4.P3, '39', 'centri in diagonale');
  // ogni rotazione successiva = formazione precedente ruotata
  for (const [a, b] of [['P1', 'P6'], ['P6', 'P5'], ['P5', 'P4'], ['P4', 'P3'], ['P3', 'P2'], ['P2', 'P1']]) {
    assert.deepStrictEqual(E.rotateLineup(E.buildLineup(slots, a)), E.buildLineup(slots, b));
  }
});

test('tipi di muro: secco, normale, palla rigiocata, interdizione', () => {
  const mm = newMatch();
  const save = [m, st];
  m = mm; st = E.computeState(m);
  push({ type: 'setStart', lineup, oppLineup: opp, liberos: ['87'], liberoAuto: true, serve: 'avv' });
  touch('avv', 'P1', 'B', '+');
  touch('noi', 'P5', 'R', '+'); touch('noi', 'P1', 'E', '+'); touch('noi', 'P4', 'A', '-');
  touch('avv', 'P4', 'A', '-');
  touch('noi', 'P3', 'M', '!'); // interdizione: nessun tocco, 3 tocchi a noi
  assert.strictEqual(st.turn, 'noi'); assert.strictEqual(st.touches, 0);
  touch('noi', 'P6', 'D', '+'); touch('noi', 'P1', 'E', '+'); touch('noi', 'P2', 'A', '-');
  touch('avv', 'P2', 'A', '-');
  touch('noi', 'P3', 'M', '+'); // palla rigiocata: resta a noi
  assert.strictEqual(st.turn, 'noi'); assert.strictEqual(st.touches, 0);
  touch('noi', 'P6', 'D', '+'); touch('noi', 'P1', 'E', '+'); touch('noi', 'P2', 'A', '-');
  touch('avv', 'P3', 'A', '-');
  touch('noi', 'P4', 'M', '-'); // muro normale: torna di là
  assert.strictEqual(st.turn, 'avv'); assert.strictEqual(st.touches, 0);
  touch('noi', 'P3', 'M', '#'); // muro secco: punto
  assert.deepStrictEqual(st.score, { noi: 1, avv: 0 });
  const T = E.computeStats(m, st, null).noiTeam;
  assert.deepStrictEqual([T.blkPts, T.blkNorm, T.blkReplay, T.blkInt, T.blkErr, T.blkTot], [1, 1, 1, 1, 0, 4]);
  assert.strictEqual(E.gradeInfo('M', '!').label, 'Interdizione');
  assert.strictEqual(E.gradeInfo('R', '#').label, '++');
  [m, st] = save;
});

test('cambio: chi entra prende il ruolo di chi esce fino a fine set', () => {
  const save = [m, st];
  const r2 = roster.concat([{ number: '20', name: 'Riserva', role: 'Opposto' }]);
  m = newMatch({ roster: r2 }); st = E.computeState(m);
  push({ type: 'setStart', lineup, oppLineup: opp, liberos: ['87'], liberoAuto: true, serve: 'avv' });
  // l'opposto di riserva entra al posto del centrale in P6 (seconda linea)
  push({ type: 'sub', team: 'noi', pos: 'P6', out: '39', in: '20' });
  assert.strictEqual(E.roleOf(m, '20', st), 'Secondo centro');
  assert.strictEqual(E.effectiveLineup(m, st).P6, '87', 'il libero entra al posto del nuovo "centro"');
  // entra al posto dell'alzatore: la rotazione segue lui
  push({ type: 'sub', team: 'noi', pos: 'P1', out: '16', in: '39' });
  assert.strictEqual(E.roleOf(m, '39', st), 'Alzatore');
  assert.strictEqual(E.rotationName(m, st), 'P1');
  // fine set: al set dopo tornano i ruoli della rosa
  for (let i = 0; i < 25; i++) push({ type: 'point', winner: 'noi' });
  push({ type: 'setEnd' });
  push({ type: 'setStart', lineup, oppLineup: opp, liberos: ['87'], liberoAuto: true, serve: 'noi' });
  assert.strictEqual(E.roleOf(m, '20', st), 'Opposto');
  assert.strictEqual(E.roleOf(m, '39', st), 'Secondo centro');
  [m, st] = save;
});

test('modifica rosa a partita iniziata: cambio numeri e giocatori usati', () => {
  const r = roster.map(p => Object.assign({}, p)).concat([{ number: '20', name: 'Riserva', role: 'Opposto' }, { number: '21', name: 'Mai usato', role: 'Opposto' }]);
  m = newMatch({ roster: r }); st = E.computeState(m);
  push({ type: 'setStart', lineup, slots: { AL: '16', OP: '33' }, oppLineup: opp, liberos: ['87', '43'], liberoAuto: true, serve: 'avv' });
  push({ type: 'touch', team: 'avv', pos: 'P1', player: 'P1', fund: 'B', grade: '#', receiver: { pos: 'P5', player: '35' } });
  touch('noi', 'P1', 'R', '+');
  push({ type: 'sub', team: 'noi', pos: 'P4', out: '33', in: '20' });
  push({ type: 'libero', num: '43', auto: true });
  const used = E.usedPlayers(m);
  ['16', '33', '20', '35', '87', '43'].forEach(n => assert.ok(used.has(n), 'usato ' + n));
  assert.ok(!used.has('21'), 'il 21 non ha mai giocato');
  // scambio di maglia tra 16 e 33, e il 20 diventa 2
  const before = E.computeStats(m, st, null).players.find(p => p.number === '16').recTot;
  E.renumberPlayers(m, { 16: '33', 33: '16', 20: '2' });
  m.roster.forEach(p => { p.number = { 16: '33', 33: '16', 20: '2' }[p.number] || p.number; });
  st = E.computeState(m);
  assert.strictEqual(m.events[0].lineup.P1, '33');
  assert.strictEqual(m.events[0].lineup.P4, '16');
  assert.strictEqual(m.events[0].slots.AL, '33');
  assert.strictEqual(m.events[3].in, '2');
  assert.strictEqual(m.events[3].out, '16');
  assert.strictEqual(m.events[1].receiver.player, '35');
  assert.strictEqual(E.computeStats(m, st, null).players.find(p => p.number === '33').recTot, before, 'le statistiche seguono il giocatore');
  assert.strictEqual(before, 1);
  assert.strictEqual(E.roleOf(m, '2', st), 'Opposto', 'chi entra prende il ruolo di chi esce');
});

test('xlsx valido', () => {
  const bytes = X.makeXlsx([
    { name: 'Prova', rows: [['A', 'B'], ['àèì <&>', 3.5], [null, -2]] },
    { name: 'Nome/troppo:lungo[per]un foglio excel davvero', rows: [['x']] },
  ]);
  require('fs').writeFileSync(path.join(require('os').tmpdir(), 'scout_test.xlsx'), bytes);
  assert.strictEqual(bytes[0], 0x50);
});

console.log(`\n${passed} test passati`);
