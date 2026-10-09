// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Small builders to write matches by hand, in tests or when entering codes manually. */

import type { Match, MatchSet, ScoutLine, SetNumber, SetScore, Team } from './model';

let lineCounter = 0;

export function line(playerNumber: number | null, codes: string): ScoutLine {
  lineCounter += 1;
  return { id: `L${lineCounter}`, playerNumber, cells: codes.trim() === '' ? [] : codes.trim().split(/\s+/) };
}

export function set(number: SetNumber, score: SetScore | null, lines: ScoutLine[]): MatchSet {
  return { number, score, lines };
}

export function team(players: [number, string][]): Team {
  return { id: 'team', name: 'Squadra', players: players.map(([number, name]) => ({ id: `p${number}`, number, name })) };
}

export function match(t: Team, sets: MatchSet[]): Match {
  return { id: 'm', competition: 'test', date: '2026-01-01', venue: 'palestra', team: t, opponentName: 'Avversari', sets };
}
