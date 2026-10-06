/**
 * Local archive (IndexedDB): matches, and the names of the players of every
 * team in a competition, so that a new match of the same team gets the names
 * for the shirt numbers already filled in. Nothing leaves the device.
 */

import { type DBSchema, type IDBPDatabase, openDB } from 'idb';
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
}

const DB_NAME = 'volleyreport';
const DB_VERSION = 1;

export class Archive {
  private constructor(private readonly db: IDBPDatabase<ArchiveSchema>) {}

  static async open(name = DB_NAME): Promise<Archive> {
    const db = await openDB<ArchiveSchema>(name, DB_VERSION, {
      upgrade(database) {
        const matches = database.createObjectStore('matches', { keyPath: 'id' });
        matches.createIndex('updatedAt', 'updatedAt');
        database.createObjectStore('teams', { keyPath: 'key' });
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

  /** Saves the match and remembers the names of its players for the team. */
  async saveMatch(record: MatchRecord): Promise<MatchRecord> {
    const saved = { ...record, updatedAt: new Date().toISOString() };
    const tx = this.db.transaction(['matches', 'teams'], 'readwrite');
    await tx.objectStore('matches').put(saved);
    const named = saved.players.filter((p) => p.name.trim() !== '');
    if (saved.teamName.trim() && named.length > 0) {
      const key = teamKey(saved.teamName, saved.competition);
      const known = (await tx.objectStore('teams').get(key))?.players ?? [];
      const players = [...known.filter((p) => !named.some((n) => n.number === p.number)), ...named].sort((a, b) => a.number - b.number);
      await tx.objectStore('teams').put({ key, teamName: saved.teamName, competition: saved.competition, players, updatedAt: saved.updatedAt });
    }
    await tx.done;
    return saved;
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

/** Fills in the missing names of the record from the archive (names already typed are kept). */
export function withKnownNames(record: MatchRecord, known: readonly PlayerRecord[], numbers: readonly number[]): MatchRecord {
  const players = numbers.map((number) => {
    const typed = record.players.find((p) => p.number === number);
    if (typed?.name.trim()) return typed;
    return { number, name: known.find((p) => p.number === number)?.name ?? typed?.name ?? '' };
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
