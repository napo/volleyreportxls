/**
 * Local archive (IndexedDB): matches, the athletes, and the names (and
 * athletes) of the players of every team in a competition, so that a new
 * match of the same team gets them for the shirt numbers already filled in.
 * Nothing leaves the device.
 */

import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
import type { Athlete } from '../athletes/matching';
import { type Squad, normalizeTeam } from '../athletes/squads';
import { type MatchRecord, type PlayerRecord, newId, teamKey } from '../matches/record';

export interface ImportResult {
  readonly added: number;
  /** Matches already present with different data, added with a new id. */
  readonly copies: number;
  /** Matches already present with the same data. */
  readonly unchanged: number;
}

export interface TeamRecord {
  /** teamKey(teamName, competition) */
  readonly key: string;
  readonly teamName: string;
  readonly competition: string;
  readonly players: readonly PlayerRecord[];
  readonly updatedAt: string;
}

interface ArchiveSchema extends DBSchema {
  matches: { key: string; value: MatchRecord; indexes: { updatedAt: string } };
  teams: { key: string; value: TeamRecord };
  athletes: { key: string; value: Athlete };
  squads: { key: string; value: Squad };
}

const DB_NAME = 'volleyreport';
const DB_VERSION = 3;

export class Archive {
  private constructor(private readonly db: IDBPDatabase<ArchiveSchema>) {}

  static async open(name = DB_NAME): Promise<Archive> {
    const db = await openDB<ArchiveSchema>(name, DB_VERSION, {
      upgrade(database, oldVersion) {
        if (oldVersion < 1) {
          const matches = database.createObjectStore('matches', { keyPath: 'id' });
          matches.createIndex('updatedAt', 'updatedAt');
          database.createObjectStore('teams', { keyPath: 'key' });
        }
        if (oldVersion < 2) database.createObjectStore('athletes', { keyPath: 'id' });
        if (oldVersion < 3) database.createObjectStore('squads', { keyPath: 'id' });
      },
    });
    return new Archive(db);
  }

  /** Most recently changed first. */
  async listMatches(): Promise<MatchRecord[]> {
    return (await this.db.getAllFromIndex('matches', 'updatedAt')).reverse();
  }

  getMatch(id: string): Promise<MatchRecord | undefined> {
    return this.db.get('matches', id);
  }

  /** Saves the match and remembers the names and athletes of its players for the team. */
  async saveMatch(record: MatchRecord): Promise<MatchRecord> {
    return (await this.saveMatches([record]))[0]!;
  }

  /** Saves several matches at once (all or none). */
  async saveMatches(records: readonly MatchRecord[]): Promise<MatchRecord[]> {
    const now = new Date().toISOString();
    const tx = this.db.transaction(['matches', 'teams'], 'readwrite');
    const saved = records.map((r) => ({ ...r, updatedAt: now }));
    for (const record of saved) {
      await tx.objectStore('matches').put(record);
      const known = record.players.filter((p) => p.name.trim() !== '' || p.athleteId);
      if (!record.teamName.trim() || known.length === 0) continue;
      const key = teamKey(record.teamName, record.competition);
      const before = (await tx.objectStore('teams').get(key))?.players ?? [];
      const players = [...before.filter((p) => !known.some((n) => n.number === p.number)), ...known].sort((a, b) => a.number - b.number);
      await tx.objectStore('teams').put({ key, teamName: record.teamName, competition: record.competition, players, updatedAt: now });
    }
    await tx.done;
    return saved;
  }

  /**
   * Matches whose players with this number were linked to an athlete (or
   * unlinked): the team remembers the link for its next matches.
   */
  async saveLink(records: readonly MatchRecord[], teamName: string, competition: string, number: number, athleteId: string | null): Promise<void> {
    await this.saveMatches(records);
    if (!teamName.trim()) return;
    const key = teamKey(teamName, competition);
    const team = await this.db.get('teams', key);
    const before = team?.players ?? [];
    const current = before.find((p) => p.number === number);
    const name = current?.name ?? records.flatMap((r) => r.players.filter((p) => p.number === number && p.name.trim()).map((p) => p.name))[0] ?? '';
    const player: PlayerRecord = athleteId ? { number, name, athleteId } : { number, name };
    const players = [...before.filter((p) => p.number !== number), ...(player.name.trim() || athleteId ? [player] : [])].sort((a, b) => a.number - b.number);
    await this.db.put('teams', { key, teamName, competition, players, updatedAt: new Date().toISOString() });
  }

