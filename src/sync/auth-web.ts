// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Google sign-in of the web version: Google Identity Services, token model.
 * There is no server, so there is no refresh token: an access token lasts an
 * hour and a new one needs a tap of the user (browsers block the Google
 * window opened without one). The token is kept for its hour in the browser,
 * so that reloading the page does not ask again. Google's script is loaded
 * only once the user chose to connect Drive.
 */

import { DRIVE_SCOPE } from './drive';
import { type CloudAuth, TokenCache } from './auth';

const SCRIPT = 'https://accounts.google.com/gsi/client';
const STORED = 'volleyreport.google.web-token';
/** The user already gave consent: later requests show no consent page, only a quick Google window. */
const CONSENTED = 'volleyreport.google.consented';

interface TokenResponse {
  readonly access_token?: string;
  readonly expires_in?: number;
  readonly error?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOauth2 {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type: string }) => void;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOauth2 } };
  }
}

let loading: Promise<GoogleOauth2> | null = null;

/** Google's script, loaded once; called before the user's tap so that Google's window opens at once. */
export function loadGoogle(): Promise<GoogleOauth2> {
  loading ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = SCRIPT;
    script.async = true;
    script.onload = () => (window.google?.accounts?.oauth2 ? resolve(window.google.accounts.oauth2) : reject(new Error('gsi')));
    script.onerror = () => {
      loading = null;
      reject(new Error('gsi'));
    };
    document.head.append(script);
  });
  return loading;
}

export class WebGoogleAuth implements CloudAuth {
  private readonly cache = new TokenCache();

  constructor(private readonly clientId: string) {
    try {
      const stored = JSON.parse(localStorage.getItem(STORED) ?? 'null') as { token: string; expires: number } | null;
      if (stored) this.cache.set(stored.token, (stored.expires - Date.now()) / 1000);
    } catch {
      // No stored token: the user is asked at the next synchronisation.
    }
  }

  async token(interactive: boolean): Promise<string | null> {
    const cached = this.cache.get();
    if (cached || !interactive) return cached;
    const oauth2 = await loadGoogle();
    const response = await new Promise<TokenResponse>((resolve) => {
      const client = oauth2.initTokenClient({
        client_id: this.clientId,
        scope: DRIVE_SCOPE,
        callback: resolve,
        error_callback: (error) => resolve({ error: error.type }),
      });
      client.requestAccessToken({ prompt: localStorage.getItem(CONSENTED) ? '' : 'consent' });
    });
    if (!response.access_token) return null;
    const expiresIn = response.expires_in ?? 3600;
    this.cache.set(response.access_token, expiresIn);
    try {
      localStorage.setItem(CONSENTED, '1');
      localStorage.setItem(STORED, JSON.stringify({ token: response.access_token, expires: Date.now() + expiresIn * 1000 }));
    } catch {
      // Private browsing: the token lasts until the page is closed.
    }
    return response.access_token;
  }

  invalidate() {
    this.cache.clear();
    localStorage.removeItem(STORED);
  }

  async signOut(): Promise<void> {
    const token = this.cache.get();
    this.invalidate();
    localStorage.removeItem(CONSENTED);
    if (token && window.google?.accounts?.oauth2) window.google.accounts.oauth2.revoke(token);
  }
}
