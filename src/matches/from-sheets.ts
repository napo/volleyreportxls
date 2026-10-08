/**
 * From the sheets read in photos (and checked by the user) to the sets of a
 * match: one set per sheet, one row per line used on the sheet.
 */
import type { ScoutCodeString } from '../domain/codes';
import type { SetNumber, SetScore } from '../domain/model';
import { type MatchRecord, type RowKind, type SetRecord, type TallyRowRecord, LIBERO_ROWS, PLAYER_ROWS, emptyRow, rowIsUsed } from './record';

export interface ReadRow {
  readonly kind: RowKind;
  readonly numberWritten: boolean;
  readonly cells: readonly { readonly code: ScoutCodeString | null; readonly count: number }[];
}

export interface CheckedSheet {
  readonly setNumber: SetNumber;
  readonly rows: readonly ReadRow[];
  /** Shirt number typed by the user, by row index. */
  readonly numbers: Readonly<Record<number, number | null>>;
  /** Counts corrected by the user, by `${row}:${code}`. */
  readonly corrections: Readonly<Record<string, number>>;
  readonly score: SetScore | null;
}

export const correctionKey = (row: number, code: ScoutCodeString) => `${row}:${code}`;

/** Touches marked in cells the app no longer records (v3 dig and graded sets). */
export const ignoredTouches = (rows: readonly ReadRow[]) =>
  rows.reduce((n, r) => n + r.cells.reduce((m, c) => m + (c.code === null ? c.count : 0), 0), 0);

export function setFromSheet(sheet: CheckedSheet): SetRecord {
  const used: TallyRowRecord[] = [];
  sheet.rows.forEach((row, index) => {
    const counts: Partial<Record<ScoutCodeString, number>> = {};
    for (const cell of row.cells) {
      if (!cell.code) continue;
      const n = sheet.corrections[correctionKey(index, cell.code)] ?? cell.count;
      if (n > 0) counts[cell.code] = n;
    }
    const playerNumber = sheet.numbers[index] ?? null;
    if (playerNumber === null && !row.numberWritten && Object.keys(counts).length === 0) return;
    used.push({ ...emptyRow(row.kind), playerNumber, counts });
  });
  return { number: sheet.setNumber, score: sheet.score, rows: padded(used) };
}

/** As many rows as the paper form at least, players first. */
function padded(used: readonly TallyRowRecord[]): TallyRowRecord[] {
  const of = (kind: RowKind, min: number) => {
    const rows = used.filter((r) => r.kind === kind);
    return [...rows, ...Array.from({ length: Math.max(0, min - rows.length) }, () => emptyRow(kind))];
  };
  return [...of('player', PLAYER_ROWS), ...of('libero', LIBERO_ROWS)];
}

/** What to do with a set the match already has when a sheet of the same set is added. */
export type SetMerge = 'sum' | 'replace';

const pointsOf = (score: SetScore | null) => (score ? score.team + score.opponent : -1);

/**
 * Two sheets of the same set (a new sheet started during the set, or a set
 * recorded in two moments): the rows with the same kind and shirt number add up
 * their counts, the other rows are kept as they are. The final score is the one
 * with more points played.
 */
export function sumSets(a: SetRecord, b: SetRecord): SetRecord {
  const used = a.rows.filter(rowIsUsed);
  for (const row of b.rows.filter(rowIsUsed)) {
    const same = row.playerNumber === null ? -1 : used.findIndex((r) => r.kind === row.kind && r.playerNumber === row.playerNumber);
    if (same < 0) {
      used.push(row);
      continue;
    }
    const counts: Partial<Record<ScoutCodeString, number>> = { ...used[same]!.counts };
    for (const [code, n] of Object.entries(row.counts) as [ScoutCodeString, number][]) counts[code] = (counts[code] ?? 0) + n;
    used[same] = { ...used[same]!, counts };
  }
  return { number: a.number, score: pointsOf(b.score) >= pointsOf(a.score) ? b.score : a.score, rows: padded(used) };
}

/** Shirt numbers written in some of the sets but not in all of them. */
export function numbersNotInAll(sets: readonly SetRecord[]): number[] {
  const numbers = sets.map((s) => new Set(s.rows.flatMap((r) => (r.playerNumber === null ? [] : [r.playerNumber]))));
  const all = [...new Set(numbers.flatMap((n) => [...n]))].sort((x, y) => x - y);
  return all.filter((n) => numbers.some((s) => !s.has(n)));
}

/**
 * The match with the sets read from the sheets: several sheets of the same set
 * are summed; they replace the set of the match with the same number, or are
 * added to it for the numbers in `sum`.
 */
export function withSets(record: MatchRecord, sets: readonly SetRecord[], sum: ReadonlySet<SetNumber> = new Set()): MatchRecord {
  return {
    ...record,
    sets: record.sets.map((s) => {
      const read = sets.filter((n) => n.number === s.number);
      if (read.length === 0) return s;
      return (sum.has(s.number) ? [s, ...read] : read).reduce(sumSets);
    }),
  };
}