  listAthletes(): Promise<Athlete[]> {
    return this.db.getAll('athletes');
  }

  async saveAthlete(athlete: Athlete): Promise<Athlete> {
    await this.db.put('athletes', athlete);
    return athlete;
  }

  /** Deletes the athlete and unlinks it from every match and team. */
  async deleteAthlete(id: string): Promise<void> {
    const tx = this.db.transaction(['matches', 'teams', 'athletes'], 'readwrite');
    const unlink = <T extends { players: readonly PlayerRecord[] }>(r: T): T | null =>
      r.players.some((p) => p.athleteId === id) ? { ...r, players: r.players.map(({ athleteId, ...p }) => (athleteId === id ? p : { ...p, athleteId })) } : null;
    for (const match of await tx.objectStore('matches').getAll()) {
      const changed = unlink(match);
      if (changed) await tx.objectStore('matches').put(changed);
    }
    for (const team of await tx.objectStore('teams').getAll()) {
      const changed = unlink(team);
      if (changed) await tx.objectStore('teams').put(changed);
    }
    await tx.objectStore('athletes').delete(id);
    await tx.done;
  }

  listSquads(): Promise<Squad[]> {
    return this.db.getAll('squads');
  }

  /** Replaces all the squads (joining or separating a name changes several of them). */
  async saveSquads(squads: readonly Squad[]): Promise<void> {
    const tx = this.db.transaction('squads', 'readwrite');
    await tx.store.clear();
    for (const squad of squads) await tx.store.put(squad);
    await tx.done;
  }

  /** Squads read from a file: only those whose names are not in a squad already. */
  async importSquads(squads: readonly Squad[]): Promise<void> {
    const tx = this.db.transaction('squads', 'readwrite');
    const known = new Set((await tx.store.getAll()).flatMap((s) => s.teamNames.map(normalizeTeam)));
    for (const squad of squads) {
      if (await tx.store.get(squad.id)) continue;
      if (squad.teamNames.some((n) => known.has(normalizeTeam(n)))) continue;
      await tx.store.put(squad);
    }
    await tx.done;
  }

  /** Athletes read from a file: those already present (same id) are kept as they are. */
  async importAthletes(athletes: readonly Athlete[]): Promise<void> {
    const tx = this.db.transaction('athletes', 'readwrite');
    for (const athlete of athletes) if (!(await tx.store.get(athlete.id))) await tx.store.put(athlete);
    await tx.done;
  }

  /**
   * Matches read from a .vrp file. One already in the archive with different data is
   * added as a copy (new id), so importing never overwrites anything.
   */
  async importMatches(records: readonly MatchRecord[]): Promise<ImportResult> {
    const content = ({ createdAt, updatedAt, ...rest }: MatchRecord) => JSON.stringify(rest);
    const result = { added: 0, copies: 0, unchanged: 0 };
    for (const record of records) {
      const existing = await this.getMatch(record.id);
      if (!existing) {
        await this.saveMatch(record);
        result.added++;
      } else if (content(existing) === content(record)) {
        result.unchanged++;
      } else {
        await this.saveMatch({ ...record, id: newId() });
        result.copies++;
      }
    }
    return result;
  }

  deleteMatch(id: string): Promise<void> {
    return this.db.delete('matches', id);
  }

  /** Names known for this team in this competition. */
  async knownPlayers(teamName: string, competition: string): Promise<readonly PlayerRecord[]> {
    return (await this.db.get('teams', teamKey(teamName, competition)))?.players ?? [];
  }

  close() {
    this.db.close();
  }
}

/**
 * Fills in the missing names and athletes of the record from the archive
 * (those already set are kept).
 */
export function withKnownNames(record: MatchRecord, known: readonly PlayerRecord[], numbers: readonly number[]): MatchRecord {
  const players = numbers.map((number): PlayerRecord => {
    const typed = record.players.find((p) => p.number === number);
    const remembered = known.find((p) => p.number === number);
    const name = typed?.name.trim() ? typed.name : remembered?.name ?? typed?.name ?? '';
    const athleteId = typed?.athleteId ?? remembered?.athleteId;
    return athleteId ? { number, name, athleteId } : { number, name };
  });
  return { ...record, players };
}

/** Asks the browser to keep the archive (not evicted under storage pressure). */
export async function requestPersistentStorage(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false;
  } catch {
    return false;
  }
}
