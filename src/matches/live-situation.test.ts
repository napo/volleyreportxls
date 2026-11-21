// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SetRecord } from './record';
import { levelOf, setFacts, setForm, setTally, teamIndicators, teamShares } from './live-situation';

const set = (rows: [number | null, Record<string, number>][]): SetRecord =>
  ({ number: 1, score: null, rows: rows.map(([playerNumber, counts], i) => ({ id: `r${i}`, kind: 'player', playerNumber, counts })) }) as unknown as SetRecord;

test('team indicators: serve and attack efficiency, reception positivity, with the balls played', () => {
  const s = set([
    [7, { 'R#': 1, 'R+': 1, 'R-': 1, 'R=': 1, 'A#': 3, 'A=': 1, 'A-': 1, 'B=': 1, 'B+': 3 }],
    [9, { 'A/': 1 }],
  ]);
  const [serve, reception, attack] = teamIndicators([s]);
  expect(reception).toEqual({ skill: 'R', kind: 'positivity', value: 0.5, total: 4 });
  expect(attack).toEqual({ skill: 'A', kind: 'efficiency', value: (3 - 2) / 6, total: 6 });
  expect(serve!.total).toBe(4);
  expect(teamIndicators([set([])])[0]!.value).toBeNull();
});

test('levels: green, orange, red by skill; grey with fewer than three balls', () => {
  expect(levelOf({ skill: 'R', kind: 'positivity', value: 0.6, total: 10 })).toBe('good');
  expect(levelOf({ skill: 'R', kind: 'positivity', value: 0.4, total: 10 })).toBe('fair');
  expect(levelOf({ skill: 'A', kind: 'efficiency', value: -0.1, total: 10 })).toBe('poor');
  expect(levelOf({ skill: 'A', kind: 'efficiency', value: 0.5, total: 2 })).toBe('unknown');
});

test('facts: from two times on, bad news first, then the most frequent, at most four', () => {
  const s = set([
    [15, { 'R=': 3, 'A#': 5 }],
    [12, { 'A=': 3 }],
    [1, { 'B=': 3, 'B#': 1 }],
    [4, { 'A/': 2 }],
    [8, { 'R=': 1 }],
    [null, { 'B=': 9 }],
  ]);
  expect(setFacts(s).map((f) => `${f.number}:${f.kind}:${f.count}`)).toEqual(['1:serveErrors:3', '12:attackErrors:3', '15:acesConceded:3', '4:blocked:2']);
  expect(setFacts(s, 10).at(-1)).toMatchObject({ number: 15, kind: 'kills', count: 5, negative: false });
});

test('shares: the counts by evaluation of each skill, in the order of its scale', () => {
  const s = set([[7, { 'A#': 3, 'A=': 1, 'A-': 2 }]]);
  const attack = teamShares([s]).find((x) => x.skill === 'A')!;
  expect(attack.total).toBe(6);
  expect(Object.fromEntries(attack.parts.map((p) => [p.evaluation, p.count]))).toMatchObject({ '#': 3, '=': 1, '-': 2 });
  expect(teamShares([set([])]).every((x) => x.total === 0)).toBe(true);
});

test('form: ranked by points minus 3 errors; shown as points, errors and points minus errors; null and even ones not listed', () => {
  const s = set([
    [10, { 'A#': 4, 'A=': 1 }],
    [11, { 'A#': 1 }],
    [12, { 'A=': 3 }],
    [13, { 'A-': 5 }],
    [14, { 'A#': 2, 'A=': 1 }],
    [null, { 'A#': 9 }],
  ]);
  const form = setForm(s);
  // 10: 4 points, 1 error -> 4 - 3 = +1; 11: +1 point; 14: 2 - 3 = -1; 12: -9
  // equal score: the better points-minus-errors first
  expect(form.good).toEqual([{ number: 10, points: 4, errors: 1, balance: 3, score: 1 }, { number: 11, points: 1, errors: 0, balance: 1, score: 1 }]);
  expect(form.bad).toEqual([{ number: 12, points: 0, errors: 3, balance: -3, score: -9 }, { number: 14, points: 2, errors: 1, balance: 1, score: -1 }]);
});

test('form: a libero with no points and one reception error is negative, with none is not listed', () => {
  const form = setForm(set([[7, { 'R=': 1, 'R+': 6 }], [8, { 'R+': 5 }]]));
  expect(form.bad.map((p) => p.number)).toEqual([7]);
  expect(form.good).toEqual([]);
});

test('tally: points (aces, attacks, blocks) and errors with their sources, most frequent first', () => {
  const s = set([
    [7, { 'B#': 2, 'A#': 5, 'M#': 1, 'B=': 1, 'A=': 2, 'A/': 1, 'R=': 1, 'A+': 4 }],
    [8, { 'P=': 1 }],
  ]);
  expect(setTally(s)).toEqual({
    points: 8,
    errors: 6,
    pointsBy: [{ skill: 'A', count: 5 }, { skill: 'B', count: 2 }, { skill: 'M', count: 1 }],
    errorsBy: [{ skill: 'A', count: 3 }, { skill: 'B', count: 1 }, { skill: 'R', count: 1 }, { skill: 'P', count: 1 }],
  });
});
