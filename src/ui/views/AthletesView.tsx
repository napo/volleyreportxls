/**
 * The athletes of the archive and the links between the shirt numbers of the
 * matches and the athletes. The app proposes the links; nothing is linked
 * until the user confirms.
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
import { type MatchRecord, newId } from '../../matches/record';
import { useI18n } from '../../i18n';
import type { Archive } from '../../storage/archive';
import { useAthletesData } from '../athletes-data';
import { href } from '../routes';

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

export function AthletesView() {
  const { m } = useI18n();
  const t = m.athletes;
  const { archive, error, data, reload } = useAthletesData();
  const [choices, setChoices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  const unlinked = useMemo(() => data?.entries.filter((e) => !e.athleteId) ?? [], [data]);
  const proposed = useMemo(() => (data ? proposals(data.entries, data.athletes) : new Map<string, Proposal>()), [data]);

  if (error) return <p className="vr-note">{m.matches.noArchive}</p>;
  if (!data || !archive) return <p className="vr-note">{m.common.loading}</p>;

  const label = (a: Athlete) => athleteLabel(a, data.entries) + (a.note.trim() ? ` (${a.note.trim()})` : '');
  const sorted = [...data.athletes].sort((a, b) => label(a).localeCompare(label(b)));
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
    return entry.names.length ? t.reason.new : t.reason.newNoName;
  };

  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="vr-lead">{t.lead}</p>
      </header>

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
        {sorted.length === 0 ? (
          <p className="vr-note">{t.none}</p>
        ) : (
          <ul className="vr-matches">
            {sorted.map((a) => {
              const own = data.entries.filter((e) => e.athleteId === a.id);
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
