/**
 * ".vrp" files (VolleyReport Paper): matches exported from one device and
 * imported on another. A zip archive with
 * - manifest.json: format name and version, app version, export time, match ids;
 * - matches/<id>.json: one MatchRecord each.
 * Later versions may add the photos of the sheets next to their match.
 *
 * Importing never trusts the file: every record is checked and rebuilt field
 * by field, and counts of codes the app does not know are dropped.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { EVALUATIONS, SKILLS, type ScoutCodeString, formatScoutCode, isAllowed, scoutCode } from '../domain/codes';
import { SET_NUMBERS, type SetNumber } from '../domain/model';
import type { MatchRecord, PlayerRecord, SetRecord, TallyRowRecord } from './record';

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

export function exportVrp(records: readonly MatchRecord[], appVersion: string, now = new Date()): Uint8Array {
  const manifest: Manifest = { format: FORMAT, version: VERSION, appVersion, exportedAt: now.toISOString(), matches: records.map((r) => r.id) };
  const files: Record<string, Uint8Array> = { 'manifest.json': strToU8(JSON.stringify(manifest, null, 2)) };
  for (const record of records) files[`matches/${record.id}.json`] = strToU8(JSON.stringify(record, null, 2));
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

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown, max = 200) => (typeof v === 'string' ? v.slice(0, max) : '');
const count = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 999 ? v : null);
const shirt = (v: unknown) => (typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 99 ? v : null);

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

function readSet(v: unknown): SetRecord | null {
  if (!isObject(v) || !SET_NUMBERS.includes(v.number as SetNumber) || !Array.isArray(v.rows)) return null;
  const score = isObject(v.score) && count(v.score.team) !== null && count(v.score.opponent) !== null
    ? { team: count(v.score.team)!, opponent: count(v.score.opponent)! }
    : null;
  return { number: v.number as SetNumber, score, rows: v.rows.map(readRow).filter((r): r is TallyRowRecord => r !== null) };
}

/** A MatchRecord rebuilt from untrusted JSON, or null when it is not one. */
export function readMatchRecord(v: unknown): MatchRecord | null {
  if (!isObject(v) || typeof v.id !== 'string' || !/^[a-z0-9]{4,40}$/i.test(v.id) || !Array.isArray(v.sets)) return null;
  const sets = v.sets.map(readSet);
  if (sets.some((s) => s === null)) return null;
  const players: PlayerRecord[] = Array.isArray(v.players)
    ? v.players.flatMap((p) => (isObject(p) && shirt(p.number) !== null ? [{ number: shirt(p.number)!, name: text(p.name, 80) }] : []))
    : [];
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
  };
}

/** The matches of a .vrp file; throws VrpError when the file is not one. */
export function importVrp(bytes: Uint8Array): MatchRecord[] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, { filter: (f) => f.name === 'manifest.json' || /^matches\/[^/]+\.json$/.test(f.name) });
  } catch {
    throw new VrpError('not-zip');
  }
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
  return records as MatchRecord[];
}
