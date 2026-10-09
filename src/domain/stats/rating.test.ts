// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { extractEvents } from '../events';
import { line, match, set, team } from '../testing';
import { calculateStatLine } from './aggregate';
import { calculatePlayerRating } from './rating';

const statLine = (codes: string) => calculateStatLine(extractEvents(match(team([[1, 'A']]), [set(1, null, [line(1, codes)])])).events);

describe('scoresheet rating (DataVolley §9.7.1.1)', () => {
  test('serve vote is the weighted mean, raised to at least 5.5', () => {
    const player = statLine('B# B+ B=');
    expect(calculatePlayerRating(player, player, 1).serve).toBeCloseTo((10 + 7 + 0) / 3);
    const weak = statLine('B= B= B-');
    expect(calculatePlayerRating(weak, weak, 1).serve).toBe(5.5);
  });

  test('a skill is rated only above the participation threshold', () => {
    const team = statLine(`${'R# '.repeat(100)}`);
    expect(calculatePlayerRating(statLine('R# R# R# R# R# R# R# R# R# R# R#'), team, 1).reception).toBeNull(); // 11%
    expect(calculatePlayerRating(statLine('R# '.repeat(12)), team, 1).reception).toBe(10); // 12%
  });

  test('block vote depends on block points per set played', () => {
    const vote = (codes: string, sets: number) => calculatePlayerRating(statLine(codes), statLine(codes), sets).block;
    expect(vote('M# M# M#', 3)).toBe(8.5);
    expect(vote('M# M# M#', 4)).toBe(7); // 0.75 per set
    expect(vote('M# M#', 3)).toBe(7);
    expect(vote('M#', 3)).toBeNull();
  });

  test('the final vote is the mean of the votes obtained', () => {
    const player = statLine('B# A# M#');
    const rating = calculatePlayerRating(player, player, 1);
    expect(rating).toEqual({ serve: 10, reception: null, attack: 10, block: 8.5, overall: (10 + 10 + 8.5) / 3 });
    expect(calculatePlayerRating(statLine(''), player, 1).overall).toBeNull();
  });
});
