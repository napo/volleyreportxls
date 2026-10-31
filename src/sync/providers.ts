// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The cloud services synchronisation can use, one at a time on each device. */

import type { CloudAuth } from './auth';
import { type SyncPlatform, syncPlatform } from './platform';
import { dropbox } from './provider-dropbox';
import { googleDrive } from './provider-google';
import { onedrive } from './provider-onedrive';
import type { SyncProvider } from './provider';

export const PROVIDERS: readonly SyncProvider[] = [googleDrive, dropbox, onedrive];

/** Devices connected before the choice of a service existed use Google Drive. */
export const DEFAULT_PROVIDER = googleDrive;

export function providerById(id: string | null | undefined): SyncProvider {
  return PROVIDERS.find((p) => p.id === id) ?? DEFAULT_PROVIDER;
}

/** Synchronisation is offered only where the project has a client for at least one service. */
export function syncAvailable(platform: SyncPlatform = syncPlatform()): boolean {
  return PROVIDERS.some((p) => p.available(platform));
}

export function createAuth(provider: SyncProvider, platform: SyncPlatform = syncPlatform()): Promise<CloudAuth | null> {
  return provider.available(platform) ? provider.createAuth(platform) : Promise.resolve(null);
}

/** Gets the sign-in ready before the user's tap (on the web, what the window of the service needs). */
export async function prepareSignIn(platform: SyncPlatform = syncPlatform()): Promise<void> {
  await Promise.all(PROVIDERS.filter((p) => p.available(platform)).map((p) => p.prepare?.(platform)));
}
