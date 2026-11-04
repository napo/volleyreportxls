// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { bump, checkScore, closeSet, currentSet, playerName, reachableSets, setMatchDetails, setPlayerName, setShirtNumber, undoTouch , bumpShirt, proposedLineup, setLineup} from './live';
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
