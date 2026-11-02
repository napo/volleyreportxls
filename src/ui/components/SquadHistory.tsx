// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The history of the squad on one page: the matches and the athletes to put
 * side by side, then one row per athlete with the totals of those matches.
 */
import { useMemo, useState } from 'react';
import { athleteTrend, matchesByAthlete } from '../../athletes/history';
import { rowPoints, squadCharts, squadLine, squadRows } from '../../athletes/squad-history';
import { evaluationShares } from '../../report/chart-data';
import { EvaluationChart } from '../charts/EvaluationChart';
import { WonLostChart } from '../charts/WonLostChart';
import { TrendChart } from '../charts/TrendChart';
import { TeamCharts } from './TeamCharts';
import type { MatchRecord } from '../../matches/record';
import { useI18n } from '../../i18n';
import { href } from '../routes';
import { MatchChoices } from './MatchChoices';
import { type NameOption, NamePicker } from './NamePicker';
import { StatsTable } from './StatsTable';
import { ProfileChart } from '../charts/ProfileChart';
import { meaningfulAxes, profileOf, teamProfile } from '../../athletes/profile';
import { formatDate } from '../../report/format';
import { type ShareSection, forSharing } from '../../share/payload';
import { ShareBox, ShareButton } from './ShareDialog';
import { ReportPdfButton, reportFileName } from './ReportPdfButton';
import type { ProfileSeries } from '../charts/ProfileChart';

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
  const names = { skills: m.skills, opponentErrors: m.charts.opponentErrors };
  // Each athlete against the own last match and the team, as in the athlete's page.
  const profiles = useMemo(
    () =>
      rows.map((row) => {
        const last = chosenOf(row.id).at(-1);
        const series: ProfileSeries[] = [
          { kind: 'athlete', name: m.profile.own, values: profileOf(row.totals.stats) },
          ...(last && row.totals.matches > 1
            ? [{ kind: 'last' as const, name: `${m.profile.last}: ${formatDate(last.record.date)}`, values: profileOf(last.stats) }]
            : []),
          { kind: 'team', name: m.profile.team, values: team },
        ];
        return { id: row.id, title: row.label, series, axes: meaningfulAxes(row.totals.stats) };
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
    return historyReportPdf({ title: m.share.historyTitle(title), summary, records: chosenRecords, rows, total, profiles, trends: new Map(rows.map((r) => [r.id, athleteTrend(chosenOf(r.id))])) }, sections, m);
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

      {shown('table') && (
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{t.listTitle}</h2>
              <p>{shared ? t.sharedListText : t.listText}</p>
            </div>
          </div>
          {rows.length === 0 ? (
            <p className="vr-note">{t.noneChosen}</p>
          ) : (
            <StatsTable rows={rows} total={total} matches={played.filter((r) => chosenMatch(r.id)).length} link={athleteHref} />
          )}
        </section>
      )}

      {shown('team') && chosenRecords.length > 0 && (
        <>
          <h2 className="vr-section-title">{m.charts.team}</h2>
          <TeamCharts
            team={charts.team}
            opponentErrors={charts.opponentErrors}
            trend={charts.trend}
            trendTexts={{ title: t.trendTitle, text: t.trendText, label: t.trendLabel, firstColumn: t.match }}
          />
        </>
      )}

      {shown('athleteCharts') && rows.length > 0 && (
        <>
          <h2 className="vr-section-title">{m.share.sectionNames.athleteCharts}</h2>
          <section className="vr-card">
            <div className="vr-card-head">
              <div>
                <h2>{m.charts.compareTitle}</h2>
                <p>{m.charts.compareText}</p>
              </div>
            </div>
            <WonLostChart rows={rowPoints(rows)} title={m.charts.compareLabel} firstColumn={m.charts.player} />
          </section>
          <div className="vr-grid-2">
            {rows.map((row) => (
              <section key={row.id} className="vr-card">
                <h3>{row.label || `n. ${row.numbers.join(', ')}`}</h3>
                <EvaluationChart rows={evaluationShares(row.totals.stats, names)} title={m.charts.playerEvaluations(row.label)} />
                {row.totals.matches > 1 && (
                  <>
                    <h3>{t.trendTitle}</h3>
                    <p className="vr-note">{t.trendText}</p>
                    <TrendChart rows={athleteTrend(chosenOf(row.id))} firstColumn={t.match} label={`${t.trendLabel}: ${row.label}`} />
                  </>
                )}
              </section>
            ))}
          </div>
        </>
      )}

      {shown('profiles') && rows.length > 0 && (
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{m.profile.title}</h2>
              <p>{m.profile.text}</p>
            </div>
          </div>
          <div className="vr-profiles">
            {profiles.map((p) => (
              <div key={p.id}>
                <h3>{shared ? p.title : <a href={href('atleta', p.id)}>{p.title}</a>}</h3>
                <ProfileChart series={p.series} axes={p.axes} label={m.profile.label(p.title)} />
              </div>
            ))}
          </div>
        </section>
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
