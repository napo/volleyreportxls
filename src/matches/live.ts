/**
 * Live scouting on a touch screen: the paper form as a sheet of counters.
 * A touch on a cell adds one to that row and code, a long press (or the undo
 * button) takes one away; closing a set asks for its final score and the next
 * set starts with the same shirt numbers. The result is the same MatchRecord
 * as the photographed sheets: only counts, as on paper.
 */

import type { ScoutCodeString } from '../domain/codes';
import type { SetNumber, SetScore } from '../domain/model';
import { type MatchRecord, type SetRecord, matchWinner, setIsPlayed, setScoreIsFinal, withNumbersFromPreviousSet } from './record';

/** One change of a count, kept to undo it. */
export interface Touch {
  readonly set: SetNumber;
  readonly rowId: string;
  readonly code: ScoutCodeString;
  /** +1 or −1, as applied. */
  readonly delta: number;
}

const replaceSet = (record: MatchRecord, set: SetRecord): MatchRecord => ({
  ...record,
  sets: record.sets.map((s) => (s.number === set.number ? set : s)),
});

/**
 * Adds `delta` to a count (never below zero). Returns the record and the touch
 * as applied, or null when nothing changes (removing from an empty cell).
 */
export function bump(record: MatchRecord, set: SetNumber, rowId: string, code: ScoutCodeString, delta: number): { record: MatchRecord; touch: Touch } | null {
  const target = record.sets.find((s) => s.number === set);
  const row = target?.rows.find((r) => r.id === rowId);
  if (!target || !row) return null;
  const current = row.counts[code] ?? 0;
  const next = Math.max(0, current + delta);
  if (next === current) return null;
  const counts = { ...row.counts };
  if (next === 0) delete counts[code];
  else counts[code] = next;
  const rows = target.rows.map((r) => (r.id === rowId ? { ...r, counts } : r));
  return { record: replaceSet(record, { ...target, rows }), touch: { set, rowId, code, delta: next - current } };
}

/** Takes back a touch. */
export const undoTouch = (record: MatchRecord, touch: Touch): MatchRecord =>
  bump(record, touch.set, touch.rowId, touch.code, -touch.delta)?.record ?? record;

export function setShirtNumber(record: MatchRecord, set: SetNumber, rowId: string, playerNumber: number | null): MatchRecord {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return record;
  return replaceSet(record, { ...target, rows: target.rows.map((r) => (r.id === rowId ? { ...r, playerNumber } : r)) });
}

/** A set is closed when it has its final score. */
export const isClosed = (set: SetRecord) => set.score !== null;

/**
 * Closes a set with its score. Unless the match is over, the next set without
 * a score is returned as the one to scout, with the shirt numbers of this one.
 */
export function closeSet(record: MatchRecord, set: SetNumber, score: SetScore): { record: MatchRecord; next: SetNumber | null } {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return { record, next: null };
  let closed = replaceSet(record, { ...target, score });
  if (matchWinner(closed) !== null) return { record: closed, next: null };
  const next = closed.sets.find((s) => s.number > set && s.score === null)?.number ?? null;
  if (next !== null) closed = withNumbersFromPreviousSet(closed, next);
  return { record: closed, next };
}

/** The set to show when the sheet opens: the first one without a score, else the last one played. */
export function currentSet(record: MatchRecord): SetNumber {
  if (matchWinner(record) === null) {
    const open = record.sets.find((s) => s.score === null);
    if (open) return open.number;
  }
  return record.sets.filter(setIsPlayed).at(-1)?.number ?? 1;
}

/** Sets that can be opened: those played, plus the first one without a score while the match is not over. */
export function reachableSets(record: MatchRecord): Set<SetNumber> {
  const reachable = new Set(record.sets.filter(setIsPlayed).map((s) => s.number));
  if (matchWinner(record) === null) {
    const open = record.sets.find((s) => s.score === null);
    if (open) reachable.add(open.number);
  }
  return reachable;
}

export type ScoreCheck = 'incomplete' | 'tied' | 'unusual' | 'ok';

/** Tied or missing scores cannot close a set; unusual ones (not 25/15 with two points) only get a warning. */
export function checkScore(team: number | null, opponent: number | null, set: SetNumber): ScoreCheck {
  if (team === null || opponent === null) return 'incomplete';
  if (team === opponent) return 'tied';
  return setScoreIsFinal({ team, opponent }, set) ? 'ok' : 'unusual';
}
