// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * What the card of an athlete shows, on the page and in the PDF: points and
 * errors, the indicators against the team (and the last match), and their
 * trend match by match (or set by set) with the averages of athlete and team.
 */

import type { StatLine } from '../domain/stats/aggregate';
import type { Profile } from './profile';

export interface CardColumn {
  readonly name: string;
  readonly values: Profile;
}

export interface AthleteCardData {
  readonly id: string;
  readonly title: string;
  readonly subtitle: string;
  /** The athlete in the matches (or the match) shown. */
  readonly stats: StatLine;
  readonly own: CardColumn;
  readonly last?: CardColumn;
  readonly team: CardColumn;
  /** One point per match (or per set), oldest first. */
  readonly trend: readonly { readonly label: string; readonly values: Profile }[];
  readonly trendTitle: string;
  /** Heading of the first column of the trend data: match or set. */
  readonly trendColumn: string;
}

/** Points won, points lost (with the aces conceded in reception) and their balance. */
export const keyFigures = (stats: StatLine) => ({
  points: stats.summary.pointsWon,
  errors: stats.summary.pointsLost,
  aces: stats.reception.errors,
  balance: stats.summary.balance,
});
