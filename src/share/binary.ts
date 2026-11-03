// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Version 2 of the shared report: the same content as version 1, written as
 * bytes instead of JSON, so that the link is about half as long. Numbers are
 * variable-length integers (7 bits per byte). The counts of the tally rows
 * come last, by column: the codes used anywhere, then for each of them the
 * counts of every row, two per byte (half a byte each); a count of 15 or
 * more is 15 plus a number in a list at the very end. Similar values side by
 * side compress better. The order of the codes and of the sections below is
 * part of the format: it never changes.
 *
 * A match keeps its sets; a history keeps, for each match, the set scores,
 * the opponent errors and, for each shirt, the sets played and the touches
 * of the whole match: that is all the history shows, in a third of the room.
 *
 * The bytes are only read here; what they describe is then checked as any
 * .vrp content (readMatchRecord), never trusted.
 */

import { strFromU8, strToU8 } from 'fflate';
import { calculateMatchStats } from '../domain/stats/aggregate';
import { type MatchRecord, rowIsUsed, setIsPlayed, toMatch } from '../matches/record';

export const BINARY_VERSION = 2;

/** Every code of the sheet, in the order of the masks. */
const CODES = ['#', '+', '!', '-', '/', '='].flatMap((e) => ['B', 'R', 'A', 'M', 'P', 'F'].map((s) => `${s}${e}`));

/** The sections that can be left out, in the order of their bits. */
const SECTIONS = {
  match: ['tabellino', 'sets', 'team', 'players'],
  history: ['matches', 'table', 'team', 'athleteCharts'],
} as const;

const KINDS = ['match', 'history'] as const;
const DAY = 86_400_000;

class Writer {
  readonly bytes: number[] = [BINARY_VERSION];
  /** The counts of the tally rows, written last (see counts). */
  readonly rows: (readonly number[])[] = [];
  int(n: number) {
    // Plain arithmetic: masks need more than the 32 bits of bitwise operators.
    let rest = Math.max(0, Math.floor(n));
    do {
      const low = rest % 128;
      rest = Math.floor(rest / 128);
      this.bytes.push(rest ? low + 128 : low);
    } while (rest);
  }
  text(s: string) {
    const u = strToU8(s);
    this.int(u.length);
    this.bytes.push(...u);
  }
  /** The counts of all the rows, by column of the codes used, half a byte each. */
  counts() {
    const used = CODES.map((_, i) => this.rows.some((row) => row[i]! > 0));
    this.int(used.reduce((mask, u, i) => (u ? mask + 2 ** i : mask), 0));
    const halves: number[] = [];
    const large: number[] = [];
    used.forEach((u, i) => {
      if (!u) return;
      for (const row of this.rows) {
        halves.push(Math.min(row[i]!, 15));
        if (row[i]! >= 15) large.push(row[i]! - 15);
      }
    });
    for (let i = 0; i < halves.length; i += 2) this.bytes.push(halves[i]! * 16 + (halves[i + 1] ?? 0));
    large.forEach((n) => this.int(n));
  }
}

class Reader {
  private at = 1;
  /** The rows read so far, filled with their counts at the end (see counts). */
  readonly rows: Record<string, number>[] = [];
  constructor(private readonly bytes: Uint8Array) {}
  int(): number {
    let n = 0;
    let scale = 1;
    for (;;) {
      if (this.at >= this.bytes.length || scale > 2 ** 49) throw new Error('share: truncated');
      const b = this.bytes[this.at++]!;
      n += (b % 128) * scale;
      if (b < 128) return n;
      scale *= 128;
    }
  }
  text(): string {
    const length = this.int();
    if (this.at + length > this.bytes.length) throw new Error('share: truncated');
    return strFromU8(this.bytes.subarray(this.at, (this.at += length)));
  }
  list<T>(item: () => T, max = 500): T[] {
    const n = this.int();
    if (n > max) throw new Error('share: too long');
    return Array.from({ length: n }, item);
  }
  counts() {
    let mask = this.int();
    const used = CODES.filter(() => {
      const u = mask % 2 === 1;
      mask = Math.floor(mask / 2);
      return u;
    });
    const total = used.length * this.rows.length;
    if (this.at + Math.ceil(total / 2) > this.bytes.length) throw new Error('share: truncated');
    const half = (i: number) => (i % 2 ? this.bytes[this.at + (i >> 1)]! % 16 : this.bytes[this.at + (i >> 1)]! >> 4);
    const values = Array.from({ length: total }, (_, i) => half(i));
    this.at += Math.ceil(total / 2);
    // Large counts are read back in the order they were written: code by code, row by row.
    values.forEach((n, i) => {
      const count = n === 15 ? 15 + this.int() : n;
      if (count) this.rows[i % this.rows.length]![used[Math.floor(i / this.rows.length)]!] = count;
    });
  }
}

