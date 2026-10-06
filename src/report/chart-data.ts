/**
 * Data series for the charts, derived from the domain statistics. Pure
 * functions: no chart library here, so they are testable and the same data
 * feeds both the charts and their table views.
 */

import { EVALUATIONS, type Evaluation, type Skill, SKILL_DEFINITIONS } from '../domain/codes';
import type { MatchStats, StatLine } from '../domain/stats/aggregate';
import type { SkillStats } from '../domain/stats/skills';
import { playerLabel } from './format';

const SKILL_FIELDS = [
  ['B', 'serve'],
  ['R', 'reception'],
  ['A', 'attack'],
  ['M', 'block'],
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

export interface SetTrendRow {
  readonly set: string;
  /** Reception Pos% (# + +), null when no reception. */
  readonly receptionPositivity: number | null;
  /** Attack Pt% (#), null when no attack. */
  readonly attackPointRate: number | null;
}

export function setTrend(stats: MatchStats): SetTrendRow[] {
  return stats.sets.map((set) => ({
    set: `Set ${set.setNumber}`,
    receptionPositivity: set.team.reception.total > 0 ? set.team.reception.positivity : null,
    attackPointRate: set.team.attack.total > 0 ? set.team.attack.pointRate : null,
  }));
}

export interface PlayerPointsRow {
  readonly playerId: string;
  readonly label: string;
  readonly won: number;
  readonly lost: number;
}

/** Points won and lost (the V-P components) of the given players, in the given order. */
export function playerPoints(stats: MatchStats, playerIds: readonly string[]): PlayerPointsRow[] {
  return playerIds.flatMap((id) => {
    const p = stats.players.find((x) => x.player.id === id);
    return p
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
