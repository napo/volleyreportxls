// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Live scouting on a touch screen: the paper form as a sheet of counters.
 * A touch on a cell adds one to that row and code, a long press (or the undo
 * button) takes one away; closing a set asks for its final score and the next
 * set starts with the same shirt numbers. Team names and the players' names
 * are written on the sheet too: names belong to the shirt number for the whole
 * match, so they follow the numbers into the next sets. The result is the same
 * MatchRecord as the photographed sheets: only counts, as on paper.
 */

import type { ScoutCodeString } from '../domain/codes';
import type { SetNumber, SetScore } from '../domain/model';
import { NO_PHASES, type PhaseStats, withAttack } from '../domain/phases';
import { type Lineup, type MatchRecord, type Rally, type ServeState, type Substitution, type PlayerRecord, type RowKind, type SetRecord, emptyRow, matchWinner, setIsPlayed, setScoreIsFinal, withNumbersFromPreviousSet } from './record';

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

/**
 * Writes the shirt number of a row. A number without a name in this match
 * gets the one known for the team (`known`, from earlier matches), if any.
 */
export function setShirtNumber(
  record: MatchRecord,
  set: SetNumber,
  rowId: string,
  playerNumber: number | null,
  known: readonly PlayerRecord[] = [],
): MatchRecord {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return record;
  const numbered = replaceSet(record, { ...target, rows: target.rows.map((r) => (r.id === rowId ? { ...r, playerNumber } : r)) });
  const remembered = known.find((p) => p.number === playerNumber);
  if (playerNumber === null || !remembered || record.players.some((p) => p.number === playerNumber && p.name.trim())) return numbered;
  return { ...numbered, players: [...record.players.filter((p) => p.number !== playerNumber), remembered] };
}

/** The name of a shirt number for the whole match (its link to an athlete of the archive is kept). */
export function setPlayerName(record: MatchRecord, playerNumber: number, name: string): MatchRecord {
  const current = record.players.find((p) => p.number === playerNumber);
  return { ...record, players: [...record.players.filter((p) => p.number !== playerNumber), { ...current, number: playerNumber, name }] };
}

export const playerName = (record: MatchRecord, playerNumber: number | null) =>
  playerNumber === null ? '' : (record.players.find((p) => p.number === playerNumber)?.name ?? '');

export type MatchDetails = Pick<MatchRecord, 'teamName' | 'opponentName' | 'competition' | 'date'>;

export const setMatchDetails = (record: MatchRecord, details: MatchDetails): MatchRecord => ({ ...record, ...details });

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

/** Writes who starts a set (keypad of the live sheet). */
export function setLineup(record: MatchRecord, set: SetNumber, lineup: Lineup): MatchRecord {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return record;
  // Another lineup: the rotation starts again from it.
  const { serve: _, ...rest } = target;
  return replaceSet(record, { ...rest, lineup });
}

/**
 * The lineup to propose for a set: its own, else the one of the nearest
 * earlier set that has one, else the shirt numbers already on its rows.
 */
export function proposedLineup(record: MatchRecord, set: SetNumber): Lineup {
  const target = record.sets.find((s) => s.number === set);
  if (target?.lineup) return target.lineup;
  const earlier = record.sets.filter((s) => s.number < set && s.lineup).at(-1)?.lineup;
  if (earlier) return earlier;
  const numbers = (kind: RowKind, max: number) =>
    [...new Set((target?.rows ?? []).filter((r) => r.kind === kind && r.playerNumber !== null).map((r) => r.playerNumber!))].slice(0, max);
  return { court: numbers('player', 6), liberos: numbers('libero', 2) };
}

/**
 * A touch given by shirt number (keypad): it goes to the row of that number
 * and kind; a number not on the sheet yet takes the first empty row of its
 * kind, or a new one. Null when nothing changes.
 */
export function bumpShirt(
  record: MatchRecord,
  set: SetNumber,
  playerNumber: number,
  kind: RowKind,
  code: ScoutCodeString,
  known: readonly PlayerRecord[] = [],
): { record: MatchRecord; touch: Touch } | null {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return null;
  const current = placeNumbers(record, set, [playerNumber], kind, known);
  const row = current.sets.find((s) => s.number === set)!.rows.find((r) => r.kind === kind && r.playerNumber === playerNumber)!;
  return bump(current, set, row.id, code, 1);
}

