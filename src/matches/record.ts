/**
 * A match as the user records it: the data of the game and, for every set, the
 * final score and the tally table (one row per player, one count per code),
 * with the same structure as the paper form. This is what the archive stores
 * and what the editor changes; statistics come from `toMatch()`, which turns
 * it into the domain model.
 */

import type { ScoutCodeString } from '../domain/codes';
import { type Match, type Player, type SetNumber, type SetScore, SET_NUMBERS } from '../domain/model';
import { tallyLine } from '../domain/tally';

export type RowKind = 'player' | 'libero';

export interface TallyRowRecord {
  readonly id: string;
  readonly kind: RowKind;
  readonly playerNumber: number | null;
  readonly counts: Readonly<Partial<Record<ScoutCodeString, number>>>;
}

export interface SetRecord {
  readonly number: SetNumber;
  readonly score: SetScore | null;
  readonly rows: readonly TallyRowRecord[];
}

export interface PlayerRecord {
  readonly number: number;
  readonly name: string;
}

export interface MatchRecord {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly teamName: string;
  readonly opponentName: string;
  /** Campionato / competizione. */
  readonly competition: string;
  /** ISO date (YYYY-MM-DD). */
  readonly date: string;
  readonly venue: string;
  /** Names known for the shirt numbers of the team. */
  readonly players: readonly PlayerRecord[];
  readonly sets: readonly SetRecord[];
}

/** Rows of a new set: as on the paper form. */
export const PLAYER_ROWS = 12;
export const LIBERO_ROWS = 2;

const ALPHABET = 'abcdefghijkmnpqrstuvwxyz23456789';

/** Short random id (also used in URLs). */
export function newId(length = 10): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

export function emptyRow(kind: RowKind): TallyRowRecord {
  return { id: newId(8), kind, playerNumber: null, counts: {} };
}

export function emptySet(number: SetNumber): SetRecord {
  return {
    number,
    score: null,
    rows: [...Array.from({ length: PLAYER_ROWS }, () => emptyRow('player')), ...Array.from({ length: LIBERO_ROWS }, () => emptyRow('libero'))],
  };
}

export function newMatchRecord(now = new Date()): MatchRecord {
  const iso = now.toISOString();
  return {
    id: newId(),
    createdAt: iso,
    updatedAt: iso,
    teamName: '',
    opponentName: '',
    competition: '',
    date: iso.slice(0, 10),
    venue: '',
    players: [],
    sets: SET_NUMBERS.map(emptySet),
  };
}

const rowHasCounts = (row: TallyRowRecord) => Object.values(row.counts).some((n) => (n ?? 0) > 0);

/** A row that carries something: a shirt number or at least one touch. */
export const rowIsUsed = (row: TallyRowRecord) => row.playerNumber !== null || rowHasCounts(row);

/** A set that was played: it has a score or some counts. */
export const setIsPlayed = (set: SetRecord) => set.score !== null || set.rows.some(rowHasCounts);

/**
 * When a set is opened for the first time, its rows get the shirt numbers of
 * the nearest earlier set that has them (counts stay empty). A set that already
 * has a score, a number or a touch is left alone; so is the record when no
 * earlier set has numbers.
 */
export function withNumbersFromPreviousSet(record: MatchRecord, number: SetNumber): MatchRecord {
  const target = record.sets.find((s) => s.number === number);
  if (!target || target.score !== null || target.rows.some(rowIsUsed)) return record;
  const source = record.sets
    .filter((s) => s.number < number && s.rows.some((r) => r.playerNumber !== null))
    .at(-1);
  if (!source) return record;
  const rows = source.rows.map((r) => ({ ...emptyRow(r.kind), playerNumber: r.playerNumber }));
  return { ...record, sets: record.sets.map((s) => (s.number === number ? { ...s, rows } : s)) };
}

/** Sets needed to win a match. */
export const SETS_TO_WIN = 3;

/**
 * A final set score that the rules allow: 25 points (15 in the fifth set) with
 * two points of margin, or beyond 25 (15) with exactly two points of margin.
 */
export function setScoreIsFinal(score: SetScore, number: SetNumber): boolean {
  const target = number === 5 ? 15 : 25;
  const [won, lost] = [Math.max(score.team, score.opponent), Math.min(score.team, score.opponent)];
  return won === target ? won - lost >= 2 : won > target && won - lost === 2;
}

/** The side that won three sets with final scores; null while the match is not over. */
export function matchWinner(record: MatchRecord): 'team' | 'opponent' | null {
  const final = record.sets.flatMap((s) => (s.score && setScoreIsFinal(s.score, s.number) ? [s.score] : []));
  if (final.filter((s) => s.team > s.opponent).length >= SETS_TO_WIN) return 'team';
  if (final.filter((s) => s.opponent > s.team).length >= SETS_TO_WIN) return 'opponent';
  return null;
}

/** Shirt numbers appearing in the sets, in order of first appearance. */
export function shirtNumbers(record: MatchRecord): number[] {
  const seen: number[] = [];
  for (const set of record.sets) {
    for (const row of set.rows) if (row.playerNumber !== null && !seen.includes(row.playerNumber)) seen.push(row.playerNumber);
  }
  return seen;
}

/** Numbers used in libero rows. */
export function liberoNumbers(record: MatchRecord): Set<number> {
  return new Set(record.sets.flatMap((s) => s.rows.filter((r) => r.kind === 'libero' && r.playerNumber !== null).map((r) => r.playerNumber!)));
}

/** The domain match: roster from the numbers found in the sets, lines from the tally rows. */
export function toMatch(record: MatchRecord): Match {
  const liberos = liberoNumbers(record);
  const players: Player[] = shirtNumbers(record).map((number) => {
    const name = record.players.find((p) => p.number === number)?.name ?? '';
    return { id: `n${number}`, number, name, ...(liberos.has(number) ? { role: 'L' as const } : {}) };
  });
  return {
    id: record.id,
    competition: record.competition,
    date: record.date,
    venue: record.venue,
    opponentName: record.opponentName,
    team: { id: 'team', name: record.teamName, players },
    sets: record.sets.filter(setIsPlayed).map((set) => ({
      number: set.number,
      score: set.score,
      lines: set.rows.filter(rowIsUsed).map((row) => tallyLine({ id: row.id, playerNumber: row.playerNumber, counts: row.counts })),
    })),
  };
}

/** Archive key of a team in a competition: names compared without case, accents or extra spaces. */
export function teamKey(teamName: string, competition: string): string {
  const norm = (s: string) => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
  return `${norm(teamName)}|${norm(competition)}`;
}
