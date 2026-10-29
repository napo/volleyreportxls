// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Which Google sign-in and which HTTP client the synchronisation uses on this platform. */

import { GOOGLE_OAUTH } from '../config';
import { isTauriApp, mobilePlatform } from '../platform/updates';
import type { GoogleAuth } from './auth';

export type SyncPlatform = 'web' | 'desktop' | 'android' | 'ios';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export function syncPlatform(): SyncPlatform {
  if (!isTauriApp()) return 'web';
  return mobilePlatform() ?? 'desktop';
}

const clientId = (platform: SyncPlatform) =>
  platform === 'desktop' ? GOOGLE_OAUTH.desktop.clientId : GOOGLE_OAUTH[platform];

/** Synchronisation is offered only where the project has a Google client (and the sign-in is built). */
export function syncAvailable(platform = syncPlatform()): boolean {
  if (platform === 'desktop') return clientId(platform) !== '' && GOOGLE_OAUTH.desktop.clientSecret !== '';
  // iOS: the sign-in through the client's URL scheme is still to be built.
  return platform !== 'ios' && clientId(platform) !== '';
}

/** In the installed apps Google is reached from Rust (tauri-plugin-http), with no CORS limits on the app's origin. */
export async function syncFetch(): Promise<Fetch> {
  if (!isTauriApp()) return (input, init) => fetch(input, init);
  const { fetch: tauriFetch } = await import('@tauri-apps/plugin-http');
  return (input, init) => tauriFetch(input, init);
}

export async function createGoogleAuth(platform = syncPlatform()): Promise<GoogleAuth | null> {
  if (!syncAvailable(platform)) return null;
  if (platform === 'web') {
    const { WebGoogleAuth } = await import('./auth-web');
    return new WebGoogleAuth(GOOGLE_OAUTH.web);
  }
  if (platform === 'android') {
    // Play services finds the "Android" client by package and signing certificate: its id is not passed.
    const [{ AndroidGoogleAuth }, fetchFn] = await Promise.all([import('./auth-android'), syncFetch()]);
    return new AndroidGoogleAuth(fetchFn);
  }
  const [{ PkceGoogleAuth }, { invoke }, { openUrl }, fetchFn] = await Promise.all([
    import('./auth-pkce'),
    import('@tauri-apps/api/core'),
    import('@tauri-apps/plugin-opener'),
    syncFetch(),
  ]);
  return new PkceGoogleAuth({
    clientId: GOOGLE_OAUTH.desktop.clientId,
    clientSecret: GOOGLE_OAUTH.desktop.clientSecret,
    fetch: fetchFn,
    openBrowser: (url) => openUrl(url),
    redirect: async () => {
      const port = await invoke<number>('oauth_listen');
      return { uri: `http://127.0.0.1:${port}`, wait: () => invoke<string>('oauth_wait', { port }) };
    },
  });
}

/** Gets the sign-in ready before the user's tap (on the web, Google's script). */
export async function prepareSignIn(platform = syncPlatform()): Promise<void> {
  if (platform !== 'web' || !syncAvailable(platform)) return;
  const { loadGoogle } = await import('./auth-web');
  await loadGoogle().catch(() => undefined);
}
