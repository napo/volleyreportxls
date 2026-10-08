/** Matches and athletes of the archive, for the athlete pages. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Athlete, type RosterEntry, rosterEntries } from '../athletes/matching';
import type { MatchRecord } from '../matches/record';
import { useArchive } from './archive-context';

export interface AthletesData {
  readonly records: readonly MatchRecord[];
  readonly athletes: readonly Athlete[];
  readonly entries: readonly RosterEntry[];
}

export function useAthletesData() {
  const { archive, error } = useArchive();
  const [data, setData] = useState<{ records: MatchRecord[]; athletes: Athlete[] } | null>(null);

  const reload = useCallback(async () => {
    if (!archive) return;
    const [records, athletes] = await Promise.all([archive.listMatches(), archive.listAthletes()]);
    setData({ records, athletes });
  }, [archive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const full = useMemo<AthletesData | null>(() => (data ? { ...data, entries: rosterEntries(data.records) } : null), [data]);
  return { archive, error, data: full, reload };
}
