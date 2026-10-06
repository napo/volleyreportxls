import { extractEvents } from '../events';
import { DATAVOLLEY_TABLES, type EvaluationTables } from '../tables';
import { line, match, set, team } from '../testing';
import {
  calculateAttackStats,
  calculateBlockStats,
  calculateFreeBallStats,
  calculateReceptionStats,
  calculateServeStats,
  calculateSettingStats,
} from './skills';

const events = (codes: string) => extractEvents(match(team([[1, 'A']]), [set(1, null, [line(1, codes)])])).events;

describe('serve (DataVolley defaults)', () => {
  const stats = calculateServeStats(events('B# B+ B+ B! B- B/ B= B='));

  test('efficiency is the positivity (# + + + ! + /) / total', () => expect(stats.efficiency).toBe(5 / 8));
  test('index weights = 0, / 8, - 4, ! 0, + 7, # 10', () => expect(stats.index).toBe((10 + 14 + 0 + 4 + 8) / 8));
  test('B# wins and B= loses the rally', () => expect([stats.won, stats.lost]).toEqual([1, 2]));
  test('points and errors', () => expect([stats.points, stats.errors]).toEqual([1, 2]));
});

describe('reception', () => {
  const stats = calculateReceptionStats(events('R# R# R+ R! R- R/ R= R= A#'));

  test('counts only receptions', () => {
    expect(stats.total).toBe(8);
    expect(stats.counts).toEqual({ '#': 2, '+': 1, '!': 1, '-': 1, '/': 1, '=': 2 });
    expect(stats.distribution['#']).toBe(2 / 8);
  });
  test('Pos% is (# + +) / total', () => expect(stats.positivity).toBe(3 / 8));
  test('Prf% is # / total', () => expect(stats.perfectRate).toBe(2 / 8));
  test('efficiency is (# + +) / total', () => expect(stats.efficiency).toBe(3 / 8));
  test('index weights = −3, / −3, - −1, ! 0, + 7, # 10', () => expect(stats.index).toBe((20 + 7 - 1 - 3 - 6) / 8));
  test('R= and R/ lose the rally', () => expect([stats.won, stats.lost, stats.errors]).toEqual([0, 3, 2]));
});

describe('attack', () => {
  const stats = calculateAttackStats(events('A# A# A# A+ A! A- A/ A='));

  test('efficiency is (# − / − =) / total', () => expect(stats.efficiency).toBe(1 / 8));
  test('Pt% is # / total', () => expect(stats.pointRate).toBe(3 / 8));
  test('points, errors and blocked attacks', () => expect([stats.points, stats.errors, stats.blocked]).toEqual([3, 1, 1]));
  test('A# wins, A= and A/ lose', () => expect([stats.won, stats.lost]).toEqual([3, 2]));
});

test('block: efficiency (# + + − / − =) / total; M= and M/ lose the point', () => {
  const stats = calculateBlockStats(events('M# M# M+ M! M- M/ M='));
  expect(stats.efficiency).toBe(1 / 7);
  expect([stats.points, stats.errors, stats.invasions, stats.won, stats.lost]).toEqual([2, 1, 1, 2, 2]);
});

test('free ball: efficiency (# + + − / − =) / total, F= loses the rally', () => {
  const stats = calculateFreeBallStats(events('F# F+ F- F/ F='));
  expect([stats.total, stats.efficiency, stats.lost]).toEqual([5, 0, 1]);
});

test('set faults: only P=, each loses the rally', () => {
  const stats = calculateSettingStats(events('P= P= A#'));
  expect([stats.total, stats.errors, stats.lost]).toEqual([2, 2, 2]);
});

test('every rate is 0 when the skill was never performed', () => {
  const none = events('M#');
  expect(calculateReceptionStats(none)).toMatchObject({ total: 0, efficiency: 0, index: 0, positivity: 0, perfectRate: 0 });
  expect(calculateAttackStats(none)).toMatchObject({ total: 0, efficiency: 0, pointRate: 0 });
  expect(Object.values(calculateAttackStats(none).distribution)).toEqual([0, 0, 0, 0, 0, 0]);
});

test('tables can be customised, as in DataVolley', () => {
  const tables: EvaluationTables = {
    ...DATAVOLLEY_TABLES,
    efficiency: { ...DATAVOLLEY_TABLES.efficiency, R: { positive: ['#'], negative: ['='] } },
  };
  expect(calculateReceptionStats(events('R# R# R= R+'), tables).efficiency).toBe(1 / 4);
});
