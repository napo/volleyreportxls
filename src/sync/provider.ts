// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** What sets a cloud service apart from another: its availability, its sign-in, its files. */

import type { CloudAuth } from './auth';
import type { SyncPlatform } from './platform';
import type { Fetch, RemoteStorage } from './storage';

export type ProviderId = 'google-drive' | 'dropbox' | 'onedrive';

export interface SyncProvider {
  readonly id: ProviderId;
  available(platform: SyncPlatform): boolean;
  /** Call it only where the service is available. */
  createAuth(platform: SyncPlatform): Promise<CloudAuth>;
  storage(accessToken: string, fetchFn: Fetch): RemoteStorage;
  /** Work to do before the user's tap, when the sign-in needs it. */
  prepare?(platform: SyncPlatform): Promise<void>;
}
