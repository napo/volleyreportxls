// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { bump, checkScore, closeSet, currentSet, playerName, reachableSets, setMatchDetails, setPlayerName, setShirtNumber, undoTouch , bumpShirt, proposedLineup, setLineup, benchNumbers, courtNow, returnsDue, substitute, undoSubstitution, placeNumbers, canEnter, canLeave, substitutionState, serveAfter, setServe, zonesNow, expectedServer} from './live';
import { type MatchRecord, newMatchRecord } from './record';

const firstRow = (record: MatchRecord, set = 1) => record.sets.find((s) => s.number === set)!.rows[0]!;

test('a touch adds one to the cell, a long press takes one away, never below zero', () => {
  const record = newMatchRecord();
  const row = firstRow(record).id;
  const once = bump(record, 1, row, 'A#', 1)!;
  const twice = bump(once.record, 1, row, 'A#', 1)!;
  expect(firstRow(twice.record).counts).toEqual({ 'A#': 2 });
  expect(twice.touch).toEqual({ set: 1, rowId: row, code: 'A#', delta: 1 });

  const removed = bump(twice.record, 1, row, 'A#', -1)!;
  expect(firstRow(removed.record).counts).toEqual({ 'A#': 1 });
  const empty = bump(removed.record, 1, row, 'A#', -1)!;
  expect(firstRow(empty.record).counts).toEqual({});
  expect(bump(empty.record, 1, row, 'A#', -1)).toBeNull();
});

test('undo takes back the last touch, added or removed', () => {
  const record = newMatchRecord();
  const row = firstRow(record).id;
  const added = bump(record, 1, row, 'R+', 1)!;
  expect(firstRow(undoTouch(added.record, added.touch)).counts).toEqual({});
  const removed = bump(added.record, 1, row, 'R+', -1)!;
  expect(firstRow(undoTouch(removed.record, removed.touch)).counts).toEqual({ 'R+': 1 });
});

test('closing a set saves the score and opens the next one with the same shirt numbers', () => {
  let record = newMatchRecord();
  const row = firstRow(record).id;
  record = setShirtNumber(record, 1, row, 7);
  record = bump(record, 1, row, 'B#', 1)!.record;
  const { record: closed, next } = closeSet(record, 1, { team: 25, opponent: 21 });
  expect(closed.sets[0]!.score).toEqual({ team: 25, opponent: 21 });
  expect(next).toBe(2);
  expect(firstRow(closed, 2).playerNumber).toBe(7);
  expect(firstRow(closed, 2).counts).toEqual({});
  expect(currentSet(closed)).toBe(2);
  expect([...reachableSets(closed)].sort()).toEqual([1, 2]);
});

test('no next set once a side has won three sets', () => {
  let record = newMatchRecord();
  let next = null;
  for (const set of [1, 2, 3] as const) ({ record, next } = closeSet(record, set, { team: 25, opponent: 20 }));
  expect(next).toBeNull();
  expect(currentSet(record)).toBe(3);
  expect(reachableSets(record).has(4)).toBe(false);
});

test('scores: missing and tied ones block, unusual ones only warn', () => {
  expect(checkScore(null, 20, 1)).toBe('incomplete');
  expect(checkScore(20, 20, 1)).toBe('tied');
  expect(checkScore(25, 24, 1)).toBe('unusual');
  expect(checkScore(25, 23, 1)).toBe('ok');
  expect(checkScore(15, 13, 5)).toBe('ok');
  expect(checkScore(28, 26, 2)).toBe('ok');
});

test('team names and players names are written on the sheet; names follow the numbers into the next set', () => {
  let record = setMatchDetails(newMatchRecord(), { teamName: 'Volley Trento', opponentName: 'Itas', competition: 'Serie D', date: '2026-10-29' });
  const row = firstRow(record).id;
  // A number already known for the team gets its name (and athlete) at once.
  record = setShirtNumber(record, 1, row, 7, [{ number: 7, name: 'Alice', athleteId: 'ath00001' }]);
  expect(playerName(record, 7)).toBe('Alice');
  record = setPlayerName(record, 7, 'Alice B.');
  expect(record.players).toEqual([{ number: 7, name: 'Alice B.', athleteId: 'ath00001' }]);
  // A name typed in this match is not replaced by the known one.
  const second = record.sets[0]!.rows[1]!.id;
  record = setShirtNumber(record, 1, second, 7, [{ number: 7, name: 'Other' }]);
  expect(playerName(record, 7)).toBe('Alice B.');
  record = bump(record, 1, row, 'B#', 1)!.record;
  const { record: closed, next } = closeSet(record, 1, { team: 25, opponent: 20 });
  const nextRow = closed.sets.find((s) => s.number === next)!.rows[0]!;
  expect(nextRow.playerNumber).toBe(7);
  expect(playerName(closed, nextRow.playerNumber)).toBe('Alice B.');
  expect(closed.teamName).toBe('Volley Trento');
});

