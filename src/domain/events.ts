// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Match, ScoutEvent, CellRef } from './model';
import { type ParseError, parseScoutCode } from './parser';

export type ScoutIssue =
  /** A cell that does not contain a valid code: it is left out of every statistic. */
  | { readonly kind: 'invalid-code'; readonly ref: CellRef; readonly error: ParseError }
  /** A line with codes but no player number: its events count for the team only. */
  | { readonly kind: 'missing-player-number'; readonly setNumber: CellRef['setNumber']; readonly lineId: string }
  /** A player number that is not in the roster: its events count for the team only. */
  | { readonly kind: 'unknown-player'; readonly setNumber: CellRef['setNumber']; readonly lineId: string; readonly playerNumber: number };

export interface ExtractedEvents {
  readonly events: readonly ScoutEvent[];
  readonly issues: readonly ScoutIssue[];
}

/** Turns the raw scouting lines of a match into events, collecting every problem found. */
export function extractEvents(match: Match): ExtractedEvents {
  const roster = new Set(match.team.players.map((p) => p.number));
  const events: ScoutEvent[] = [];
  const issues: ScoutIssue[] = [];

  for (const set of match.sets) {
    for (const line of set.lines) {
      const hasContent = line.cells.some((c) => c.trim() !== '');
      if (hasContent && line.playerNumber === null) {
        issues.push({ kind: 'missing-player-number', setNumber: set.number, lineId: line.id });
      } else if (line.playerNumber !== null && !roster.has(line.playerNumber)) {
        issues.push({ kind: 'unknown-player', setNumber: set.number, lineId: line.id, playerNumber: line.playerNumber });
      }

      line.cells.forEach((raw, position) => {
        const ref: CellRef = { setNumber: set.number, lineId: line.id, position };
        const parsed = parseScoutCode(raw);
        if (parsed.ok) {
          events.push({ ref, setNumber: set.number, playerNumber: line.playerNumber, code: parsed.code });
        } else if (parsed.error.kind !== 'empty') {
          issues.push({ kind: 'invalid-code', ref, error: parsed.error });
        }
      });
    }
  }
  return { events, issues };
}
