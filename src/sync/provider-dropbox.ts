// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Dropbox: PKCE sign-in on the web and on the desktop, the files in src/sync/dropbox.ts. */

import { DROPBOX_OAUTH } from '../config';
import type { CloudAuth } from './auth';
import type { PkceEndpoints } from './auth-pkce';
import { DROPBOX_SCOPE, DropboxClient } from './dropbox';
import { type SyncPlatform, syncFetch } from './platform';
import type { SyncProvider } from './provider';

const ENDPOINTS: PkceEndpoints = {
  authorize: 'https://www.dropbox.com/oauth2/authorize',
  token: 'https://api.dropboxapi.com/oauth2/token',
  revoke: 'https://api.dropboxapi.com/2/auth/token/revoke',
  revokeWithAccessToken: true,
  scope: DROPBOX_SCOPE,
  extraParams: { token_access_type: 'offline' },
  storageKey: 'volleyreport.dropbox.refresh-token',
};

/** Dropbox accepts only the exact addresses registered in its console: no free port on the desktop. */
const DESKTOP_PORT = 53682;

async function createAuth(platform: SyncPlatform): Promise<CloudAuth> {
  const [{ PkceAuth }, fetchFn] = await Promise.all([import('./auth-pkce'), syncFetch()]);
  const common = { endpoints: ENDPOINTS, clientId: DROPBOX_OAUTH.appKey, fetch: fetchFn };
  if (platform === 'web') {
    const { popupSignIn } = await import('./auth-popup');
    return new PkceAuth({ ...common, ...popupSignIn() });
  }
  const [{ invoke }, { openUrl }] = await Promise.all([import('@tauri-apps/api/core'), import('@tauri-apps/plugin-opener')]);
  return new PkceAuth({
    ...common,
    openBrowser: (url) => openUrl(url),
    redirect: async () => {
      const port = await invoke<number>('oauth_listen', { port: DESKTOP_PORT });
      return { uri: `http://localhost:${port}/`, wait: () => invoke<string>('oauth_wait', { port }) };
    },
  });
}

export const dropbox: SyncProvider = {
  id: 'dropbox',
  // Android and iOS: Dropbox documents only https and localhost as ways back, so they need an app link, still to be built.
  available: (platform) => (platform === 'web' || platform === 'desktop') && DROPBOX_OAUTH.appKey !== '',
  createAuth,
  storage: (accessToken, fetchFn) => new DropboxClient(accessToken, fetchFn),
  async prepare(platform) {
    if (platform === 'web') await Promise.all([import('./auth-pkce'), import('./auth-popup')]);
  },
};
