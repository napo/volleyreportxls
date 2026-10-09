// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Match data as captured on the scouting sheet.
 *
 * The model mirrors how a coach scouts: for each set, one line per player who
 * entered the court, with the ordered sequence of codes written for the balls
 * that player touched. Cells hold exactly what was written (raw text), so the
 * same structure can be filled by hand, by the recognizer, or by importing a
 * VolleyReportXLS workbook; parsing happens in `events.ts`.
 */

import type { ScoutCode } from './codes';

export const SET_NUMBERS = [1, 2, 3, 4, 5] as const;
export type SetNumber = (typeof SET_NUMBERS)[number];

/** `L` (libero) is the only role used by the workbook. */
export type PlayerRole = 'L';

export interface Player {
  readonly id: string;
  /** Shirt number: the key used on the scouting sheet. */
  readonly number: number;
  /** May be empty: the shirt number alone identifies the player. */
  readonly name: string;
  readonly role?: PlayerRole;
}

export interface Team {
  readonly id: string;
  readonly name: string;
  readonly players: readonly Player[];
}

export interface SetScore {
  readonly team: number;
  readonly opponent: number;
}

export interface ScoutLine {
  readonly id: string;
  /** Shirt number written at the start of the line; null if missing or unreadable. */
  readonly playerNumber: number | null;
  /** Raw cell contents, in order; empty strings are blank cells. */
  readonly cells: readonly string[];
}

export interface MatchSet {
  readonly number: SetNumber;
  /** Final score; null while the set has not been played or entered. */
  readonly score: SetScore | null;
  readonly lines: readonly ScoutLine[];
}

export interface Match {
  readonly id: string;
  readonly competition: string;
  /** ISO 8601 date (YYYY-MM-DD). */
  readonly date: string;
  readonly venue: string;
  /** The scouted team (the workbook advises to record it as the home team). */
  readonly team: Team;
  readonly opponentName: string;
  readonly sets: readonly MatchSet[];
}

/** Location of a cell on the scouting sheet. */
export interface CellRef {
  readonly setNumber: SetNumber;
  readonly lineId: string;
  /** Zero-based index of the cell within its line. */
  readonly position: number;
}

/** One ball touch, as recorded by a valid scout code. */
export interface ScoutEvent {
  readonly ref: CellRef;
  readonly setNumber: SetNumber;
  /** Null when the line has no player number: the event still counts for the team. */
  readonly playerNumber: number | null;
  readonly code: ScoutCode;
}
