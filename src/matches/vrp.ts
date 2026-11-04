// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * ".vrp" files (VolleyReport Paper): matches exported from one device and
 * imported on another. A zip archive with
 * - manifest.json: format name and version, app version, export time, match ids;
 * - matches/<id>.json: one MatchRecord each;
 * - athletes.json (optional): the athletes the players of the matches are linked to;
 * - squads.json (optional): the team names joined into one squad.
 * Later versions may add the photos of the sheets next to their match.
 *
 * Importing never trusts the file: every record is checked and rebuilt field
 * by field, and counts of codes the app does not know are dropped.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { EVALUATIONS, SKILLS, type ScoutCodeString, formatScoutCode, isAllowed, scoutCode } from '../domain/codes';
import { SET_NUMBERS, type SetNumber } from '../domain/model';
import type { Athlete } from '../athletes/matching';
import { type Squad, normalizeTeam } from '../athletes/squads';
import { type Lineup, type MatchRecord, OPTIONAL_CODES, type PlayerRecord, type SetRecord, type TallyRowRecord } from './record';

export const VRP_EXTENSION = 'vrp';
export const VRP_MEDIA_TYPE = 'application/zip';
const FORMAT = 'volleyreport-paper';
const VERSION = 1;

interface Manifest {
  readonly format: typeof FORMAT;
  readonly version: number;
  readonly appVersion: string;
  readonly exportedAt: string;
  readonly matches: readonly string[];
}

export function exportVrp(
  records: readonly MatchRecord[],
  appVersion: string,
  now = new Date(),
  athletes: readonly Athlete[] = [],
  squads: readonly Squad[] = [],
): Uint8Array {
  const manifest: Manifest = { format: FORMAT, version: VERSION, appVersion, exportedAt: now.toISOString(), matches: records.map((r) => r.id) };
  const files: Record<string, Uint8Array> = { 'manifest.json': strToU8(JSON.stringify(manifest, null, 2)) };
  for (const record of records) files[`matches/${record.id}.json`] = strToU8(JSON.stringify(record, null, 2));
  const linked = new Set(records.flatMap((r) => r.players.flatMap((p) => (p.athleteId ? [p.athleteId] : []))));
  const used = athletes.filter((a) => linked.has(a.id));
  if (used.length) files['athletes.json'] = strToU8(JSON.stringify(used, null, 2));
  const teams = new Set(records.map((r) => normalizeTeam(r.teamName)));
  const joined = squads.filter((s) => s.teamNames.some((n) => teams.has(normalizeTeam(n))));
  if (joined.length) files['squads.json'] = strToU8(JSON.stringify(joined, null, 2));
  return zipSync(files, { level: 6 });
}

/** "Team - Opponent 2026-10-06.vrp", or "VolleyReport (3).vrp" for several matches. */
export function vrpFileName(records: readonly MatchRecord[]): string {
  const only = records.length === 1 ? records[0]! : null;
  const teams = only ? [only.teamName, only.opponentName].filter(Boolean).join(' - ') || 'VolleyReport' : '';
  const name = only ? `${teams}${only.date ? ` ${only.date}` : ''}` : `VolleyReport (${records.length})`;
  return `${name.replace(/[\\/:*?"<>|]/g, '_')}.${VRP_EXTENSION}`;
}

export type VrpErrorKind = 'not-zip' | 'not-vrp' | 'newer' | 'invalid';

/** A file that cannot be imported; the user interface words the reason. */
export class VrpError extends Error {
  constructor(readonly kind: VrpErrorKind) {
    super(`vrp: ${kind}`);
  }
}

const KNOWN_CODES = new Set<string>(SKILLS.flatMap((s) => EVALUATIONS.map((e) => scoutCode(s, e)).filter(isAllowed).map(formatScoutCode)));

export const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
export const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 999 ? v : null);
export const isId = (v: unknown): v is string => typeof v === 'string' && /^[a-z0-9]{4,40}$/i.test(v);
const shirt = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99 ? v : null);

/** The columns not recorded: known optional codes only, each once, in their order. */
function readUntracked(v: unknown): ScoutCodeString[] | null {
  if (!Array.isArray(v)) return null;
  const codes = OPTIONAL_CODES.filter((code) => v.includes(code));
  return codes.length ? codes : null;
}

function readRow(v: unknown): TallyRowRecord | null {
  if (!isObject(v) || typeof v.id !== 'string' || (v.kind !== 'player' && v.kind !== 'libero')) return null;
  const counts: Partial<Record<ScoutCodeString, number>> = {};
  if (isObject(v.counts)) {
    for (const [code, n] of Object.entries(v.counts)) {
      const value = count(n);
      if (KNOWN_CODES.has(code) && value) counts[code as ScoutCodeString] = value;
    }
  }
  return { id: text(v.id, 40), kind: v.kind, playerNumber: shirt(v.playerNumber), counts };
}

/** Up to six shirt numbers on court and two liberos, each once. */
function readLineup(v: unknown): Lineup | null {
  if (!isObject(v)) return null;
  const numbers = (list: unknown, max: number) =>
    Array.isArray(list) ? [...new Set(list.map(shirt).filter((n): n is number => n !== null))].slice(0, max) : [];
  const court = numbers(v.court, 6);
  const liberos = numbers(v.liberos, 2).filter((n) => !court.includes(n));
  return court.length || liberos.length ? { court, liberos } : null;
}

