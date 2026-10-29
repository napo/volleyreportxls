// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * One synchronisation of the local archive with the file on Google Drive:
 * download the file, merge (src/sync/merge.ts), write the changes to the
 * archive, upload the merged archive when it differs from the file. When the
 * file changed on Drive meanwhile (another device synchronised), the whole
 * round starts again, so nothing written by the other device is lost.
 */

import { newId } from '../matches/record';
import type { Archive } from '../storage/archive';
import type { GoogleAuth } from './auth';
import { type DriveApi, DriveClient, DriveError, type DriveFile } from './drive';
import { readSyncFile, writeSyncFile } from './file';
import { EMPTY_SNAPSHOT, type SyncBase, mergeSnapshots, snapshotChanges, snapshotStamps } from './merge';

export type SyncArchive = Pick<Archive, 'snapshot' | 'applySync' | 'getMeta' | 'setMeta'>;

export interface SyncDependencies {
  readonly archive: SyncArchive;
  readonly auth: GoogleAuth;
  readonly appVersion: string;
  readonly drive?: (accessToken: string) => DriveApi;
  readonly now?: () => Date;
}

export interface SyncOutcome {
  /** False when no access token could be had without asking the user. */
  readonly done: boolean;
  /** Changes written to this device. */
  readonly received: number;
  readonly uploaded: boolean;
  /** Matches changed on two devices: the older version was kept as a copy. */
  readonly conflicts: number;
}

export const META = { base: 'sync.base', fileId: 'sync.fileId', lastSyncedAt: 'sync.lastSyncedAt' } as const;

/** Rounds tried when another device keeps changing the file. */
const ATTEMPTS = 3;

export async function synchronise(deps: SyncDependencies, interactive = false): Promise<SyncOutcome> {
  const { archive, auth, appVersion } = deps;
  const drive = deps.drive ?? ((token: string): DriveApi => new DriveClient(token));
  const now = deps.now ?? (() => new Date());

  for (let retryAuth = true; ; retryAuth = false) {
    const token = await auth.token(interactive);
    if (!token) return { done: false, received: 0, uploaded: false, conflicts: 0 };
    try {
      return await round(drive(token));
    } catch (e) {
      // An access token refused before its expiry: get a new one, once.
      if (e instanceof DriveError && e.status === 401 && retryAuth) {
        auth.invalidate();
        continue;
      }
      throw e;
    }
  }

  async function round(client: DriveApi): Promise<SyncOutcome> {
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const knownId = await archive.getMeta<string>(META.fileId);
      const knownVersion = knownId ? await client.version(knownId) : null;
      let file: DriveFile | null = knownId && knownVersion ? { id: knownId, version: knownVersion } : await client.findArchive();
      const remote = file ? readSyncFile(await client.download(file.id)) : EMPTY_SNAPSHOT;
      const local = await archive.snapshot();
      const base = (await archive.getMeta<SyncBase>(META.base)) ?? {};
      const at = now();
      const { merged, base: nextBase, conflicts } = mergeSnapshots(local, remote, base, newId, at);

      const toLocal = snapshotChanges(local, merged);
      const received = toLocal.changed ? await archive.applySync(toLocal.puts, toLocal.deletions, snapshotStamps(local)) : 0;

      const upload = !file || snapshotChanges(remote, merged).changed;
      if (upload) {
        const bytes = writeSyncFile(merged, appVersion, at);
        if (file) {
          // Another device wrote the file after it was read: merge again with its version.
          if ((await client.version(file.id)) !== file.version) continue;
          file = await client.update(file.id, bytes);
        } else {
          file = await client.create(bytes);
        }
      }
      await archive.setMeta(META.fileId, file!.id);
      await archive.setMeta(META.base, nextBase);
      await archive.setMeta(META.lastSyncedAt, at.toISOString());
      return { done: true, received, uploaded: upload, conflicts };
    }
    throw new Error('sync: the file on Drive keeps changing');
  }
}

/** Forgets the file and the base: the next synchronisation starts from the file found on Drive, if any. */
export async function forgetSync(archive: SyncArchive): Promise<void> {
  await archive.setMeta(META.fileId, null);
  await archive.setMeta(META.base, {});
  await archive.setMeta(META.lastSyncedAt, null);
}
