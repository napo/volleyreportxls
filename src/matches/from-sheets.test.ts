import { newMatchRecord, setIsPlayed } from './record';
import { correctionKey, ignoredTouches, setFromSheet, withSets } from './from-sheets';

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