function readSet(v: unknown): SetRecord | null {
  if (!isObject(v) || !SET_NUMBERS.includes(v.number as SetNumber) || !Array.isArray(v.rows)) return null;
  const score = isObject(v.score) && count(v.score.team) !== null && count(v.score.opponent) !== null
    ? { team: count(v.score.team)!, opponent: count(v.score.opponent)! }
    : null;
  const lineup = readLineup(v.lineup);
  return { number: v.number as SetNumber, score, rows: v.rows.map(readRow).filter((r): r is TallyRowRecord => r !== null), ...(lineup && { lineup }) };
}

/** A MatchRecord rebuilt from untrusted JSON, or null when it is not one. */
export function readMatchRecord(v: unknown): MatchRecord | null {
  if (!isObject(v) || !isId(v.id) || !Array.isArray(v.sets)) return null;
  const sets = v.sets.map(readSet);
  if (sets.some((s) => s === null)) return null;
  const players = readPlayers(v.players);
  const date = text(v.date, 10);
  return {
    id: v.id,
    createdAt: text(v.createdAt, 40),
    updatedAt: text(v.updatedAt, 40),
    teamName: text(v.teamName),
    opponentName: text(v.opponentName),
    competition: text(v.competition),
    date: /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '',
    venue: text(v.venue),
    players,
    sets: (sets as SetRecord[]).sort((a, b) => a.number - b.number),
    ...(count(v.opponentErrors) !== null && { opponentErrors: count(v.opponentErrors)! }),
    ...(readUntracked(v.untracked) && { untracked: readUntracked(v.untracked)! }),
  };
}

/** A time of last change (ISO 8601), kept only when it looks like one. */
export const stamp = (v: unknown): { updatedAt?: string } =>
  typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(v) ? { updatedAt: v } : {};

export function readAthletes(v: unknown): Athlete[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((a) => (isObject(a) && isId(a.id) ? [{ id: a.id, name: text(a.name, 80), note: text(a.note, 200), ...stamp(a.updatedAt) }] : []));
}

export function readSquads(v: unknown): Squad[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((s) => {
    if (!isObject(s) || !isId(s.id) || !Array.isArray(s.teamNames)) return [];
    const teamNames = s.teamNames.map((n) => text(n)).filter((n) => n.trim());
    return teamNames.length > 1 ? [{ id: s.id, name: text(s.name), teamNames, ...stamp(s.updatedAt) }] : [];
  });
}

/** Players of a match or of a team's known names, rebuilt from untrusted JSON. */
export function readPlayers(v: unknown): PlayerRecord[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((p) => {
    if (!isObject(p) || shirt(p.number) === null) return [];
    const player = { number: shirt(p.number)!, name: text(p.name, 80) };
    return [isId(p.athleteId) ? { ...player, athleteId: p.athleteId } : player];
  });
}

export { FORMAT as VRP_FORMAT, VERSION as VRP_VERSION };

export interface VrpContent {
  readonly matches: MatchRecord[];
  readonly athletes: Athlete[];
  readonly squads: Squad[];
}

/** Limits of a .vrp file, far above any real archive: a file made to fill the memory is refused. */
const MAX_ENTRY_BYTES = 20 * 1024 * 1024;
const MAX_TOTAL_BYTES = 200 * 1024 * 1024;
const MAX_ENTRIES = 20_000;

/**
 * The files of a .vrp with these names (or a match), unpacked; throws VrpError
 * ('not-zip') when it is not a zip, ('invalid') when it is too large.
 */
export function unzipVrp(bytes: Uint8Array, names: readonly string[]): Record<string, Uint8Array> {
  let total = 0;
  let entries = 0;
  let tooLarge = false;
  const filter = (f: { name: string; originalSize: number }) => {
    if (!names.includes(f.name) && !/^matches\/[^/]+\.json$/.test(f.name)) return false;
    total += f.originalSize;
    entries++;
    if (f.originalSize > MAX_ENTRY_BYTES || total > MAX_TOTAL_BYTES || entries > MAX_ENTRIES) tooLarge = true;
    return !tooLarge;
  };
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter });
  } catch {
    throw new VrpError('not-zip');
  }
  if (tooLarge) throw new VrpError('invalid');
  return files;
}

/** The matches (and athletes) of a .vrp file; throws VrpError when the file is not one. */
export function importVrp(bytes: Uint8Array): VrpContent {
  const files = unzipVrp(bytes, ['manifest.json', 'athletes.json', 'squads.json']);
  const json = (name: string): unknown => {
    try {
      return JSON.parse(strFromU8(files[name]!));
    } catch {
      return null;
    }
  };
  const manifest = files['manifest.json'] ? json('manifest.json') : null;
  if (!isObject(manifest) || manifest.format !== FORMAT) throw new VrpError('not-vrp');
  if (typeof manifest.version !== 'number' || manifest.version > VERSION) {
    throw new VrpError('newer');
  }
  const records = Object.keys(files)
    .filter((name) => name.startsWith('matches/'))
    .map((name) => readMatchRecord(json(name)));
  if (records.length === 0 || records.some((r) => r === null)) throw new VrpError('invalid');
  return {
    matches: records as MatchRecord[],
    athletes: files['athletes.json'] ? readAthletes(json('athletes.json')) : [],
    squads: files['squads.json'] ? readSquads(json('squads.json')) : [],
  };
}
