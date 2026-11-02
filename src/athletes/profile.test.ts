// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { emptySet, newMatchRecord, type MatchRecord } from '../matches/record';
import { athleteMatches, athleteTotals } from './history';
import { meaningfulAxes, playedAxes, profileOf, rangeOf, teamProfile } from './profile';

/** A match with one row per player: [number, athlete, counts]. */
function match(players: readonly [number, string, Record<string, number>][]): MatchRecord {
  const set = emptySet(1);
  const rows = set.rows.map((r, i) => (players[i] ? { ...r, playerNumber: players[i][0], counts: players[i][2] } : r));
  return {
    ...newMatchRecord(),
    players: players.map(([number, athleteId]) => ({ number, name: '', athleteId })),
    sets: [{ ...set, rows, score: { team: 25, opponent: 20 } }, ...newMatchRecord().sets.slice(1)],
  };
}

const record = match([
  [1, 'libero', { 'R#': 3, 'R+': 3, 'R-': 2 }],
  [7, 'banda', { 'R#': 1, 'R=': 1, 'A#': 4, 'A=': 1, 'A-': 1, 'B#': 1, 'B-': 4, 'M#': 1 }],
  [4, 'centrale', { 'A#': 3, 'A-': 2, 'M#': 3, 'M-': 2 }],
]);

test('a libero has a single indicator: reception', () => {
  const totals = athleteTotals(athleteMatches([record], 'libero'));
  expect(meaningfulAxes(totals.stats)).toEqual(['reception']);
  expect(playedAxes(athleteTotals(athleteMatches([record], 'banda')).stats)).toEqual(['serve', 'reception', 'attack', 'block']);
  expect(profileOf(totals.stats)).toMatchObject({ reception: 0.75, attack: null, serve: null, block: null });
});

test('the team counts only the touches made: its reception is the one of who received', () => {
  const team = teamProfile([record]);
  // 3 + 3 + 1 positive receptions out of 8 + 2.
  expect(team.reception).toBe(0.7);
  expect(team.attack).not.toBeNull();
});

test('a chart keeps the usual range of its indicator and widens it to hold every value', () => {
  expect(rangeOf('reception', [0.5, 0.7])).toEqual({ min: 0, max: 1 });
  expect(rangeOf('attack', [0.1, 0.75])).toEqual({ min: -0.2, max: 0.8 });
  expect(rangeOf('attack', [-0.35, null])).toEqual({ min: -0.4, max: 0.6 });
});
