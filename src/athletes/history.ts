// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The history of an athlete: the statistics of every match in which a player
 * is linked to the athlete (whatever the shirt number), and the total of the
 * chosen matches. Totals are computed again from the touches, never by adding
 * up percentages.
 */

import type { ScoutEvent, SetNumber } from '../domain/model';
import { type StatLine, calculateMatchStats, calculateStatLine } from '../domain/stats/aggregate';
import { filterEvents } from '../domain/stats/counts';
import { type MatchRecord, toMatch } from '../matches/record';
import type { SetTrendRow } from '../report/chart-data';
import { formatDate } from '../report/format';
import { type TabellinoLine, tabellinoLine } from '../report/tabellino';

export interface AthleteMatch {
  readonly record: MatchRecord;
  /** The shirt number worn in that match. */
  readonly number: number;
  readonly setsPlayed: readonly SetNumber[];
  readonly rating: number | null;
  readonly stats: StatLine;
  readonly line: TabellinoLine;
  readonly events: readonly ScoutEvent[];
}

/** The matches of the athlete, oldest first. */
export function athleteMatches(records: readonly MatchRecord[], athleteId: string): AthleteMatch[] {
  return records
    .flatMap((record) => {
      const player = record.players.find((p) => p.athleteId === athleteId);
      if (!player) return [];
      const stats = calculateMatchStats(toMatch(record));
      const own = stats.players.find((p) => p.player.number === player.number);
      if (!own) return [];
      return [
        {
          record,
          number: player.number,
          setsPlayed: own.setsPlayed,
          rating: own.rating.overall,
          stats: own.match,
          line: tabellinoLine(own.match),
          events: filterEvents(stats.events, { playerNumber: player.number }),
        },
      ];
    })
    .sort((a, b) => a.record.date.localeCompare(b.record.date) || a.record.createdAt.localeCompare(b.record.createdAt));
}

export interface AthleteTotals {
  readonly matches: number;
  readonly sets: number;
  readonly stats: StatLine;
  readonly line: TabellinoLine;
  /** Mean of the ratings of the matches in which the athlete was rated. */
  readonly rating: number | null;
}

export function athleteTotals(matches: readonly AthleteMatch[]): AthleteTotals {
  const stats = calculateStatLine(matches.flatMap((m) => m.events));
  const rated = matches.flatMap((m) => (m.rating === null ? [] : [m.rating]));
  return {
    matches: matches.length,
    sets: matches.reduce((n, m) => n + m.setsPlayed.length, 0),
    stats,
    line: tabellinoLine(stats),
    rating: rated.length ? rated.reduce((a, b) => a + b, 0) / rated.length : null,
  };
}

/** Reception Pos% and attack Pt% match by match (same rows as the set trend). */
export function athleteTrend(matches: readonly AthleteMatch[]): SetTrendRow[] {
  return matches.map((m) => ({
    set: [formatDate(m.record.date), m.record.opponentName].filter(Boolean).join(' '),
    receptionPositivity: m.stats.reception.total > 0 ? m.stats.reception.positivity : null,
    attackPointRate: m.stats.attack.total > 0 ? m.stats.attack.pointRate : null,
  }));
}
