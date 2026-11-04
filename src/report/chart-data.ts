// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Data series for the charts, derived from the domain statistics. Pure
 * functions: no chart library here, so they are testable and the same data
 * feeds both the charts and their table views.
 */

import { EVALUATIONS, type Evaluation, type Skill, SKILL_DEFINITIONS } from '../domain/codes';
import type { MatchStats, StatLine } from '../domain/stats/aggregate';
import type { SkillStats } from '../domain/stats/skills';
import { playerLabel } from './format';

/** In the order of the form: serve, block, attack, reception, set faults. */
const SKILL_FIELDS = [
  ['B', 'serve'],
  ['M', 'block'],
  ['A', 'attack'],
  ['R', 'reception'],
  ['P', 'setting'],
  ['F', 'freeBall'],
] as const satisfies readonly (readonly [Skill, keyof StatLine])[];

/** Names shown in the charts, in the user's language. */
export interface ChartNames {
  readonly skills: Readonly<Record<Skill, string>>;
  readonly opponentErrors: string;
}

/** Italian names, from the vocabulary. */
export const ITALIAN_CHART_NAMES: ChartNames = {
  skills: Object.fromEntries(Object.entries(SKILL_DEFINITIONS).map(([k, d]) => [k, d.label])) as Record<Skill, string>,
  opponentErrors: 'Errori avversari',
};

function skillStats(line: StatLine, names: ChartNames = ITALIAN_CHART_NAMES): (SkillStats & { label: string })[] {
  return SKILL_FIELDS.map(([skill, field]) => ({ ...(line[field] as SkillStats), label: names.skills[skill] }));
}

export interface EvaluationShareRow {
  readonly skill: Skill;
  readonly label: string;
  readonly total: number;
  readonly counts: Readonly<Record<Evaluation, number>>;
  /** Share of each evaluation, 0–1. */
  readonly shares: Readonly<Record<Evaluation, number>>;
}

/** How the touches of each skill were evaluated; skills never performed are left out. */
export function evaluationShares(line: StatLine, names?: ChartNames): EvaluationShareRow[] {
  return skillStats(line, names)
    .filter((s) => s.total > 0)
    .map((s) => ({ skill: s.skill, label: s.label, total: s.total, counts: s.counts, shares: s.distribution }));
}

export interface PointsBySkillRow {
  readonly label: string;
  readonly won: number;
  readonly lost: number;
}

/** Points won and lost by each skill (point-effects table), plus the opponent errors when given. */
export function pointsBySkill(line: StatLine, opponentErrors?: number, names: ChartNames = ITALIAN_CHART_NAMES): PointsBySkillRow[] {
  const rows = skillStats(line, names)
    .map((s) => ({ label: s.label, won: s.won, lost: s.lost }))
    .filter((r) => r.won > 0 || r.lost > 0);
  return opponentErrors === undefined ? rows : [...rows, { label: names.opponentErrors, won: opponentErrors, lost: 0 }];
}

/**
 * One point of a trend (a set, or a match): positivity of serve, positivity
 * and efficiency of reception and attack. Null where the skill was not played.
 * Positivity follows the DataVolley tables (for the attack the only positive
 * touch is the kill); efficiency is DataVolley's classic one, winning minus
 * losing touches.
 */
export interface SetTrendRow {
  readonly set: string;
  /** Serves #, +, ! and / over all serves. */
  readonly servePositivity: number | null;
  /** Receptions # and + over all receptions. */
  readonly receptionPositivity: number | null;
  /** Receptions # minus = over all receptions. */
  readonly receptionEfficiency: number | null;
  /** Kills (#) over all attacks. */
  readonly attackPositivity: number | null;
  /** Kills minus blocked and errors, over the attacks (it can be negative). */
  readonly attackEfficiency: number | null;
}

/** The indicators of a trend, in the order of the action: serve, reception, attack. */
export const TREND_KEYS = ['servePositivity', 'receptionPositivity', 'receptionEfficiency', 'attackPositivity', 'attackEfficiency'] as const;

export function trendRow(label: string, line: StatLine): SetTrendRow {
  const share = (total: number, value: number) => (total > 0 ? value : null);
  const { serve, reception, attack } = line;
  return {
    set: label,
    servePositivity: share(serve.total, serve.efficiency),
    receptionPositivity: share(reception.total, reception.positivity),
    receptionEfficiency: share(reception.total, (reception.counts['#'] - reception.counts['=']) / reception.total),
    attackPositivity: share(attack.total, attack.pointRate),
    attackEfficiency: share(attack.total, attack.efficiency),
  };
}

export function setTrend(stats: MatchStats): SetTrendRow[] {
  return stats.sets.map((set) => trendRow(`Set ${set.setNumber}`, set.team));
}

export interface PlayerPointsRow {
  readonly playerId: string;
  readonly label: string;
  readonly won: number;
  readonly lost: number;
}

/**
 * Whether the touches can win points: some serve, attack or block. Who only
 * received (usually the libero) can lose points but never win one, so points
 * won and lost say nothing about them.
 */
export const scoresPoints = (line: StatLine) => line.serve.total + line.attack.total + line.block.total > 0;

/** Points won and lost (the V-P components) of the given players, in the given order; not those who cannot score. */
export function playerPoints(stats: MatchStats, playerIds: readonly string[]): PlayerPointsRow[] {
  return playerIds.flatMap((id) => {
    const p = stats.players.find((x) => x.player.id === id);
    return p && scoresPoints(p.match)
      ? [{ playerId: id, label: playerLabel(p.player), won: p.match.summary.pointsWon, lost: p.match.summary.pointsLost }]
      : [];
  });
}

/** Players with at least one recorded touch, most involved first. */
export function activePlayers(stats: MatchStats) {
  const touches = (line: StatLine) => skillStats(line).reduce((n, s) => n + s.total, 0);
  return stats.players
    .map((p) => ({ player: p.player, touches: touches(p.match) }))
    .filter((p) => p.touches > 0)
    .sort((a, b) => b.touches - a.touches);
}

export { EVALUATIONS };
