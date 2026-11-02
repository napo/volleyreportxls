// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { newMatchRecord } from '../matches/record';
import { type MatchRow, DEFAULT_SORT, filterRows, nextSort, sortRows } from './match-table';

function row(over: { team: string; competition?: string; date?: string; createdAt?: string; updatedAt?: string; venue?: string }): MatchRow {
  const r = { ...newMatchRecord(new Date('2026-01-01T10:00:00Z')), teamName: over.team, ...over };
  return {
    record: r,
    cells: { match: r.teamName, competition: r.competition, date: r.date, createdAt: r.createdAt, updatedAt: r.updatedAt },
  };
}

const names = (rows: readonly MatchRow[]) => rows.map((r) => r.record.teamName);

test('the filter looks in every column, ignores case and accents and wants every word', () => {
  const rows = [row({ team: 'Città', competition: 'Under 14' }), row({ team: 'Lago', competition: 'Serie D', venue: 'Palazzetto' })];
  expect(names(filterRows(rows, 'citta'))).toEqual(['Città']);
  expect(names(filterRows(rows, 'serie d'))).toEqual(['Lago']);
  expect(names(filterRows(rows, 'palazzetto'))).toEqual(['Lago']);
  expect(names(filterRows(rows, 'under lago'))).toEqual([]);
  expect(names(filterRows(rows, '  '))).toEqual(['Città', 'Lago']);
});

test('a click orders by the column, a second click turns the order around; dates start from the most recent', () => {
  expect(nextSort(DEFAULT_SORT, 'competition')).toEqual({ column: 'competition', descending: false });
  expect(nextSort({ column: 'competition', descending: false }, 'competition')).toEqual({ column: 'competition', descending: true });
  expect(nextSort(DEFAULT_SORT, 'date')).toEqual({ column: 'date', descending: true });
  expect(nextSort(DEFAULT_SORT, 'updatedAt')).toEqual({ column: 'updatedAt', descending: false });
});

test('rows are ordered by the column, with empty values last', () => {
  const rows = [
    row({ team: 'A', competition: 'Serie D', date: '2026-03-01', updatedAt: '2026-03-02T00:00:00Z' }),
    row({ team: 'B', competition: '', date: '2025-10-12', updatedAt: '2026-03-05T00:00:00Z' }),
    row({ team: 'C', competition: 'Under 14', date: '2026-01-20', updatedAt: '2026-03-01T00:00:00Z' }),
  ];
  expect(names(sortRows(rows, DEFAULT_SORT))).toEqual(['B', 'A', 'C']);
  expect(names(sortRows(rows, { column: 'date', descending: true }))).toEqual(['A', 'C', 'B']);
  expect(names(sortRows(rows, { column: 'competition', descending: false }))).toEqual(['A', 'C', 'B']);
  expect(names(sortRows(rows, { column: 'competition', descending: true }))).toEqual(['C', 'A', 'B']);
});
