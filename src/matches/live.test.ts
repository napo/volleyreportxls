// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { bump, checkScore, closeSet, currentSet, reachableSets, setShirtNumber, undoTouch } from './live';
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
