// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { emptySet, newMatchRecord, type MatchRecord } from '../matches/record';
import { direction, standing, teamSummary } from './summary';

/** A match where the team receives `good` positive and `bad` negative balls. */
function match(id: string, good: number, bad: number): MatchRecord {
  const set = emptySet(1);
  const rows = set.rows.map((r, i) => (i === 0 ? { ...r, playerNumber: 7, counts: { 'R+': good, 'R-': bad, 'A#': 2 } } : r));
  return { ...newMatchRecord(), id, sets: [{ ...set, rows, score: { team: 25, opponent: 20 } }, ...newMatchRecord().sets.slice(1)] };
}

test('the last three matches against all of them: the reception gets worse', () => {
  const records = [match('a', 9, 1), match('b', 9, 1), match('c', 5, 5), match('d', 5, 5), match('e', 5, 5)];
  const s = teamSummary(records);
  // 33 positive out of 50 in all; 15 out of 30 in the last three.
  expect(s.values.reception).toBeCloseTo(33 / 50);
  expect(s.recent?.reception).toBeCloseTo(0.5);
  expect(direction(s.values.reception, s.recent!.reception)).toBe('down');
  expect(s.balance.total).toBe(10);
  expect(s.balance.perUnit).toBe(2);
});

test('with three matches or fewer there is no direction', () => {
  expect(teamSummary([match('a', 9, 1), match('b', 5, 5)]).recent).toBeNull();
  expect(direction(0.5, null)).toBeNull();
  expect(direction(0.5, 0.52)).toBe('steady');
});

test('an athlete above, level with or below the team; nothing on few touches', () => {
  expect(standing(0.7, 0.6, 20)).toBe('above');
  expect(standing(0.61, 0.6, 20)).toBe('level');
  expect(standing(0.5, 0.6, 20)).toBe('below');
  expect(standing(0.9, 0.6, 3)).toBeNull();
});
