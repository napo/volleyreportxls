import { useMemo, useState } from 'react';
import { formatRating, formatSigned, playerLabel } from '../../report/format';
import { activePlayers, evaluationShares, playerPoints, pointsBySkill, setTrend } from '../../report/chart-data';
import { EvaluationChart } from '../charts/EvaluationChart';
import { TrendChart } from '../charts/TrendChart';
import { WonLostChart } from '../charts/WonLostChart';
import { percent } from '../charts/tokens';
import type { MatchReport } from '../match-report';
import { useI18n } from '../../i18n';
import type { SavedFile } from '../../platform/save-file';
import { SavedFileLink } from '../components/SavedFileLink';

function Tile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="vr-tile">
      <span className="vr-tile-label">{label}</span>
      <span className="vr-tile-value">{value}</span>
      {note && <span className="vr-tile-note">{note}</span>}
    </div>
  );
}

function TeamSection({ report }: { report: MatchReport }) {
  const { m } = useI18n();
  const t = m.charts;
  const names = { skills: m.skills, opponentErrors: t.opponentErrors };
  const { stats } = report;
  const team = stats.team.match;
  return (
    <>
      <div className="vr-tiles">
        <Tile label={t.directPoints} value={String(team.summary.pointsWon)} note={t.directPointsNote} />
        <Tile label={t.balance} value={formatSigned(team.summary.balance)} note={t.wonLost(team.summary.pointsWon, team.summary.pointsLost)} />
        <Tile label={t.opponentErrors} value={String(stats.opponentErrors)} />
        <Tile label={t.receptionPos} value={percent(team.reception.positivity)} note={t.receptions(team.reception.total)} />
        <Tile label={t.attackPt} value={percent(team.attack.pointRate)} note={t.attacks(team.attack.total)} />
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
          <WonLostChart rows={pointsBySkill(team, stats.opponentErrors, names)} title={t.wonLostBySkill} firstColumn={t.skill} />
        </section>
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{t.trendTitle}</h2>
              <p>{t.trendText}</p>
            </div>
          </div>
          <TrendChart rows={setTrend(stats)} />
        </section>
      </div>
    </>
  );
}

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
    </section>
  );
}

interface PlayersSectionProps {
  readonly report: MatchReport;
  readonly active: ReturnType<typeof activePlayers>;
  /** Selected athletes, in roster order. */
  readonly ordered: readonly string[];
  readonly toggle: (id: string) => void;
}

function PlayersSection({ report, active, ordered, toggle }: PlayersSectionProps) {
  const { m } = useI18n();
  const t = m.charts;
  const { stats } = report;

  return (
    <>
      <fieldset className="vr-choices">
        <legend>{t.choosePlayers}</legend>
        {active.map(({ player }) => (
          <label key={player.id} className="vr-choice">
            <input type="checkbox" checked={ordered.includes(player.id)} onChange={() => toggle(player.id)} />
            {playerLabel(player)}
          </label>
        ))}
      </fieldset>

      {ordered.length === 0 ? (
        <p className="vr-note">{t.selectPlayers}</p>
      ) : (
        <>
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

export default function GraficiView({ report }: { report: MatchReport }) {
  const { tabellino, stats } = report;
  const active = useMemo(() => activePlayers(stats), [stats]);
  const [selected, setSelected] = useState<string[]>(() => active.slice(0, 3).map((p) => p.player.id));
  // A different match starts again from its first athletes.
  const [shownFor, setShownFor] = useState(report);
  if (shownFor !== report) {
    setShownFor(report);
    setSelected(active.slice(0, 3).map((p) => p.player.id));
  }
  const ordered = active.filter((p) => selected.includes(p.player.id)).map((p) => p.player.id);
  const toggle = (id: string) => setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));

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

      <section className="vr-card vr-export">
        <p>{t.pdfIntro(ordered.length)}</p>
        {failed && <p className="vr-message warning">{m.common.pdfError}</p>}
        <button type="button" className="vr-btn vr-btn-primary" onClick={exportPdf} disabled={busy}>
          {busy ? m.common.preparing : m.common.downloadPdf}
        </button>
        <SavedFileLink file={saved} />
      </section>

      <h2 className="vr-section-title">{t.team}</h2>
      <TeamSection report={report} />

      <h2 className="vr-section-title">{t.players}</h2>
      <PlayersSection report={report} active={active} ordered={ordered} toggle={toggle} />
    </>
  );
}
