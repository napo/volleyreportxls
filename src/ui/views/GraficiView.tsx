// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from 'react';
import { formatDate, formatRating, playerLabel } from '../../report/format';
import { activePlayers, playerPoints, setTrend } from '../../report/chart-data';
import { WonLostChart } from '../charts/WonLostChart';
import type { MatchReport } from '../match-report';
import { type Messages, useI18n } from '../../i18n';
import { ShareBox, ShareButton } from '../components/ShareDialog';
import { sharedMatch } from './TabellinoView';
import { useArchive } from '../archive-context';
import type { ShareSection } from '../../share/payload';
import { ReportPdfButton, reportFileName } from '../components/ReportPdfButton';
import { TeamCharts } from '../components/TeamCharts';
import { profileOf } from '../../athletes/profile';
import type { AthleteCardData } from '../../athletes/card';
import { AthleteTable } from '../components/AthleteTable';
import { TeamSummary } from '../components/TeamSummary';
import { matchSummary } from '../../athletes/summary';
import { StatsTable } from '../components/StatsTable';
import { matchRows } from '../../athletes/squad-history';
import { calculateStatLine } from '../../domain/stats/aggregate';
import { tabellinoLine } from '../../report/tabellino';

/** The card of a player in this match: against the team in the same match, set by set. */
function matchCard(report: MatchReport, id: string, m: Messages): AthleteCardData | null {
  const { stats, tabellino } = report;
  const p = stats.players.find((x) => x.player.id === id);
  if (!p) return null;
  const rating = tabellino.players.find((x) => x.player.id === id)?.rating ?? null;
  return {
    id,
    title: playerLabel(p.player),
    subtitle: `${m.charts.setsPlayed(p.setsPlayed.join(', '))} · ${m.charts.rating} ${formatRating(rating)}`,
    stats: p.match,
    own: { name: m.profile.match, values: profileOf(p.match) },
    team: { name: m.profile.team, values: profileOf(stats.team.match) },
    trend: p.setsPlayed.map((n) => ({ label: `${m.scoresheet.set} ${n}`, values: profileOf(p.bySet[n]) })),
    trendTitle: m.profile.trendSets,
    trendColumn: m.scoresheet.set,
  };
}

interface Props {
  readonly report: MatchReport;
  /** In a shared report: the sections left out. */
  readonly shared?: { readonly hidden: readonly ShareSection[] };
}

/**
 * The charts of a match, read as the history is: the team with its last set,
 * every athlete against the team (a click opens the card), and the full
 * tables and team charts when asked.
 */
export default function GraficiView({ report, shared }: Props) {
  const { tabellino, stats } = report;
  const { archive } = useArchive();
  const { m } = useI18n();
  const t = m.charts;
  const ids = useMemo(() => activePlayers(stats).map((p) => p.player.id), [stats]);
  const rows = useMemo(() => matchRows(stats, ids), [stats, ids]);
  const cards = useMemo(() => ids.flatMap((id) => matchCard(report, id, m) ?? []), [report, ids, m]);
  const total = useMemo(() => tabellinoLine(calculateStatLine(stats.events.filter((e) => e.playerNumber !== null))), [stats]);
  const summary = useMemo(() => matchSummary(stats), [stats]);
  const shown = (section: ShareSection) => !shared?.hidden.includes(section);
  const subject = `${tabellino.teamName} – ${tabellino.opponentName}`;
  const fileName = reportFileName(`${tabellino.teamName} · ${tabellino.opponentName}`);
  const share = (names: boolean) => sharedMatch(archive, report.recordId!, names);

  // The report PDF: the blocks chosen, with every athlete who played.
  async function reportPdf(sections: ReadonlySet<ShareSection>) {
    const { matchReportPdf } = await import('../report-pdf-export');
    return matchReportPdf({ report, rows, total, playerIds: ids, cards }, sections, m);
  }

  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">{shared ? m.share.eyebrow : `${t.title} · ${report.recordId ? m.common.match : m.common.example}`}</p>
        <h1>
          {tabellino.teamName} – {tabellino.opponentName}
        </h1>
        <ul className="vr-meta">
          {/* A shared report has no scoresheet page above: competition and date go here. */}
          {shared && [tabellino.competition, formatDate(tabellino.date)].filter(Boolean).map((text) => <li key={text}>{text}</li>)}
          <li>
            {tabellino.setsWon.team}-{tabellino.setsWon.opponent}
          </li>
          {tabellino.setScores.map(({ number, score }) => (
            <li key={number}>
              {score.team}-{score.opponent}
            </li>
          ))}
        </ul>
      </header>

      <div className="vr-actions start vr-report-actions">
        {report.recordId && !shared && <ShareButton kind="match" subject={subject} build={share} />}
        <ReportPdfButton kind="match" fileName={fileName} make={reportPdf} />
      </div>

      {shown('team') && (
        <>
          <h2 className="vr-section-title">{m.summary.teamTitle}</h2>
          <TeamSummary summary={summary} />
        </>
      )}

      {shown('players') && rows.length > 0 && (
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{m.summary.athletesTitle}</h2>
              <p>{m.summary.athletesText}</p>
            </div>
          </div>
          <AthleteTable rows={rows} cards={cards} team={summary.values} open unit="sets" />
          <details className="vr-more">
            <summary>{m.summary.allColumns}</summary>
            <StatsTable rows={rows} total={total} />
          </details>
        </section>
      )}

      {shown('team') && (
        <details className="vr-more vr-more-section">
          <summary>{m.summary.teamCharts}</summary>
          <TeamCharts team={stats.team.match} opponentErrors={stats.opponentErrors} trend={setTrend(stats)} tiles={false} />
          {rows.length > 1 && (
            <section className="vr-card">
              <div className="vr-card-head">
                <div>
                  <h2>{t.compareTitle}</h2>
                  <p>{t.compareText}</p>
                </div>
              </div>
              <WonLostChart rows={playerPoints(stats, ids)} title={t.compareLabel} firstColumn={t.player} />
            </section>
          )}
        </details>
      )}

      {!shared && (
        <ShareBox>
          {report.recordId && <ShareButton kind="match" subject={subject} primary build={share} />}
          <ReportPdfButton kind="match" fileName={fileName} make={reportPdf} />
        </ShareBox>
      )}
    </>
  );
}
