// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The report PDF of a match (scoresheet and charts) or of the history of a
 * squad, with the blocks the user chose: the same tables and charts as the
 * page, drawn as PDF tables and chart images.
 */
import type { ProfileAxis } from '../athletes/profile';
import { EVALUATION_SCALES, type Skill } from '../domain/codes';
import type { Messages } from '../i18n';
import type { MatchRecord } from '../matches/record';
import type { ChartImage, ChartsPdfBlock } from '../pdf/charts-pdf';
import { type ReportBlock, renderReportPdf, tableBlock } from '../pdf/report-pdf';
import { type Group, type PlayerOrTotal, num, playerGroups, setGroups, skillGroups } from '../pdf/tabellino-pdf';
import { formatCount, formatDate, formatRating, formatSigned } from '../report/format';
import type { TabellinoLine } from '../report/tabellino';
import type { ShareSection } from '../share/payload';
import { chartImage } from './charts/chart-images';
import { athleteChartBlocks, playerChartBlocks, teamChartBlocks } from './charts/charts-export';
import { type SetTrendRow, setTrend } from '../report/chart-data';
import { type SquadRow, squadCharts } from '../athletes/squad-history';
import { PROFILE_RADAR_HEIGHT, type ProfileSeries, profileBarOption, profileRadarOption } from './charts/ProfileChart';
import type { MatchReport } from './match-report';
import { loadLogoPng, loadPdfFonts } from './pdf-assets';

/** A profile to draw: the series compared and the indicators that say something. */
export interface PdfProfile {
  readonly title: string;
  readonly series: readonly ProfileSeries[];
  readonly axes: readonly ProfileAxis[];
}

/** Width of the small charts printed two per row: their labels print at the same size as the wide ones. */
const SMALL_WIDTH = 420;

async function profileImages(p: PdfProfile, m: Messages): Promise<ChartImage[]> {
  if (p.axes.length >= 3) return [await chartImage(profileRadarOption(p.series, p.axes, m), PROFILE_RADAR_HEIGHT, true, SMALL_WIDTH)];
  // Bars: on paper the name of the indicator and of every bar must be in the image.
  return Promise.all(
    p.axes.map((axis) => {
      const option = profileBarOption(p.series, axis, m);
      return chartImage(
        {
          ...option,
          grid: { ...option.grid, top: 28 },
          xAxis: { ...option.xAxis, axisLabel: { show: true, interval: 0 } },
          yAxis: { ...option.yAxis, name: m.profile.axes[axis], nameTextStyle: { align: 'left', fontWeight: 600 } },
        },
        190,
        false,
        SMALL_WIDTH,
      );
    }),
  );
}

const profileGrid = async (profiles: readonly PdfProfile[], m: Messages): Promise<ReportBlock> => ({
  kind: 'grid',
  items: await Promise.all(profiles.map(async (p) => ({ title: p.title, images: await profileImages(p, m) }))),
});

/** Charts of the charts PDF as report blocks (their key figures go into the note). */
const fromCharts = (blocks: readonly ChartsPdfBlock[]): ReportBlock[] =>
  blocks.map((b) =>
    b.kind === 'section'
      ? b
      : {
          kind: 'chart',
          title: b.title,
          image: b.image,
          ...((b.note || b.figures?.length) && { note: [b.figures?.map(([k, v]) => `${k} ${v}`).join(' · '), b.note].filter(Boolean).join(' — ') }),
        },
  );

type StatsRow = TabellinoLine & { readonly label: string; readonly matches: string; readonly sets: string; readonly rating: string; readonly total?: true };

/** The table of the statistics by athlete, as on the page (the column of the matches only for the history). */
function statsTable(title: string, rows: readonly SquadRow[], total: TabellinoLine, m: Messages, matches?: number): ReportBlock {
  const t = m.scoresheet;
  const lines: StatsRow[] = [
    ...rows.map((r) => ({
      ...r.totals.line,
      label: `${r.label}${r.label ? ' ' : ''}n. ${r.numbers.join(', ')}`,
      matches: String(r.totals.matches),
      sets: String(r.totals.sets),
      rating: formatRating(r.totals.rating),
    })),
    { ...total, label: m.athletes.total, matches: matches === undefined ? '' : String(matches), sets: '', rating: '', total: true as const },
  ];
  const groups: Group<StatsRow>[] = [
    { title: '', columns: [{ header: m.athletes.athlete, width: matches === undefined ? 47 : 40, align: 'left', value: (r) => r.label }] },
    {
      title: '',
      columns: [
        ...(matches === undefined ? [] : [num<StatsRow>(m.athletes.matchesShort.slice(0, 4), (r) => r.matches, 7)]),
        num<StatsRow>(t.set, (r) => r.sets),
        num<StatsRow>(t.rating, (r) => r.rating, 8),
      ],
    },
    { title: t.points, columns: [num(t.tot, (r) => formatCount(r.points.total)), num(t.balance, (r) => formatSigned(r.points.balance))] },
    ...skillGroups<StatsRow>(t),
  ];
  return tableBlock(title, groups, lines, (r) => r.total === true, m.athletes.totalNote);
}

