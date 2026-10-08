/**
 * Squads: the names a club uses in its competitions ("Volley Trento" in the
 * under 18, "Itas Trentino" in Serie C, with the sponsor) joined by the user
 * into one team. A name not joined to others is a squad of its own. The app
 * only points out similar names; it never joins them by itself.
 */

import type { MatchRecord } from '../matches/record';

/** Names joined by the user (stored in the archive). */
export interface Squad {
  readonly id: string;
  readonly name: string;
  /** Team names as written in the matches. */
  readonly teamNames: readonly string[];
}

export interface SquadView {
  /** The stored squad id, or IMPLICIT + the name for a name of its own. */
  readonly id: string;
  readonly name: string;
  readonly stored: boolean;
  readonly teams: readonly { readonly name: string; readonly competitions: readonly string[]; readonly matches: number }[];
  readonly matches: number;
}

export const IMPLICIT = 't-';

export const normalizeTeam = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();

/** Ids usable in the URL for a name of its own. */
const implicitId = (name: string) => IMPLICIT + encodeURIComponent(normalizeTeam(name)).replace(/%/g, '_');

/** The squads of the matches, most played first. */
export function squadsOf(records: readonly MatchRecord[], stored: readonly Squad[]): SquadView[] {
  const teams = new Map<string, { name: string; competitions: string[]; matches: number }>();
  for (const r of records) {
    const key = normalizeTeam(r.teamName);
    const team = teams.get(key) ?? { name: r.teamName.trim(), competitions: [], matches: 0 };
    team.matches++;
    if (r.competition.trim() && !team.competitions.includes(r.competition.trim())) team.competitions.push(r.competition.trim());
    teams.set(key, team);
  }
  const used = new Set<string>();
  const views: SquadView[] = [];
  for (const squad of stored) {
    const members = squad.teamNames.map(normalizeTeam).filter((k) => teams.has(k) && !used.has(k));
    if (members.length === 0) continue;
    members.forEach((k) => used.add(k));
    const list = members.map((k) => teams.get(k)!);
    views.push({ id: squad.id, name: squad.name, stored: true, teams: list, matches: list.reduce((n, t) => n + t.matches, 0) });
  }
  for (const [key, team] of teams) {
    if (used.has(key)) continue;
    views.push({ id: implicitId(team.name), name: team.name, stored: false, teams: [team], matches: team.matches });
  }
  return views.sort((a, b) => b.matches - a.matches || a.name.localeCompare(b.name));
}

/** Whether the team of a match belongs to the squad. */
export const inSquad = (squad: SquadView, teamName: string) => squad.teams.some((t) => normalizeTeam(t.name) === normalizeTeam(teamName));

/** Words that say nothing about the club. */
const COMMON = new Set(['volley', 'pallavolo', 'volleyball', 'asd', 'ssd', 'a.s.d.', 's.s.d.', 'us', 'u.s.', 'polisportiva', 'sport', 'team', 'club', 'gruppo', 'sportivo', 'societa']);

const words = (name: string) => normalizeTeam(name).split(/[\s\-.,']+/).filter((w) => w.length >= 4 && !COMMON.has(w));

/** Two names that may be the same club: they share a word that is not generic (a hint only). */
export function similarTeams(a: string, b: string): boolean {
  const x = words(a);
  return words(b).some((w) => x.includes(w));
}

/**
 * The stored squads after joining `teamName` to `target` (an implicit squad
 * becomes a stored one, with `newId`). The name leaves any other squad.
 */
export function joinTeam(stored: readonly Squad[], target: SquadView, teamName: string, newId: string): { squads: Squad[]; id: string } {
  const key = normalizeTeam(teamName);
  const without = stored
    .map((s) => ({ ...s, teamNames: s.teamNames.filter((n) => normalizeTeam(n) !== key) }))
    .filter((s) => s.teamNames.length > 1 || s.id === target.id);
  if (target.stored) {
    return { squads: without.map((s) => (s.id === target.id ? { ...s, teamNames: [...s.teamNames, teamName] } : s)), id: target.id };
  }
  return { squads: [...without, { id: newId, name: target.name, teamNames: [target.teams[0]!.name, teamName] }], id: newId };
}

/** The stored squads after the name goes back to a squad of its own. */
export function separateTeam(stored: readonly Squad[], teamName: string): Squad[] {
  const key = normalizeTeam(teamName);
  return stored
    .map((s) => ({ ...s, teamNames: s.teamNames.filter((n) => normalizeTeam(n) !== key) }))
    .filter((s) => s.teamNames.length > 1);
}
