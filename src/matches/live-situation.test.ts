// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { SetRecord } from './record';
import { levelOf, setFacts, teamIndicators } from './live-situation';

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
