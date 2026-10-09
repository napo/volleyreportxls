// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Statistics and scoresheet of the match a view shows: a saved match, or the example. */
import { useEffect, useState } from 'react';
import { calculateMatchStats } from '../domain/stats/aggregate';
import type { MatchStats } from '../domain/stats/aggregate';
import type { Match } from '../domain/model';
import { type Anomaly, findAnomalies } from '../matches/checks';
import { toMatch } from '../matches/record';
import { type Tabellino, buildTabellino } from '../report/tabellino';
import { SAMPLE_MATCH } from '../demo/sample-match';
import { useArchive } from './archive-context';
import { SAMPLE_ID } from './routes';

export interface MatchReport {
  /** Id of the saved match; null for the example. */
  readonly recordId: string | null;
  readonly match: Match;
  readonly stats: MatchStats;
  readonly tabellino: Tabellino;
  readonly anomalies: readonly Anomaly[];
}

export function reportOf(match: Match, recordId: string | null, anomalies: readonly Anomaly[] = []): MatchReport {
  const stats = calculateMatchStats(match);
  return { recordId, match, stats, tabellino: buildTabellino(match, stats), anomalies };
}

export const SAMPLE_REPORT = reportOf(SAMPLE_MATCH, null);

export function useMatchReport(param: string | null): { readonly report: MatchReport | null; readonly missing: boolean } {
  const { archive } = useArchive();
  const sample = !param || param === SAMPLE_ID;
  const [state, setState] = useState<{ report: MatchReport | null; missing: boolean }>({ report: sample ? SAMPLE_REPORT : null, missing: false });

  useEffect(() => {
    if (sample) {
      setState({ report: SAMPLE_REPORT, missing: false });
      return;
    }
    if (!archive) return;
    let active = true;
    archive.getMatch(param).then((record) => {
      if (!active) return;
      setState(record ? { report: reportOf(toMatch(record), record.id, findAnomalies(record)), missing: false } : { report: null, missing: true });
    });
    return () => {
      active = false;
    };
  }, [archive, param, sample]);

  return state;
}
