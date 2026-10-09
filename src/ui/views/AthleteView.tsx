// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * One athlete: name and note, the shirt numbers linked to it, and the history
 * of the chosen matches (totals, trend, match by match).
 */
import { useMemo, useState } from 'react';
import { type Athlete, athleteLabel, entryLabel, linkEntry } from '../../athletes/matching';
import { athleteMatches, athleteTotals, athleteTrend } from '../../athletes/history';
import { evaluationShares } from '../../report/chart-data';
import { formatDate, formatRating, formatSigned } from '../../report/format';
import { useI18n } from '../../i18n';
import { EvaluationChart } from '../charts/EvaluationChart';
import { TrendChart } from '../charts/TrendChart';
import { percent } from '../charts/tokens';
import { inSquad } from '../../athletes/squads';
import { useAthletesData } from '../athletes-data';
import { PointsCells, SkillCells, SkillGroups, SkillHeaders } from '../components/TabellinoTable';
import { href, navigate } from '../routes';

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <div className="vr-tile">
      <span className="vr-tile-label">{label}</span>
      <span className="vr-tile-value">{value}</span>
    </div>
  );
}

/** Name and note, saved when the field is left. */
function AthleteFields({ athlete, onSave }: { athlete: Athlete; onSave: (a: Athlete) => void }) {
  const t = useI18n().m.athletes;
  const [name, setName] = useState(athlete.name);
  const [note, setNote] = useState(athlete.note);
  const save = () => (name !== athlete.name || note !== athlete.note) && onSave({ ...athlete, name: name.trim(), note: note.trim() });
  return (
    <div className="vr-form-grid">
      <label className="vr-field">
        <span>{t.name}</span>
        <input value={name} onChange={(e) => setName(e.target.value)} onBlur={save} />
      </label>
      <label className="vr-field">
        <span>{t.note}</span>
        <input value={note} onChange={(e) => setNote(e.target.value)} onBlur={save} />
      </label>
    </div>
  );
}

