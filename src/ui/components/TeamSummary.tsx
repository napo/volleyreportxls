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

const ARROW: Record<Direction, string> = { up: '↑', down: '↓', steady: '→' };

function Trend({ to, value }: { to: Direction | null; value: string }) {
  const t = useI18n().m.summary;
  if (!to) return null;
  return (
    <span className={`vr-direction ${to}`}>
      <span aria-hidden="true">{ARROW[to]}</span> {t.direction[to]} · {t.recent(RECENT_MATCHES)}: {value}
    </span>
  );
}

export function TeamSummary({ summary }: { summary: Summary }) {
  const { m } = useI18n();
  const { values, recent, balance } = summary;
  const perMatch = (v: number) => formatSigned(Math.round(v * 10) / 10);
  return (
    <div className="vr-tiles vr-team-summary">
      {INDICATORS.map((a) =>
        values[a] === null ? null : (
          <div key={a} className="vr-tile">
            <span className="vr-tile-label">{m.profile.axes[a]}</span>
            <span className="vr-tile-value">{formatIndicator(a, values[a])}</span>
            <Trend to={direction(values[a], recent?.[a] ?? null)} value={formatIndicator(a, recent?.[a] ?? null)} />
          </div>
        ),
      )}
      <div className="vr-tile">
        <span className="vr-tile-label">{m.profile.balance}</span>
        <span className="vr-tile-value">{formatSigned(balance.total)}</span>
        <span className="vr-tile-note">{m.summary.perMatch(perMatch(balance.perMatch))}</span>
        <Trend
          to={direction(balance.perMatch, balance.recentPerMatch, STEADY_BALANCE)}
          value={balance.recentPerMatch === null ? '.' : m.summary.perMatch(perMatch(balance.recentPerMatch))}
        />
      </div>
    </div>
  );
}
