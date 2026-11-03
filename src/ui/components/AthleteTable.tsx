// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The athletes at a glance: matches, points, balance and the four indicators
 * in words, each coloured against the team. A click on a heading sorts; a
 * click on a name opens the card of the athlete under the table.
 */
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { AthleteCardData } from '../../athletes/card';
import { type Profile, type ProfileAxis, touchesOf } from '../../athletes/profile';
import type { SquadRow } from '../../athletes/squad-history';
import { INDICATORS, standing } from '../../athletes/summary';
import { formatSigned } from '../../report/format';
import { useI18n } from '../../i18n';
import { formatIndicator } from '../charts/IndicatorTrendChart';
import { AthleteCard } from './AthleteCard';
import { scrollBehavior, useA11y } from '../a11y';

type Column = 'name' | 'matches' | 'points' | 'balance' | ProfileAxis;

const SORT_MARK = { ascending: '▲', descending: '▼' } as const;

/** Next to the colour, so that it is not the only sign. */
const MARK = { above: '▲', below: '▼' } as const;

interface Props {
  readonly rows: readonly SquadRow[];
  readonly cards: readonly AthleteCardData[];
  readonly team: Profile;
  /** Whether a name opens the card. */
  readonly open: boolean;
  /** The second column: matches (a history) or sets played (a match). */
  readonly unit?: 'matches' | 'sets';
}

export function AthleteTable({ rows, cards, team, open, unit = 'matches' }: Props) {
  const { m } = useI18n();
  const t = m.summary;
  const [sort, setSort] = useState<{ column: Column; descending: boolean }>({ column: 'name', descending: false });
  const [shown, setShown] = useState<string | null>(null);
  const { explain } = useA11y();
  const opened = cards.find((c) => c.id === shown) ?? null;
  const cardRef = useRef<HTMLDivElement>(null);
  // The card opens under the table: bring it into view.
  useEffect(() => {
    if (shown) cardRef.current?.scrollIntoView({ behavior: scrollBehavior(), block: 'start' });
  }, [shown]);

  const value = (row: SquadRow, column: Column): number | string | null => {
    const s = row.totals.stats;
    if (column === 'name') return row.label || `n. ${row.numbers.join(', ')}`;
    if (column === 'matches') return unit === 'sets' ? row.totals.sets : row.totals.matches;
    if (column === 'points') return s.summary.pointsWon;
    if (column === 'balance') return s.summary.balance;
    // An indicator on few touches is not ranked with the others.
    return touchesOf(s, column) > 0 ? cards.find((c) => c.id === row.id)?.own.values[column] ?? null : null;
  };
  const sorted = useMemo(() => {
    const sign = sort.descending ? -1 : 1;
    return [...rows].sort((a, b) => {
      const [x, y] = [value(a, sort.column), value(b, sort.column)];
      if (x === null || y === null) return x === y ? 0 : x === null ? 1 : -1;
      return sign * (typeof x === 'string' ? x.localeCompare(String(y)) : x - (y as number));
    });
  }, [rows, cards, sort]);

  const header = (column: Column, label: string, help?: string) => {
    const active = sort.column === column ? (sort.descending ? 'descending' : 'ascending') : undefined;
    return (
      <th key={column} className={column === 'name' ? undefined : 'num'} aria-sort={active ?? 'none'} title={help}>
        <button
          type="button"
          className="vr-sort"
          onClick={() => setSort(sort.column === column ? { column, descending: !sort.descending } : { column, descending: column !== 'name' })}
        >
          {label}
          <span aria-hidden="true">{active ? SORT_MARK[active] : ''}</span>
        </button>
      </th>
    );
  };

  return (
    <>
      {explain && (
        <dl className="vr-explain">
          {INDICATORS.map((a) => (
            <div key={a}>
              <dt>{m.profile.axes[a]}</dt>
              <dd>{m.profile.help[a]}</dd>
            </div>
          ))}
        </dl>
      )}
      <div className="vr-scroll">
        <table className="vr-table vr-athlete-table">
          <thead>
            <tr>
              {header('name', m.athletes.athlete)}
              {header('matches', unit === 'sets' ? m.scoresheet.set : m.athletes.matchesShort)}
              {header('points', m.profile.points)}
              {header('balance', m.profile.balance)}
              {INDICATORS.map((a) => header(a, m.profile.axes[a], m.profile.help[a]))}
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => {
              const card = cards.find((c) => c.id === row.id);
              const name = value(row, 'name') as string;
              const balance = row.totals.stats.summary.balance;
              const expanded = shown === row.id;
              return (
                <Fragment key={row.id}>
                  <tr className={expanded ? 'expanded' : undefined}>
                    <td>
                      {open && card ? (
                        <button type="button" className="vr-row-open" aria-expanded={expanded} onClick={() => setShown(expanded ? null : row.id)}>
                          <span aria-hidden="true">{expanded ? '▾' : '▸'}</span> {name}
                        </button>
                      ) : (
                        <strong>{name}</strong>
                      )}
                    </td>
                    <td className="num">{unit === 'sets' ? row.totals.sets : row.totals.matches}</td>
                    <td className="num">{row.totals.stats.summary.pointsWon}</td>
                    <td className={`num ${balance > 0 ? 'positive' : balance < 0 ? 'negative' : ''}`}>{formatSigned(balance)}</td>
                    {INDICATORS.map((a) => {
                      const own = card?.own.values[a] ?? null;
                      const touches = touchesOf(row.totals.stats, a);
                      const place = standing(own, team[a], touches);
                      return (
                        <td key={a} className={`num${place ? ` vr-${place}` : ''}${touches > 0 && touches < 5 ? ' vr-few' : ''}`} title={place ? t.standing[place] : undefined}>
                          {place && place !== 'level' && (
                            <>
                              <span className="vr-mark" aria-hidden="true">
                                {MARK[place]}
                              </span>
                              <span className="vr-visually-hidden">{t.standing[place]}: </span>
                            </>
                          )}
                          {touches > 0 ? formatIndicator(a, own) : '.'}
                        </td>
                      );
                    })}
                  </tr>
                </Fragment>
              );
            })}
            <tr className="total">
              <td>{m.profile.team}</td>
              <td />
              <td />
              <td />
              {INDICATORS.map((a) => (
                <td key={a} className="num">
                  {formatIndicator(a, team[a])}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      {opened && (
        <div ref={cardRef} className="vr-opened-card">
          <AthleteCard
            card={opened}
            heading={
              <>
                {opened.title}
                <button type="button" className="vr-icon-button" aria-label={m.share.close} onClick={() => setShown(null)}>
                  ×
                </button>
              </>
            }
          />
        </div>
      )}
      <p className="vr-note">
        <span className="vr-key vr-above">
          {MARK.above} {t.standing.above}
        </span>{' '}
        <span className="vr-key vr-below">
          {MARK.below} {t.standing.below}
        </span>{' '}
        {t.legend}
      </p>
    </>
  );
}
