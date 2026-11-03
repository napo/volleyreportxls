// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The team at a glance: the four indicators and the balance of points, each
 * with its direction in the last matches (an arrow, a word and the value).
 */
import { type Direction, INDICATORS, RECENT_MATCHES, STEADY_BALANCE, type TeamSummary as Summary, direction } from '../../athletes/summary';
import { formatSigned } from '../../report/format';
import { useI18n } from '../../i18n';
import { formatIndicator } from '../charts/IndicatorTrendChart';
import { useA11y } from '../a11y';
import { FEW_TOUCHES } from '../../athletes/squad-history';

const ARROW: Record<Direction, string> = { up: '↑', down: '↓', steady: '→' };

function Trend({ to, value, recent }: { to: Direction | null; value: string; recent: string }) {
  const t = useI18n().m.summary;
  if (!to) return null;
  return (
    <span className={`vr-direction ${to}`}>
      <span aria-hidden="true">{ARROW[to]}</span> {t.direction[to]} · {recent}: {value}
    </span>
  );
}

export function TeamSummary({ summary }: { summary: Summary }) {
  const { m } = useI18n();
  const { explain } = useA11y();
  const { values, recent, balance } = summary;
  const t = m.summary;
  // The last matches of a history, the last set of a match.
  const recentLabel = summary.unit === 'set' ? t.lastSet : t.recent(RECENT_MATCHES);
  const per = (v: number) => (summary.unit === 'set' ? t.perSet : t.perMatch)(formatSigned(Math.round(v * 10) / 10));
  return (
    <div className="vr-tiles vr-team-summary">
      {INDICATORS.map((a) =>
        values[a] === null ? null : (
          <div key={a} className={`vr-tile${summary.touches[a] < FEW_TOUCHES ? ' vr-few-tile' : ''}`}>
            <span className="vr-tile-label" title={m.profile.help[a]}>
              {m.profile.axes[a]}
            </span>
            <span className="vr-tile-value">{formatIndicator(a, values[a])}</span>
            {/* Few touches (often the block): the value says little, and the tile says so. */}
            {summary.touches[a] < FEW_TOUCHES && <span className="vr-tile-note">{m.summary.fewTouches(summary.touches[a])}</span>}
            <Trend to={direction(values[a], recent?.[a] ?? null)} value={formatIndicator(a, recent?.[a] ?? null)} recent={recentLabel} />
            {explain && <span className="vr-tile-help">{m.profile.help[a]}</span>}
          </div>
        ),
      )}
      <div className="vr-tile">
        <span className="vr-tile-label">{m.profile.balance}</span>
        <span className="vr-tile-value">{formatSigned(balance.total)}</span>
        <span className="vr-tile-note">{per(balance.perUnit)}</span>
        <Trend
          to={direction(balance.perUnit, balance.recentPerUnit, STEADY_BALANCE)}
          value={balance.recentPerUnit === null ? '.' : per(balance.recentPerUnit)}
          recent={recentLabel}
        />
      </div>
    </div>
  );
}
