// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * How the match is going, for whoever scouts on the keypad and cannot see the
 * sheet: three team indicators (serve and attack efficiency, reception
 * positivity, as in the charts) for the set and for the match so far, and
 * short facts about single shirt numbers in the set ("#15 conceded 3 aces").
 * Only counts are used: the sheet keeps no order of the touches.
 */
import type { Evaluation, ScoutCodeString, Skill } from '../domain/codes';
import { DATAVOLLEY_TABLES } from '../domain/tables';
import type { MatchRecord, SetRecord } from './record';

export type IndicatorSkill = 'B' | 'R' | 'A';

export interface Indicator {
  readonly skill: IndicatorSkill;
  /** Efficiency (serve, attack, in [-1, 1]) or positivity (reception, in [0, 1]). */
  readonly kind: 'efficiency' | 'positivity';
  /** Null when the skill was never performed. */
  readonly value: number | null;
  /** Balls played with this skill. */
  readonly total: number;
}

const count = (rows: SetRecord['rows'], skill: Skill, evaluations: readonly Evaluation[]) =>
  rows.reduce((n, row) => n + evaluations.reduce((k, e) => k + (row.counts[`${skill}${e}` as ScoutCodeString] ?? 0), 0), 0);

const ALL: readonly Evaluation[] = ['#', '+', '!', '-', '/', '='];

function indicator(rows: SetRecord['rows'], skill: IndicatorSkill): Indicator {
  const total = count(rows, skill, ALL);
  if (skill === 'R') return { skill, kind: 'positivity', value: total ? count(rows, 'R', ['#', '+']) / total : null, total };
  const { positive, negative } = DATAVOLLEY_TABLES.efficiency[skill];
  return { skill, kind: 'efficiency', value: total ? (count(rows, skill, positive) - count(rows, skill, negative)) / total : null, total };
}

export const INDICATOR_SKILLS: readonly IndicatorSkill[] = ['B', 'R', 'A'];

/** How an indicator is going: the colour of its bar. Too few balls: no judgement. */
export type Level = 'good' | 'fair' | 'poor' | 'unknown';

/**
 * Where green ends and orange starts, and where orange gives way to red
 * (project choice, to tune on real matches). Serve efficiency follows the
 * DataVolley defaults: every serve but "-" and "=" counts as positive.
 */
export const SITUATION_THRESHOLDS: Readonly<Record<IndicatorSkill, { readonly good: number; readonly fair: number }>> = {
  B: { good: 0.55, fair: 0.4 },
  R: { good: 0.5, fair: 0.35 },
  A: { good: 0.25, fair: 0.1 },
};

/** Fewer balls than this tell nothing yet. */
export const SITUATION_MIN_BALLS = 3;

export function levelOf(indicator: Indicator): Level {
  if (indicator.value === null || indicator.total < SITUATION_MIN_BALLS) return 'unknown';
  const { good, fair } = SITUATION_THRESHOLDS[indicator.skill];
  return indicator.value >= good ? 'good' : indicator.value >= fair ? 'fair' : 'poor';
}

/** The three indicators over these sets. */
export const teamIndicators = (sets: readonly SetRecord[]): Indicator[] => {
  const rows = sets.flatMap((s) => s.rows);
  return INDICATOR_SKILLS.map((skill) => indicator(rows, skill));
};

/** The sets up to this one (the match so far). */
export const setsUpTo = (record: MatchRecord, set: number) => record.sets.filter((s) => s.number <= set);

/** A fact about a shirt number: what happened, and how many times. */
export type FactKind = 'serveErrors' | 'acesConceded' | 'attackErrors' | 'blocked' | 'aces' | 'kills' | 'blocks';

export interface Fact {
  readonly number: number;
  readonly kind: FactKind;
  readonly count: number;
  /** Bad news first: they call for a decision. */
  readonly negative: boolean;
}

const FACTS: readonly { readonly kind: FactKind; readonly code: ScoutCodeString; readonly negative: boolean }[] = [
  { kind: 'acesConceded', code: 'R=' as ScoutCodeString, negative: true },
  { kind: 'attackErrors', code: 'A=' as ScoutCodeString, negative: true },
  { kind: 'serveErrors', code: 'B=' as ScoutCodeString, negative: true },
  { kind: 'blocked', code: 'A/' as ScoutCodeString, negative: true },
  { kind: 'aces', code: 'B#' as ScoutCodeString, negative: false },
  { kind: 'kills', code: 'A#' as ScoutCodeString, negative: false },
  { kind: 'blocks', code: 'M#' as ScoutCodeString, negative: false },
];

/** From how many times a fact is worth telling: one error is a ball, two start to say something. */
export const FACT_THRESHOLD = 2;

/**
 * The facts of the set, bad news first, then by count; at most `limit`, so
 * that they can be read between two rallies.
 */
export function setFacts(set: SetRecord, limit = 4): Fact[] {
  const byNumber = new Map<number, Record<string, number>>();
  for (const row of set.rows) {
    if (row.playerNumber === null) continue;
    const counts = byNumber.get(row.playerNumber) ?? {};
    for (const [code, n] of Object.entries(row.counts)) counts[code] = (counts[code] ?? 0) + (n ?? 0);
    byNumber.set(row.playerNumber, counts);
  }
  const facts: Fact[] = [];
  for (const [number, counts] of byNumber) {
    for (const f of FACTS) {
      const n = counts[f.code] ?? 0;
      if (n >= FACT_THRESHOLD) facts.push({ number, kind: f.kind, count: n, negative: f.negative });
    }
  }
  return facts.sort((a, b) => Number(b.negative) - Number(a.negative) || b.count - a.count || a.number - b.number).slice(0, limit);
}
