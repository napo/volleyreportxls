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

const byDate = (a: AthleteMatch, b: AthleteMatch) =>
  a.record.date.localeCompare(b.record.date) || a.record.createdAt.localeCompare(b.record.createdAt);

/** The matches of every linked athlete, oldest first; the statistics of each match are computed once. */
export function matchesByAthlete(records: readonly MatchRecord[]): Map<string, AthleteMatch[]> {
  const byAthlete = new Map<string, AthleteMatch[]>();
  for (const record of records) {
    const linked = record.players.filter((p) => p.athleteId);
    if (!linked.length) continue;
    const stats = calculateMatchStats(toMatch(record));
    for (const player of linked) {
      const own = stats.players.find((p) => p.player.number === player.number);
      if (!own || !player.athleteId) continue;
      const list = byAthlete.get(player.athleteId) ?? [];
      list.push({
        record,
        number: player.number,
        setsPlayed: own.setsPlayed,
        rating: own.rating.overall,
        stats: own.match,
        line: tabellinoLine(own.match),
        events: filterEvents(stats.events, { playerNumber: player.number }),
      });
      byAthlete.set(player.athleteId, list);
    }
  }
  for (const list of byAthlete.values()) list.sort(byDate);
  return byAthlete;
}

/** The matches of the athlete, oldest first. */
export function athleteMatches(records: readonly MatchRecord[], athleteId: string): AthleteMatch[] {
  return matchesByAthlete(records.filter((r) => r.players.some((p) => p.athleteId === athleteId))).get(athleteId) ?? [];
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
    attackEfficiency: m.stats.attack.total > 0 ? m.stats.attack.efficiency : null,
  }));
}
