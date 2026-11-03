// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The history of the squad on one page: the matches and the athletes to put
 * side by side, then one row per athlete with the totals of those matches.
 */
import { useMemo, useState } from 'react';
import { matchesByAthlete } from '../../athletes/history';
import type { AthleteCardData } from '../../athletes/card';
import { rowPoints, squadCharts, squadLine, squadRows } from '../../athletes/squad-history';
import { WonLostChart } from '../charts/WonLostChart';
import { AthleteTable } from './AthleteTable';
import { TeamSummary } from './TeamSummary';
import { teamSummary } from '../../athletes/summary';
import { TeamCharts } from './TeamCharts';
import type { MatchRecord } from '../../matches/record';
import { useI18n } from '../../i18n';
import { href } from '../routes';
import { MatchChoices } from './MatchChoices';
import { type NameOption, NamePicker } from './NamePicker';
import { StatsTable } from './StatsTable';
import { profileOf, teamProfile } from '../../athletes/profile';
import { formatDate, formatRating } from '../../report/format';
import { type ShareSection, forSharing } from '../../share/payload';
import { ShareBox, ShareButton } from './ShareDialog';
import { ReportPdfButton, reportFileName } from './ReportPdfButton';

interface Props {
  /** The matches of the squad. */
  readonly records: readonly MatchRecord[];
  /** The athletes linked to the squad, with the label to show. */
  readonly athletes: readonly NameOption[];
  /** Name of the squad, for the shared report. */
  readonly title: string;
  /** In a shared report: the sections left out (and no links to the pages of the app). */
  readonly shared?: { readonly hidden: readonly ShareSection[] };
}

