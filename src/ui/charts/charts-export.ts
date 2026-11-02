// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The charts PDF: the same charts as the Grafici page (team, then the
 * athletes selected there), drawn as images and laid out on A4.
 */
import { type ChartsPdfBlock, chartsFileName, renderChartsPdf } from '../../pdf/charts-pdf';
import { formatRating, formatSigned, playerLabel } from '../../report/format';
import { type SetTrendRow, evaluationShares, playerPoints, playerSetTrend, pointsBySkill, setTrend } from '../../report/chart-data';
import type { StatLine } from '../../domain/stats/aggregate';
import { type SquadRow, rowPoints } from '../../athletes/squad-history';
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
  const { stats } = report;
  const blocks: ChartsPdfBlock[] = [
    { kind: 'section', title: m.charts.team },
    ...(await teamChartBlocks({ team: stats.team.match, opponentErrors: stats.opponentErrors, trend: setTrend(stats) }, m)),
  ];
  if (playerIds.length) blocks.push({ kind: 'section', title: m.charts.players }, ...(await playerChartBlocks(report, playerIds, m)));
  return blocks;
}

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
        [t.attackPt, percent(team.attack.pointRate)],
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

/** Points won and lost side by side, then the evaluations of each athlete (rows of the history). */
export async function athleteChartBlocks(
  rows: readonly SquadRow[],
  trends: ReadonlyMap<string, readonly SetTrendRow[]>,
  m: Messages,
): Promise<ChartsPdfBlock[]> {
  const t = m.charts;
  const names = { skills: m.skills, opponentErrors: t.opponentErrors };
  const minShare = minLabelledShareFor(PDF_CHART_WIDTH);
  if (!rows.length) return [];
  const comparison = rowPoints(rows);
  const blocks: ChartsPdfBlock[] = [
    { kind: 'chart', title: t.compareTitle, note: t.compareText, image: await chartImage(wonLostChartOption(comparison, m), wonLostChartHeight(comparison)) },
  ];
  for (const row of rows) {
    const shares = evaluationShares(row.totals.stats, names);
    if (!shares.length) continue;
    blocks.push({
      kind: 'chart',
      title: `${row.label} n. ${row.numbers.join(', ')}`.trim(),
      figures: [
        [t.rating, formatRating(row.totals.rating)],
        [t.points, String(row.totals.stats.summary.pointsWon)],
        [t.balance, formatSigned(row.totals.stats.summary.balance)],
      ],
      image: await chartImage(evaluationChartOption(shares, minShare, m), evaluationChartHeight(shares)),
    });
    const trend = trends.get(row.id) ?? [];
    if (trend.length > 1) blocks.push(await trendBlock(`${m.athletes.trendTitle} · ${row.label}`, m.athletes.trendText, trend, m));
  }
  return blocks;
}

const trendBlock = async (title: string, note: string, rows: readonly SetTrendRow[], m: Messages): Promise<ChartsPdfBlock> => ({
  kind: 'chart',
  title,
  note,
  image: await chartImage(trendChartOption(rows, m), TREND_CHART_HEIGHT),
});

/** The charts of the chosen athletes: points won and lost side by side, then the evaluations of each. */
export async function playerChartBlocks(report: MatchReport, playerIds: readonly string[], m: Messages): Promise<ChartsPdfBlock[]> {
  const t = m.charts;
  const names = { skills: m.skills, opponentErrors: t.opponentErrors };
  const { stats, tabellino } = report;
  const minShare = minLabelledShareFor(PDF_CHART_WIDTH);
  const blocks: ChartsPdfBlock[] = [];
  if (playerIds.length) {
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
      const trend = playerSetTrend(player);
      if (trend.length > 1) blocks.push(await trendBlock(`${t.trendTitle} · ${playerLabel(player.player)}`, t.trendText, trend, m));
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
