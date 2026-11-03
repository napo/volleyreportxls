// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The card of an athlete: points, errors and their balance; the indicators
 * against the team (and the last match); the trend of the indicator chosen,
 * with the averages of athlete and team; the evaluations, folded away.
 */
import { type ReactNode, useState } from 'react';
import { type AthleteCardData, keyFigures } from '../../athletes/card';
import { type ProfileAxis, meaningfulAxes, playedAxes, touchesOf } from '../../athletes/profile';
import { FEW_TOUCHES } from '../../athletes/squad-history';
import { evaluationShares, scoresPoints } from '../../report/chart-data';
import { formatSigned } from '../../report/format';
import { useI18n } from '../../i18n';
import { EvaluationChart } from '../charts/EvaluationChart';
import { IndicatorTrendChart, formatIndicator } from '../charts/IndicatorTrendChart';
import { useA11y } from '../a11y';

interface Props {
  readonly card: AthleteCardData;
  /** The title as shown (a link, a badge…); the card's title otherwise. */
  readonly heading?: ReactNode;
}

export function AthleteCard({ card, heading }: Props) {
  const { m } = useI18n();
  const t = m.profile;
  const axes = playedAxes(card.stats);
  const meaningful = meaningfulAxes(card.stats);
  const [chosen, setChosen] = useState<ProfileAxis | null>(null);
  const { explain } = useA11y();
  const axis = chosen && axes.includes(chosen) ? chosen : (meaningful[0] ?? axes[0] ?? null);
  const figures = keyFigures(card.stats);
  const columns = [card.own, ...(card.last ? [card.last] : []), card.team];
  const few = (a: ProfileAxis) => touchesOf(card.stats, a) < FEW_TOUCHES;

  return (
    <section className="vr-card vr-athlete-card">
      <div className="vr-card-head">
        <div>
          <h3>{heading ?? card.title}</h3>
          <p>{card.subtitle}</p>
        </div>
      </div>

      {scoresPoints(card.stats) ? (
        <ul className="vr-figures">
          <li>
            <span>{t.points}</span>
            <strong>{figures.points}</strong>
          </li>
          <li>
            <span>{t.errors}</span>
            <strong>{figures.errors}</strong>
            {figures.aces > 0 && <small>{t.aces(figures.aces)}</small>}
          </li>
          <li>
            <span>{t.balance}</span>
            <strong className={figures.balance > 0 ? 'positive' : figures.balance < 0 ? 'negative' : undefined}>{formatSigned(figures.balance)}</strong>
          </li>
        </ul>
      ) : (
        // Who only received: the receptions and the aces conceded, not a balance that can only be negative.
        <>
          <ul className="vr-figures">
            <li>
              <span>{t.receptions}</span>
              <strong>{card.stats.reception.total}</strong>
            </li>
            <li>
              <span>{t.acesConceded}</span>
              <strong>{figures.aces}</strong>
            </li>
          </ul>
          <p className="vr-note">{t.receiverOnly}</p>
        </>
      )}

      {axes.length === 0 ? (
        <p className="vr-note">{t.none}</p>
      ) : (
        <>
          <div className="vr-scroll">
            <table className="vr-table vr-compare">
              <thead>
                <tr>
                  <th>{t.indicator}</th>
                  {columns.map((c) => (
                    <th key={c.name} className="num">
                      {c.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {axes.map((a) => (
                  <tr key={a}>
                    <td title={t.help[a]}>
                      {t.axes[a]}
                      {explain && <small className="vr-cell-help">{t.help[a]}</small>}
                    </td>
                    {columns.map((c, i) => (
                      <td key={c.name} className={`num${i === 0 && few(a) ? ' vr-few' : ''}`}>
                        {formatIndicator(a, c.values[a])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="vr-note">{t.definitions}</p>

          {axis && card.trend.length > 1 && (
            <>
              <h4>{card.trendTitle}</h4>
              <div className="vr-indicator-choice" role="group" aria-label={t.indicator}>
                {axes.map((a) => (
                  <button key={a} type="button" aria-pressed={a === axis} onClick={() => setChosen(a)}>
                    {t.axes[a]}
                  </button>
                ))}
              </div>
              <IndicatorTrendChart
                points={card.trend.map((p) => ({ label: p.label, value: p.values[axis] }))}
                axis={axis}
                own={card.own.values[axis]}
                team={card.team.values[axis]}
                firstColumn={card.trendColumn}
                label={t.label(card.title, t.axes[axis])}
              />
            </>
          )}
        </>
      )}

      <details className="vr-data">
        <summary>{t.evaluations}</summary>
        <EvaluationChart rows={evaluationShares(card.stats, { skills: m.skills, opponentErrors: m.charts.opponentErrors })} title={m.charts.playerEvaluations(card.title)} />
      </details>
    </section>
  );
}
