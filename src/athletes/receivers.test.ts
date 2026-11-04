// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { emptySet, newMatchRecord, type MatchRecord } from '../matches/record';
import { matchesByAthlete } from './history';
import { receiverLines } from './receivers';
import { squadRows } from './squad-history';

function match(players: readonly [number, string, Record<string, number>][]): MatchRecord {
  const set = emptySet(1);
  const rows = set.rows.map((r, i) => (players[i] ? { ...r, playerNumber: players[i][0], counts: players[i][2] } : r));
  return {
    ...newMatchRecord(),
    players: players.map(([number, athleteId]) => ({ number, name: '', athleteId })),
    sets: [{ ...set, rows, score: { team: 25, opponent: 20 } }, ...newMatchRecord().sets.slice(1)],
  };
}

test('only who received and cannot score, with receptions, perfect ones, positivity, efficiency and aces conceded', () => {
  const record = match([
    [1, 'libero', { 'R#': 4, 'R+': 3, 'R-': 2, 'R=': 1 }],
    [7, 'banda', { 'R#': 2, 'R=': 1, 'A#': 3 }],
  ]);
  const rows = squadRows(matchesByAthlete([record]), [{ id: 'libero', label: 'Libera' }, { id: 'banda', label: 'Banda' }], () => true);
  const [line, ...others] = receiverLines(rows);
  expect(others).toEqual([]);
  expect(line).toMatchObject({ id: 'libero', label: 'Libera', receptions: 10, perfect: 4, positivity: 0.7, efficiency: 0.3, aces: 1 });
  expect(Object.values(line!.counts).reduce((a, b) => a + b, 0)).toBe(10);
});
