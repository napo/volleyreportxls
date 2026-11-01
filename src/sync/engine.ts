// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * One synchronisation of the local archive with the file on the cloud service:
 * download the file, merge (src/sync/merge.ts), write the changes to the
 * archive, upload the merged archive when it differs from the file. When the
 * file changed on the service meanwhile (another device synchronised), the whole
 * round starts again, so nothing written by the other device is lost.
 */

import { newId } from '../matches/record';
import type { Archive } from '../storage/archive';
import type { CloudAuth } from './auth';
import { readSyncFile, writeSyncFile } from './file';
import { EMPTY_SNAPSHOT, type SyncBase, mergeSnapshots, snapshotChanges, snapshotStamps } from './merge';
import { type RemoteFile, type RemoteStorage, StorageError } from './storage';

export type SyncArchive = Pick<Archive, 'snapshot' | 'applySync' | 'getMeta' | 'setMeta'>;

export interface SyncDependencies {
  readonly archive: SyncArchive;
  readonly auth: CloudAuth;
  readonly appVersion: string;
  readonly storage: (accessToken: string) => RemoteStorage;
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

export const META = { base: 'sync.base', fileId: 'sync.fileId', lastSyncedAt: 'sync.lastSyncedAt', provider: 'sync.provider' } as const;

/** Rounds tried when another device keeps changing the file. */
const ATTEMPTS = 3;

export async function synchronise(deps: SyncDependencies, interactive = false): Promise<SyncOutcome> {
  const { archive, auth, appVersion, storage } = deps;
  const now = deps.now ?? (() => new Date());

  for (let retryAuth = true; ; retryAuth = false) {
    const token = await auth.token(interactive);
    if (!token) return { done: false, received: 0, uploaded: false, conflicts: 0 };
    try {
      return await round(storage(token));
    } catch (e) {
      // An access token refused before its expiry: get a new one, once.
      if (e instanceof StorageError && e.status === 401 && retryAuth) {
        auth.invalidate();
        continue;
      }
      throw e;
    }
  }

  async function round(client: RemoteStorage): Promise<SyncOutcome> {
    let received = 0;
    let conflicts = 0;
    for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
      const knownId = await archive.getMeta<string>(META.fileId);
      const knownVersion = knownId ? await client.version(knownId) : null;
      let file: RemoteFile | null = knownId && knownVersion ? { id: knownId, version: knownVersion } : await client.findArchive();
      const remote = file ? readSyncFile(await client.download(file.id)) : EMPTY_SNAPSHOT;
      const local = await archive.snapshot();
      const base = (await archive.getMeta<SyncBase>(META.base)) ?? {};
      const at = now();
      const { merged, base: nextBase, conflicts: found } = mergeSnapshots(local, remote, base, newId, at);
      conflicts += found;

      const toLocal = snapshotChanges(local, merged);
      if (toLocal.changed) received += await archive.applySync(toLocal.puts, toLocal.deletions, snapshotStamps(local));

      const upload = !file || snapshotChanges(remote, merged).changed;
      if (upload) {
        // The file read so far is now merged here, even if the upload fails: its versions must not count as
        // changes of this device, or conflicts again. A change not uploaded yet still differs from them, so it is not lost.
        await archive.setMeta(META.base, { ...base, ...Object.fromEntries(snapshotStamps(remote)) });
        const bytes = writeSyncFile(merged, appVersion, at);
        if (file) {
          // Another device wrote the file after it was read: merge again with its version.
          const updated = await client.update(file.id, bytes, file.version);
          if (!updated) continue;
          file = updated;
        } else {
          file = await client.create(bytes);
        }
      }
      await archive.setMeta(META.fileId, file!.id);
      await archive.setMeta(META.base, nextBase);
      await archive.setMeta(META.lastSyncedAt, at.toISOString());
      return { done: true, received, uploaded: upload, conflicts };
    }
    throw new Error('sync: the remote file keeps changing');
  }
}

/** Forgets the file and the base: the next synchronisation starts from the file found on the service, if any. */
export async function forgetSync(archive: SyncArchive): Promise<void> {
  await archive.setMeta(META.fileId, null);
  await archive.setMeta(META.base, {});
  await archive.setMeta(META.lastSyncedAt, null);
  await archive.setMeta(META.provider, null);
}