describe('keypad: touches by shirt number and lineups', () => {
  it('a touch goes to the row of the number, or to the first empty row of its kind', () => {
    let record = newMatchRecord();
    const first = bumpShirt(record, 1, 7, 'player', 'A#')!;
    record = first.record;
    const set = record.sets[0]!;
    const row = set.rows.find((r) => r.playerNumber === 7)!;
    expect(row.kind).toBe('player');
    expect(row.counts['A#']).toBe(1);
    record = bumpShirt(record, 1, 7, 'player', 'A#')!.record;
    expect(record.sets[0]!.rows.filter((r) => r.playerNumber === 7)).toHaveLength(1);
    expect(record.sets[0]!.rows.find((r) => r.playerNumber === 7)!.counts['A#']).toBe(2);
    record = bumpShirt(record, 1, 1, 'libero', 'R+')!.record;
    expect(record.sets[0]!.rows.find((r) => r.playerNumber === 1)!.kind).toBe('libero');
    // Undo takes the touch back.
    expect(undoTouch(first.record, first.touch).sets[0]!.rows.find((r) => r.playerNumber === 7)!.counts['A#']).toBeUndefined();
  });

  it('a number with no empty row left gets a new one', () => {
    let record = newMatchRecord();
    for (const n of [11, 12, 13]) record = bumpShirt(record, 1, n, 'libero', 'R#')!.record;
    expect(record.sets[0]!.rows.filter((r) => r.kind === 'libero')).toHaveLength(3);
  });

  it('a set proposes its lineup, else the one of an earlier set, else the numbers on its rows', () => {
    let record = newMatchRecord();
    record = bumpShirt(record, 1, 4, 'player', 'B+')!.record;
    record = bumpShirt(record, 1, 9, 'libero', 'R+')!.record;
    expect(proposedLineup(record, 1)).toEqual({ court: [4], liberos: [9] });
    const lineup = { court: [1, 2, 3, 4, 5, 6], liberos: [9] };
    record = setLineup(record, 1, lineup);
    expect(proposedLineup(record, 1)).toEqual(lineup);
    expect(proposedLineup(record, 3)).toEqual(lineup);
  });
});

