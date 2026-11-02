// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The history of a whole squad: one row per athlete with the totals of the
 * chosen matches, in the order chosen by clicking a column. As for a single
 * athlete, totals come from the touches, never from adding up percentages.
 */

import { type MatchStats, type StatLine, calculateMatchStats, calculateStatLine } from '../domain/stats/aggregate';
import { type MatchRecord, toMatch } from '../matches/record';
import type { PlayerPointsRow, SetTrendRow } from '../report/chart-data';
import { formatDate } from '../report/format';
import { type TabellinoLine, tabellinoLine } from '../report/tabellino';
import { type AthleteMatch, type AthleteTotals, athleteTotals } from './history';

export interface SquadRow {
  /** The athlete (or, for a single match, the player). */
  readonly id: string;
  readonly label: string;
  /** Shirt numbers worn in the chosen matches. */
  readonly numbers: readonly number[];
  readonly totals: AthleteTotals;
}

/** The athletes with at least one of the chosen matches. */
export function squadRows(
  byAthlete: ReadonlyMap<string, readonly AthleteMatch[]>,
  athletes: readonly { readonly id: string; readonly label: string }[],
  chosenMatch: (id: string) => boolean,
): SquadRow[] {
  return athletes.flatMap((a) => {
    const matches = (byAthlete.get(a.id) ?? []).filter((m) => chosenMatch(m.record.id));
    if (!matches.length) return [];
    return [{ id: a.id, label: a.label, numbers: [...new Set(matches.map((m) => m.number))], totals: athleteTotals(matches) }];
  });
}

/** The chosen players of one match as rows of the same table. */
export function matchRows(stats: MatchStats, ids: readonly string[]): SquadRow[] {
  return ids.flatMap((id) => {
    const p = stats.players.find((x) => x.player.id === id);
    if (!p) return [];
    const totals = { matches: 1, sets: p.setsPlayed.length, stats: p.match, line: tabellinoLine(p.match), rating: p.rating.overall };
    return [{ id, label: p.player.name.trim(), numbers: [p.player.number], totals }];
  });
}

/** The team in the chosen matches: all its touches, the opponent errors added up, and the trend match by match. */
export function squadCharts(records: readonly MatchRecord[]): { team: StatLine; opponentErrors: number; trend: SetTrendRow[] } {
  const stats = records.map((r) => ({ record: r, stats: calculateMatchStats(toMatch(r)) }));
  return {
    team: calculateStatLine(stats.flatMap((s) => s.stats.events)),
    opponentErrors: stats.reduce((n, s) => n + s.stats.opponentErrors, 0),
    trend: stats.map(({ record, stats }) => ({
      set: [formatDate(record.date), record.opponentName].filter(Boolean).join(' '),
      receptionPositivity: stats.team.match.reception.total > 0 ? stats.team.match.reception.positivity : null,
      attackPointRate: stats.team.match.attack.total > 0 ? stats.team.match.attack.pointRate : null,
    })),
  };
}

/** Points won and lost by every row, for the comparison chart. */
export const rowPoints = (rows: readonly SquadRow[]): PlayerPointsRow[] =>
  rows.map((r) => ({
    playerId: r.id,
    label: r.label || `n. ${r.numbers.join(', ')}`,
    won: r.totals.stats.summary.pointsWon,
    lost: r.totals.stats.summary.pointsLost,
  }));

/** Points and skills of the rows together (the team, as far as the chosen athletes go). */
export function squadLine(byAthlete: ReadonlyMap<string, readonly AthleteMatch[]>, rows: readonly SquadRow[], chosenMatch: (id: string) => boolean): TabellinoLine {
  const events = rows.flatMap((r) => (byAthlete.get(r.id) ?? []).filter((m) => chosenMatch(m.record.id)).flatMap((m) => m.events));
  return tabellinoLine(calculateStatLine(events));
}

const NUMBERS = {
  matches: (t: AthleteTotals) => t.matches,
  sets: (t: AthleteTotals) => t.sets,
  rating: (t: AthleteTotals) => t.rating,
  points: (t: AthleteTotals) => t.line.points.total,
  balance: (t: AthleteTotals) => t.line.points.balance,
  serveTotal: (t: AthleteTotals) => t.line.serve.total,
  serveErrors: (t: AthleteTotals) => t.line.serve.errors,
  servePoints: (t: AthleteTotals) => t.line.serve.points,
  receptionTotal: (t: AthleteTotals) => t.line.reception.total,
  receptionErrors: (t: AthleteTotals) => t.line.reception.errors,
  receptionPositivity: (t: AthleteTotals) => t.line.reception.positivity,
  receptionPerfect: (t: AthleteTotals) => t.line.reception.perfectRate,
  attackTotal: (t: AthleteTotals) => t.line.attack.total,
  attackErrors: (t: AthleteTotals) => t.line.attack.errors,
  attackBlocked: (t: AthleteTotals) => t.line.attack.blocked,
  attackPoints: (t: AthleteTotals) => t.line.attack.points,
  attackPointRate: (t: AthleteTotals) => t.line.attack.pointRate,
  blockPoints: (t: AthleteTotals) => t.line.blockPoints,
} as const satisfies Record<string, (t: AthleteTotals) => number | null>;

export type SquadColumn = 'name' | keyof typeof NUMBERS;

/** The number shown in a column (null when there is nothing to compute). */
export const squadValue = (row: SquadRow, column: Exclude<SquadColumn, 'name'>): number | null => NUMBERS[column](row.totals);

/** Below this many touches a percentage says little: it is shown greyed out. */
export const FEW_TOUCHES = 5;

/** True when the percentage of the column rests on fewer than FEW_TOUCHES touches. */
export function fewTouches(line: TabellinoLine, column: SquadColumn): boolean {
  if (column === 'receptionPositivity' || column === 'receptionPerfect') return line.reception.total > 0 && line.reception.total < FEW_TOUCHES;
  if (column === 'attackPointRate') return line.attack.total > 0 && line.attack.total < FEW_TOUCHES;
  return false;
}

export interface SquadSort {
  readonly column: SquadColumn;
  readonly descending: boolean;
}

export const DEFAULT_SQUAD_SORT: SquadSort = { column: 'name', descending: false };

/** Clicking a column orders by it; clicking it again turns the order around. Numbers start from the highest. */
export function nextSquadSort(sort: SquadSort, column: SquadColumn): SquadSort {
  return sort.column === column ? { column, descending: !sort.descending } : { column, descending: column !== 'name' };
}

/** Rows in the chosen order; empty values always go last, ties by name. */
export function sortSquadRows(rows: readonly SquadRow[], sort: SquadSort): SquadRow[] {
  const byName = (a: SquadRow, b: SquadRow) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: 'base' });
  const { column } = sort;
  if (column === 'name') return [...rows].sort((a, b) => (sort.descending ? -1 : 1) * byName(a, b));
  const sign = sort.descending ? -1 : 1;
  return [...rows].sort((a, b) => {
    const [x, y] = [squadValue(a, column), squadValue(b, column)];
    if (x === null || y === null) return x === y ? byName(a, b) : x === null ? 1 : -1;
    return sign * (x - y) || byName(a, b);
  });
}
