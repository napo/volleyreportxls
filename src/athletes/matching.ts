// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Athletes across matches. A shirt number identifies a player only inside a
 * team in a competition (a "roster"): the same athlete may wear other numbers
 * in other competitions, and the name may be missing. So every player of a
 * match can be linked to an athlete of the archive, and the app proposes the
 * links (same roster, or same name elsewhere) without ever applying them on
 * its own.
 */

import { type MatchRecord, shirtNumbers, teamKey } from '../matches/record';

export interface Athlete {
  readonly id: string;
  /** May be empty: the athlete is then shown by number and roster. */
  readonly name: string;
  /** Free text to tell apart athletes with the same name (e.g. the year of birth). */
  readonly note: string;
}

/**
 * The players with one shirt number in one roster, in the matches where they
 * are linked to the same athlete (or to none).
 */
export interface RosterEntry {
  /** `${teamKey}#${number}#${athleteId ?? ''}` */
  readonly key: string;
  readonly roster: string;
  readonly teamName: string;
  readonly competition: string;
  readonly number: number;
  /** Names written in those matches, without repetitions. */
  readonly names: readonly string[];
  readonly matchIds: readonly string[];
  readonly athleteId: string | null;
}

const normalize = (s: string) =>
  s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[.,;'’]/g, ' ').replace(/\s+/g, ' ').trim();

const tokens = (name: string) => (normalize(name) ? normalize(name).split(' ') : []);

/**
 * Two written names of the same person: "Giulia Rossi", "rossi giulia",
 * "Rossi G.", "G. Rossi". A single word matches only the same single word
 * (a first name alone is not enough).
 */
export function sameName(a: string, b: string): boolean {
  const [x, y] = [tokens(a), tokens(b)];
  if (x.length === 0 || y.length === 0) return false;
  if (x.length === 1 || y.length === 1) return x.length === y.length && x[0] === y[0];
  const [short, long] = x.length <= y.length ? [x, y] : [y, x];
  if (!short.some((t) => t.length > 1 && long.includes(t))) return false;
  const free = [...long];
  for (const t of short) {
    const i = free.findIndex((u) => u === t || (t.length === 1 && u.startsWith(t)) || (u.length === 1 && t.startsWith(u)));
    if (i < 0) return false;
    free.splice(i, 1);
  }
  return true;
}

/** The roster entries of the matches, by team, competition and number. */
export function rosterEntries(records: readonly MatchRecord[]): RosterEntry[] {
  const entries = new Map<string, RosterEntry & { names: string[]; matchIds: string[] }>();
  const sorted = [...records].sort((a, b) => a.date.localeCompare(b.date));
  for (const record of sorted) {
    const roster = teamKey(record.teamName, record.competition);
    for (const number of shirtNumbers(record)) {
      const player = record.players.find((p) => p.number === number);
      const athleteId = player?.athleteId ?? null;
      const key = `${roster}#${number}#${athleteId ?? ''}`;
      let entry = entries.get(key);
      if (!entry) {
        entry = { key, roster, teamName: record.teamName, competition: record.competition, number, names: [], matchIds: [], athleteId };
        entries.set(key, entry);
      }
      entry.matchIds.push(record.id);
      const name = player?.name.trim() ?? '';
      if (name && !entry.names.some((n) => normalize(n) === normalize(name))) entry.names.push(name);
    }
  }
  return [...entries.values()].sort(
    (a, b) => a.teamName.localeCompare(b.teamName) || a.competition.localeCompare(b.competition) || a.number - b.number,
  );
}

/** Ids of the matches in which the athlete already plays (with any number). */
function matchesOf(entries: readonly RosterEntry[], athleteId: string): Set<string> {
  return new Set(entries.filter((e) => e.athleteId === athleteId).flatMap((e) => e.matchIds));
}

/** An athlete cannot wear two numbers in the same match. */
export function conflicts(entries: readonly RosterEntry[], entry: RosterEntry, athleteId: string): boolean {
  const others = matchesOf(
    entries.filter((e) => e.key !== entry.key),
    athleteId,
  );
  return entry.matchIds.some((id) => others.has(id));
}

export type Proposal =
  /** An athlete of the archive. */
  | { readonly kind: 'athlete'; readonly athleteId: string; readonly reason: 'roster' | 'name' }
  /** The same new athlete as an earlier entry (same name). */
  | { readonly kind: 'same-as'; readonly entryKey: string }
  /**
   * A new athlete. `homonym`: in the team two shirts with this name play in
   * the same matches, so the name alone does not tell who it is.
   */
  | { readonly kind: 'new'; readonly homonym: boolean }
  /** Several athletes have this name: the user chooses. */
  | { readonly kind: 'ambiguous' };

const shareMatches = (a: RosterEntry, b: RosterEntry) => a.matchIds.some((id) => b.matchIds.includes(id));
const sameNames = (a: readonly string[], b: readonly string[]) => a.some((n) => b.some((m) => sameName(n, m)));

/**
 * A proposal for every entry not linked yet, in order:
 * - the athlete already linked to the same number in the same roster;
 * - the only athlete with the same name, linked or proposed for an earlier
 *   entry (several: the user chooses);
 * - otherwise a new athlete. Without a name there is no proposal across
 *   rosters: the number alone does not identify anyone.
 * Two shirts with the same name in the same match are never the same athlete.
 * Call it with the entries of one team, so that names are compared only there.
 */
export function proposals(entries: readonly RosterEntry[], athletes: readonly Athlete[]): Map<string, Proposal> {
  const result = new Map<string, Proposal>();
  const namesOf = (athleteId: string) => [
    ...athletes.filter((a) => a.id === athleteId).map((a) => a.name),
    ...entries.filter((e) => e.athleteId === athleteId).flatMap((e) => e.names),
  ];
  const newOnes: RosterEntry[] = [];
  for (const entry of entries) {
    if (entry.athleteId) continue;
    const sameRoster = entries.find((e) => e.athleteId && e.roster === entry.roster && e.number === entry.number);
    if (sameRoster && !conflicts(entries, entry, sameRoster.athleteId!)) {
      result.set(entry.key, { kind: 'athlete', athleteId: sameRoster.athleteId!, reason: 'roster' });
      continue;
    }
    const named = athletes.filter((a) => sameNames(entry.names, namesOf(a.id)) && !conflicts(entries, entry, a.id));
    const earlier = newOnes.filter((e) => sameNames(entry.names, e.names) && !shareMatches(e, entry));
    // The name belongs to two athletes playing together: any match by name is the user's choice.
    const homonym = entries.some(
      (x) => x.key !== entry.key && sameNames(entry.names, x.names) && entries.some((y) => y.key !== x.key && shareMatches(x, y) && sameNames(x.names, y.names)),
    );
    if (named.length + earlier.length > (homonym ? 0 : 1)) {
      result.set(entry.key, { kind: 'ambiguous' });
    } else if (named.length === 1) {
      result.set(entry.key, { kind: 'athlete', athleteId: named[0]!.id, reason: 'name' });
    } else if (earlier.length === 1) {
      result.set(entry.key, { kind: 'same-as', entryKey: earlier[0]!.key });
    } else {
      newOnes.push(entry);
      result.set(entry.key, { kind: 'new', homonym });
    }
  }
  return result;
}

/** The most complete of the written names ("Giulia Rossi" rather than "Rossi G."). */
export function fullestName(names: readonly string[]): string {
  const score = (n: string) => tokens(n).filter((t) => t.length > 1).length * 100 + n.trim().length;
  return [...names].sort((a, b) => score(b) - score(a))[0]?.trim() ?? '';
}

/** "Giulia Rossi", or "n. 7 · Team, Competition" for an athlete without a name. */
export function athleteLabel(athlete: Athlete, entries: readonly RosterEntry[]): string {
  if (athlete.name.trim()) return athlete.name.trim();
  const first = entries.find((e) => e.athleteId === athlete.id);
  return first ? entryLabel(first) : '—';
}

export function entryLabel(entry: RosterEntry): string {
  return `n. ${entry.number} · ${[entry.teamName, entry.competition].filter((s) => s.trim()).join(', ') || '—'}`;
}

/**
 * The matches with the players of an entry linked to an athlete (or unlinked
 * with null). Empty names are filled with the athlete's name.
 */
export function linkEntry(records: readonly MatchRecord[], entry: RosterEntry, athlete: Athlete | null): MatchRecord[] {
  return records
    .filter((r) => entry.matchIds.includes(r.id))
    .map((record) => {
      const current = record.players.find((p) => p.number === entry.number);
      const name = current?.name.trim() ? current.name : athlete?.name ?? current?.name ?? '';
      const player = athlete ? { number: entry.number, name, athleteId: athlete.id } : { number: entry.number, name };
      return { ...record, players: [...record.players.filter((p) => p.number !== entry.number), player] };
    });
}
