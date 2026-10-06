import { matchFromWorkbook } from '../oracle/workbook';
import { calculateMatchStats } from './stats/aggregate';
import { tallyCounts, tallyLine } from './tally';

test('a tally row becomes a line repeating each code as many times as counted', () => {
  expect(tallyLine({ id: 'r1', playerNumber: 7, counts: { 'A#': 2, 'B=': 1, 'R+': 0 } }).cells).toEqual(['B=', 'A#', 'A#']);
  expect(() => tallyLine({ id: 'r1', playerNumber: 7, counts: { 'A#': -1 } })).toThrow();
});

test('the reference match entered as counts gives exactly the same statistics', () => {
  const match = matchFromWorkbook();
  const asTally = {
    ...match,
    sets: match.sets.map((set) => ({
      ...set,
      lines: set.lines.map((line) => tallyLine({ id: line.id, playerNumber: line.playerNumber, counts: tallyCounts(line) })),
    })),
  };
  const original = calculateMatchStats(match);
  const fromTally = calculateMatchStats(asTally);
  expect(fromTally.team).toEqual(original.team);
  expect(fromTally.players).toEqual(original.players);
  expect(fromTally.sets).toEqual(original.sets);
});
