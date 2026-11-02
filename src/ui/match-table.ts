// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The table of the saved matches: one text per column, a free filter that
 * looks in all of them and the order chosen by clicking a column.
 */

import type { MatchRecord } from '../matches/record';

export const MATCH_COLUMNS = ['match', 'competition', 'date', 'createdAt', 'updatedAt'] as const;
export type MatchColumn = (typeof MATCH_COLUMNS)[number];

export interface MatchSort {
  readonly column: MatchColumn;
  readonly descending: boolean;
}

/** As the archive lists them: the last changed first. */
export const DEFAULT_SORT: MatchSort = { column: 'updatedAt', descending: true };

export interface MatchRow {
  readonly record: MatchRecord;
  /** What every column shows. */
  readonly cells: Readonly<Record<MatchColumn, string>>;
}

const DATE_COLUMNS: ReadonlySet<MatchColumn> = new Set(['date', 'createdAt', 'updatedAt']);

/** Clicking a column orders by it; clicking it again turns the order around. Dates start from the most recent. */
export function nextSort(sort: MatchSort, column: MatchColumn): MatchSort {
  return sort.column === column ? { column, descending: !sort.descending } : { column, descending: DATE_COLUMNS.has(column) };
}

/** Sets won-lost and the score of every set, e.g. "3-1 (25-20, 18-25, 25-22, 25-19)". */
export function matchResult(r: MatchRecord): string {
  const scored = r.sets.flatMap((s) => (s.score ? [s.score] : []));
  if (!scored.length) return '';
  const won = scored.filter((s) => s.team > s.opponent).length;
  const lost = scored.filter((s) => s.opponent > s.team).length;
  return `${won}-${lost} (${scored.map((s) => `${s.team}-${s.opponent}`).join(', ')})`;
}

/** Lower case and without accents, for searching. */
export const fold = (text: string) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLocaleLowerCase();

/** The rows where every word of the query appears in some column (or in the venue or the result); case and accents do not count. */
export function filterRows(rows: readonly MatchRow[], query: string): readonly MatchRow[] {
  const words = fold(query).split(/\s+/).filter(Boolean);
  if (!words.length) return rows;
  return rows.filter((row) => {
    const text = fold([...Object.values(row.cells), row.record.venue, row.record.date, matchResult(row.record)].join('\n'));
    return words.every((w) => text.includes(w));
  });
}

const sortKey = (row: MatchRow, column: MatchColumn) => (DATE_COLUMNS.has(column) ? row.record[column as 'date'] : row.cells[column]);

/** Rows in the chosen order; empty values always go last, ties keep the last changed first. */
export function sortRows(rows: readonly MatchRow[], sort: MatchSort): readonly MatchRow[] {
  const sign = sort.descending ? -1 : 1;
  const compare = (a: MatchRow, b: MatchRow) => {
    const [x, y] = [sortKey(a, sort.column), sortKey(b, sort.column)];
    if (!x || !y) return x ? -1 : y ? 1 : 0;
    return sign * x.localeCompare(y, undefined, { numeric: true, sensitivity: 'base' });
  };
  return [...rows].sort((a, b) => compare(a, b) || b.record.updatedAt.localeCompare(a.record.updatedAt));
}