export default function AthleteView({ id }: { id: string }) {
  const { m } = useI18n();
  const t = m.athletes;
  const s = m.scoresheet;
  const { archive, data, reload } = useAthletesData();
  // Matches left out of the history by the user.
  const [excluded, setExcluded] = useState<ReadonlySet<string>>(new Set());

  const athlete = data?.athletes.find((a) => a.id === id) ?? null;
  const all = useMemo(() => (data ? athleteMatches(data.records, id) : []), [data, id]);
  const chosen = useMemo(() => all.filter((x) => !excluded.has(x.record.id)), [all, excluded]);
  const totals = useMemo(() => athleteTotals(chosen), [chosen]);

  if (!data || !archive) return <p className="vr-note">{m.common.loading}</p>;
  if (!athlete) {
    return (
      <section className="vr-card">
        <p>{t.notFound}</p>
        <a className="vr-btn vr-btn-secondary" href={href('storico')}>
          {t.back}
        </a>
      </section>
    );
  }

  const own = data.entries.filter((e) => e.athleteId === id);
  const title = athleteLabel(athlete, data.entries);
  const toggle = (matchId: string) =>
    setExcluded((ex) => {
      const next = new Set(ex);
      if (!next.delete(matchId)) next.add(matchId);
      return next;
    });

  // The matches by team name and competition (one roster each), in order of first match.
  const groups = all.reduce<{ key: string; label: string; matches: typeof all }[]>((list, x) => {
    const key = `${x.record.teamName}|${x.record.competition}`;
    const group = list.find((g) => g.key === key);
    if (group) group.matches.push(x);
    else list.push({ key, label: [x.record.competition, x.record.teamName].filter((s) => s.trim()).join(' · ') || '—', matches: [x] });
    return list;
  }, []);
  const toggleAll = (ids: readonly string[], include: boolean) =>
    setExcluded((ex) => {
      const next = new Set(ex);
      ids.forEach((id) => (include ? next.delete(id) : next.add(id)));
      return next;
    });
  const squadNames = data.squads.filter((s) => own.some((e) => inSquad(s, e.teamName))).map((s) => s.name);
  const back = href('storico', data.squads.find((s) => own.some((e) => inSquad(s, e.teamName)))?.id);

  const unlink = async (key: string) => {
    const entry = own.find((e) => e.key === key)!;
    await archive.saveLink(linkEntry(data.records, entry, null), entry.teamName, entry.competition, entry.number, null);
    await reload();
  };
  const remove = async () => {
    if (!window.confirm(t.confirmDelete)) return;
    await archive.deleteAthlete(id);
    navigate('storico');
  };

  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">
          {t.history}
          {squadNames.length > 0 && ` · ${squadNames.join(', ')}`}
        </p>
        <h1>{athlete.name.trim() || title}</h1>
        <ul className="vr-meta">
          {athlete.note.trim() && <li>{athlete.note.trim()}</li>}
          {own.map((e) => (
            <li key={e.key}>{entryLabel(e)}</li>
          ))}
        </ul>
        <div className="vr-actions start">
          <a className="vr-btn vr-btn-secondary" href={back}>
            {t.back}
          </a>
        </div>
      </header>

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.dataTitle}</h2>
          </div>
        </div>
        <AthleteFields key={athlete.id} athlete={athlete} onSave={async (a) => (await archive.saveAthlete(a), await reload())} />
        <h3>{t.shirtsTitle}</h3>
        <p className="vr-note">{t.shirtsText}</p>
        <ul className="vr-matches">
          {own.map((e) => (
            <li key={e.key}>
              <span>
                <strong>{entryLabel(e)}</strong>
                <span>
                  {e.names.join(' · ')}
                  {e.names.length > 0 && ' · '}
                  {t.matchesCount(e.matchIds.length)}
                </span>
              </span>
              <span className="vr-actions start">
                <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => unlink(e.key)}>
                  {t.unlink}
                </button>
              </span>
            </li>
          ))}
        </ul>
        <div className="vr-actions start">
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small vr-btn-danger" onClick={remove}>
            {t.delete}
          </button>
        </div>
      </section>

      {all.length > 0 && (
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{t.matchesTitle}</h2>
              <p>{t.matchesText}</p>
            </div>
            <div className="vr-actions start">
              <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => setExcluded(new Set())}>
                {t.all}
              </button>
            </div>
          </div>
          {groups.map(({ key, label, matches }) => {
            const ids = matches.map((x) => x.record.id);
            const on = ids.filter((id) => !excluded.has(id)).length;
            return (
              <fieldset key={key} className="vr-choices vr-match-group">
                <legend>
                  <label className="vr-check">
                    <input
                      type="checkbox"
                      checked={on === ids.length}
                      ref={(el) => {
                        if (el) el.indeterminate = on > 0 && on < ids.length;
                      }}
                      onChange={() => toggleAll(ids, on < ids.length)}
                    />
                    {label}
                  </label>
                </legend>
                {matches.map((x) => (
                  <label key={x.record.id} className="vr-choice">
                    <input type="checkbox" checked={!excluded.has(x.record.id)} onChange={() => toggle(x.record.id)} />
                    {formatDate(x.record.date)} {x.record.opponentName || m.common.opponent} · n. {x.number}
                  </label>
                ))}
              </fieldset>
            );
          })}
        </section>
      )}

      {chosen.length === 0 ? (
        all.length > 0 && <p className="vr-note">{t.noneSelected}</p>
      ) : (
        <>
          <div className="vr-tiles">
            <Tile label={t.matches} value={String(totals.matches)} />
            <Tile label={t.sets} value={String(totals.sets)} />
            <Tile label={t.meanRating} value={formatRating(totals.rating)} />
            <Tile label={m.charts.points} value={String(totals.line.points.total)} />
            <Tile label={m.charts.balance} value={formatSigned(totals.line.points.balance)} />
            <Tile label={m.charts.receptionPos} value={totals.stats.reception.total ? percent(totals.stats.reception.positivity) : '.'} />
            <Tile label={m.charts.attackPt} value={totals.stats.attack.total ? percent(totals.stats.attack.pointRate) : '.'} />
          </div>

          {chosen.length > 1 && (
            <section className="vr-card">
              <div className="vr-card-head">
                <div>
                  <h2>{t.trendTitle}</h2>
                  <p>{t.trendText}</p>
                </div>
              </div>
              <TrendChart rows={athleteTrend(chosen)} firstColumn={t.match} label={t.trendLabel} />
            </section>
          )}

          <section className="vr-card">
            <div className="vr-card-head">
              <div>
                <h2>{t.tableTitle}</h2>
                <p>{t.tableText}</p>
              </div>
            </div>
            <div className="vr-scroll">
              <table className="vr-table">
                <thead>
                  <tr>
                    <th colSpan={3} />
                    <th />
                    <th colSpan={2} className="group-start">
                      {s.points}
                    </th>
                    <SkillGroups />
                  </tr>
                  <tr>
                    <th>{t.match}</th>
                    <th className="num">{s.number}</th>
                    <th className="num">{s.set}</th>
                    <th className="num">{s.rating}</th>
                    <th className="num group-start">{s.tot}</th>
                    <th className="num">{s.balance}</th>
                    <SkillHeaders />
                  </tr>
                </thead>
                <tbody>
                  {chosen.map((x) => (
                    <tr key={x.record.id}>
                      <td>
                        <a href={href('tabellino', x.record.id)}>
                          {formatDate(x.record.date)} {x.record.opponentName || m.common.opponent}
                        </a>
                      </td>
                      <td className="num">{x.number}</td>
                      <td className="num">{x.setsPlayed.length}</td>
                      <td className="num">{formatRating(x.rating)}</td>
                      <PointsCells line={x.line} />
                      <SkillCells row={x.line} />
                    </tr>
                  ))}
                  <tr className="total">
                    <td colSpan={2}>{t.total}</td>
                    <td className="num">{totals.sets}</td>
                    <td className="num">{formatRating(totals.rating)}</td>
                    <PointsCells line={totals.line} />
                    <SkillCells row={totals.line} />
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section className="vr-card">
            <div className="vr-card-head">
              <div>
                <h2>{t.evaluationsTitle}</h2>
              </div>
            </div>
            <EvaluationChart rows={evaluationShares(totals.stats, { skills: m.skills, opponentErrors: m.charts.opponentErrors })} title={t.evaluationsLabel} />
          </section>
        </>
      )}
    </>
  );
}