/** The six on court now: the lineup of the set with its substitutions applied, place by place. */
export function courtNow(set: SetRecord): number[] {
  const court = [...(set.lineup?.court ?? [])];
  for (const sub of set.subs ?? []) {
    const place = court.indexOf(sub.out);
    if (place >= 0 && !court.includes(sub.in)) court[place] = sub.in;
  }
  return court;
}

const NO_SERVE: ServeState = { rotation: 0, received: false };

/**
 * Who is in each zone now, zone 1 first (null: nobody given for that place):
 * the lineup, with its substitutions, turned by the rotation. Zones run
 * 4 3 2 at the net and 5 6 1 behind; a rotation moves zone 2 to zone 1.
 */
export function zonesNow(set: SetRecord): (number | null)[] {
  const court = courtNow(set);
  const turned = set.serve?.rotation ?? 0;
  return Array.from({ length: 6 }, (_, zone) => court[(zone + turned) % 6] ?? null);
}

/**
 * Who is expected to serve next: whoever is in zone 1, or in zone 2 when the
 * opponent served since our last serve (a reception was recorded, or our
 * serve was missed): winning the serve back rotates.
 */
export function expectedServer(set: SetRecord): number | null {
  return zonesNow(set)[set.serve?.received ? 1 : 0] ?? null;
}

/**
 * The rotation after a touch of the keypad, or null when it does not change.
 * A reception, or a serve of ours missed, means the opponent serves. A serve puts whoever serves in zone 1:
 * one place on after a reception, any number chosen by hand otherwise (the
 * opponent missed their serve: no reception tells), turning the lineup as far
 * as needed. It is always followed, to know who serves next; whether the keys
 * move with it is a choice of the keypad.
 */
export function serveAfter(set: SetRecord, number: number, kind: RowKind, code: ScoutCodeString): ServeState | null {
  const now = set.serve ?? NO_SERVE;
  if (code.startsWith('R')) return now.received ? null : { ...now, received: true };
  if (!code.startsWith('B') || kind !== 'player') return null;
  const place = courtNow(set).indexOf(number);
  // A missed serve gives the ball away as a reception does: our next serve comes after a rotation.
  const next: ServeState = { rotation: place >= 0 ? place : now.rotation, received: code === 'B=' };
  return next.rotation === now.rotation && next.received === now.received ? null : next;
}

/** What the keypad follows from touch to touch: the rotation with the rally, and the statistics by phase. */
export interface Followed {
  readonly serve: ServeState | null;
  readonly phases: PhaseStats | null;
}

export const followedOf = (set: SetRecord): Followed => ({ serve: set.serve ?? null, phases: set.phases ?? null });

/**
 * The rally and the statistics by phase after a touch of the keypad, as in the
 * tables at the bottom of the DataVolley scoresheet.
 * - A serve or a reception starts a rally, and tells how the one before ended
 *   when no touch did: serving after a reception rally is a side-out won (the
 *   opponent made the error); the same server again is a break point won.
 * - The first attack after a reception "#"/"+" or "!"/"-" is an attack on
 *   reception; every other attack of a rally is a counter-attack. "R/" and
 *   "R=" allow no attack on reception.
 * - A touch that wins the rally ("B#", "A#", "M#") is a break point or a
 *   side-out by the phase; one that loses it ("B=", "R=", "A=", "A/", "M=",
 *   "M/", "P=") closes it.
 * A touch outside any rally (before the first serve or reception of the set)
 * is in the counts only.
 */
