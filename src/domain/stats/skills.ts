// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Per-skill statistics with DataVolley semantics (manual §2.3.4 and §9.7.1).
 *
 * All rates are fractions (efficiency in [-1, 1]) and are 0 when the skill was
 * never performed. Which evaluations count as positive, negative, won or lost
 * comes from the evaluation tables (DataVolley defaults unless configured).
 */

import type { Skill } from '../codes';
import type { ScoutEvent } from '../model';
import { type EvaluationTables, DATAVOLLEY_TABLES } from '../tables';
import { type EvaluationCounts, type EvaluationRatios, countEvaluations, distribution, ratio, sumCounts } from './counts';

export interface SkillStats {
  readonly skill: Skill;
  readonly counts: EvaluationCounts;
  readonly total: number;
  /** Share of each evaluation over the total. */
  readonly distribution: EvaluationRatios;
  /** DataVolley "*E%": (positive − negative) / total, per the efficiency table. */
  readonly efficiency: number;
  /** DataVolley "Ind.": weighted mean of the evaluations, per the index table. */
  readonly index: number;
  /** Rallies won by this skill (point-effects table). */
  readonly won: number;
  /** Rallies lost by this skill (point-effects table). */
  readonly lost: number;
}

export interface ServeStats extends SkillStats {
  /** B#: aces */
  readonly points: number;
  /** B= */
  readonly errors: number;
}

export interface ReceptionStats extends SkillStats {
  /** (R# + R+) / total — "Pos%" of the scoresheet */
  readonly positivity: number;
  /** R# / total — "Prf%" of the scoresheet */
  readonly perfectRate: number;
  /** R=: aces conceded */
  readonly errors: number;
}

export interface AttackStats extends SkillStats {
  /** A#: kills */
  readonly points: number;
  /** A= */
  readonly errors: number;
  /** A/: attacks blocked by the opponent ("Mur") */
  readonly blocked: number;
  /** A# / total — "Pt%" of the scoresheet */
  readonly pointRate: number;
}

export interface BlockStats extends SkillStats {
  /** M#: block points */
  readonly points: number;
  /** M= */
  readonly errors: number;
  /** M/: net touches */
  readonly invasions: number;
}

export type FreeBallStats = SkillStats;

export interface SettingStats extends SkillStats {
  /** P= */
  readonly errors: number;
}

export function calculateSkillStats(
  events: readonly ScoutEvent[],
  skill: Skill,
  tables: EvaluationTables = DATAVOLLEY_TABLES,
): SkillStats {
  const counts = countEvaluations(events, skill);
  const total = sumCounts(counts);
  const { positive, negative } = tables.efficiency[skill];
  const { weights, factor } = tables.index[skill];
  const { won, lost } = tables.pointEffects[skill];
  const weighted = Object.entries(weights).reduce((sum, [e, w]) => sum + counts[e as keyof EvaluationCounts] * w, 0);
  return {
    skill,
    counts,
    total,
    distribution: distribution(counts),
    efficiency: ratio(sumCounts(counts, positive) - sumCounts(counts, negative), total),
    index: ratio(weighted, total) * factor,
    won: sumCounts(counts, won),
    lost: sumCounts(counts, lost),
  };
}

export function calculateServeStats(events: readonly ScoutEvent[], tables?: EvaluationTables): ServeStats {
  const base = calculateSkillStats(events, 'B', tables);
  return { ...base, points: base.counts['#'], errors: base.counts['='] };
}

export function calculateReceptionStats(events: readonly ScoutEvent[], tables?: EvaluationTables): ReceptionStats {
  const base = calculateSkillStats(events, 'R', tables);
  return {
    ...base,
    positivity: ratio(base.counts['#'] + base.counts['+'], base.total),
    perfectRate: ratio(base.counts['#'], base.total),
    errors: base.counts['='],
  };
}

export function calculateAttackStats(events: readonly ScoutEvent[], tables?: EvaluationTables): AttackStats {
  const base = calculateSkillStats(events, 'A', tables);
  return {
    ...base,
    points: base.counts['#'],
    errors: base.counts['='],
    blocked: base.counts['/'],
    pointRate: ratio(base.counts['#'], base.total),
  };
}

export function calculateBlockStats(events: readonly ScoutEvent[], tables?: EvaluationTables): BlockStats {
  const base = calculateSkillStats(events, 'M', tables);
  return { ...base, points: base.counts['#'], errors: base.counts['='], invasions: base.counts['/'] };
}

export function calculateSettingStats(events: readonly ScoutEvent[], tables?: EvaluationTables): SettingStats {
  const base = calculateSkillStats(events, 'P', tables);
  return { ...base, errors: base.counts['='] };
}

export function calculateFreeBallStats(events: readonly ScoutEvent[], tables?: EvaluationTables): FreeBallStats {
  return calculateSkillStats(events, 'F', tables);
}
