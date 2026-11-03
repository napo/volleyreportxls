// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The indicators of an athlete, all "higher is better": positivity and
 * efficiency of serve and reception, efficiency of attack and block.
 * Positivity is the default of the DataVolley tables (system of the Italian
 * national team); efficiency is DataVolley's "classic" one, winning minus
 * losing touches over all of them (manual §2.3.4.4): # − = for the serve,
 * and for the reception # − =, as the manual suggests. They compare the athlete
 * with the team (and with the last match), and follow the athlete match by
 * match. Every indicator is a ratio of touches, so the team value is
 * comparable with the athlete's: the team reception counts only who received.
 * The ranges below are those of the charts, fixed so that a chart does not
 * change scale when a match is added.
 */

import { type StatLine, calculateMatchStats, calculateStatLine } from '../domain/stats/aggregate';
import { type MatchRecord, toMatch } from '../matches/record';
import { FEW_TOUCHES } from './squad-history';

export const PROFILE_AXES = [
  /** Serve positivity: the share of positive serves (#, +, ! and /), as the evaluation tables count serve efficiency. */
  { id: 'serve', skill: 'serve', min: 0, max: 1 },
  /** Serve efficiency: (# − =) / total. */
  { id: 'serveEfficiency', skill: 'serve', min: -0.3, max: 0.3 },
  /** Reception positivity. */
  { id: 'reception', skill: 'reception', min: 0, max: 1 },
  /** Reception efficiency: (# − =) / total. */
  { id: 'receptionEfficiency', skill: 'reception', min: -0.2, max: 0.6 },
  /** Attack efficiency. */
  { id: 'attack', skill: 'attack', min: -0.2, max: 0.6 },
  /** Block efficiency. */
  { id: 'block', skill: 'block', min: -0.5, max: 0.5 },
] as const;

export type ProfileAxis = (typeof PROFILE_AXES)[number]['id'];
export type Profile = Readonly<Record<ProfileAxis, number | null>>;

/** The indicators of a stat line; null where there are no touches. */
export function profileOf(stats: StatLine): Profile {
  const rate = (total: number, value: number) => (total > 0 ? value : null);
  const classic = (s: { total: number; counts: Readonly<Record<string, number>> }) => rate(s.total, (s.counts['#']! - s.counts['=']!) / s.total);
  return {
    serveEfficiency: classic(stats.serve),
    receptionEfficiency: classic(stats.reception),
    // For the serve the tables count only positive evaluations: this is a share, from 0 to 1.
    serve: rate(stats.serve.total, stats.serve.efficiency),
    reception: rate(stats.reception.total, stats.reception.positivity),
    attack: rate(stats.attack.total, stats.attack.efficiency),
    block: rate(stats.block.total, stats.block.efficiency),
  };
}

/** Touches of the skill of an indicator. */
export const touchesOf = (stats: StatLine, axis: ProfileAxis): number => stats[PROFILE_AXES.find((a) => a.id === axis)!.skill].total;

/** The indicators of the skills the athlete played at all. */
export const playedAxes = (stats: StatLine): ProfileAxis[] => PROFILE_AXES.map((a) => a.id).filter((id) => touchesOf(stats, id) > 0);

/** The indicators that say something for the athlete: enough touches in the matches put together. */
export const meaningfulAxes = (stats: StatLine): ProfileAxis[] => PROFILE_AXES.map((a) => a.id).filter((id) => touchesOf(stats, id) >= FEW_TOUCHES);

/** The team in the matches: all its touches together. */
export function teamProfile(records: readonly MatchRecord[]): Profile {
  return profileOf(calculateStatLine(records.flatMap((r) => calculateMatchStats(toMatch(r)).events)));
}

/** The range of the chart of an indicator: its usual range, widened to hold every value. */
export function rangeOf(axis: ProfileAxis, values: readonly (number | null)[]): { min: number; max: number } {
  const { min, max } = PROFILE_AXES.find((a) => a.id === axis)!;
  const given = values.filter((v): v is number => v !== null);
  return { min: Math.floor(Math.min(min, ...given) * 10) / 10, max: Math.ceil(Math.max(max, ...given) * 10) / 10 };
}
