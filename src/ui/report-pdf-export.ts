// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The report PDF of a match (scoresheet and charts) or of the history of a
 * squad, with the blocks the user chose: the same tables and charts as the
 * page, drawn as PDF tables and chart images.
 */
import { type AthleteCardData, keyFigures } from '../athletes/card';
import { type ProfileAxis, meaningfulAxes, playedAxes, touchesOf } from '../athletes/profile';
import { type Direction, INDICATORS, RECENT_MATCHES, STEADY_BALANCE, type Standing, direction, standing, teamSummary } from '../athletes/summary';
import { rgb } from 'pdf-lib';
import { EVALUATION_SCALES, type Skill } from '../domain/codes';
import type { Messages } from '../i18n';
import type { MatchRecord } from '../matches/record';
import type { ChartsPdfBlock } from '../pdf/charts-pdf';
import { type ReportBlock, renderReportPdf, tableBlock } from '../pdf/report-pdf';
import { type Group, type PlayerOrTotal, num, playerGroups, setGroups, skillGroups } from '../pdf/tabellino-pdf';
import { formatCount, formatDate, formatRating, formatSigned } from '../report/format';
import type { TabellinoLine } from '../report/tabellino';
import type { ShareSection } from '../share/payload';
import { chartImage } from './charts/chart-images';
import { comparisonBlock, teamChartBlocks } from './charts/charts-export';
import { playerPoints, setTrend } from '../report/chart-data';
import { type SquadRow, rowPoints, squadCharts } from '../athletes/squad-history';
import { INDICATOR_TREND_HEIGHT, formatIndicator, indicatorTrendOption } from './charts/IndicatorTrendChart';
import type { MatchReport } from './match-report';
import { loadLogoPng, loadPdfFonts } from './pdf-assets';

/** Width of the small charts printed two per row: their labels print at the same size as the wide ones. */
const SMALL_WIDTH = 420;

/**
 * The card of every athlete: key figures and the indicators against the team
 * as a small table, then the trend of each indicator with enough touches,
 * two charts per row.
 */
async function cardBlocks(cards: readonly AthleteCardData[], m: Messages): Promise<ReportBlock[]> {
  const t = m.profile;
  const blocks: ReportBlock[] = [];
  for (const card of cards) {
    const f = keyFigures(card.stats);
    const figures = [
      `${t.points} ${f.points}`,
      `${t.errors} ${f.errors}${f.aces ? ` (${t.aces(f.aces)})` : ''}`,
      `${t.balance} ${formatSigned(f.balance)}`,
    ].join(' · ');
    const columns = [card.own, ...(card.last ? [card.last] : []), card.team];
    const rows = playedAxes(card.stats).map((axis) => ({ label: t.axes[axis], values: columns.map((c) => formatIndicator(axis, c.values[axis])) }));
    const groups: Group<(typeof rows)[number]>[] = [
      {
        title: '',
        columns: [
          { header: t.indicator, width: 48, align: 'left', value: (r) => r.label },
          ...columns.map((c, i) => ({ header: c.name, width: 34, align: 'right' as const, value: (r: (typeof rows)[number]) => r.values[i] ?? '' })),
        ],
      },
    ];
    blocks.push(tableBlock(card.title, groups, rows, () => false, `${card.subtitle} — ${figures}`));
    const axes = meaningfulAxes(card.stats);
    if (card.trend.length > 1 && axes.length) {
      const items = await Promise.all(
        axes.map(async (axis) => {
          const points = card.trend.map((p) => ({ label: p.label, value: p.values[axis] }));
          const option = indicatorTrendOption(points, axis, card.own.values[axis], card.team.values[axis], m);
          return { title: t.axes[axis], images: [await chartImage(option, INDICATOR_TREND_HEIGHT, true, SMALL_WIDTH)] };
        }),
      );
      blocks.push({ kind: 'grid', items });
    }
  }
  return blocks;
}

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
  /** Rows and cards of the athletes chosen on the page. */
  readonly rows: readonly SquadRow[];
  readonly total: TabellinoLine;
  readonly playerIds: readonly string[];
  readonly cards: readonly AthleteCardData[];
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
    blocks.push(...fromCharts([await comparisonBlock(playerPoints(report.stats, data.playerIds), m)]), ...(await cardBlocks(data.cards, m)));
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
  readonly cards: readonly AthleteCardData[];
}

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

const ABOVE = rgb(0.89, 0.95, 0.9);
const BELOW = rgb(0.98, 0.89, 0.89);