export function phasesAfter(set: SetRecord, number: number, kind: RowKind, code: ScoutCodeString): { readonly rally: Rally | undefined; readonly phases: PhaseStats } {
  const skill = code[0]!;
  const evaluation = code.slice(1);
  let phases = set.phases ?? NO_PHASES;
  const before = set.serve?.rally;
  const won = (rally: Rally): PhaseStats =>
    rally.phase === 'serve' ? { ...phases, breakPoints: phases.breakPoints + 1 } : { ...phases, sideOuts: phases.sideOuts + 1 };

  if (skill === 'B' && kind === 'player') {
    // How the rally before ended, when no touch told: our serve now means we won it, unless another server came (we lost, then won the serve back).
    if (before?.open && (before.phase === 'reception' || before.server === number)) phases = won(before);
    phases = { ...phases, serves: phases.serves + 1, ...(evaluation === '#' && { breakPoints: phases.breakPoints + 1 }) };
    return { rally: { phase: 'serve', open: evaluation !== '#' && evaluation !== '=', server: number }, phases };
  }
  if (skill === 'R') {
    phases = { ...phases, receptions: phases.receptions + 1 };
    const quality = evaluation === '#' || evaluation === '+' ? 'positive' : evaluation === '!' || evaluation === '-' ? 'negative' : undefined;
    return { rally: { phase: 'reception', open: evaluation !== '=', ...(quality && { quality }) }, phases };
  }
  if (!before) return { rally: before, phases };
  let rally = before;
  if (skill === 'A') {
    const on = rally.open && rally.phase === 'reception' ? rally.quality : undefined;
    const where = on === 'positive' ? 'onPositive' : on === 'negative' ? 'onNegative' : 'counter';
    phases = { ...phases, [where]: withAttack(phases[where], evaluation) };
    // The attack on reception is the first one only.
    if (rally.quality) rally = { phase: rally.phase, open: rally.open };
  }
  const wins = (skill === 'A' || skill === 'M') && evaluation === '#';
  const loses = (skill === 'A' && (evaluation === '=' || evaluation === '/')) || (skill === 'M' && (evaluation === '=' || evaluation === '/')) || skill === 'P';
  if (rally.open && (wins || loses)) {
    if (wins) phases = won(rally);
    rally = { ...rally, open: false };
  }
  return { rally, phases };
}

/** Everything the keypad follows after a touch: rotation, rally and statistics by phase. */
export function followAfter(set: SetRecord, number: number, kind: RowKind, code: ScoutCodeString): Followed {
  const { rally, phases } = phasesAfter(set, number, kind, code);
  const turned = serveAfter(set, number, kind, code) ?? set.serve ?? NO_SERVE;
  const serve: ServeState = { rotation: turned.rotation, received: turned.received, ...(rally && { rally }) };
  const some = phases !== NO_PHASES;
  return { serve: serve.rotation || serve.received || serve.rally ? serve : null, phases: some ? phases : null };
}

/** Sets what the keypad follows in a set (null clears). */
export function setFollowed(record: MatchRecord, set: SetNumber, followed: Followed): MatchRecord {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return record;
  const { serve: _s, phases: _p, ...rest } = target;
  return replaceSet(record, { ...rest, ...(followed.serve && { serve: followed.serve }), ...(followed.phases && { phases: followed.phases }) });
}

/** Sets (or, with null, clears) the rotation of a set. */
export function setServe(record: MatchRecord, set: SetNumber, serve: ServeState | null): MatchRecord {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return record;
  const { serve: _, ...rest } = target;
  return replaceSet(record, serve ? { ...rest, serve } : rest);
}

/** A substitution in a set: the entering number takes the place of the leaving one. */
export function substitute(record: MatchRecord, set: SetNumber, sub: Substitution): MatchRecord {
  const target = record.sets.find((s) => s.number === set);
  return target ? replaceSet(record, { ...target, subs: [...(target.subs ?? []), sub] }) : record;
}

/** Takes back the last substitution of a set. */
export function undoSubstitution(record: MatchRecord, set: SetNumber): MatchRecord {
  const target = record.sets.find((s) => s.number === set);
  if (!target?.subs?.length) return record;
  const subs = target.subs.slice(0, -1);
  const { subs: _, ...rest } = target;
  return replaceSet(record, subs.length ? { ...target, subs } : rest);
}

/**
 * The substitutions the rules expect next: whoever came in for someone can
 * leave only for that someone, who comes back in. One per pair still open
 * (the one who came in is on court, the one who left is not, and they have
 * not swapped back yet). A suggestion: nothing is forbidden.
 */
