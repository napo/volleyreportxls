// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from 'react';
import { formatRating, playerLabel } from '../../report/format';
import { activePlayers, playerPoints, setTrend } from '../../report/chart-data';
import { WonLostChart } from '../charts/WonLostChart';
import type { MatchReport } from '../match-report';
import { type Messages, useI18n } from '../../i18n';
import type { SavedFile } from '../../platform/save-file';
import { SavedFileLink } from '../components/SavedFileLink';
import { ShareBox, ShareButton } from '../components/ShareDialog';
import { sharedMatch } from './TabellinoView';
import { useArchive } from '../archive-context';
import type { ShareSection } from '../../share/payload';
import { NamePicker } from '../components/NamePicker';
import { ReportPdfButton, reportFileName } from '../components/ReportPdfButton';
import { TeamCharts } from '../components/TeamCharts';
import { profileOf } from '../../athletes/profile';
import type { AthleteCardData } from '../../athletes/card';
import { AthleteCard } from '../components/AthleteCard';
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

function PlayerCard({ report, playerId }: { report: MatchReport; playerId: string }) {
  const { m } = useI18n();
  const card = matchCard(report, playerId, m);
  const player = report.stats.players.find((p) => p.player.id === playerId);
  if (!card || !player) return null;
  return (
    <AthleteCard
      card={card}
      heading={
        <>
          <span className="vr-player-number">{player.player.number}</span> {player.player.name.trim()}
          {player.player.role === 'L' && <span className="vr-badge vr-badge-orange">{m.charts.libero}</span>}
        </>
      }
    />
  );
}

interface PlayersSectionProps {
  readonly report: MatchReport;
  readonly active: ReturnType<typeof activePlayers>;
  /** Selected athletes, in the order chosen. */
  readonly ordered: readonly string[];
  readonly onChange: (selected: readonly string[]) => void;
}

function PlayersSection({ report, active, ordered, onChange }: PlayersSectionProps) {
  const { m } = useI18n();
  const t = m.charts;
  const { stats } = report;
  const rows = useMemo(() => matchRows(stats, ordered), [stats, ordered]);
  const total = useMemo(() => {
    const numbers = new Set(rows.flatMap((r) => r.numbers));
    return tabellinoLine(calculateStatLine(stats.events.filter((e) => e.playerNumber !== null && numbers.has(e.playerNumber))));
  }, [stats, rows]);

  return (
    <>
      <section className="vr-card">
        <NamePicker legend={t.choosePlayers} options={active.map(({ player }) => ({ id: player.id, label: playerLabel(player) }))} selected={ordered} onChange={onChange} />
      </section>

      {ordered.length === 0 ? (
        <p className="vr-note">{t.selectPlayers}</p>
      ) : (
        <>
          <section className="vr-card">
            <div className="vr-card-head">
              <div>
                <h2>{m.athletes.listTitle}</h2>
                <p>{t.tableText}</p>
              </div>
            </div>
            <StatsTable rows={rows} total={total} />
          </section>
          <section className="vr-card">
            <div className="vr-card-head">
              <div>
                <h2>{t.compareTitle}</h2>
                <p>{t.compareText}</p>
              </div>
            </div>
            <WonLostChart rows={playerPoints(stats, ordered)} title={t.compareLabel} firstColumn={t.player} />
          </section>
          {ordered.map((id) => (
            <PlayerCard key={id} report={report} playerId={id} />
          ))}
        </>
      )}
    </>
  );
}

interface Props {
  readonly report: MatchReport;
  /** In a shared report: the sections left out and the shirts chosen by who shared it. */
  readonly shared?: { readonly hidden: readonly ShareSection[]; readonly numbers: readonly number[] };
}

export default function GraficiView({ report, shared }: Props) {
  const { tabellino, stats } = report;
  const { archive } = useArchive();
  const active = useMemo(() => activePlayers(stats), [stats]);
  // The shirts of the shared report, otherwise the three with most touches.
  const first = () => {
    const chosen = active.filter((p) => shared?.numbers.includes(p.player.number));
    return (chosen.length ? chosen : active.slice(0, 3)).map((p) => p.player.id);
  };
  const [selected, setSelected] = useState<readonly string[]>(first);
  // A different match starts again from its first athletes.
  const [shownFor, setShownFor] = useState(report);
  if (shownFor !== report) {
    setShownFor(report);
    setSelected(first());
  }
  const ordered = selected.filter((id) => active.some((p) => p.player.id === id));
  const shown = (section: ShareSection) => !shared?.hidden.includes(section);
  const subject = `${tabellino.teamName} – ${tabellino.opponentName}`;
  const numbers = ordered.flatMap((id) => active.filter((p) => p.player.id === id).map((p) => p.player.number));

  // The report PDF: the blocks chosen, with the athletes chosen on the page.
  async function reportPdf(sections: ReadonlySet<ShareSection>) {
    const { matchReportPdf } = await import('../report-pdf-export');
    const rows = matchRows(stats, ordered);
    const events = new Set(rows.flatMap((r) => r.numbers));
    const total = tabellinoLine(calculateStatLine(stats.events.filter((e) => e.playerNumber !== null && events.has(e.playerNumber))));
    const cards = ordered.flatMap((id) => matchCard(report, id, m) ?? []);
    return matchReportPdf({ report, rows, total, playerIds: ordered, cards }, sections, m);
  }

  const { m } = useI18n();
  const t = m.charts;
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<SavedFile | null>(null);
  async function exportPdf() {
    setBusy(true);
    setFailed(false);
    setSaved(null);
    try {
      // PDF library and canvas renderer are loaded only when needed.
      const { exportChartsPdf } = await import('../charts/charts-export');
      setSaved(await exportChartsPdf(report, ordered, m));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }
  return (
    <>
      {!shared && (
        <header className="vr-hero">
          <p className="vr-eyebrow">
            {t.title} · {report.recordId ? m.common.match : m.common.example}
          </p>
          <h1>
            {tabellino.teamName} – {tabellino.opponentName}
          </h1>
          <ul className="vr-meta">
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
      )}

      <section className="vr-card vr-export">
        <p>{t.pdfIntro(ordered.length)}</p>
        {failed && <p className="vr-message warning">{m.common.pdfError}</p>}
        <div className="vr-actions start">
          <button type="button" className="vr-btn vr-btn-primary" onClick={exportPdf} disabled={busy}>
            {busy ? m.common.preparing : m.common.downloadPdf}
          </button>
          <ReportPdfButton kind="match" fileName={reportFileName(`${tabellino.teamName} · ${tabellino.opponentName}`)} make={reportPdf} />
          {report.recordId && !shared && <ShareButton kind="match" subject={subject} build={(names) => sharedMatch(archive, report.recordId!, names, numbers)} />}
        </div>
        <SavedFileLink file={saved} />
      </section>

      {shown('team') && (
        <>
          <h2 className="vr-section-title">{t.team}</h2>
          <TeamCharts team={report.stats.team.match} opponentErrors={report.stats.opponentErrors} trend={setTrend(report.stats)} />
        </>
      )}

      {shown('players') && (
        <>
          <h2 className="vr-section-title">{t.players}</h2>
          <PlayersSection report={report} active={active} ordered={ordered} onChange={setSelected} />
        </>
      )}

      <ShareBox>
        {report.recordId && !shared && (
          <ShareButton kind="match" subject={subject} primary build={(names) => sharedMatch(archive, report.recordId!, names, numbers)} />
        )}
        <ReportPdfButton kind="match" fileName={reportFileName(`${tabellino.teamName} · ${tabellino.opponentName}`)} make={reportPdf} />
      </ShareBox>
    </>
  );
}
