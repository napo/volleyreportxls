// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * One row per athlete with the columns of the tabellino, ordered by clicking
 * a column; percentages on few touches are greyed out. Used by the history
 * (totals of the chosen matches) and by the charts (one match).
 */
import { useMemo, useState } from 'react';
import {
  DEFAULT_SQUAD_SORT,
  FEW_TOUCHES,
  type SquadColumn,
  type SquadRow,
  type SquadSort,
  fewTouches,
  nextSquadSort,
  sortSquadRows,
  squadValue,
} from '../../athletes/squad-history';
import type { TabellinoLine } from '../../report/tabellino';
import { formatBracketedPercent, formatCount, formatPercent, formatRating, formatSigned } from '../../report/format';
import { useI18n } from '../../i18n';
import { PointsCells, SkillCells, SkillGroups } from './TabellinoTable';

type Format = 'count' | 'rating' | 'signed' | 'percent' | 'bracketed';

interface Column {
  readonly id: Exclude<SquadColumn, 'name'>;
  readonly format: Format;
  /** First column of a group (a line on its left). */
  readonly start?: boolean;
}

// The same columns as the tabellino, after matches and sets.
const COLUMNS: readonly Column[] = [
  { id: 'matches', format: 'count' },
  { id: 'sets', format: 'count' },
  { id: 'rating', format: 'rating' },
  { id: 'points', format: 'count', start: true },
  { id: 'balance', format: 'signed' },
  { id: 'serveTotal', format: 'count', start: true },
  { id: 'serveErrors', format: 'count' },
  { id: 'servePoints', format: 'count' },
  { id: 'receptionTotal', format: 'count', start: true },
  { id: 'receptionErrors', format: 'count' },
  { id: 'receptionPositivity', format: 'percent' },
  { id: 'receptionPerfect', format: 'bracketed' },
  { id: 'attackTotal', format: 'count', start: true },
  { id: 'attackErrors', format: 'count' },
  { id: 'attackBlocked', format: 'count' },
  { id: 'attackPoints', format: 'count' },
  { id: 'attackPointRate', format: 'percent' },
  { id: 'blockPoints', format: 'count', start: true },
];

const SORT_MARK = { ascending: '▲', descending: '▼' } as const;

function formatted(value: number | null, format: Format): string {
  switch (format) {
    case 'rating':
      return formatRating(value);
    case 'signed':
      return value === null ? '.' : formatSigned(value);
    case 'percent':
      return formatPercent(value);
    case 'bracketed':
      return formatBracketedPercent(value);
    default:
      return formatCount(value);
  }
}

function cellClass(column: Column, row: SquadRow, value: number | null) {
  return [
    'num',
    column.start && 'group-start',
    column.format === 'signed' && value !== null && (value > 0 ? 'positive' : value < 0 ? 'negative' : ''),
    fewTouches(row.totals.line, column.id) && 'vr-few',
  ]
    .filter(Boolean)
    .join(' ');
}

interface Props {
  readonly rows: readonly SquadRow[];
  /** Points and skills of the rows together. */
  readonly total: TabellinoLine;
  /** Matches put together; without it (a single match) there is no column of the matches. */
  readonly matches?: number;
  /** Where the name of a row leads, if anywhere. */
  readonly link?: (id: string) => string | undefined;
}

export function StatsTable({ rows, total, matches, link }: Props) {
  const { m } = useI18n();
  const t = m.athletes;
  const s = m.scoresheet;
  const [sort, setSort] = useState<SquadSort>(DEFAULT_SQUAD_SORT);
  const sorted = useMemo(() => sortSquadRows(rows, sort), [rows, sort]);
  const columns = matches === undefined ? COLUMNS.filter((c) => c.id !== 'matches') : COLUMNS;

  const labels: Record<SquadColumn, string> = {
    name: t.athlete,
    matches: t.matchesShort,
    sets: s.set,
    rating: s.rating,
    points: s.tot,
    balance: s.balance,
    serveTotal: s.tot,
    serveErrors: s.err,
    servePoints: s.pt,
    receptionTotal: s.tot,
    receptionErrors: s.err,
    receptionPositivity: s.pos,
    receptionPerfect: s.prf,
    attackTotal: s.tot,
    attackErrors: s.err,
    attackBlocked: s.blocked,
    attackPoints: s.pt,
    attackPointRate: s.ptPct,
    blockPoints: s.pt,
  };

  const header = (column: SquadColumn, className?: string) => {
    const sorted = sort.column === column ? (sort.descending ? 'descending' : 'ascending') : undefined;
    return (
      <th key={column} className={className} aria-sort={sorted ?? 'none'}>
        <button type="button" className="vr-sort" onClick={() => setSort(nextSquadSort(sort, column))}>
          {labels[column]}
          <span aria-hidden="true">{sorted ? SORT_MARK[sorted] : ''}</span>
        </button>
      </th>
    );
  };

  return (
    <>
      <div className="vr-scroll">
        <table className="vr-table vr-squad-table">
          <thead>
            <tr>
              <th />
              <th colSpan={columns.length - 15} />
              <th colSpan={2} className="group-start">
                {s.points}
              </th>
              <SkillGroups />
            </tr>
            <tr>
              {header('name')}
              {columns.map((c) => header(c.id, `num${c.start ? ' group-start' : ''}`))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const to = link?.(row.id);
              return (
                <tr key={row.id}>
                  <td>
                    {to ? <a href={to}>{row.label}</a> : <strong>{row.label}</strong>}
                    <span className="vr-squad-numbers">n. {row.numbers.join(', ')}</span>
                  </td>
                  {columns.map((c) => {
                    const value = squadValue(row, c.id);
                    return (
                      <td key={c.id} className={cellClass(c, row, value)} title={fewTouches(row.totals.line, c.id) ? t.few(FEW_TOUCHES) : undefined}>
                        {formatted(value, c.format)}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
            <tr className="total">
              <td>{t.total}</td>
              {matches !== undefined && <td className="num">{matches}</td>}
              <td />
              <td />
              <PointsCells line={total} />
              <SkillCells row={total} />
            </tr>
          </tbody>
        </table>
      </div>
      <p className="vr-note">{t.fewNote(FEW_TOUCHES)}</p>
    </>
  );
}