export function returnsDue(set: SetRecord): Substitution[] {
  const court = courtNow(set);
  const subs = set.subs ?? [];
  return subs.flatMap((s, i) => {
    const back = subs.slice(i + 1).some((later) => later.out === s.in && later.in === s.out);
    // A return closes its pair: it opens no new one.
    const isReturn = subs.slice(0, i).some((earlier) => earlier.out === s.in && earlier.in === s.out);
    return !back && !isReturn && court.includes(s.in) && !court.includes(s.out) ? [{ out: s.in, in: s.out }] : [];
  });
}

/** Shirt numbers of the match that are not on court nor liberos in this set: who can come in. */
export function benchNumbers(record: MatchRecord, set: SetNumber): number[] {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return [];
  const away = new Set([...courtNow(target), ...(target.lineup?.liberos ?? [])]);
  const known = [
    ...record.players.map((p) => p.number),
    ...record.sets.flatMap((s) => s.rows.filter((r) => r.kind === 'player' && r.playerNumber !== null).map((r) => r.playerNumber!)),
    ...(target.subs ?? []).flatMap((s) => [s.out, s.in]),
  ];
  return [...new Set(known)].filter((n) => !away.has(n)).sort((a, b) => a - b);
}

/**
 * Puts shirt numbers on the rows of a set, so that the sheet shows them: a
 * number already on a row of its kind stays there, the others take the first
 * empty rows of their kind, or new ones.
 */
export function placeNumbers(
  record: MatchRecord,
  set: SetNumber,
  numbers: readonly number[],
  kind: RowKind,
  known: readonly PlayerRecord[] = [],
): MatchRecord {
  let current = record;
  for (const number of numbers) {
    const target = current.sets.find((s) => s.number === set);
    if (!target || target.rows.some((r) => r.kind === kind && r.playerNumber === number)) continue;
    let row = target.rows.find((r) => r.kind === kind && r.playerNumber === null && Object.keys(r.counts).length === 0);
    if (!row) {
      row = emptyRow(kind);
      current = replaceSet(current, { ...target, rows: [...target.rows, row] });
    }
    current = setShirtNumber(current, set, row.id, number, known);
  }
  return current;
}

/**
 * Where the substitutions of a set stand, by the rules: whoever comes in for
 * someone can leave only for that someone, who comes back in; after that
 * return the pair is closed and neither can be substituted again in the set.
 * Liberos are not substitutions. Each set starts afresh.
 */
export interface SubstitutionState {
  /** Pairs still open: who came in (on court) → who left and can come back only for them. */
  readonly partner: ReadonlyMap<number, number>;
  /** Numbers of closed pairs: no more substitutions for them in this set. */
  readonly closed: ReadonlySet<number>;
  /** Every number already part of a substitution of the set. */
  readonly involved: ReadonlySet<number>;
}

export function substitutionState(set: SetRecord): SubstitutionState {
  const partner = new Map<number, number>();
  const closed = new Set<number>();
  const involved = new Set<number>();
  for (const sub of set.subs ?? []) {
    involved.add(sub.out).add(sub.in);
    if (partner.get(sub.out) === sub.in) {
      partner.delete(sub.out);
      closed.add(sub.out).add(sub.in);
    } else {
      partner.set(sub.in, sub.out);
    }
  }
  return { partner, closed, involved };
}

/** Who can leave the court now: everyone on court but the closed pairs. */
export const canLeave = (set: SetRecord): number[] => {
  const { closed } = substitutionState(set);
  return courtNow(set).filter((n) => !closed.has(n));
};

/**
 * Who can come in for `out`: only the one they replaced, when they came in
 * with a substitution (locked); otherwise the numbers on the bench never part
 * of a substitution of the set (and any new number, typed).
 */
export function canEnter(record: MatchRecord, set: SetNumber, out: number): { readonly locked: boolean; readonly options: number[] } {
  const target = record.sets.find((s) => s.number === set);
  if (!target) return { locked: false, options: [] };
  const { partner, involved } = substitutionState(target);
  const back = partner.get(out);
  if (back !== undefined) return { locked: true, options: [back] };
  return { locked: false, options: benchNumbers(record, set).filter((n) => !involved.has(n)) };
}
