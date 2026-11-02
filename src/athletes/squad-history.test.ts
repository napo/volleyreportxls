// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { emptySet, newMatchRecord, type MatchRecord } from '../matches/record';
import { matchesByAthlete } from './history';
import { DEFAULT_SQUAD_SORT, fewTouches, nextSquadSort, sortSquadRows, squadLine, squadRows } from './squad-history';

/** A match with one row per player: [number, athlete, counts]. */
function match(id: string, date: string, players: readonly [number, string, Record<string, number>][]): MatchRecord {
  const set = emptySet(1);
  const rows = set.rows.map((r, i) => (players[i] ? { ...r, playerNumber: players[i][0], counts: players[i][2] } : r));
  return {
    ...newMatchRecord(),
    id,
    date,
    players: players.map(([number, athleteId]) => ({ number, name: '', athleteId })),
    sets: [{ ...set, rows, score: { team: 25, opponent: 20 } }, ...newMatchRecord().sets.slice(1)],
  };
}

const records = [
  match('a', '2026-10-01', [
    [7, 'giulia', { 'R#': 1, 'R+': 1, 'A#': 2 }],
    [4, 'sara', { 'A#': 1, 'A=': 1, 'M#': 2 }],
  ]),
  match('b', '2026-10-08', [
    [7, 'giulia', { 'R=': 2, 'A#': 1 }],
    [4, 'sara', { 'A#': 3 }],
  ]),
];
const athletes = [
  { id: 'giulia', label: 'Giulia' },
  { id: 'sara', label: 'Sara' },
  { id: 'eva', label: 'Eva' },
];

test('one row per athlete with totals from the touches of the chosen matches', () => {
  const byAthlete = matchesByAthlete(records);
  const all = squadRows(byAthlete, athletes, () => true);
  expect(all.map((r) => [r.label, r.totals.matches, r.numbers])).toEqual([
    ['Giulia', 2, [7]],
    ['Sara', 2, [4]],
  ]);
  // 2 positive out of 4 receptions, not the mean of 100% and 0%.
  expect(all[0]?.totals.line.reception.positivity).toBe(0.5);

  const first = squadRows(byAthlete, athletes, (id) => id === 'a');
  expect(first.map((r) => r.totals.line.attack.points)).toEqual([2, 1]);
  expect(squadLine(byAthlete, first, (id) => id === 'a').attack.total).toBe(4);
});

test('a click orders by the column, numbers from the highest; empty values last, ties by name', () => {
  const rows = squadRows(matchesByAthlete(records), athletes, () => true);
  expect(sortSquadRows(rows, DEFAULT_SQUAD_SORT).map((r) => r.label)).toEqual(['Giulia', 'Sara']);
  const byAttack = nextSquadSort(DEFAULT_SQUAD_SORT, 'attackPoints');
  expect(byAttack).toEqual({ column: 'attackPoints', descending: true });
  expect(sortSquadRows(rows, byAttack).map((r) => r.label)).toEqual(['Sara', 'Giulia']);
  // Sara has no receptions: her Pos% goes last in both directions.
  expect(sortSquadRows(rows, { column: 'receptionPositivity', descending: false }).map((r) => r.label)).toEqual(['Giulia', 'Sara']);
  expect(sortSquadRows(rows, { column: 'receptionPositivity', descending: true }).map((r) => r.label)).toEqual(['Giulia', 'Sara']);
});

test('percentages on fewer than five touches are marked', () => {
  const [giulia, sara] = squadRows(matchesByAthlete(records), athletes, () => true);
  expect(fewTouches(giulia!.totals.line, 'receptionPositivity')).toBe(true);
  expect(fewTouches(sara!.totals.line, 'attackPointRate')).toBe(false);
  expect(fewTouches(sara!.totals.line, 'receptionPositivity')).toBe(false);
});
