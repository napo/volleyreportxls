// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The archive file on Google Drive: a .vrp file (src/matches/vrp.ts) holding
 * the whole archive, so that the user can also download it and import it by
 * hand. Next to the matches, athletes and squads of a .vrp it holds what only
 * synchronisation needs: the names known for every team (teams.json) and the
 * deletions (deletions.json); the import of a .vrp leaves them out.
 * Reading never trusts the file, as for any .vrp.
 */

import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';
import { VRP_FORMAT, VRP_VERSION, VrpError, isId, isObject, readAthletes, readMatchRecord, readPlayers, readSquads, stamp, text } from '../matches/vrp';
import type { TeamRecord } from '../storage/archive';
import type { Deletion, Snapshot, SyncKind } from './merge';

/** Name of the file in the "VolleyReport" folder of the user's Drive. */
export const SYNC_FILE_NAME = 'VolleyReport.vrp';

const KINDS: readonly SyncKind[] = ['match', 'athlete', 'team', 'squad'];

export function writeSyncFile(s: Snapshot, appVersion: string, now = new Date()): Uint8Array {
  const json = (v: unknown) => strToU8(JSON.stringify(v));
  const manifest = { format: VRP_FORMAT, version: VRP_VERSION, appVersion, exportedAt: now.toISOString(), matches: s.matches.map((m) => m.id), sync: 1 };
  const files: Record<string, Uint8Array> = {
    'manifest.json': json(manifest),
    'athletes.json': json(s.athletes),
    'squads.json': json(s.squads),
    'teams.json': json(s.teams),
    'deletions.json': json(s.deletions),
  };
  for (const m of s.matches) files[`matches/${m.id}.json`] = json(m);
  return zipSync(files, { level: 6 });
}

function readTeams(v: unknown): TeamRecord[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((t) => {
    if (!isObject(t) || typeof t.key !== 'string' || !t.key.trim()) return [];
    const updatedAt = stamp(t.updatedAt).updatedAt;
    if (!updatedAt) return [];
    return [{ key: text(t.key, 410), teamName: text(t.teamName), competition: text(t.competition), players: readPlayers(t.players), updatedAt }];
  });
}

function readDeletions(v: unknown): Deletion[] {
  if (!Array.isArray(v)) return [];
  return v.flatMap((d) => {
    if (!isObject(d) || !KINDS.includes(d.kind as SyncKind) || typeof d.id !== 'string') return [];
    const deletedAt = stamp(d.deletedAt).updatedAt;
    const id = d.kind === 'team' ? text(d.id, 410) : isId(d.id) ? d.id : null;
    return deletedAt && id ? [{ kind: d.kind as SyncKind, id, deletedAt }] : [];
  });
}

/** The archive held by the file; throws VrpError when it is not a .vrp file this app can read. */
export function readSyncFile(bytes: Uint8Array): Snapshot {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes, {
      filter: (f) => ['manifest.json', 'athletes.json', 'squads.json', 'teams.json', 'deletions.json'].includes(f.name) || /^matches\/[^/]+\.json$/.test(f.name),
    });
  } catch {
    throw new VrpError('not-zip');
  }
  const json = (name: string): unknown => {
    try {
      return files[name] ? JSON.parse(strFromU8(files[name])) : null;
    } catch {
      return null;
    }
  };
  const manifest = json('manifest.json');
  if (!isObject(manifest) || manifest.format !== VRP_FORMAT) throw new VrpError('not-vrp');
  if (typeof manifest.version !== 'number' || manifest.version > VRP_VERSION) throw new VrpError('newer');
  const matches = Object.keys(files)
    .filter((name) => name.startsWith('matches/'))
    .map((name) => readMatchRecord(json(name)));
  if (matches.some((m) => m === null)) throw new VrpError('invalid');
  return {
    matches: matches as NonNullable<(typeof matches)[number]>[],
    athletes: readAthletes(json('athletes.json')),
    teams: readTeams(json('teams.json')),
    squads: readSquads(json('squads.json')),
    deletions: readDeletions(json('deletions.json')),
  };
}
