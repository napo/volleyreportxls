// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A match scouted on the screen, as a DataVolley scout file (.dvw) that
 * OpenVolleyScout imports: the touches in order with their time, so that a
 * video can be matched to them there.
 *
 * Only the scouted team is in the file (the opponent by name), as many club
 * scouts do. The live sheet records no score rally by rally, so the rallies
 * and their points are rebuilt from the order of the touches:
 * - a serve or a reception of ours starts a rally;
 * - who won it is told by a touch that decides it ("B#", "A#", "M#" for us;
 *   "B=", "R=", "A=", "A/", "M=", "M/", "P=" for the opponent), or by how the
 *   next rally starts (we serve again: ours; we receive: theirs);
 * - when we serve after a rally we lost, the opponent missed their serve in
 *   between: a point of ours with no touch.
 * The score in the file is the rebuilt one; a set whose rebuilt score differs
 * from the one written at the end is reported, never corrected.
 */
import type { ScoutCodeString } from '../domain/codes';
import type { SetNumber } from '../domain/model';
import { type MatchRecord, type SetRecord, liberoNumbers, shirtNumbers } from './record';

const CRLF = '\r\n';

/** Our skills in DataVolley letters: serve, reception, attack, block, set. */
const SKILL: Readonly<Record<string, string>> = { B: 'S', R: 'R', A: 'A', M: 'B', P: 'E' };

const WINS = new Set(['B#', 'A#', 'M#']);
const LOSES = new Set(['B=', 'R=', 'A=', 'A/', 'M=', 'M/', 'P=']);

export interface DvwSetReport {
  readonly set: SetNumber;
  /** Touches written in the file. */
  readonly touches: number;
  /** Touches of the set that are in the counts only (paper, corrections by hand): not in the file. */
  readonly missing: number;
  /** The score rebuilt from the touches. */
  readonly rebuilt: { readonly team: number; readonly opponent: number };
  /** The score written when the set was closed, when it differs from the rebuilt one. */
  readonly written: { readonly team: number; readonly opponent: number } | null;
  /** Who was taken as the setter at the start of the set (chosen by the user, or worked out from the touches); null when nobody is on court. */
  readonly setter: number | null;
}

export interface DvwExport {
  readonly text: string;
  readonly sets: readonly DvwSetReport[];
}

const clean = (value: string | number) => String(value).replace(/[;\r\n]+/g, ' ').trim();
const row = (...parts: (string | number)[]) => `${parts.map(clean).join(';')};`;
const two = (n: number) => String(n).padStart(2, '0');
const clock = (at: number) => {
  const d = new Date(at);
  return `${two(d.getHours())}.${two(d.getMinutes())}.${two(d.getSeconds())}`;
};

/** The touches of a set that have a shirt number, in the order they were entered. */
function touchesOf(set: SetRecord) {
  const rows = new Map(set.rows.map((r) => [r.id, r]));
  return (set.log ?? [])
    .flatMap((entry) => {
      const found = rows.get(entry.row);
      return found && found.playerNumber !== null ? [{ at: entry.at, number: found.playerNumber, kind: found.kind, code: entry.code }] : [];
    })
    .sort((a, b) => a.at - b.at);
}

/** A match can be exported when some touches were entered on the screen with a shirt number. */
export const hasDvwData = (record: MatchRecord) => record.sets.some((set) => touchesOf(set).length > 0);

/**
 * Who sets, worked out from the touches of the whole match: among the numbers
 * given, whoever does not receive (fewer than a tenth of the team's
 * receptions) and attacks the least; with a tie, the fewest points. Middles
 * and the opposite do not receive either, but they attack.
 */
export function likelySetter(record: MatchRecord, among: readonly number[]): number | null {
  const totals = new Map<number, { receptions: number; attacks: number; points: number }>();
  for (const set of record.sets) {
    for (const r of set.rows) {
      if (r.playerNumber === null) continue;
      const t = totals.get(r.playerNumber) ?? { receptions: 0, attacks: 0, points: 0 };
      for (const [code, n] of Object.entries(r.counts)) {
        if (code.startsWith('R')) t.receptions += n ?? 0;
        if (code.startsWith('A')) t.attacks += n ?? 0;
        if (code === 'A#' || code === 'B#' || code === 'M#') t.points += n ?? 0;
      }
      totals.set(r.playerNumber, t);
    }
  }
  const of = (n: number) => totals.get(n) ?? { receptions: 0, attacks: 0, points: 0 };
  const team = [...totals.values()].reduce((sum, t) => sum + t.receptions, 0);
  const apart = among.filter((n) => of(n).receptions <= team / 10);
  const pool = apart.length ? apart : among;
  return [...pool].sort((a, b) => of(a).attacks - of(b).attacks || of(a).points - of(b).points || of(a).receptions - of(b).receptions)[0] ?? null;
}

interface Rally {
  readonly phase: 'serve' | 'reception';
  readonly server: number | null;
  /** Decided by a touch: who won. */
  winner: 'team' | 'opponent' | null;
}

