// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The reception of who only received: they cannot score, so it is their measure instead of points won and lost. */
import type { EvaluationCounts } from '../domain/stats/counts';
import { scoresPoints } from '../report/chart-data';
import type { SquadRow } from './squad-history';

export interface ReceiverLine {
  readonly id: string;
  readonly label: string;
  readonly receptions: number;
  /** Perfect receptions (#). */
  readonly perfect: number;
  /** # and + over the receptions. */
  readonly positivity: number;
  /** # minus = over the receptions. */
  readonly efficiency: number;
  /** Aces conceded (=). */
  readonly aces: number;
  /** The receptions by evaluation. */
  readonly counts: EvaluationCounts;
}

/** The rows that received but cannot score, best reception first. */
export function receiverLines(rows: readonly SquadRow[]): ReceiverLine[] {
  return rows
    .filter((r) => !scoresPoints(r.totals.stats) && r.totals.stats.reception.total > 0)
    .map((r) => {
      const { reception } = r.totals.stats;
      return {
        id: r.id,
        label: r.label || `n. ${r.numbers.join(', ')}`,
        receptions: reception.total,
        perfect: reception.counts['#'],
        positivity: reception.positivity,
        efficiency: (reception.counts['#'] - reception.counts['=']) / reception.total,
        aces: reception.errors,
        counts: reception.counts,
      };
    })
    .sort((a, b) => b.positivity - a.positivity);
}
