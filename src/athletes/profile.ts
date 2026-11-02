// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The profile of an athlete: a few indicators, all "higher is better", to
 * compare the last match with the athlete's own total and with the team.
 * Every indicator is a ratio of touches, so the team value is
 * comparable with the athlete's: the team reception counts only who received.
 * Scales are fixed, so the shape does not change when a match is added.
 * The vote is left out: it is a mean of votes on these same touches.
 */

import { type StatLine, calculateMatchStats, calculateStatLine } from '../domain/stats/aggregate';
import { type MatchRecord, toMatch } from '../matches/record';
import { FEW_TOUCHES } from './squad-history';

export const PROFILE_AXES = [
  /** Battuta E% (DataVolley efficiency). */
  { id: 'serve', min: -0.4, max: 0.4 },
  /** Ricezione Pos%. */
  { id: 'reception', min: 0, max: 1 },
  /** Attacco E%. */
  { id: 'attack', min: -0.2, max: 0.6 },
  /** Muro E%. */
  { id: 'block', min: -0.5, max: 0.5 },
] as const;

export type ProfileAxis = (typeof PROFILE_AXES)[number]['id'];
export type Profile = Readonly<Record<ProfileAxis, number | null>>;

/** The indicators of a stat line; null where there are no touches. */
export function profileOf(stats: StatLine): Profile {
  const rate = (total: number, value: number) => (total > 0 ? value : null);
  return {
    serve: rate(stats.serve.total, stats.serve.efficiency),
    reception: rate(stats.reception.total, stats.reception.positivity),
    attack: rate(stats.attack.total, stats.attack.efficiency),
    block: rate(stats.block.total, stats.block.efficiency),
  };
}

/** The indicators that say something for the athlete: enough touches in the matches put together. */
export function meaningfulAxes(stats: StatLine): ProfileAxis[] {
  const touches: Record<ProfileAxis, number> = {
    serve: stats.serve.total,
    reception: stats.reception.total,
    attack: stats.attack.total,
    block: stats.block.total,
  };
  return PROFILE_AXES.map((a) => a.id).filter((id) => touches[id] >= FEW_TOUCHES);
}

/** The team in the matches: all its touches together. */
export function teamProfile(records: readonly MatchRecord[]): Profile {
  return profileOf(calculateStatLine(records.flatMap((r) => calculateMatchStats(toMatch(r)).events)));
}

/** Where a value falls on the fixed scale of its axis, from 0 to 1 (values outside are held at the edge). */
export function onScale(axis: ProfileAxis, value: number): number {
  const { min, max } = PROFILE_AXES.find((a) => a.id === axis)!;
  return Math.min(1, Math.max(0, (value - min) / (max - min)));
}
