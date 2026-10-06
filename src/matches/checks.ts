/**
 * Anomalies of a recorded match, shown to the user before the scoresheet:
 * nothing is corrected automatically, the user decides.
 */

import { calculateMatchStats } from '../domain/stats/aggregate';
import type { SetNumber } from '../domain/model';
import { type MatchRecord, rowIsUsed, setIsPlayed, toMatch } from './record';

export type Anomaly =
  | { readonly kind: 'missing-team' }
  | { readonly kind: 'no-sets' }
  | { readonly kind: 'missing-score'; readonly set: SetNumber }
  | { readonly kind: 'tied-score'; readonly set: SetNumber }
  | { readonly kind: 'missing-number'; readonly set: SetNumber; readonly row: number }
  | { readonly kind: 'points-above-score'; readonly set: SetNumber; readonly won: number; readonly score: number };

export function findAnomalies(record: MatchRecord): Anomaly[] {
  const anomalies: Anomaly[] = [];
  if (!record.teamName.trim()) anomalies.push({ kind: 'missing-team' });
  const played = record.sets.filter(setIsPlayed);
  if (played.length === 0) anomalies.push({ kind: 'no-sets' });

  const stats = calculateMatchStats(toMatch(record));
  for (const set of played) {
    if (!set.score) anomalies.push({ kind: 'missing-score', set: set.number });
    else if (set.score.team === set.score.opponent) anomalies.push({ kind: 'tied-score', set: set.number });
    set.rows.forEach((row, index) => {
      if (rowIsUsed(row) && row.playerNumber === null) anomalies.push({ kind: 'missing-number', set: set.number, row: index + 1 });
    });
    const setStats = stats.sets.find((s) => s.setNumber === set.number);
    if (set.score && setStats?.opponentErrors?.inconsistent) {
      anomalies.push({ kind: 'points-above-score', set: set.number, won: setStats.team.summary.pointsWon, score: set.score.team });
    }
  }
  return anomalies;
}
