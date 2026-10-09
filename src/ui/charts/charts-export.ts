// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The charts PDF: the same charts as the Grafici page (team, then the
 * athletes selected there), drawn as images and laid out on A4.
 */
import { type ChartsPdfBlock, chartsFileName, renderChartsPdf } from '../../pdf/charts-pdf';
import { formatRating, formatSigned, playerLabel } from '../../report/format';
import { evaluationShares, playerPoints, pointsBySkill, setTrend } from '../../report/chart-data';
import { saveFile } from '../../platform/save-file';
import type { Messages } from '../../i18n';
import type { MatchReport } from '../match-report';
import { loadLogoPng, loadPdfFonts } from '../pdf-assets';
import { PDF_CHART_WIDTH, chartImage } from './chart-images';
import { evaluationChartHeight, evaluationChartOption, minLabelledShareFor } from './EvaluationChart';
import { percent } from './tokens';
import { TREND_CHART_HEIGHT, trendChartOption } from './TrendChart';
import { wonLostChartHeight, wonLostChartOption } from './WonLostChart';

async function chartBlocks(report: MatchReport, playerIds: readonly string[], m: Messages): Promise<ChartsPdfBlock[]> {
  const t = m.charts;
  const names = { skills: m.skills, opponentErrors: t.opponentErrors };
  const { stats, tabellino } = report;
  const team = stats.team.match;
  const minShare = minLabelledShareFor(PDF_CHART_WIDTH);
  const blocks: ChartsPdfBlock[] = [{ kind: 'section', title: t.team }];

  const shares = evaluationShares(team, names);
  if (shares.length) {
    blocks.push({
      kind: 'chart',
      title: t.evaluationsTitle,
      note: t.evaluationsText,
      figures: [
        [t.directPoints, String(team.summary.pointsWon)],
        [t.balance, formatSigned(team.summary.balance)],
        [t.opponentErrors, String(stats.opponentErrors)],
        [t.receptionPos, percent(team.reception.positivity)],
        [t.attackPt, percent(team.attack.pointRate)],
      ],
      image: await chartImage(evaluationChartOption(shares, minShare, m), evaluationChartHeight(shares)),
    });
  }
  const points = pointsBySkill(team, stats.opponentErrors, names);
  if (points.length) {
    blocks.push({
      kind: 'chart',
      title: t.wonLostTitle,
      note: t.wonLostText,
      image: await chartImage(wonLostChartOption(points, m), wonLostChartHeight(points)),
    });
  }
  const trend = setTrend(stats);
  if (trend.length > 1) {
    blocks.push({
      kind: 'chart',
      title: t.trendTitle,
      note: t.trendText,
      image: await chartImage(trendChartOption(trend, m), TREND_CHART_HEIGHT),
    });
  }

  if (playerIds.length) {
    blocks.push({ kind: 'section', title: t.players });
    const comparison = playerPoints(stats, playerIds);
    blocks.push({
      kind: 'chart',
      title: t.compareTitle,
      note: t.compareText,
      image: await chartImage(wonLostChartOption(comparison, m), wonLostChartHeight(comparison)),
    });
    for (const id of playerIds) {
      const player = stats.players.find((p) => p.player.id === id);
      const row = tabellino.players.find((p) => p.player.id === id);
      if (!player || !row) continue;
      const rows = evaluationShares(player.match, names);
      if (!rows.length) continue;
      blocks.push({
        kind: 'chart',
        title: `${playerLabel(player.player)}${player.player.role === 'L' ? ` (${t.libero})` : ''}`,
        figures: [
          [t.rating, formatRating(row.rating)],
          [t.points, String(player.match.summary.pointsWon)],
          [t.balance, formatSigned(player.match.summary.balance)],
          [t.setsPlayedShort, player.setsPlayed.join(', ') || t.none],
        ],
        image: await chartImage(evaluationChartOption(rows, minShare, m), evaluationChartHeight(rows)),
      });
    }
  }
  return blocks;
}

export function exportChartsPdf(report: MatchReport, playerIds: readonly string[], m: Messages) {
  return saveFile(chartsFileName(report.tabellino, m.charts.title), async () => {
    const [fonts, logoPng, blocks] = await Promise.all([loadPdfFonts(), loadLogoPng(), chartBlocks(report, playerIds, m)]);
    return renderChartsPdf(report.tabellino, blocks, { fonts, logoPng, title: m.charts.title, texts: m.scoresheet });
  });
}
