// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Manual entry of one set: the table (as the paper form) or one athlete at a
 * time with − / + buttons. Phones start with the second.
 */
import { useEffect, useState } from 'react';
import type { ScoutCodeString } from '../../domain/codes';
import { type RowKind, type SetRecord, type TallyRowRecord, emptyRow } from '../../matches/record';
import { useI18n } from '../../i18n';
import { CountsByPlayer } from './CountsByPlayer';
import { CountsTable } from './CountsTable';

export interface CountsViewProps {
  readonly set: SetRecord;
  readonly onCount: (rowId: string, code: ScoutCodeString, count: number) => void;
  readonly onNumber: (rowId: string, number: number | null) => void;
  readonly onRemove: (rowId: string) => void;
  readonly onAdd: (kind: RowKind) => void;
}

type View = 'tabella' | 'atleta';
const NARROW = '(max-width: 760px)';

function useNarrowScreen() {
  const [narrow, setNarrow] = useState(() => window.matchMedia(NARROW).matches);
  useEffect(() => {
    const query = window.matchMedia(NARROW);
    const update = () => setNarrow(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return narrow;
}

export function CountsEditor({ set, onChange }: { set: SetRecord; onChange: (set: SetRecord) => void }) {
  const { m } = useI18n();
  const narrow = useNarrowScreen();
  const [chosen, setChosen] = useState<View | null>(null);
  const view: View = chosen ?? (narrow ? 'atleta' : 'tabella');

  const update = (id: string, change: (row: TallyRowRecord) => TallyRowRecord) =>
    onChange({ ...set, rows: set.rows.map((row) => (row.id === id ? change(row) : row)) });
  const props: CountsViewProps = {
    set,
    onCount: (id, code, count) => update(id, (row) => ({ ...row, counts: { ...row.counts, [code]: Math.max(0, count) } })),
    onNumber: (id, playerNumber) => update(id, (row) => ({ ...row, playerNumber })),
    onRemove: (id) => onChange({ ...set, rows: set.rows.filter((row) => row.id !== id) }),
    onAdd: (kind) => {
      // New rows go after the last row of their kind.
      const last = set.rows.map((r) => r.kind).lastIndexOf(kind);
      const rows = [...set.rows];
      rows.splice(last + 1, 0, emptyRow(kind));
      onChange({ ...set, rows });
    },
  };

  return (
    <>
      <div className="vr-counts-toolbar">
        <div className="vr-segmented" role="group" aria-label={m.counts.mode}>
          {(
            [
              ['tabella', m.counts.table],
              ['atleta', m.counts.byPlayer],
            ] as const
          ).map(([key, label]) => (
            <button key={key} type="button" className={view === key ? 'selected' : undefined} aria-pressed={view === key} onClick={() => setChosen(key)}>
              {label}
            </button>
          ))}
        </div>
      </div>
      {view === 'tabella' ? <CountsTable {...props} /> : <CountsByPlayer key={set.number} {...props} />}
    </>
  );
}
