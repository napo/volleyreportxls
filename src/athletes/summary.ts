// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * What the statistics say at a glance: the indicators of the team with their
 * direction (in a history the last matches against all the chosen ones, in
 * a match the last set against the whole match), and where each athlete
 * stands against the team.
 */

import { type MatchStats, calculateMatchStats, calculateStatLine } from '../domain/stats/aggregate';
import { type MatchRecord, toMatch } from '../matches/record';
import { type Profile, type ProfileAxis, PROFILE_AXES, profileOf } from './profile';
import { FEW_TOUCHES } from './squad-history';

/** The last matches compared with all the chosen ones. */
export const RECENT_MATCHES = 3;
/** A change smaller than this (3 percentage points) is no change. */
export const STEADY = 0.03;
/** For the balance: points per match. */
export const STEADY_BALANCE = 2;

export type Direction = 'up' | 'down' | 'steady';

export interface TeamSummary {
  /** What is compared: matches (a history) or sets (a match). */
  readonly unit: 'match' | 'set';
  readonly values: Profile;
  /** The last RECENT_MATCHES matches, or the last set; null when there is nothing before them to compare with. */
  readonly recent: Profile | null;
  /** Points won minus lost: in all, per match (or set), per match in the last matches (or in the last set). */
  readonly balance: { readonly total: number; readonly perUnit: number; readonly recentPerUnit: number | null };
}

/** The team in the chosen matches (oldest first). */
export function teamSummary(records: readonly MatchRecord[]): TeamSummary {
  const stats = records.map((r) => calculateMatchStats(toMatch(r)));
  const line = (from: number) => calculateStatLine(stats.slice(from).flatMap((s) => s.events));
  const all = line(0);
  const recent = records.length > RECENT_MATCHES ? line(records.length - RECENT_MATCHES) : null;
  return {
    unit: 'match',
    values: profileOf(all),
    recent: recent && profileOf(recent),
    balance: {
      total: all.summary.balance,
      perUnit: records.length ? all.summary.balance / records.length : 0,
      recentPerUnit: recent && recent.summary.balance / RECENT_MATCHES,
    },
  };
}

/** The team in a match: the last set against the whole match (with two sets played or more). */
export function matchSummary(stats: MatchStats): TeamSummary {
  const team = stats.team.match;
  const last = stats.sets.length > 1 ? stats.sets.at(-1)!.team : null;
  return {
    unit: 'set',
    values: profileOf(team),
    recent: last && profileOf(last),
    balance: {
      total: team.summary.balance,
      perUnit: stats.sets.length ? team.summary.balance / stats.sets.length : 0,
      recentPerUnit: last && last.summary.balance,
    },
  };
}

/** Up, down or steady from `from` to `to`; null when one is missing. */
export function direction(from: number | null, to: number | null, steady = STEADY): Direction | null {
  if (from === null || to === null) return null;
  return to - from >= steady ? 'up' : from - to >= steady ? 'down' : 'steady';
}

export type Standing = 'above' | 'level' | 'below';

/** Where the athlete stands against the team in an indicator; null on too few touches. */
export function standing(own: number | null, team: number | null, touches: number): Standing | null {
  if (own === null || team === null || touches < FEW_TOUCHES) return null;
  return own - team >= STEADY ? 'above' : team - own >= STEADY ? 'below' : 'level';
}

export const INDICATORS: readonly ProfileAxis[] = PROFILE_AXES.map((a) => a.id);
