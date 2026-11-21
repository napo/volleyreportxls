// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * How the match is going, for whoever scouts on the keypad and cannot see the
 * sheet: three team indicators (serve and attack efficiency, reception
 * positivity, as in the charts) for the set and for the match so far, and
 * short facts about single shirt numbers in the set ("#15 conceded 3 aces").
 * Only counts are used: the sheet keeps no order of the touches.
 */
import { EVALUATION_SCALES, type Evaluation, type ScoutCodeString, type Skill } from '../domain/codes';
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

/** How the balls of a skill were evaluated: the counts by evaluation, from the most to the least favourable. */
export interface Shares {
  readonly skill: IndicatorSkill;
  readonly total: number;
  readonly parts: readonly { readonly evaluation: Evaluation; readonly count: number }[];
}

/** The evaluations of serve, reception and attack over these sets, for the stacked bars. */
export const teamShares = (sets: readonly SetRecord[]): Shares[] => {
  const rows = sets.flatMap((s) => s.rows);
  return INDICATOR_SKILLS.map((skill) => {
    const parts = EVALUATION_SCALES[skill].map((evaluation) => ({ evaluation, count: count(rows, skill, [evaluation]) }));
    return { skill, total: parts.reduce((n, p) => n + p.count, 0), parts };
  });
};

/** A shirt number and its balance in the set: points won by its touches minus points lost. */
export interface PlayerForm {
  readonly number: number;
  /** Points scored by the touches of the shirt number in the set (aces, attacks, blocks). */
  readonly points: number;
  /** Errors made (serve, reception, attack, block, set, free ball). */
  readonly errors: number;
  /** Points minus errors, as shown. */
  readonly balance: number;
  /** Points minus ERROR_WEIGHT times the errors: what decides who is positive and who negative. */
  readonly score: number;
}

/**
 * An error costs this many points in the score that ranks the players. The libero hardly
 * ever scores, so for the libero the score is mostly "how few errors"; one error is clearly negative.
 */
export const ERROR_WEIGHT = 3;

/**
 * The performance of the shirt numbers in the set: the two with the best score
 * (points - 3 errors, above zero) and the two with the worst (below zero); who has
 * no points and no errors, or is exactly even, is not listed.
 */
export function setForm(set: SetRecord, limit = 2): { readonly good: PlayerForm[]; readonly bad: PlayerForm[] } {
  const skills = Object.keys(DATAVOLLEY_TABLES.pointEffects) as Skill[];
  const totals = new Map<number, { points: number; errors: number }>();
  for (const row of set.rows) {
    if (row.playerNumber === null) continue;
    const t = totals.get(row.playerNumber) ?? { points: 0, errors: 0 };
    for (const skill of skills) {
      const { won, lost } = DATAVOLLEY_TABLES.pointEffects[skill];
      t.points += count([row], skill, won);
      t.errors += count([row], skill, lost);
    }
    totals.set(row.playerNumber, t);
  }
  const all: PlayerForm[] = [...totals].map(([number, t]) => ({ number, ...t, balance: t.points - t.errors, score: t.points - ERROR_WEIGHT * t.errors }));
  return {
    good: all.filter((p) => p.score > 0).sort((a, b) => b.score - a.score || b.balance - a.balance || a.number - b.number).slice(0, limit),
    bad: all.filter((p) => p.score < 0).sort((a, b) => a.score - b.score || a.balance - b.balance || a.number - b.number).slice(0, limit),
  };
}

/** Points won and points lost by our own touches, each with the skills they came from (most frequent first). */
export interface Tally {
  readonly points: number;
  readonly errors: number;
  readonly pointsBy: readonly { readonly skill: Skill; readonly count: number }[];
  readonly errorsBy: readonly { readonly skill: Skill; readonly count: number }[];
}

/** Points scored (ace, attack, block) and errors (serve, reception, attack, block, set, free ball) of the set. */
export function setTally(set: SetRecord): Tally {
  const by = (kind: 'won' | 'lost') =>
    (Object.keys(DATAVOLLEY_TABLES.pointEffects) as Skill[])
      .map((skill) => ({ skill, count: count(set.rows, skill, DATAVOLLEY_TABLES.pointEffects[skill][kind]) }))
      .filter((x) => x.count > 0)
      .sort((a, b) => b.count - a.count);
  const pointsBy = by('won');
  const errorsBy = by('lost');
  const sum = (xs: readonly { count: number }[]) => xs.reduce((n, x) => n + x.count, 0);
  return { points: sum(pointsBy), errors: sum(errorsBy), pointsBy, errorsBy };
}
