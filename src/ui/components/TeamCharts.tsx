// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The charts of the team, for one match (Grafici) or for the matches put together (history). */
import type { StatLine } from '../../domain/stats/aggregate';
import { useI18n } from '../../i18n';
import { type SetTrendRow, evaluationShares, pointsBySkill } from '../../report/chart-data';
import { formatSigned } from '../../report/format';
import { EvaluationChart } from '../charts/EvaluationChart';
import { TrendChart } from '../charts/TrendChart';
import { WonLostChart } from '../charts/WonLostChart';
import { percent } from '../charts/tokens';

export function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="vr-tile">
      <span className="vr-tile-label">{label}</span>
      <span className="vr-tile-value">{value}</span>
      {note && <span className="vr-tile-note">{note}</span>}
    </div>
  );
}

interface Props {
  readonly team: StatLine;
  readonly opponentErrors: number;
  /** Set by set for a match, match by match for the history. */
  readonly trend: readonly SetTrendRow[];
  /** Title, text, label and first column of the trend, when it is not set by set. */
  readonly trendTexts?: { readonly title: string; readonly text: string; readonly label: string; readonly firstColumn: string };
}

/** The charts of the team: key figures, evaluations, points won and lost by skill, trend. */
export function TeamCharts({ team, opponentErrors, trend, trendTexts }: Props) {
  const { m } = useI18n();
  const t = m.charts;
  const names = { skills: m.skills, opponentErrors: t.opponentErrors };
  return (
    <>
      <div className="vr-tiles">
        <Tile label={t.directPoints} value={String(team.summary.pointsWon)} note={t.directPointsNote} />
        <Tile label={t.balance} value={formatSigned(team.summary.balance)} note={t.wonLost(team.summary.pointsWon, team.summary.pointsLost)} />
        <Tile label={t.opponentErrors} value={String(opponentErrors)} />
        <Tile label={t.receptionPos} value={percent(team.reception.positivity)} note={t.receptions(team.reception.total)} />
        <Tile label={t.attackEff} value={`${formatSigned(Math.round(team.attack.efficiency * 100))}%`} note={t.attacks(team.attack.total)} />
      </div>

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.evaluationsTitle}</h2>
            <p>{t.evaluationsText}</p>
          </div>
        </div>
        <EvaluationChart rows={evaluationShares(team, names)} title={t.teamEvaluations} />
      </section>

      <div className="vr-grid-2">
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{t.wonLostTitle}</h2>
              <p>{t.wonLostText}</p>
            </div>
          </div>
          <WonLostChart rows={pointsBySkill(team, opponentErrors, names)} title={t.wonLostBySkill} firstColumn={t.skill} />
        </section>
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{trendTexts?.title ?? t.trendTitle}</h2>
              <p>{trendTexts?.text ?? t.trendText}</p>
            </div>
          </div>
          <TrendChart rows={trend} {...(trendTexts && { firstColumn: trendTexts.firstColumn, label: trendTexts.label })} />
        </section>
      </div>
    </>
  );
}
