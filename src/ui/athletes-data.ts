// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Matches, athletes and squads of the archive, for the history pages. */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { type Athlete, type RosterEntry, rosterEntries } from '../athletes/matching';
import { type Squad, type SquadView, squadsOf } from '../athletes/squads';
import type { MatchRecord } from '../matches/record';
import { useArchive } from './archive-context';

export interface AthletesData {
  readonly records: readonly MatchRecord[];
  readonly athletes: readonly Athlete[];
  readonly entries: readonly RosterEntry[];
  readonly stored: readonly Squad[];
  readonly squads: readonly SquadView[];
}

export function useAthletesData() {
  const { archive, error } = useArchive();
  const [data, setData] = useState<{ records: MatchRecord[]; athletes: Athlete[]; stored: Squad[] } | null>(null);

  const reload = useCallback(async () => {
    if (!archive) return;
    const [records, athletes, stored] = await Promise.all([archive.listMatches(), archive.listAthletes(), archive.listSquads()]);
    setData({ records, athletes, stored });
  }, [archive]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const full = useMemo<AthletesData | null>(
    () => (data ? { ...data, entries: rosterEntries(data.records), squads: squadsOf(data.records, data.stored) } : null),
    [data],
  );
  return { archive, error, data: full, reload };
}

// The squad the user looked at last (a per-viewer convenience: storage may be unavailable).
const SQUAD_KEY = 'volleyreport.squad';

export function readLastSquad(): string | null {
  try {
    return window.localStorage.getItem(SQUAD_KEY);
  } catch {
    return null;
  }
}

export function writeLastSquad(id: string) {
  try {
    window.localStorage.setItem(SQUAD_KEY, id);
  } catch {
    // Ignored: the history opens on the most played squad.
  }
}
