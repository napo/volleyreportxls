// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Charts of the report PDF, drawn as images with the same options as on the
 * page: those of the team and the comparison of the athletes.
 */
import type { ChartsPdfBlock } from '../../pdf/charts-pdf';
import { formatSigned } from '../../report/format';
import { type PlayerPointsRow, type SetTrendRow, evaluationShares, pointsBySkill } from '../../report/chart-data';
import type { StatLine } from '../../domain/stats/aggregate';
import type { Messages } from '../../i18n';
import { PDF_CHART_WIDTH, chartImage } from './chart-images';
import { evaluationChartHeight, evaluationChartOption, minLabelledShareFor } from './EvaluationChart';
import { percent } from './tokens';
import { TREND_CHART_HEIGHT, trendChartOption } from './TrendChart';
import { wonLostChartHeight, wonLostChartOption } from './WonLostChart';

export interface TeamChartData {
  readonly team: StatLine;
  readonly opponentErrors: number;
  /** Set by set for a match, match by match for the history. */
  readonly trend: readonly SetTrendRow[];
  readonly trendTexts?: { readonly title: string; readonly text: string };
}

/** The charts of the team: evaluations, points won and lost, trend. */
export async function teamChartBlocks({ team, opponentErrors, trend, trendTexts }: TeamChartData, m: Messages): Promise<ChartsPdfBlock[]> {
  const t = m.charts;
  const names = { skills: m.skills, opponentErrors: t.opponentErrors };
  const minShare = minLabelledShareFor(PDF_CHART_WIDTH);
  const blocks: ChartsPdfBlock[] = [];

  const shares = evaluationShares(team, names);
  if (shares.length) {
    blocks.push({
      kind: 'chart',
      title: t.evaluationsTitle,
      note: t.evaluationsText,
      figures: [
        [t.directPoints, String(team.summary.pointsWon)],
        [t.balance, formatSigned(team.summary.balance)],
        [t.opponentErrors, String(opponentErrors)],
        [t.receptionPos, percent(team.reception.positivity)],
        [t.attackEff, formatSigned(Math.round(team.attack.efficiency * 100)) + '%'],
      ],
      image: await chartImage(evaluationChartOption(shares, minShare, m), evaluationChartHeight(shares)),
    });
  }
  const points = pointsBySkill(team, opponentErrors, names);
  if (points.length) {
    blocks.push({
      kind: 'chart',
      title: t.wonLostTitle,
      note: t.wonLostText,
      image: await chartImage(wonLostChartOption(points, m), wonLostChartHeight(points)),
    });
  }
  if (trend.length > 1) {
    blocks.push({
      kind: 'chart',
      title: trendTexts?.title ?? t.trendTitle,
      note: trendTexts?.text ?? t.trendText,
      image: await chartImage(trendChartOption(trend, m), TREND_CHART_HEIGHT),
    });
  }

  return blocks;
}

/** Points won and lost of the chosen athletes, side by side. */
export async function comparisonBlock(rows: readonly PlayerPointsRow[], m: Messages): Promise<ChartsPdfBlock> {
  const t = m.charts;
  return { kind: 'chart', title: t.compareTitle, note: t.compareText, image: await chartImage(wonLostChartOption(rows, m), wonLostChartHeight(rows)) };
}
