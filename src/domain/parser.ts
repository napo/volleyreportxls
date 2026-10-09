// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ScoutCode, isAllowed, isEvaluation, isSkill } from './codes';

export type ParseErrorKind =
  /** Nothing written in the cell. */
  | 'empty'
  /** Not a skill letter followed by one evaluation symbol. */
  | 'malformed'
  | 'unknown-skill'
  | 'unknown-evaluation'
  /** Valid letter and symbol, but the pair is not in the vocabulary (e.g. `P!`). */
  | 'not-allowed';

export interface ParseError {
  readonly kind: ParseErrorKind;
  readonly input: string;
}

export type ParseResult =
  | { readonly ok: true; readonly code: ScoutCode }
  | { readonly ok: false; readonly error: ParseError };

/**
 * Parses a single scouting cell.
 *
 * Letter case and whitespace are not significant: `b#` and `B #` both read as
 * `B#`. (The reference workbook normalises case through COUNTIF but silently
 * drops codes containing spaces; see docs/volleyreportxls-analysis.md, W11.)
 */
export function parseScoutCode(input: string): ParseResult {
  const normalised = input.replace(/\s+/g, '').toUpperCase();
  if (normalised === '') return failure('empty', input);
  if (normalised.length !== 2) return failure('malformed', input);

  const [letter, symbol] = [normalised[0]!, normalised[1]!];
  if (!isSkill(letter)) return failure('unknown-skill', input);
  if (!isEvaluation(symbol)) return failure('unknown-evaluation', input);

  const code: ScoutCode = { skill: letter, evaluation: symbol };
  if (!isAllowed(code)) return failure('not-allowed', input);
  return { ok: true, code };
}

function failure(kind: ParseErrorKind, input: string): ParseResult {
  return { ok: false, error: { kind, input } };
}
