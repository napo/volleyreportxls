// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A shared report travels inside its link, after "#v/": the matches it needs
 * (only what the statistics use), compressed and written in base64url. The
 * part after "#" never reaches the web server. There is no server either, so
 * a link cannot be withdrawn: the expiry written in it is checked by the
 * viewer, and a new link is the only way to "renew" one.
 * Reading never trusts the link, as for a .vrp file.
 */

import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { type MatchRecord, rowIsUsed } from '../matches/record';
import { isObject, readMatchRecord, text } from '../matches/vrp';

/** Version of the format: a newer app keeps reading the links of older ones. */
export const SHARE_VERSION = 1;

export type ShareKind = 'match' | 'history';

/** The parts of the page that can be left out of a shared report. */
export const SHARE_SECTIONS = {
  match: ['tabellino', 'sets', 'team', 'players'],
  history: ['matches', 'table', 'team', 'athleteCharts'],
} as const satisfies Record<ShareKind, readonly string[]>;

export type ShareSection = (typeof SHARE_SECTIONS)[ShareKind][number];

export interface SharedAthlete {
  readonly id: string;
  readonly label: string;
}

export interface SharePayload {
  readonly kind: ShareKind;
  /** End of validity (ISO 8601). */
  readonly expires: string;
  /** For the history: the name of the squad. */
  readonly title: string;
  readonly hidden: readonly ShareSection[];
  readonly matches: readonly MatchRecord[];
  /** History: the athletes shown, in order. Match: none. */
  readonly athletes: readonly SharedAthlete[];
  /** Match: the shirt numbers shown in the charts. */
  readonly numbers: readonly number[];
}

/** Base path of the viewer, after the address of the web app. */
export const SHARE_PREFIX = '#v/';

const shortId = (prefix: string, i: number) => `${prefix}${String(i).padStart(3, '0')}`;

/**
 * The matches as the link carries them: new short ids, no times, no empty
 * rows; without names when asked (athletes become their shirt numbers).
 */
export function forSharing(
  records: readonly MatchRecord[],
  athletes: readonly SharedAthlete[],
  names: boolean,
): { matches: MatchRecord[]; athletes: SharedAthlete[] } {
  const ids = new Map(athletes.map((a, i) => [a.id, shortId('a', i)]));
  const numbers = (id: string) => [...new Set(records.flatMap((r) => r.players.filter((p) => p.athleteId === id).map((p) => p.number)))];
  return {
    matches: records.map((r, i) => ({
      ...r,
      id: shortId('m', i),
      createdAt: '',
      updatedAt: '',
      players: r.players.flatMap((p) => {
        const athleteId = p.athleteId && ids.get(p.athleteId);
        const name = names ? p.name : '';
        return name || athleteId ? [athleteId ? { number: p.number, name, athleteId } : { number: p.number, name }] : [];
      }),
      sets: r.sets.map((s) => ({ ...s, rows: s.rows.filter(rowIsUsed).map((row) => ({ ...row, id: '' })) })),
    })),
    athletes: athletes.map((a) => ({ id: ids.get(a.id)!, label: names ? a.label : `n. ${numbers(a.id).join(', ')}` })),
  };
}

function toBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(s: string): Uint8Array {
  const binary = atob(s.replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

export function encodeShare(p: SharePayload): string {
  const json = { v: SHARE_VERSION, k: p.kind, e: p.expires, t: p.title, h: p.hidden, m: p.matches, a: p.athletes, n: p.numbers };
  return toBase64Url(deflateSync(strToU8(JSON.stringify(json)), { level: 9 }));
}

export type ShareError = 'invalid' | 'newer';

/** The report of a link, or why it cannot be read. Expiry is left to the caller. */
export function decodeShare(s: string): SharePayload | ShareError {
  let v: unknown;
  try {
    v = JSON.parse(strFromU8(inflateSync(fromBase64Url(s))));
  } catch {
    return 'invalid';
  }
  if (!isObject(v) || typeof v.v !== 'number') return 'invalid';
  if (v.v > SHARE_VERSION) return 'newer';
  const kind = v.k === 'match' || v.k === 'history' ? v.k : null;
  const expires = typeof v.e === 'string' && !Number.isNaN(Date.parse(v.e)) ? v.e : null;
  if (!kind || !expires || !Array.isArray(v.m)) return 'invalid';
  const matches = v.m.map(readMatchRecord);
  if (matches.length === 0 || matches.some((m) => m === null)) return 'invalid';
  const sections: readonly string[] = SHARE_SECTIONS[kind];
  return {
    kind,
    expires,
    title: text(v.t),
    hidden: Array.isArray(v.h) ? (v.h.filter((h) => typeof h === 'string' && sections.includes(h)) as ShareSection[]) : [],
    matches: matches as MatchRecord[],
    athletes: Array.isArray(v.a) ? v.a.flatMap((a) => (isObject(a) && typeof a.id === 'string' ? [{ id: text(a.id, 40), label: text(a.label, 120) }] : [])) : [],
    numbers: Array.isArray(v.n) ? v.n.filter((n): n is number => Number.isInteger(n) && n >= 0 && n <= 99) : [],
  };
}

export const isExpired = (p: SharePayload, now = new Date()) => now.getTime() > Date.parse(p.expires);

/** The shared report in the hash of a page, or null when the page is not a shared report. */
export const sharedPart = (hash: string): string | null => (hash.startsWith(SHARE_PREFIX) ? hash.slice(SHARE_PREFIX.length) : null);

export const shareUrl = (base: string, encoded: string) => `${base.replace(/#.*$/, '')}${SHARE_PREFIX}${encoded}`;