/** The six who start a set, by zone (zone 1 first): the lineup, or without one the first six shirt numbers that touch the ball. */
export function startingSix(set: SetRecord): (number | null)[] {
  if (set.lineup) return Array.from({ length: 6 }, (_, i) => set.lineup!.court[i] ?? null);
  const first = [...new Set(touchesOf(set).filter((t) => t.kind === 'player').map((t) => t.number))].slice(0, 6);
  return Array.from({ length: 6 }, (_, i) => first[i] ?? null);
}

/** Who sets at the start of a set: the one the user chose, if among the six who start; otherwise worked out from the touches. */
export function startingSetter(record: MatchRecord, set: SetRecord): number | null {
  const six = startingSix(set).filter((n): n is number => n !== null);
  return set.setter !== undefined && six.includes(set.setter) ? set.setter : likelySetter(record, six);
}

/** The sets of a match that go into the file. */
export const dvwSets = (record: MatchRecord) => record.sets.filter((set) => touchesOf(set).length > 0);

function scoutSet(record: MatchRecord, set: SetRecord, start: number, lines: string[]): DvwSetReport {
  const touches = touchesOf(set);
  // The six on court by zone (zone 1 first), turned at each side-out; liberos are not in the lineup.
  let court = startingSix(set);
  const pending = [...(set.subs ?? [])];
  // DataVolley wants a setter: the one chosen by the user, or worked out from the touches (see likelySetter).
  const onCourt = () => court.filter((n): n is number => n !== null);
  let setter = startingSetter(record, set);
  const atStart = setter;
  let at = touches[0]?.at ?? start;
  const score = { team: 0, opponent: 0 };
  let ourServe: boolean | null = null;
  let rally: Rally | null = null;
  let written = 0;

  const line = (code: string, video = true) => {
    const setterZone = Math.max(1, (setter === null ? -1 : court.indexOf(setter)) + 1);
    lines.push(
      row(code, '', '', '', '', '', '', clock(at), set.number, setterZone, 1, video ? 1 : '', video ? Math.max(0, Math.round((at - start) / 1000)) : '', '', ...court.map((n) => n ?? ''), '', '', '', '', '', ''),
    );
  };
  const rotate = () => {
    court = [...court.slice(1), court[0]!];
  };
  const point = (winner: 'team' | 'opponent') => {
    score[winner] += 1;
    line(`${winner === 'team' ? '*' : 'a'}p${two(score.team)}:${two(score.opponent)}`);
    // Winning the serve back turns the lineup.
    if (winner === 'team' && ourServe === false) rotate();
    ourServe = winner === 'team';
    rally = null;
  };
  /** A rally with no touch of ours: the point code alone. */
  const bare = (winner: 'team' | 'opponent') => {
    line(`${winner === 'team' ? '*' : 'a'}$$&H#`);
    point(winner);
  };
  /** Ends the rally being played: by its deciding touch, or by what follows. */
  const close = (next: { readonly skill: string; readonly number: number } | null) => {
    if (!rally) return;
    const open: Rally = rally;
    let winner = open.winner;
    if (!winner && next) {
      if (open.phase === 'serve') winner = next.skill === 'B' && next.number === open.server ? 'team' : 'opponent';
      else winner = next.skill === 'B' ? 'team' : 'opponent';
    }
    if (!winner) {
      // The last rally of the set: the point the written score still needs, else to whoever won the set.
      const final = set.score;
      if (final && score.team + 1 === final.team && score.opponent === final.opponent) winner = 'team';
      else if (final && score.opponent + 1 === final.opponent && score.team === final.team) winner = 'opponent';
      else winner = final && final.opponent > final.team ? 'opponent' : 'team';
    }
    point(winner);
  };

  line(`*P${two(setter ?? 0)}>LUp`, false);
  line(`*z${Math.max(1, (setter === null ? -1 : court.indexOf(setter)) + 1)}>LUp`, false);

  /** The substitutions made before a rally: whoever plays it without being on court came in for someone. */
  const substitutions = (from: number) => {
    for (let k = from; k < touches.length; k++) {
      const next = touches[k]!;
      if (k > from && (next.code.startsWith('B') || next.code.startsWith('R'))) break;
      if (next.kind !== 'player' || court.includes(next.number)) continue;
      const sub = pending.findIndex((s) => s.in === next.number && court.includes(s.out));
      if (sub < 0) continue;
      const [made] = pending.splice(sub, 1);
      line(`*c${two(made!.out)}:${two(made!.in)}`);
      court = court.map((n) => (n === made!.out ? made!.in : n));
      // The setter went out: whoever sets now, among the six on court.
      if (made!.out === setter) {
        setter = likelySetter(record, onCourt());
        if (setter !== null) line(`*P${two(setter)}`);
      }
    }
  };

  for (const [index, touch] of touches.entries()) {
    // Points and substitutions before this touch keep the time of the touch before it.
    const skill = touch.code[0]!;
    if (skill === 'B' || skill === 'R') {
      close({ skill, number: touch.number });
      substitutions(index);
      if (skill === 'B') {
        // We serve after a rally we lost: the opponent missed their serve in between.
        if (ourServe === false) bare('team');
        ourServe = true;
        // Whoever serves is in zone 1: the lineup turns as far as needed (a rally was not entered).
        const place = court.indexOf(touch.number);
        if (place > 0) court = [...court.slice(place), ...court.slice(0, place)];
      } else {
        // We receive after a rally we won: we served and lost a rally that was not entered.
        if (ourServe === true) bare('opponent');
        ourServe = false;
      }
      rally = { phase: skill === 'B' ? 'serve' : 'reception', server: skill === 'B' ? touch.number : null, winner: null };
    }
    // A touch before any serve or reception of the set opens a rally of its own kind: we are playing the ball.
    if (!rally) {
      substitutions(index);
      rally = { phase: ourServe ? 'serve' : 'reception', server: null, winner: null };
    }
    const playing: Rally = rally;
    at = touch.at;
    line(`*${two(touch.number)}${SKILL[skill] ?? skill}H${touch.code.slice(1)}`);
    written += 1;
    if (!playing.winner) playing.winner = WINS.has(touch.code) ? 'team' : LOSES.has(touch.code) ? 'opponent' : null;
  }
  close(null);
  line(`**${set.number}set`, false);

  const counted = set.rows.reduce((n, r) => n + Object.values(r.counts).reduce((k: number, v) => k + (v ?? 0), 0), 0);
  const differs = set.score !== null && (set.score.team !== score.team || set.score.opponent !== score.opponent);
  return { set: set.number, touches: written, missing: Math.max(0, counted - written), rebuilt: { ...score }, written: differs ? set.score : null, setter: atStart };
}