export function SquadHistory({ records, athletes, title, shared }: Props) {
  const shown = (section: ShareSection) => !shared?.hidden.includes(section);
  const athleteHref = (id: string) => (shared ? undefined : href('atleta', id));
  const { m } = useI18n();
  const t = m.athletes;
  // Matches left out and athletes chosen by the user (at first the whole roster).
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());
  const [selected, setSelected] = useState<readonly string[]>(() => athletes.map((a) => a.id));

  const byAthlete = useMemo(() => matchesByAthlete(records), [records]);
  // Only the matches in which some athlete of the squad is linked.
  const played = useMemo(
    () => records.filter((r) => athletes.some((a) => byAthlete.get(a.id)?.some((x) => x.record.id === r.id))).sort((a, b) => a.date.localeCompare(b.date)),
    [records, athletes, byAthlete],
  );
  const chosenMatch = (id: string) => !excluded.has(id);
  const rows = useMemo(
    () => squadRows(byAthlete, selected.flatMap((id) => athletes.filter((a) => a.id === id)), chosenMatch),
    [byAthlete, athletes, selected, excluded],
  );
  const total = useMemo(() => squadLine(byAthlete, rows, chosenMatch), [byAthlete, rows, excluded]);
  const chosenOf = (id: string) => (byAthlete.get(id) ?? []).filter((x) => chosenMatch(x.record.id));
  const chosenRecords = useMemo(() => played.filter((r) => chosenMatch(r.id)), [played, excluded]);
  const team = useMemo(() => teamProfile(chosenRecords), [chosenRecords]);
  const charts = useMemo(() => squadCharts(chosenRecords), [chosenRecords]);
  const summary = useMemo(() => teamSummary(chosenRecords), [chosenRecords]);
  // The choice of matches and roster stays folded: the page opens on the answers.
  const [choosing, setChoosing] = useState(false);
  // The card of each athlete: against the own last match and the team, match by match.
  const cards = useMemo(
    () =>
      rows.map((row): AthleteCardData => {
        const matches = chosenOf(row.id);
        const last = matches.at(-1);
        const p = m.profile;
        return {
          id: row.id,
          title: row.label || `n. ${row.numbers.join(', ')}`,
          subtitle: `n. ${row.numbers.join(', ')} · ${p.summary(row.totals.matches, row.totals.sets, formatRating(row.totals.rating))}`,
          stats: row.totals.stats,
          own: { name: p.own, values: profileOf(row.totals.stats) },
          ...(last && matches.length > 1 && { last: { name: `${p.last} ${formatDate(last.record.date)}`, values: profileOf(last.stats) } }),
          team: { name: p.team, values: team },
          trend: matches.map((x) => ({ label: [formatDate(x.record.date), x.record.opponentName].filter(Boolean).join(' '), values: profileOf(x.stats) })),
          trendTitle: p.trendMatches,
          trendColumn: m.athletes.match,
        };
      }),
    [rows, byAthlete, excluded, team, m],
  );
  const share = async (names: boolean) => ({
    ...forSharing(chosenRecords, rows.map((r) => ({ id: r.id, label: r.label })), names),
    title,
    numbers: [],
  });
  const dates = chosenRecords.map((r) => r.date).filter(Boolean);
  const pdf = async (sections: ReadonlySet<ShareSection>) => {
    const { historyReportPdf } = await import('../report-pdf-export');
    const summary = m.share.summary(chosenRecords.length, formatDate(dates[0] ?? ''), formatDate(dates.at(-1) ?? ''));
    return historyReportPdf({ title: m.share.historyTitle(title), summary, records: chosenRecords, rows, total, cards }, sections, m);
  };

  return (
    <>
      {rows.length > 0 && (
        <div className="vr-actions start vr-report-actions">
          {!shared && <ShareButton kind="history" subject={m.share.historyTitle(title)} build={share} />}
          <ReportPdfButton kind="history" fileName={reportFileName(m.share.historyTitle(title))} make={pdf} />
        </div>
      )}

      {shown('matches') && (
        <div className="vr-choice-summary">
          <span>
            {m.summary.choice(chosenRecords.length, formatDate(dates[0] ?? ''), formatDate(dates.at(-1) ?? ''), rows.length, athletes.length)}
          </span>
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" aria-expanded={choosing} onClick={() => setChoosing(!choosing)}>
            {choosing ? m.summary.close : m.summary.change}
          </button>
        </div>
      )}

      {shown('matches') && choosing && (
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{t.chooseTitle}</h2>
              <p>{t.chooseText}</p>
            </div>
            <div className="vr-actions start">
              <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => setExcluded(new Set())}>
                {t.allMatches}
              </button>
            </div>
          </div>
          <MatchChoices items={played.map((record) => ({ record }))} excluded={excluded} onChange={setExcluded} />
          <NamePicker legend={t.roster} options={athletes} selected={selected} onChange={setSelected} />
        </section>
      )}

      {shown('team') && chosenRecords.length > 0 && (
        <>
          <h2 className="vr-section-title">{m.summary.teamTitle}</h2>
          <TeamSummary summary={summary} />
        </>
      )}

      {shown('table') && (
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{m.summary.athletesTitle}</h2>
              <p>{m.summary.athletesText}</p>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="vr-note">{t.noneChosen}</p>
          ) : (
            <>
              <AthleteTable rows={rows} cards={cards} team={team} open={shown('athleteCharts')} />
              <details className="vr-more">
                <summary>{m.summary.allColumns}</summary>
                <StatsTable rows={rows} total={total} matches={chosenRecords.length} link={athleteHref} />
              </details>
            </>
          )}
        </section>
      )}

      {shown('team') && chosenRecords.length > 0 && (
        <details className="vr-more vr-more-section">
          <summary>{m.summary.teamCharts}</summary>
          <TeamCharts
            team={charts.team}
            opponentErrors={charts.opponentErrors}
            trend={charts.trend}
            trendTexts={{ title: t.trendTitle, text: t.trendText, label: t.trendLabel, firstColumn: t.match }}
            tiles={false}
          />
          {rows.length > 1 && (
            <section className="vr-card">
              <div className="vr-card-head">
                <div>
                  <h2>{m.charts.compareTitle}</h2>
                  <p>{m.charts.compareText}</p>
                </div>
              </div>
              <WonLostChart rows={rowPoints(rows)} title={m.charts.compareLabel} firstColumn={m.charts.player} />
            </section>
          )}
        </details>
      )}

      {rows.length > 0 && (
        <ShareBox>
          {!shared && <ShareButton kind="history" subject={m.share.historyTitle(title)} primary build={share} />}
          <ReportPdfButton kind="history" fileName={reportFileName(m.share.historyTitle(title))} make={pdf} />
        </ShareBox>
      )}
    </>
  );
}
