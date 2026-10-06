/**
 * Counts from the tally sheet (one row per player, one count per code) as
 * scouting lines. Statistics depend only on how many touches of each code a
 * player made in a set, so a tally row becomes a line whose cells repeat each
 * code as many times as it was counted; the order of the cells carries no
 * meaning.
 */

import { EVALUATIONS, SKILLS, type ScoutCodeString, formatScoutCode, isAllowed, scoutCode } from './codes';
import type { ScoutLine } from './model';

export interface TallyRow {
  readonly id: string;
  /** Shirt number written on the sheet; null if missing or unreadable. */
  readonly playerNumber: number | null;
  /** How many times each code was marked (codes not listed: zero). */
  readonly counts: Readonly<Partial<Record<ScoutCodeString, number>>>;
}

/** Every code in the canonical order (skill, then evaluation from # to =). */
const CODE_ORDER: readonly ScoutCodeString[] = SKILLS.flatMap((skill) =>
  EVALUATIONS.map((e) => scoutCode(skill, e)).filter(isAllowed).map(formatScoutCode),
);

export function tallyLine(row: TallyRow): ScoutLine {
  const cells = CODE_ORDER.flatMap((code) => {
    const n = row.counts[code] ?? 0;
    if (!Number.isInteger(n) || n < 0) throw new Error(`invalid count ${n} for ${code}`);
    return Array.from({ length: n }, () => code as string);
  });
  return { id: row.id, playerNumber: row.playerNumber, cells };
}

/** The counts of a line, the inverse of tallyLine (invalid cells are ignored). */
export function tallyCounts(line: ScoutLine): Partial<Record<ScoutCodeString, number>> {
  const counts: Partial<Record<ScoutCodeString, number>> = {};
  for (const cell of line.cells) {
    const code = cell.replace(/\s+/g, '').toUpperCase() as ScoutCodeString;
    if (CODE_ORDER.includes(code)) counts[code] = (counts[code] ?? 0) + 1;
  }
  return counts;
}
