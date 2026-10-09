// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The history of a squad: the names of the squad (one per competition, with
 * the sponsor), the links between its shirts and the athletes, the athletes.
 * The app proposes the links; nothing is linked until the user confirms.
 */
import { useMemo, useState } from 'react';
import {
  type Athlete,
  type Proposal,
  type RosterEntry,
  athleteLabel,
  conflicts,
  entryLabel,
  fullestName,
  linkEntry,
  proposals,
  rosterEntries,
} from '../../athletes/matching';
import { type SquadView, inSquad, joinTeam, separateTeam, similarTeams } from '../../athletes/squads';
import { type MatchRecord, newId } from '../../matches/record';
import { useI18n } from '../../i18n';
import type { Archive } from '../../storage/archive';
import { type AthletesData, readLastSquad, useAthletesData, writeLastSquad } from '../athletes-data';
import { href, navigate } from '../routes';

const NEW = 'new';

/** The choice shown first in the menu of an entry. */
function defaultChoice(proposal: Proposal | undefined): string {
  if (!proposal) return '';
  if (proposal.kind === 'athlete') return proposal.athleteId;
  if (proposal.kind === 'ambiguous') return '';
  return NEW;
}

/** Links the entry to the athlete; null when the athlete already plays one of its matches with another number. */
async function link(archive: Archive, records: readonly MatchRecord[], entry: RosterEntry, athlete: Athlete): Promise<MatchRecord[] | null> {
  if (conflicts(rosterEntries(records), entry, athlete.id)) return null;
  const linked = linkEntry(records, entry, athlete);
  await archive.saveLink(linked, entry.teamName, entry.competition, entry.number, athlete.id);
  return records.map((r) => linked.find((l) => l.id === r.id) ?? r);
}

const newAthlete = (names: readonly string[]): Athlete => ({ id: newId(), name: fullestName(names), note: '' });

/** The squad in the route, or the one seen last, or the most played. */
function chosenSquad(data: AthletesData, id: string | null): SquadView | null {
  return data.squads.find((s) => s.id === id) ?? data.squads.find((s) => s.id === readLastSquad()) ?? data.squads[0] ?? null;
}

