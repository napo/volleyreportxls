// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { emptySet, newMatchRecord, type MatchRecord } from '../matches/record';
import { athleteMatches, athleteTotals, athleteTrend } from './history';

function match(id: string, date: string, number: number, counts: Record<string, number>, athleteId?: string): MatchRecord {
  const set = emptySet(1);
  const rows = set.rows.map((r, i) => (i === 0 ? { ...r, playerNumber: number, counts } : r));
  return {
    ...newMatchRecord(),
    id,
    date,
    opponentName: `Avv ${id}`,
    players: [athleteId ? { number, name: '', athleteId } : { number, name: '' }],
    sets: [{ ...set, rows, score: { team: 25, opponent: 20 } }, ...newMatchRecord().sets.slice(1)],
  };
}

test('the matches of the athlete with any shirt number, oldest first, and totals from the touches', () => {
  const records = [
    match('b', '2026-10-08', 12, { 'R#': 1, 'R=': 1, 'A#': 1 }, 'giulia'),
    match('a', '2026-10-01', 7, { 'R#': 1, 'R+': 1, 'A#': 1, 'A=': 1 }, 'giulia'),
    match('c', '2026-10-05', 7, { 'R#': 4 }),
  ];
  const matches = athleteMatches(records, 'giulia');
  expect(matches.map((m) => [m.record.id, m.number, m.setsPlayed])).toEqual([
    ['a', 7, [1]],
    ['b', 12, [1]],
  ]);
  const totals = athleteTotals(matches);
  expect(totals.matches).toBe(2);
  expect(totals.line.reception.total).toBe(4);
  // (# + +) / total over all touches: 3/4, not the mean of 100% and 50%.
  expect(totals.line.reception.positivity).toBe(0.75);
  expect(totals.line.attack.points).toBe(2);
  expect(athleteTrend(matches).map((r) => [r.set, r.receptionPositivity])).toEqual([
    ['01/10/26 Avv a', 1],
    ['08/10/26 Avv b', 0.5],
  ]);
});
