// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useState } from 'react';
import { formatRating, formatSigned, playerLabel } from '../../report/format';
import { activePlayers, evaluationShares, playerPoints, playerSetTrend, setTrend } from '../../report/chart-data';
import { TrendChart } from '../charts/TrendChart';
import { EvaluationChart } from '../charts/EvaluationChart';
import { WonLostChart } from '../charts/WonLostChart';
import type { MatchReport } from '../match-report';
import { useI18n } from '../../i18n';
import type { SavedFile } from '../../platform/save-file';
import { SavedFileLink } from '../components/SavedFileLink';
import { ShareButton } from '../components/ShareDialog';
import { sharedMatch } from './TabellinoView';
import { useArchive } from '../archive-context';
import type { ShareSection } from '../../share/payload';
import { NamePicker } from '../components/NamePicker';
import { ReportPdfButton, reportFileName } from '../components/ReportPdfButton';
import type { ProfileSeries } from '../charts/ProfileChart';
import { TeamCharts, Tile } from '../components/TeamCharts';
import { ProfileChart } from '../charts/ProfileChart';
import { meaningfulAxes, profileOf } from '../../athletes/profile';
import { StatsTable } from '../components/StatsTable';
import { matchRows } from '../../athletes/squad-history';
import { calculateStatLine } from '../../domain/stats/aggregate';
import { tabellinoLine } from '../../report/tabellino';

function PlayerCard({ report, playerId }: { report: MatchReport; playerId: string }) {
  const { m } = useI18n();
  const t = m.charts;
  const { stats, tabellino } = report;
  const player = stats.players.find((p) => p.player.id === playerId)!;
  const row = tabellino.players.find((p) => p.player.id === playerId)!;
  return (
    <section className="vr-card">
      <div className="vr-card-head">
        <div>
          <h2>
            <span className="vr-player-number">{player.player.number}</span> {player.player.name.trim()}
            {player.player.role === 'L' && <span className="vr-badge vr-badge-orange">{t.libero}</span>}
          </h2>
          <p>{t.setsPlayed(player.setsPlayed.join(', '))}</p>
        </div>
        <div className="vr-tiles vr-tiles-compact">
          <Tile label={t.rating} value={formatRating(row.rating)} />
          <Tile label={t.points} value={String(player.match.summary.pointsWon)} />
          <Tile label={t.balance} value={formatSigned(player.match.summary.balance)} />
        </div>
      </div>
      <EvaluationChart rows={evaluationShares(player.match, { skills: m.skills, opponentErrors: t.opponentErrors })} title={t.playerEvaluations(playerLabel(player.player))} />
      {player.setsPlayed.length > 1 && (
        <>
          <h3>{t.trendTitle}</h3>
          <p className="vr-note">{t.trendText}</p>
          <TrendChart rows={playerSetTrend(player)} label={`${t.trendLabel}: ${playerLabel(player.player)}`} />
        </>
      )}
      <h3>{m.profile.title}</h3>
      <p className="vr-note">{m.profile.matchText}</p>
      <ProfileChart
        series={[
          { kind: 'athlete', name: m.profile.match, values: profileOf(player.match) },
          { kind: 'team', name: m.profile.team, values: profileOf(stats.team.match) },
        ]}
        axes={meaningfulAxes(player.match)}
        label={m.profile.label(playerLabel(player.player))}
      />
    </section>
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
  const numbers = ordered.flatMap((id) => active.filter((p) => p.player.id === id).map((p) => p.player.number));

  // The report PDF: the blocks chosen, with the athletes chosen on the page.
  async function reportPdf(sections: ReadonlySet<ShareSection>) {
    const { matchReportPdf } = await import('../report-pdf-export');
    const rows = matchRows(stats, ordered);
    const events = new Set(rows.flatMap((r) => r.numbers));
    const total = tabellinoLine(calculateStatLine(stats.events.filter((e) => e.playerNumber !== null && events.has(e.playerNumber))));
    const profiles = ordered.flatMap((id) => {
      const p = stats.players.find((x) => x.player.id === id);
      if (!p) return [];
      const series: ProfileSeries[] = [
        { kind: 'athlete', name: m.profile.match, values: profileOf(p.match) },
        { kind: 'team', name: m.profile.team, values: profileOf(stats.team.match) },
      ];
      return [{ title: playerLabel(p.player), series, axes: meaningfulAxes(p.match) }];
    });
    return matchReportPdf({ report, rows, total, playerIds: ordered, profiles }, sections, m);
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
          {report.recordId && !shared && <ShareButton kind="match" build={(names) => sharedMatch(archive, report.recordId!, names, numbers)} />}
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
    </>
  );
}
