// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Merging the local archive with the copy on the user's Google Drive.
 *
 * Every record (match, athlete, team names, squad) carries the time of its
 * last change; a deleted record leaves a deletion with its time, so that the
 * deletion reaches the other devices instead of the record coming back.
 * The base is the time of every record at the last synchronisation: a side
 * whose time differs from the base has changed since.
 * - Changed on one side only: that side wins.
 * - Changed on both sides: the latest change wins. Two different versions of
 *   the same match are both kept: the older one becomes a copy with a new id,
 *   as when importing a .vrp file, so no counts are lost.
 */

import type { Athlete } from '../athletes/matching';
import type { Squad } from '../athletes/squads';
import type { MatchRecord } from '../matches/record';
import type { TeamRecord } from '../storage/archive';

export type SyncKind = 'match' | 'athlete' | 'team' | 'squad';

export interface Deletion {
  readonly kind: SyncKind;
  readonly id: string;
  readonly deletedAt: string;
}

export interface Snapshot {
  readonly matches: readonly MatchRecord[];
  readonly athletes: readonly Athlete[];
  readonly teams: readonly TeamRecord[];
  readonly squads: readonly Squad[];
  readonly deletions: readonly Deletion[];
}

/** Time of every record (key "kind:id") at the last synchronisation. */
export type SyncBase = Readonly<Record<string, string>>;

export const EMPTY_SNAPSHOT: Snapshot = { matches: [], athletes: [], teams: [], squads: [], deletions: [] };

/** Deletions older than this are forgotten: a device offline for longer may bring the record back. */
const DELETION_KEPT_DAYS = 400;

type Record_ = MatchRecord | Athlete | TeamRecord | Squad;
export type Entry = { readonly kind: SyncKind; readonly id: string; readonly record: Record_ | null; readonly stamp: string };

export const syncKey = (kind: SyncKind, id: string) => `${kind}:${id}`;

const idOf = (kind: SyncKind, r: Record_) => (kind === 'team' ? (r as TeamRecord).key : (r as { id: string }).id);

function entries(s: Snapshot): Map<string, Entry> {
  const map = new Map<string, Entry>();
  const add = (kind: SyncKind, records: readonly Record_[]) => {
    for (const record of records) {
      const id = idOf(kind, record);
      map.set(syncKey(kind, id), { kind, id, record, stamp: record.updatedAt ?? '' });
    }
  };
  add('match', s.matches);
  add('athlete', s.athletes);
  add('team', s.teams);
  add('squad', s.squads);
  // A deletion hides a record of the same snapshot only when it is later (it should never be).
  for (const d of s.deletions) {
    const key = syncKey(d.kind, d.id);
    const present = map.get(key);
    if (!present || present.stamp < d.deletedAt) map.set(key, { kind: d.kind, id: d.id, record: null, stamp: d.deletedAt });
  }
  return map;
}

const same = (a: Entry, b: Entry) => (a.record === null) === (b.record === null) && (a.record === null || JSON.stringify(a.record) === JSON.stringify(b.record));

/** The latest of two entries; on the same time a deletion wins, then the local one. */
const latest = (local: Entry, remote: Entry) =>
  remote.stamp > local.stamp || (remote.stamp === local.stamp && remote.record === null && local.record !== null) ? remote : local;

export interface MergeResult {
  readonly merged: Snapshot;
  readonly base: SyncBase;
  /** Matches changed on both sides with different data: the older version kept as a copy. */
  readonly conflicts: number;
}

export function mergeSnapshots(local: Snapshot, remote: Snapshot, base: SyncBase, newId: () => string, now = new Date()): MergeResult {
  const l = entries(local);
  const r = entries(remote);
  const out = new Map<string, Entry>();
  let conflicts = 0;
  for (const key of new Set([...l.keys(), ...r.keys()])) {
    const a = l.get(key);
    const b = r.get(key);
    if (!a || !b) {
      out.set(key, (a ?? b)!);
      continue;
    }
    if (same(a, b)) {
      out.set(key, a);
      continue;
    }
    const localChanged = a.stamp !== base[key];
    const remoteChanged = b.stamp !== base[key];
    if (localChanged !== remoteChanged) {
      out.set(key, localChanged ? a : b);
      continue;
    }
    const winner = latest(a, b);
    out.set(key, winner);
    const loser = winner === a ? b : a;
    if (winner.kind === 'match' && winner.record && loser.record) {
      const id = newId();
      out.set(syncKey('match', id), { kind: 'match', id, record: { ...(loser.record as MatchRecord), id }, stamp: loser.stamp });
      conflicts++;
    }
  }

  const oldest = new Date(now.getTime() - DELETION_KEPT_DAYS * 86_400_000).toISOString();
  const kept = [...out.values()].filter((e) => e.record !== null || e.stamp >= oldest);
  const records = <T>(kind: SyncKind) => kept.filter((e) => e.kind === kind && e.record).map((e) => e.record as T);
  const merged: Snapshot = {
    matches: records<MatchRecord>('match'),
    athletes: records<Athlete>('athlete'),
    teams: records<TeamRecord>('team'),
    squads: records<Squad>('squad'),
    deletions: kept.filter((e) => e.record === null).map((e) => ({ kind: e.kind, id: e.id, deletedAt: e.stamp })),
  };
  return { merged, base: Object.fromEntries(kept.map((e) => [syncKey(e.kind, e.id), e.stamp])), conflicts };
}

/** Records to write and to delete to turn `from` into `to`, by key. */
export function snapshotChanges(from: Snapshot, to: Snapshot) {
  const before = entries(from);
  const after = entries(to);
  const puts: Entry[] = [];
  const deletions: Deletion[] = [];
  for (const [key, entry] of after) {
    const old = before.get(key);
    if (old && same(old, entry) && old.stamp === entry.stamp) continue;
    if (entry.record) puts.push(entry);
    else deletions.push({ kind: entry.kind, id: entry.id, deletedAt: entry.stamp });
  }
  // A deletion forgotten by the merge needs no change: the record is already gone.
  return { puts, deletions, changed: puts.length > 0 || deletions.length > 0 };
}

/** Time of every record and deletion of a snapshot, by key: what the local archive held when it was read. */
export const snapshotStamps = (s: Snapshot): ReadonlyMap<string, string> => new Map([...entries(s)].map(([key, e]) => [key, e.stamp]));