describe('keypad: substitutions', () => {
  const start = () => setLineup(newMatchRecord(), 1, { court: [1, 2, 3, 4, 5, 6], liberos: [9] });
  const set1 = (r: ReturnType<typeof start>) => r.sets[0]!;

  it('the one coming in takes the place of the one leaving', () => {
    const record = substitute(start(), 1, { out: 4, in: 10 });
    expect(courtNow(set1(record))).toEqual([1, 2, 3, 10, 5, 6]);
    expect(courtNow(set1(undoSubstitution(record, 1)))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(set1(undoSubstitution(record, 1)).subs).toBeUndefined();
  });

  it('proposes the return of the one who left, until the pair has swapped back', () => {
    let record = substitute(start(), 1, { out: 4, in: 10 });
    expect(returnsDue(set1(record))).toEqual([{ out: 10, in: 4 }]);
    record = substitute(record, 1, { out: 10, in: 4 });
    expect(courtNow(set1(record))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(returnsDue(set1(record))).toEqual([]);
  });

  it('the bench is the numbers of the match neither on court nor liberos', () => {
    let record = start();
    record = { ...record, players: [{ number: 10, name: '' }, { number: 1, name: '' }, { number: 9, name: '' }, { number: 14, name: '' }] };
    expect(benchNumbers(record, 1)).toEqual([10, 14]);
    record = substitute(record, 1, { out: 4, in: 10 });
    expect(benchNumbers(record, 1)).toEqual([4, 14]);
  });
});

test('keypad: the numbers of the lineup go on the rows of the sheet, liberos on theirs', () => {
  let record = newMatchRecord();
  record = placeNumbers(record, 1, [1, 3, 5], 'player');
  record = placeNumbers(record, 1, [12], 'libero');
  record = placeNumbers(record, 1, [3], 'player');
  const rows = record.sets[0]!.rows;
  expect(rows.filter((r) => r.kind === 'player' && r.playerNumber !== null).map((r) => r.playerNumber)).toEqual([1, 3, 5]);
  expect(rows.find((r) => r.playerNumber === 12)!.kind).toBe('libero');
});

describe('keypad: substitution rules', () => {
  const start = () => ({
    ...setLineup(newMatchRecord(), 1, { court: [1, 2, 3, 4, 5, 6], liberos: [9] }),
    players: [10, 11, 20].map((number) => ({ number, name: '' })),
  });

  it('whoever came in can leave only for the one they replaced', () => {
    const record = substitute(start(), 1, { out: 5, in: 10 });
    expect(canEnter(record, 1, 10)).toEqual({ locked: true, options: [5] });
    // Another one on court can take only numbers never part of a substitution.
    expect(canEnter(record, 1, 2)).toEqual({ locked: false, options: [11, 20] });
  });

  it('after the return the pair is closed: neither can be substituted again in the set', () => {
    let record = substitute(start(), 1, { out: 5, in: 10 });
    record = substitute(record, 1, { out: 10, in: 5 });
    const set = record.sets[0]!;
    expect([...substitutionState(set).closed].sort()).toEqual([10, 5].sort());
    expect(canLeave(set)).toEqual([1, 2, 3, 4, 6]);
    expect(canEnter(record, 1, 1).options).toEqual([11, 20]);
  });

  it('every set starts afresh', () => {
    let record = substitute(start(), 1, { out: 5, in: 10 });
    record = substitute(record, 1, { out: 10, in: 5 });
    record = setLineup(record, 2, { court: [1, 2, 3, 4, 5, 6], liberos: [9] });
    expect(canLeave(record.sets[1]!)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(canEnter(record, 2, 5).options).toContain(10);
  });
});

describe('rotation followed by the keypad', () => {
  const start = () => setLineup(newMatchRecord(), 1, { court: [1, 2, 3, 4, 5, 6], liberos: [9] });
  const first = (record: MatchRecord) => record.sets.find((s) => s.number === 1)!;
  /** A touch of the keypad with its effect on the rotation, as the live sheet applies it. */
  const play = (record: MatchRecord, number: number, code: 'B+' | 'B#' | 'R+' | 'A#', rotate = true) => {
    const next = serveAfter(first(record), number, 'player', code as never, rotate);
    return next ? setServe(record, 1, next) : record;
  };

  test('zones start as the lineup: zone 1 serves', () => {
    expect(zonesNow(first(start()))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(expectedServer(first(start()))).toBe(1);
  });

  test('serving again after winning the rally (no reception) does not rotate', () => {
    let record = play(start(), 1, 'B+');
    record = play(record, 3, 'A#');
    expect(expectedServer(first(record))).toBe(1);
    record = play(record, 1, 'B+');
    expect(zonesNow(first(record))).toEqual([1, 2, 3, 4, 5, 6]);
  });

  test('a reception since our serve: the next serve rotates, zone 2 goes to zone 1', () => {
    let record = play(start(), 1, 'B+');
    record = play(record, 5, 'R+');
    expect(expectedServer(first(record))).toBe(2);
    record = play(record, 2, 'B+');
    expect(zonesNow(first(record))).toEqual([2, 3, 4, 5, 6, 1]);
    expect(first(record).serve).toEqual({ rotation: 1, received: false });
  });

  test('the opponent serves first: our first serve is from who started in zone 2', () => {
    const record = play(start(), 6, 'R+');
    expect(expectedServer(first(record))).toBe(2);
  });

  test('no reception tells (the opponent missed the serve): the number chosen by hand goes to zone 1', () => {
    let record = play(start(), 1, 'B+');
    record = play(record, 4, 'B+');
    expect(zonesNow(first(record))).toEqual([4, 5, 6, 1, 2, 3]);
  });

  test('a substitution keeps the zone; without the option nothing rotates; a new lineup starts again', () => {
    let record = play(play(start(), 1, 'R+'), 2, 'B+');
    record = substitute(record, 1, { out: 2, in: 12 });
    expect(zonesNow(first(record))).toEqual([12, 3, 4, 5, 6, 1]);
    const still = play(play(start(), 1, 'R+', false), 2, 'B+', false);
    expect(zonesNow(first(still))).toEqual([1, 2, 3, 4, 5, 6]);
    expect(first(setLineup(record, 1, { court: [6, 5, 4, 3, 2, 1], liberos: [] })).serve).toBeUndefined();
  });
});
