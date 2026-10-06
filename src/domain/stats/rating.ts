/**
 * Player rating ("Voto") of the DataVolley scoresheet (manual §9.7.1.1).
 *
 * Each skill gets a vote only when the player performed a sufficient share of
 * the team's touches; the final vote is the mean of the votes obtained.
 * The setter's extra vote (attacks after positive reception while on court)
 * needs rally-level data that the paper sheet does not record, so it is not
 * computed.
 */

import type { Evaluation } from '../codes';
import type { StatLine } from './aggregate';
import { ratio } from './counts';
import type { SkillStats } from './skills';

type RatedSkill = 'serve' | 'reception' | 'attack';

export interface RatingRules {
  /** Votes below this value are raised to it. */
  readonly minimum: number;
  readonly weights: Readonly<Record<RatedSkill, Readonly<Record<Evaluation, number>>>>;
  /** Minimum share of the team's touches needed to be rated in a skill. */
  readonly participation: Readonly<Record<RatedSkill, number>>;
  /** Block vote by block points per set played, best first. */
  readonly block: readonly { readonly pointsPerSet: number; readonly vote: number }[];
}

export const DATAVOLLEY_RATING_RULES: RatingRules = {
  minimum: 5.5,
  weights: {
    serve: { '=': 0, '/': 8, '-': 4, '!': 0, '+': 7, '#': 10 },
    reception: { '=': -3, '/': -3, '-': -1, '!': 0, '+': 7, '#': 10 },
    attack: { '=': 0, '/': 0, '-': 5, '!': 0, '+': 5, '#': 10 },
  },
  participation: { serve: 0.05, reception: 0.12, attack: 0.07 },
  block: [
    { pointsPerSet: 1, vote: 8.5 },
    { pointsPerSet: 0.8, vote: 8 },
    { pointsPerSet: 0.5, vote: 7 },
  ],
};

export interface PlayerRating {
  readonly serve: number | null;
  readonly reception: number | null;
  readonly attack: number | null;
  readonly block: number | null;
  /** Mean of the votes above; null when the player got none. */
  readonly overall: number | null;
}

function skillVote(player: SkillStats, team: SkillStats, skill: RatedSkill, rules: RatingRules): number | null {
  if (player.total === 0 || ratio(player.total, team.total) < rules.participation[skill]) return null;
  const weights = rules.weights[skill];
  const weighted = (Object.keys(weights) as Evaluation[]).reduce((sum, e) => sum + player.counts[e] * weights[e], 0);
  return Math.max(rules.minimum, weighted / player.total);
}

function blockVote(blockPoints: number, setsPlayed: number, rules: RatingRules): number | null {
  if (setsPlayed === 0) return null;
  return rules.block.find((step) => blockPoints >= setsPlayed * step.pointsPerSet)?.vote ?? null;
}

export function calculatePlayerRating(
  player: StatLine,
  team: StatLine,
  setsPlayed: number,
  rules: RatingRules = DATAVOLLEY_RATING_RULES,
): PlayerRating {
  const votes = {
    serve: skillVote(player.serve, team.serve, 'serve', rules),
    reception: skillVote(player.reception, team.reception, 'reception', rules),
    attack: skillVote(player.attack, team.attack, 'attack', rules),
    block: blockVote(player.block.points, setsPlayed, rules),
  };
  const given = Object.values(votes).filter((v): v is number => v !== null);
  return { ...votes, overall: given.length === 0 ? null : given.reduce((a, b) => a + b, 0) / given.length };
}
