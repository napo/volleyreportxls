// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { newMatchRecord, setIsPlayed } from './record';
import { correctionKey, ignoredTouches, numbersNotInAll, setFromSheet, sumSets, withSets } from './from-sheets';

const rows = [
  { kind: 'player' as const, numberWritten: true, cells: [{ code: 'A#' as const, count: 3 }, { code: 'B=' as const, count: 0 }] },
  { kind: 'player' as const, numberWritten: false, cells: [{ code: 'A#' as const, count: 0 }] },
  { kind: 'player' as const, numberWritten: false, cells: [{ code: 'R+' as const, count: 2 }] },
  { kind: 'libero' as const, numberWritten: true, cells: [{ code: 'R#' as const, count: 4 }, { code: null, count: 2 }] },
];

test('one row per line used, numbers and corrections applied, padded like the paper form', () => {
  const set = setFromSheet({
    setNumber: 2,
    rows,
    numbers: { 0: 7, 3: 9 },
    corrections: { [correctionKey(0, 'A#')]: 4, [correctionKey(0, 'B=')]: 1 },
    score: { team: 25, opponent: 20 },
  });
  expect(set.number).toBe(2);
  expect(set.score).toEqual({ team: 25, opponent: 20 });
  const used = set.rows.filter((r) => r.playerNumber !== null || Object.keys(r.counts).length);
  expect(used.map((r) => [r.kind, r.playerNumber, r.counts])).toEqual([
    ['player', 7, { 'A#': 4, 'B=': 1 }],
    ['player', null, { 'R+': 2 }],
    ['libero', 9, { 'R#': 4 }],
  ]);
  expect(set.rows.filter((r) => r.kind === 'player')).toHaveLength(12);
  expect(set.rows.filter((r) => r.kind === 'libero')).toHaveLength(2);
  expect(ignoredTouches(rows)).toBe(2);
});

test('the sets read replace those with the same number', () => {
  const record = newMatchRecord();
  const set = setFromSheet({ setNumber: 3, rows, numbers: {}, corrections: {}, score: null });
  const updated = withSets(record, [set]);
  expect(updated.sets.map(setIsPlayed)).toEqual([false, false, true, false, false]);
});

const sheet = (numbers: Record<number, number>, score: { team: number; opponent: number } | null) =>
  setFromSheet({ setNumber: 3, rows, numbers, corrections: {}, score });

const used = (set: ReturnType<typeof sheet>) =>
  set.rows.filter((r) => r.playerNumber !== null || Object.keys(r.counts).length).map((r) => [r.kind, r.playerNumber, r.counts]);

test('two sheets of a set add up the rows with the same kind and shirt number', () => {
  const first = sheet({ 0: 7, 3: 9 }, { team: 12, opponent: 10 });
  const second = sheet({ 0: 7, 3: 5 }, { team: 25, opponent: 21 });
  const sum = sumSets(first, second);
  expect(used(sum)).toEqual([
    ['player', 7, { 'A#': 6 }],
    ['player', null, { 'R+': 2 }],
    ['player', null, { 'R+': 2 }],
    ['libero', 9, { 'R#': 4 }],
    ['libero', 5, { 'R#': 4 }],
  ]);
  expect(sum.score).toEqual({ team: 25, opponent: 21 });
  expect(sumSets(second, first).score).toEqual({ team: 25, opponent: 21 });
  expect(sumSets(second, sheet({}, null)).score).toEqual({ team: 25, opponent: 21 });
  expect(numbersNotInAll([first, second])).toEqual([5, 9]);
});

test('sheets of the same set are summed, and added to the saved set only when asked', () => {
  const saved = withSets(newMatchRecord(), [sheet({ 0: 7 }, null)]);
  const replaced = withSets(saved, [sheet({ 0: 7 }, null)]);
  expect(used(replaced.sets[2]!)[0]).toEqual(['player', 7, { 'A#': 3 }]);
  const added = withSets(saved, [sheet({ 0: 7 }, null)], new Set([3 as const]));
  expect(used(added.sets[2]!)[0]).toEqual(['player', 7, { 'A#': 6 }]);
  const twoSheets = withSets(newMatchRecord(), [sheet({ 0: 7 }, null), sheet({ 0: 7 }, null)]);
  expect(used(twoSheets.sets[2]!)[0]).toEqual(['player', 7, { 'A#': 6 }]);
});