/** The abbreviations, then the meaning of every evaluation in each skill of the sheet. */
function legend(m: Messages) {
  const skills: Skill[] = ['B', 'R', 'A', 'M'];
  return [
    ...m.reportPdf.legend,
    ...skills.map((skill) => ({
      term: m.skills[skill],
      text: EVALUATION_SCALES[skill]
        .flatMap((e) => (m.codes[skill][e] ? [`${e} ${m.codes[skill][e]!.split(' (')[0]}`] : []))
        .join(' · '),
    })),
  ];
}

async function render(blocks: readonly ReportBlock[], title: string, summary: string, m: Messages) {
  const [fonts, logoPng] = await Promise.all([loadPdfFonts(), loadLogoPng()]);
  return renderReportPdf(blocks, { fonts, logoPng, title, summary, legend: legend(m), legendTitle: m.reportPdf.legendTitle, texts: m.scoresheet });
}

export interface MatchPdf {
  readonly report: MatchReport;
  /** Rows and profiles of the athletes chosen on the page. */
  readonly rows: readonly SquadRow[];
  readonly total: TabellinoLine;
  readonly playerIds: readonly string[];
  readonly profiles: readonly PdfProfile[];
}

export async function matchReportPdf(data: MatchPdf, sections: ReadonlySet<ShareSection>, m: Messages): Promise<Uint8Array> {
  const { report } = data;
  const { tabellino } = report;
  const t = m.scoresheet;
  const blocks: ReportBlock[] = [];
  if (sections.has('tabellino')) {
    const rows: PlayerOrTotal[] = [...tabellino.players, { ...tabellino.totals, total: true }];
    blocks.push(tableBlock(t.title, playerGroups(tabellino, t), rows, (r) => 'total' in r, t.pdfLegend));
  }
  if (sections.has('sets')) blocks.push(tableBlock(t.setStats, setGroups(t), tabellino.sets, () => false, t.opponentErrorsTotal(tabellino.opponentErrors)));
  if (sections.has('team')) {
    const { stats } = report;
    const team = { team: stats.team.match, opponentErrors: stats.opponentErrors, trend: setTrend(stats) };
    blocks.push({ kind: 'section', title: m.charts.team }, ...fromCharts(await teamChartBlocks(team, m)));
  }
  if (sections.has('players') && data.rows.length) {
    blocks.push({ kind: 'section', title: m.charts.players }, statsTable(m.athletes.listTitle, data.rows, data.total, m));
    blocks.push(...fromCharts(await playerChartBlocks(report, data.playerIds, m)));
    blocks.push({ kind: 'section', title: m.profile.title }, await profileGrid(data.profiles, m));
  }
  const title = `${tabellino.teamName} – ${tabellino.opponentName}`;
  const scores = tabellino.setScores.map((s) => `${s.score.team}-${s.score.opponent}`).join(', ');
  const summary = [tabellino.competition, formatDate(tabellino.date), `${tabellino.setsWon.team}-${tabellino.setsWon.opponent}${scores ? ` (${scores})` : ''}`]
    .filter(Boolean)
    .join(' · ');
  return render(blocks, title, summary, m);
}

export interface HistoryPdf {
  readonly title: string;
  readonly summary: string;
  /** The chosen matches, oldest first. */
  readonly records: readonly MatchRecord[];
  readonly rows: readonly SquadRow[];
  readonly total: TabellinoLine;
  readonly profiles: readonly PdfProfile[];
  /** Match by match, for every athlete. */
  readonly trends: ReadonlyMap<string, readonly SetTrendRow[]>;
}

export async function historyReportPdf(data: HistoryPdf, sections: ReadonlySet<ShareSection>, m: Messages): Promise<Uint8Array> {
  const t = m.reportPdf;
  const blocks: ReportBlock[] = [];
  if (sections.has('matches')) {
    const result = (r: MatchRecord) => {
      const scored = r.sets.flatMap((s) => (s.score ? [s.score] : []));
      const won = scored.filter((s) => s.team > s.opponent).length;
      return scored.length ? `${won}-${scored.length - won}  (${scored.map((s) => `${s.team}-${s.opponent}`).join(', ')})` : '';
    };
    const groups: Group<MatchRecord>[] = [
      {
        title: '',
        columns: [
          { header: t.date, width: 18, align: 'left', value: (r) => formatDate(r.date) },
          { header: t.opponent, width: 52, align: 'left', value: (r) => r.opponentName || m.common.opponent },
          { header: t.competition, width: 52, align: 'left', value: (r) => r.competition },
          { header: t.result, width: 55, align: 'left', value: result },
        ],
      },
    ];
    blocks.push(tableBlock(t.matchesTitle, groups, data.records, () => false));
  }
  if (sections.has('table') && data.rows.length) blocks.push(statsTable(m.athletes.listTitle, data.rows, data.total, m, data.records.length));
  if (sections.has('team') && data.records.length) {
    const a = m.athletes;
    const team = { ...squadCharts(data.records), trendTexts: { title: a.trendTitle, text: a.trendText } };
    blocks.push({ kind: 'section', title: m.charts.team }, ...fromCharts(await teamChartBlocks(team, m)));
  }
  if (sections.has('athleteCharts') && data.rows.length) {
    blocks.push({ kind: 'section', title: m.share.sectionNames.athleteCharts! }, ...fromCharts(await athleteChartBlocks(data.rows, data.trends, m)));
  }
  if (sections.has('profiles') && data.profiles.length) blocks.push({ kind: 'section', title: m.profile.title }, await profileGrid(data.profiles, m));
  return render(blocks, data.title, data.summary, m);
}