export interface BinaryContent {
  readonly kind: (typeof KINDS)[number];
  readonly expires: string;
  readonly title: string;
  readonly hidden: readonly string[];
  readonly matches: readonly MatchRecord[];
  readonly athletes: readonly { readonly id: string; readonly label: string }[];
  readonly numbers: readonly number[];
}

const countsOf = (counts: Readonly<Partial<Record<string, number>>>) => CODES.map((code) => counts[code] ?? 0);

/** The counts of a row go with the others, at the end. */
function writeCounts(w: Writer, counts: readonly number[]) {
  w.rows.push(counts);
}

/** The counts of a row, filled in when the end is read. */
function readCounts(r: Reader): Record<string, number> {
  const counts: Record<string, number> = {};
  r.rows.push(counts);
  return counts;
}

/** Shirt number and libero mark in one integer (0: no number). */
const who = (number: number | null, libero: boolean) => (number === null ? 0 : number + 1) * 2 + (libero ? 1 : 0);

/** A match: names of the players, then every set with its rows. */
function writeSets(w: Writer, r: MatchRecord, athlete: (id: string | undefined) => number) {
  w.int(r.players.length);
  for (const p of r.players) {
    w.int(p.number);
    w.text(p.name);
    w.int(athlete(p.athleteId));
  }
  const sets = r.sets.filter((s) => s.score || s.rows.length);
  w.int(sets.length);
  for (const s of sets) {
    w.int(s.number);
    w.int(s.score ? s.score.team + 1 : 0);
    w.int(s.score?.opponent ?? 0);
    w.int(s.rows.length);
    for (const row of s.rows) {
      w.int(who(row.playerNumber, row.kind === 'libero'));
      writeCounts(w, countsOf(row.counts));
    }
  }
}

/** A match of a history: set scores, opponent errors, then each shirt with its sets and the touches of the match. */
function writeTotals(w: Writer, r: MatchRecord, athlete: (id: string | undefined) => number) {
  const sets = r.sets.filter(setIsPlayed);
  w.int(sets.length);
  for (const s of sets) {
    w.int(s.number);
    w.int(s.score ? s.score.team + 1 : 0);
    w.int(s.score?.opponent ?? 0);
  }
  w.int(r.opponentErrors ?? calculateMatchStats(toMatch(r)).opponentErrors);
  // Rows without a shirt number count for the team: they travel together, as one shirt without number.
  const rows = sets.flatMap((s) => s.rows.filter(rowIsUsed).map((row) => ({ set: s.number, row })));
  const numbers = [...new Set<number | null>([...r.players.map((p) => p.number), ...rows.map((x) => x.row.playerNumber)])];
  w.int(numbers.length);
  for (const number of numbers) {
    const own = rows.filter((x) => x.row.playerNumber === number);
    const player = number === null ? undefined : r.players.find((p) => p.number === number);
    w.int(who(number, own.some((x) => x.row.kind === 'libero')));
    // The name of a linked shirt is already in the list of the athletes.
    const linked = athlete(player?.athleteId);
    w.text(linked ? '' : (player?.name ?? ''));
    w.int(linked);
    w.int([...new Set(own.map((x) => x.set))].reduce((mask, set) => mask + 2 ** (set - 1), 0));
    writeCounts(w, own.reduce((sum, x) => countsOf(x.row.counts).map((n, i) => n + sum[i]!), CODES.map(() => 0)));
  }
}

