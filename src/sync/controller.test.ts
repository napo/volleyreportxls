// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { Archive } from '../storage/archive';
import type { CloudAuth } from './auth';
import { SyncController } from './controller';
import { META } from './engine';
import type { SyncProvider } from './provider';
import { DEFAULT_PROVIDER } from './providers';
import type { RemoteStorage } from './storage';

let n = 0;

/** A controller already connected, with the given sign-in and a service whose bin may fail. */
async function connected(token: string | null, trashFails = false) {
  const archive = await Archive.open(`controller-${n++}`);
  await archive.setMeta('sync.enabled', true);
  await archive.setMeta(META.fileId, 'file-1');
  const trashed: string[] = [];
  let signedOut = false;
  const auth: CloudAuth = {
    token: async () => token,
    invalidate: () => undefined,
    signOut: async () => {
      signedOut = true;
    },
  };
  const storage = {
    trash: async (id: string) => {
      if (trashFails) throw new Error('offline');
      trashed.push(id);
    },
  } as unknown as RemoteStorage;
  const provider: SyncProvider = { ...DEFAULT_PROVIDER, storage: () => storage };
  const controller = new SyncController(archive, '0.0.0');
  Object.assign(controller, { auth, provider });
  return { archive, controller, trashed, signedOut: () => signedOut };
}

describe('disconnecting and deleting the file', () => {
  it('moves the file to the bin, then forgets the service', async () => {
    const { archive, controller, trashed, signedOut } = await connected('token');
    await controller.disconnect(true);
    expect(trashed).toEqual(['file-1']);
    expect(signedOut()).toBe(true);
    expect(await archive.getMeta('sync.enabled')).toBe(false);
    expect(controller.status.state).toBe('off');
  });

  it('stays connected when there is no access to delete the file', async () => {
    const { archive, controller, trashed, signedOut } = await connected(null);
    await expect(controller.disconnect(true)).rejects.toThrow();
    expect(trashed).toEqual([]);
    expect(signedOut()).toBe(false);
    expect(await archive.getMeta('sync.enabled')).toBe(true);
    expect(await archive.getMeta(META.fileId)).toBe('file-1');
  });

  it('stays connected when the service does not delete the file', async () => {
    const { archive, controller, signedOut } = await connected('token', true);
    await expect(controller.disconnect(true)).rejects.toThrow();
    expect(signedOut()).toBe(false);
    expect(await archive.getMeta('sync.enabled')).toBe(true);
  });
});
