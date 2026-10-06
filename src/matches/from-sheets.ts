/**
 * From the sheets read in photos (and checked by the user) to the sets of a
 * match: one set per sheet, one row per line used on the sheet.
 */
import type { ScoutCodeString } from '../domain/codes';
import type { SetNumber, SetScore } from '../domain/model';
import { type MatchRecord, type RowKind, type SetRecord, type TallyRowRecord, LIBERO_ROWS, PLAYER_ROWS, emptyRow } from './record';

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
  // As many rows as the paper form at least, players first.
  const of = (kind: RowKind, min: number) => {
    const rows = used.filter((r) => r.kind === kind);
    return [...rows, ...Array.from({ length: Math.max(0, min - rows.length) }, () => emptyRow(kind))];
  };
  return { number: sheet.setNumber, score: sheet.score, rows: [...of('player', PLAYER_ROWS), ...of('libero', LIBERO_ROWS)] };
}

/** The match with the sets read from the sheets in place of the ones with the same number. */
export function withSets(record: MatchRecord, sets: readonly SetRecord[]): MatchRecord {
  return { ...record, sets: record.sets.map((s) => sets.find((n) => n.number === s.number) ?? s) };
}
