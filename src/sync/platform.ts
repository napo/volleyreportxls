// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Which platform the synchronisation runs on, and the HTTP client it uses there. */

import { isTauriApp, mobilePlatform } from '../platform/updates';
import type { Fetch } from './storage';

export type SyncPlatform = 'web' | 'desktop' | 'android' | 'ios';

export function syncPlatform(): SyncPlatform {
  if (!isTauriApp()) return 'web';
  return mobilePlatform() ?? 'desktop';
}

/** In the installed apps the services are reached from Rust (tauri-plugin-http), with no CORS limits on the app's origin. */
export async function syncFetch(): Promise<Fetch> {
  if (!isTauriApp()) return (input, init) => fetch(input, init);
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
  return (input, init) => tauriFetch(input, init);
}