/** The first page, as the page opens: the team with its direction, then every athlete against the team. */
function summaryBlocks(data: HistoryPdf, sections: ReadonlySet<ShareSection>, m: Messages): ReportBlock[] {
  const t = m.summary;
  const p = m.profile;
  const summary = teamSummary(data.records);
  const blocks: ReportBlock[] = [];
  const fillOf = (to: Direction | null) => (to === 'up' ? ABOVE : to === 'down' ? BELOW : undefined);

  if (sections.has('team') && data.records.length) {
    type Line = { label: string; all: string; recent: string; to: Direction | null };
    const perMatch = (v: number) => t.perMatch(formatSigned(Math.round(v * 10) / 10));
    const lines: Line[] = [
      ...INDICATORS.flatMap((a) => {
        const value = summary.values[a];
        if (value === null) return [];
        const recent = summary.recent?.[a] ?? null;
        return [{ label: p.axes[a], all: formatIndicator(a, value), recent: formatIndicator(a, recent), to: direction(value, recent) }];
      }),
      {
        label: p.balance,
        all: `${formatSigned(summary.balance.total)} (${perMatch(summary.balance.perMatch)})`,
        recent: summary.balance.recentPerMatch === null ? '.' : perMatch(summary.balance.recentPerMatch),
        to: direction(summary.balance.perMatch, summary.balance.recentPerMatch, STEADY_BALANCE),
      },
    ];
    const groups: Group<Line>[] = [
      {
        title: '',
        columns: [
          { header: p.indicator, width: 60, align: 'left', value: (r) => r.label },
          { header: m.reportPdf.allMatches, width: 45, align: 'right', value: (r) => r.all },
          { header: capitalised(t.recent(RECENT_MATCHES)), width: 40, align: 'right', value: (r) => r.recent },
          { header: m.reportPdf.direction, width: 30, align: 'left', value: (r) => (r.to ? t.direction[r.to] : '') },
        ],
      },
    ];
    blocks.push(tableBlock(t.teamTitle, groups, lines, () => false, undefined, (r, c) => (c.header === m.reportPdf.direction ? fillOf(r.to) : undefined)));
  }

  if (sections.has('table') && data.rows.length) {
    type Line = { label: string; matches: string; points: string; balance: string; values: Partial<Record<ProfileAxis, string>>; places: Partial<Record<ProfileAxis, Standing | null>>; team?: true };
    const lines: Line[] = data.rows.map((row) => {
      const s = row.totals.stats;
      const own = data.cards.find((c) => c.id === row.id)?.own.values;
      return {
        label: row.label || `n. ${row.numbers.join(', ')}`,
        matches: String(row.totals.matches),
        points: String(s.summary.pointsWon),
        balance: formatSigned(s.summary.balance),
        values: Object.fromEntries(INDICATORS.map((a) => [a, touchesOf(s, a) > 0 ? formatIndicator(a, own?.[a] ?? null) : '.'])),
        places: Object.fromEntries(INDICATORS.map((a) => [a, standing(own?.[a] ?? null, summary.values[a], touchesOf(s, a))])),
      };
    });
    lines.push({
      label: p.team,
      matches: '',
      points: '',
      balance: '',
      values: Object.fromEntries(INDICATORS.map((a) => [a, formatIndicator(a, summary.values[a])])),
      places: {},
      team: true,
    });
    const groups: Group<Line>[] = [
      {
        title: '',
        columns: [
          { header: m.athletes.athlete, width: 42, align: 'left', value: (r) => r.label },
          { header: m.athletes.matchesShort.slice(0, 4), width: 13, align: 'right', value: (r) => r.matches },
          { header: p.points, width: 13, align: 'right', value: (r) => r.points },
          { header: m.scoresheet.balance, width: 14, align: 'right', value: (r) => r.balance },
          ...INDICATORS.map((a) => ({ header: p.axes[a], width: 27, align: 'right' as const, value: (r: Line) => r.values[a] ?? '' })),
        ],
      },
    ];
    const axisOf = (header: string) => INDICATORS.find((a) => p.axes[a] === header);
    const fill = (r: Line, c: { header: string }) => {
      const a = axisOf(c.header);
      const place = a && r.places[a];
      return place === 'above' ? ABOVE : place === 'below' ? BELOW : undefined;
    };
    blocks.push(tableBlock(t.athletesTitle, groups, lines, (r) => r.team === true, m.reportPdf.colours, fill));
  }
  return blocks.length ? [{ kind: 'section', title: m.reportPdf.summaryTitle }, ...blocks] : [];
}

export async function historyReportPdf(data: HistoryPdf, sections: ReadonlySet<ShareSection>, m: Messages): Promise<Uint8Array> {
  const t = m.reportPdf;
  const blocks: ReportBlock[] = [...summaryBlocks(data, sections, m)];
  // After the summary, the full tables under a heading of their own.
  if (sections.has('matches') || (sections.has('table') && data.rows.length)) blocks.push({ kind: 'section', title: t.detailsTitle });
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
    blocks.push(
      { kind: 'section', title: m.share.sectionNames.athleteCharts! },
      ...fromCharts([await comparisonBlock(rowPoints(data.rows), m)]),
      ...(await cardBlocks(data.cards, m)),
    );
  }
  return render(blocks, data.title, data.summary, m);
}