export function AthletesView({ squadId }: { squadId: string | null }) {
  const { m } = useI18n();
  const t = m.athletes;
  const { archive, error, data, reload } = useAthletesData();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const squad = data ? chosenSquad(data, squadId) : null;
  // Only the shirts of the squad, and the athletes linked there (or nowhere yet).
  const entries = useMemo(() => (data && squad ? data.entries.filter((e) => inSquad(squad, e.teamName)) : []), [data, squad]);
  const athletes = useMemo(
    () => data?.athletes.filter((a) => entries.some((e) => e.athleteId === a.id) || !data.entries.some((e) => e.athleteId === a.id)) ?? [],
    [data, entries],
  );
  const unlinked = useMemo(() => entries.filter((e) => !e.athleteId), [entries]);
  const proposed = useMemo(() => proposals(entries, athletes), [entries, athletes]);

  if (error) return <p className="vr-note">{m.matches.noArchive}</p>;
  if (!data || !archive) return <p className="vr-note">{m.common.loading}</p>;

  const label = (a: Athlete) => athleteLabel(a, data.entries) + (a.note.trim() ? ` (${a.note.trim()})` : '');
  const sorted = [...athletes].sort((a, b) => label(a).localeCompare(label(b)));
  const listed = sorted.filter((a) => entries.some((e) => e.athleteId === a.id));
  const choose = (id: string) => {
    writeLastSquad(id);
    navigate('storico', id);
  };
  const choiceOf = (entry: RosterEntry) => choices[entry.key] ?? defaultChoice(proposed.get(entry.key));

  const run = async (work: () => Promise<void>) => {
    setBusy(true);
    setProblem(null);
    try {
      await work();
    } finally {
      setChoices({});
      await reload();
      setBusy(false);
    }
  };

  const linkOne = (entry: RosterEntry) =>
    run(async () => {
      const choice = choiceOf(entry);
      const athlete = choice === NEW ? newAthlete(entry.names) : data.athletes.find((a) => a.id === choice);
      if (!athlete) return;
      if (conflicts(data.entries, entry, athlete.id)) return setProblem(entryLabel(entry));
      if (choice === NEW) await archive.saveAthlete(athlete);
      await link(archive, data.records, entry, athlete);
    });

  /** Names of the entry and of the entries proposed as the same new athlete. */
  const namesOfGroup = (entry: RosterEntry) => [
    ...entry.names,
    ...unlinked.flatMap((e) => {
      const p = proposed.get(e.key);
      return p?.kind === 'same-as' && p.entryKey === entry.key && choices[e.key] === undefined ? e.names : [];
    }),
  ];

  // In order: an entry proposed as "same as" an earlier one gets the athlete created for it.
  const confirmAll = () =>
    run(async () => {
      let records = data.records;
      const created = new Map<string, Athlete>();
      for (const entry of unlinked) {
        const proposal = proposed.get(entry.key);
        const choice = choices[entry.key];
        let athlete: Athlete | undefined;
        if (choice !== undefined && choice !== NEW) athlete = data.athletes.find((a) => a.id === choice);
        else if (choice === NEW || proposal?.kind === 'new') athlete = newAthlete(namesOfGroup(entry));
        else if (proposal?.kind === 'athlete') athlete = data.athletes.find((a) => a.id === proposal.athleteId);
        else if (proposal?.kind === 'same-as') athlete = created.get(proposal.entryKey);
        if (!athlete) continue;
        if (!data.athletes.includes(athlete) && ![...created.values()].includes(athlete)) {
          await archive.saveAthlete(athlete);
          created.set(entry.key, athlete);
        }
        // An athlete already playing one of these matches with another number is skipped.
        records = (await link(archive, records, entry, athlete)) ?? records;
      }
    });

  const reasonOf = (entry: RosterEntry, proposal: Proposal | undefined) => {
    if (!proposal) return '';
    if (proposal.kind === 'athlete') return t.reason[proposal.reason];
    if (proposal.kind === 'ambiguous') return t.reason.ambiguous;
    if (proposal.kind === 'same-as') {
      const leader = data.entries.find((e) => e.key === proposal.entryKey);
      return t.reason.sameAs(leader ? entryLabel(leader) : '');
    }
    if (proposal.homonym) return t.reason.homonym;
    return entry.names.length ? t.reason.new : t.reason.newNoName;
  };

  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">{t.eyebrow}</p>
        <h1>{squad ? t.titleOf(squad.name || t.noTeamName) : t.title}</h1>
        <p className="vr-lead">{t.lead}</p>
        {data.squads.length > 1 && squad && (
          <label className="vr-field vr-squad-choice">
            <span>{t.squad}</span>
            <select value={squad.id} onChange={(e) => choose(e.target.value)}>
              {data.squads.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name || t.noTeamName} · {t.matchesCount(s.matches)}
                </option>
              ))}
            </select>
          </label>
        )}
      </header>

      {squad && (
        <SquadNames
          key={squad.id}
          squad={squad}
          others={data.squads.filter((s) => s.id !== squad.id)}
          onSave={async (stored, id) => {
            await archive.saveSquads(stored);
            await reload();
            if (id !== squad.id) choose(id);
          }}
          stored={data.stored}
        />
      )}

      {data.records.length === 0 ? (
        <section className="vr-card">
          <p className="vr-note">{t.noMatches}</p>
        </section>
      ) : (
        <section className="vr-card">
          <div className="vr-card-head">
            <div>
              <h2>{t.toLinkTitle}</h2>
              <p>{unlinked.length ? t.toLinkText(unlinked.length) : t.allLinked}</p>
            </div>
            {unlinked.length > 0 && (
              <div className="vr-actions start">
                <button type="button" className="vr-btn vr-btn-primary vr-btn-small" disabled={busy} onClick={confirmAll}>
                  {t.confirmAll}
                </button>
              </div>
            )}
          </div>
          {problem && (
            <p className="vr-message warning" role="status">
              {problem}: {t.conflict}
            </p>
          )}
          {unlinked.length > 0 && (
            <ul className="vr-links">
              {unlinked.map((entry) => {
                const proposal = proposed.get(entry.key);
                const choice = choiceOf(entry);
                return (
                  <li key={entry.key}>
                    <div>
                      <strong>{entryLabel(entry)}</strong>
                      <span>
                        {entry.names.length ? entry.names.join(' · ') : <em>{t.noName}</em>} · {t.matchesCount(entry.matchIds.length)}
                      </span>
                      <small>{reasonOf(entry, proposal)}</small>
                    </div>
                    <span className="vr-actions start">
                      <select
                        aria-label={`${m.editor.athlete} ${entryLabel(entry)}`}
                        value={choice}
                        onChange={(e) => setChoices((c) => ({ ...c, [entry.key]: e.target.value }))}
                      >
                        <option value="">{t.choose}</option>
                        <option value={NEW}>
                          {t.newAthlete}
                          {entry.names.length ? `: ${fullestName(entry.names)}` : ''}
                        </option>
                        {sorted.map((a) => (
                          <option key={a.id} value={a.id}>
                            {label(a)}
                          </option>
                        ))}
                      </select>
                      <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" disabled={busy || choice === ''} onClick={() => linkOne(entry)}>
                        {t.link}
                      </button>
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.listTitle}</h2>
            <p>{t.listText}</p>
          </div>
        </div>
        {listed.length === 0 ? (
          <p className="vr-note">{t.none}</p>
        ) : (
          <ul className="vr-matches">
            {listed.map((a) => {
              const own = entries.filter((e) => e.athleteId === a.id);
              const matches = new Set(own.flatMap((e) => e.matchIds)).size;
              return (
                <li key={a.id}>
                  <a href={href('atleta', a.id)}>
                    <strong>{label(a)}</strong>
                    <span>
                      {own.map(entryLabel).join(' · ')}
                      {own.length > 0 && ' · '}
                      {t.matchesCount(matches)}
                    </span>
                  </a>
                  <span className="vr-actions start">
                    <a className="vr-btn vr-btn-secondary vr-btn-small" href={href('atleta', a.id)}>
                      {t.history}
                    </a>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}

interface SquadNamesProps {
  readonly squad: SquadView;
  readonly others: readonly SquadView[];
  readonly stored: AthletesData['stored'];
  readonly onSave: (stored: AthletesData['stored'], id: string) => void;
}

/** The team names of the squad: join another name, separate one, rename the squad. */
function SquadNames({ squad, others, stored, onSave }: SquadNamesProps) {
  const { m } = useI18n();
  const t = m.athletes;
  const [name, setName] = useState(squad.name);
  const names = others
    .flatMap((o) => o.teams.map((team) => ({ name: team.name, similar: squad.teams.some((s) => similarTeams(s.name, team.name)) })))
    .sort((a, b) => Number(b.similar) - Number(a.similar) || a.name.localeCompare(b.name));
  const [toJoin, setToJoin] = useState('');

  return (
    <section className="vr-card">
      <div className="vr-card-head">
        <div>
          <h2>{t.squadTitle}</h2>
          <p>{t.squadText}</p>
        </div>
      </div>
      {squad.stored && (
        <div className="vr-form-grid">
          <label className="vr-field">
            <span>{t.squadName}</span>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onBlur={() => name.trim() && name !== squad.name && onSave(stored.map((s) => (s.id === squad.id ? { ...s, name: name.trim() } : s)), squad.id)}
            />
          </label>
        </div>
      )}
      <ul className="vr-matches">
        {squad.teams.map((team) => (
          <li key={team.name}>
            <span>
              <strong>{team.name || t.noTeamName}</strong>
              <span>
                {team.competitions.join(' · ')}
                {team.competitions.length > 0 && ' · '}
                {t.matchesCount(team.matches)}
              </span>
            </span>
            {squad.teams.length > 1 && (
              <span className="vr-actions start">
                <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => onSave(separateTeam(stored, team.name), squad.id)}>
                  {t.separate}
                </button>
              </span>
            )}
          </li>
        ))}
      </ul>
      {names.length > 0 && (
        <div className="vr-actions start vr-links">
          <select aria-label={t.addName} value={toJoin} onChange={(e) => setToJoin(e.target.value)}>
            <option value="">{t.addName}</option>
            {names.map((n) => (
              <option key={n.name} value={n.name}>
                {n.name || t.noTeamName}
                {n.similar ? ` · ${t.similar}` : ''}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="vr-btn vr-btn-secondary vr-btn-small"
            disabled={toJoin === ''}
            onClick={() => {
              const { squads, id } = joinTeam(stored, squad, toJoin, newId());
              onSave(squads, id);
            }}
          >
            {t.join}
          </button>
        </div>
      )}
    </section>
  );
}