/** The content as bytes (still to be compressed). Athlete ids must be those of forSharing (a000, a001…). */
export function writeBinary(c: BinaryContent): Uint8Array {
  const w = new Writer();
  w.int(KINDS.indexOf(c.kind));
  // To the minute, rounded down: a link may end a few seconds early, never late.
  w.int(Math.floor(Date.parse(c.expires) / 60_000));
  const sections: readonly string[] = SECTIONS[c.kind];
  w.int(c.hidden.reduce((mask, h) => (sections.includes(h) ? mask + 2 ** sections.indexOf(h) : mask), 0));
  w.text(c.title);
  w.int(c.athletes.length);
  c.athletes.forEach((a) => w.text(a.label));
  const athlete = (id: string | undefined) => (id ? c.athletes.findIndex((a) => a.id === id) + 1 : 0);
  w.int(c.numbers.length);
  c.numbers.forEach((n) => w.int(n));
  w.int(c.matches.length);
  for (const r of c.matches) {
    [r.teamName, r.opponentName, r.competition, r.venue].forEach((s) => w.text(s));
    w.int(r.date ? Date.parse(`${r.date}T00:00:00Z`) / DAY + 1 : 0);
    if (c.kind === 'history') writeTotals(w, r, athlete);
    else writeSets(w, r, athlete);
  }
  w.counts();
  return Uint8Array.from(w.bytes);
}

const whoOf = (n: number) => ({ kind: n % 2 ? 'libero' : 'player', playerNumber: n >= 2 ? Math.floor(n / 2) - 1 : null });

const readScore = (r: Reader) => {
  const number = r.int();
  const team = r.int();
  const opponent = r.int();
  return { number, score: team ? { team: team - 1, opponent } : null };
};

function readSets(r: Reader, athleteId: (i: number) => string | undefined) {
  const players = r.list(() => {
    const number = r.int();
    const name = r.text();
    const athlete = athleteId(r.int());
    return athlete ? { number, name, athleteId: athlete } : { number, name };
  });
  const sets = r.list(() => {
    const set = readScore(r);
    return { ...set, rows: r.list(() => ({ id: '', ...whoOf(r.int()), counts: readCounts(r) }), 99) };
  }, 5);
  return { players, sets };
}

/** The touches of the match go to the first set the shirt played; its other sets get an empty row, so the sets played stay right. */
function readTotals(r: Reader, athleteId: (i: number) => string | undefined) {
  const scores = r.list(() => readScore(r), 5);
  const opponentErrors = r.int();
  const shirts = r.list(() => {
    const shirt = whoOf(r.int());
    const name = r.text();
    const athlete = athleteId(r.int());
    const sets = r.int();
    return { shirt, name, athlete, sets, counts: readCounts(r) };
  }, 99);
  const players = shirts.flatMap(({ shirt, name, athlete }) =>
    shirt.playerNumber === null || (!name && !athlete) ? [] : [athlete ? { number: shirt.playerNumber, name, athleteId: athlete } : { number: shirt.playerNumber, name }],
  );
  const sets = scores.map(({ number, score }) => ({
    number,
    score,
    rows: shirts
      .filter((x) => Math.floor(x.sets / 2 ** (number - 1)) % 2 === 1)
      .map((x) => {
        const first = scores.find((s) => Math.floor(x.sets / 2 ** (s.number - 1)) % 2 === 1)?.number === number;
        return { id: '', ...x.shirt, counts: first ? x.counts : {} };
      }),
  }));
  return { players, sets, opponentErrors };
}

/** Plain objects in the shape of version 1 (to be checked by the caller); throws on broken bytes. */
export function readBinary(bytes: Uint8Array) {
  const r = new Reader(bytes);
  const kind = KINDS[r.int()];
  if (!kind) throw new Error('share: kind');
  const expires = new Date(r.int() * 60_000).toISOString();
  const mask = r.int();
  const hidden = SECTIONS[kind].filter((_, i) => Math.floor(mask / 2 ** i) % 2 === 1);
  const title = r.text();
  const athletes = r.list(() => r.text()).map((label, i) => ({ id: `a${String(i).padStart(3, '0')}`, label }));
  const numbers = r.list(() => r.int(), 99);
  const athleteId = (i: number) => (i ? athletes[i - 1]?.id : undefined);
  const matches = r.list(() => {
    const [teamName, opponentName, competition, venue] = [r.text(), r.text(), r.text(), r.text()];
    const day = r.int();
    const date = day ? new Date((day - 1) * DAY).toISOString().slice(0, 10) : '';
    return { id: '', teamName, opponentName, competition, venue, date, ...(kind === 'history' ? readTotals(r, athleteId) : readSets(r, athleteId)) };
  });
  r.counts();
  return { kind, expires, title, hidden, athletes, numbers, matches };
}