/** The DataVolley scout file of a match, with what to know about each set written in it. */
export function buildDvw(record: MatchRecord, now = Date.now()): DvwExport {
  const sets = dvwSets(record);
  const start = Math.min(...sets.map((set) => touchesOf(set)[0]!.at));
  const scout: string[] = [];
  const reports = sets.map((set) => scoutSet(record, set, start, scout));

  const won = (side: 'team' | 'opponent') => reports.filter((r) => (side === 'team' ? r.rebuilt.team > r.rebuilt.opponent : r.rebuilt.opponent > r.rebuilt.team)).length;
  const liberos = liberoNumbers(record);
  const [year, month, day] = (record.date || new Date(start).toISOString().slice(0, 10)).split('-');
  const players = shirtNumbers(record).map((number, i) => {
    const starting = Array.from({ length: 5 }, (_, s) => {
      const set = record.sets.find((x) => x.number === s + 1);
      const zone = set?.lineup?.court.indexOf(number) ?? -1;
      return zone >= 0 ? zone + 1 : set?.lineup?.liberos.includes(number) ? '*' : '';
    });
    const name = record.players.find((p) => p.number === number)?.name.trim() ?? '';
    return row(0, number, i + 1, ...starting, `VR-${number}`, name || `N. ${number}`, '', '', liberos.has(number) ? 'L' : '', liberos.has(number) ? 1 : '', 'False');
  });
  const generated = new Date(now);
  const text = [
    '[3DATAVOLLEYSCOUT]',
    'FILEFORMAT: 2.0',
    `GENERATOR-DAY: ${two(generated.getDate())}/${two(generated.getMonth() + 1)}/${generated.getFullYear()} ${clock(now)}`,
    'GENERATOR-IDP: VR',
    'GENERATOR-PRG: VolleyReport',
    'GENERATOR-REL: Export v1',
    'GENERATOR-VER: Community',
    'GENERATOR-NAM: VolleyReport',
    '[3MATCH]',
    row(`${day}/${month}/${year}`, clock(start), '', record.competition, '', '', '', '', '', 1, 'Z', 0),
    '[3TEAMS]',
    row('HOM', record.teamName || 'Team', won('team'), '', ''),
    row('AWY', record.opponentName || 'Opponent', won('opponent'), '', ''),
    '[3MORE]',
    row('', '', '', record.venue, '', ''),
    '[3COMMENTS]',
    '[3SET]',
    ...Array.from({ length: 5 }, (_, i) => {
      const report = reports.find((r) => r.set === i + 1);
      return report ? row('True', '', '', '', `${report.rebuilt.team}-${report.rebuilt.opponent}`, '') : row('False', '', '', '', '', '');
    }),
    '[3PLAYERS-H]',
    ...players,
    '[3PLAYERS-V]',
    '[3ATTACKCOMBINATION]',
    '[3SETTERCALL]',
    '[3WINNINGSYMBOLS]',
    '=~~~#~~~=~~~~~~~=/~~#~~~=/~~#~~~=~~~~~~~=~~~~~~~=~~~~~~~',
    '[3RESERVE]',
    '[3VIDEO]',
    '[3SCOUT]',
    ...scout,
    '',
  ].join(CRLF);
  return { text, sets: reports };
}

/** A touch of the log as the file writes it (for tests and messages). */
export const dvwCode = (number: number, code: ScoutCodeString) => `*${two(number)}${SKILL[code[0]!] ?? code[0]}H${code.slice(1)}`;
