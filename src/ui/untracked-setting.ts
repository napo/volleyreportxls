// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The "!" and "/" columns last left out on this device: the live sheet starts
 * a new match with them, and the printable form is offered with them.
 */
import type { ScoutCodeString } from '../domain/codes';
import { OPTIONAL_CODES } from '../matches/record';

const UNTRACKED_SETTING = 'volleyreport.live.untracked';

export function lastUntracked(): ScoutCodeString[] {
  try {
    const stored = JSON.parse(localStorage.getItem(UNTRACKED_SETTING) ?? '[]') as unknown;
    return Array.isArray(stored) ? OPTIONAL_CODES.filter((code) => stored.includes(code)) : [];
  } catch {
    return [];
  }
}

export function rememberUntracked(codes: readonly ScoutCodeString[]) {
  try {
    localStorage.setItem(UNTRACKED_SETTING, JSON.stringify(codes));
  } catch {
    // Not kept: every column next time.
  }
}
