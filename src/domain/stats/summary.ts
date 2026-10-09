// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Skill } from '../codes';
import type { SkillStats } from './skills';

/**
 * Skills whose lost points enter the "V-P" balance. DataVolley (manual §9.7.1)
 * counts points lost "in battuta, ricezione e attacco"; by project decision the
 * block is included too, so that M= and M/ weigh on the balance.
 */
export const BALANCE_LOST_SKILLS = ['B', 'R', 'A', 'M'] as const satisfies readonly Skill[];

export interface PointsSummary {
  /** Points won by our skills (B# + A# + M# with the default tables). */
  readonly pointsWon: number;
  /** Points lost in serve, reception, attack and block (B=, R= R/, A= A/, M= M/ with the default tables). */
  readonly pointsLost: number;
  /** "V-P" (vinti − persi) */
  readonly balance: number;
  /** Points lost by each skill, according to the point-effects table. */
  readonly lostBySkill: Readonly<Record<Skill, number>>;
}

export function calculatePointsSummary(stats: Readonly<Record<Skill, SkillStats>>): PointsSummary {
  const skills = Object.values(stats);
  const pointsWon = skills.reduce((sum, s) => sum + s.won, 0);
  const pointsLost = BALANCE_LOST_SKILLS.reduce((sum, skill) => sum + stats[skill].lost, 0);
  const lostBySkill = Object.fromEntries(skills.map((s) => [s.skill, s.lost])) as Record<Skill, number>;
  return { pointsWon, pointsLost, balance: pointsWon - pointsLost, lostBySkill };
}
