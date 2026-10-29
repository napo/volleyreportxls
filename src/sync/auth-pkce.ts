// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Google sign-in of the installed apps (RFC 8252): Google's page opens in the
 * system browser, never inside the app (Google refuses embedded web views);
 * the browser comes back to the app with a code, exchanged with PKCE for an
 * access token (one hour) and a refresh token, kept on the device to renew
 * the access without asking again. The way back depends on the platform:
 * 127.0.0.1 on the desktop (src-tauri/src/oauth.rs), the app's URL scheme on iOS.
 */

import { DRIVE_SCOPE } from './drive';
import { type GoogleAuth, TokenCache } from './auth';

const AUTHORIZE = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN = 'https://oauth2.googleapis.com/token';
const REVOKE = 'https://oauth2.googleapis.com/revoke';
const REFRESH_TOKEN = 'volleyreport.google.refresh-token';

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface Redirect {
  readonly uri: string;
  /** The address the browser came back to, with the code in its query. */
  wait(): Promise<string>;
}

export interface PkceOptions {
  readonly clientId: string;
  /** Desktop clients only; public by design. */
  readonly clientSecret?: string;
  readonly redirect: () => Promise<Redirect>;
  readonly openBrowser: (url: string) => Promise<void>;
  readonly fetch: Fetch;
  readonly storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
}

/** Sign-in refused or cancelled by the user, or a code Google did not accept. */
export class SignInError extends Error {}

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const random = (length: number) => base64url(crypto.getRandomValues(new Uint8Array(length)));

export async function pkcePair() {
  const verifier = random(48);
  const challenge = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))));
  return { verifier, challenge };
}

export class PkceGoogleAuth implements GoogleAuth {
  private readonly cache = new TokenCache();
  private readonly storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

  constructor(private readonly options: PkceOptions) {
    this.storage = options.storage ?? localStorage;
  }

  async token(interactive: boolean): Promise<string | null> {
    const cached = this.cache.get();
    if (cached) return cached;
    if (this.storage.getItem(REFRESH_TOKEN) && (await this.refresh())) return this.cache.get();
    return interactive ? this.signIn() : null;
  }

  invalidate() {
    this.cache.clear();
  }

  async signOut(): Promise<void> {
    const token = this.storage.getItem(REFRESH_TOKEN);
    this.storage.removeItem(REFRESH_TOKEN);
    this.cache.clear();
    if (token) await this.options.fetch(`${REVOKE}?${new URLSearchParams({ token })}`, { method: 'POST' }).catch(() => undefined);
  }

  private async tokenRequest(fields: Record<string, string>) {
    const { clientId, clientSecret } = this.options;
    const body = new URLSearchParams({ client_id: clientId, ...(clientSecret && { client_secret: clientSecret }), ...fields });
    const response = await this.options.fetch(TOKEN, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    const json = (await response.json()) as { access_token?: string; expires_in?: number; refresh_token?: string; error?: string };
    return { ok: response.ok && Boolean(json.access_token), ...json };
  }

  /** A new access token from the refresh token; false when Google no longer accepts it (access revoked). */
  private async refresh(): Promise<boolean> {
    const result = await this.tokenRequest({ grant_type: 'refresh_token', refresh_token: this.storage.getItem(REFRESH_TOKEN)! });
    if (!result.ok) {
      if (result.error === 'invalid_grant') this.storage.removeItem(REFRESH_TOKEN);
      return false;
    }
    this.cache.set(result.access_token!, result.expires_in ?? 3600);
    return true;
  }

  private async signIn(): Promise<string> {
    const redirect = await this.options.redirect();
    const { verifier, challenge } = await pkcePair();
    const state = random(16);
    const url = `${AUTHORIZE}?${new URLSearchParams({
      client_id: this.options.clientId,
      redirect_uri: redirect.uri,
      response_type: 'code',
      scope: DRIVE_SCOPE,
      code_challenge: challenge,
      code_challenge_method: 'S256',
      state,
      // A refresh token, so that the access is renewed without the browser.
      access_type: 'offline',
      prompt: 'consent',
    })}`;
    const back = redirect.wait();
    await this.options.openBrowser(url);
    const query = new URL(await back, redirect.uri).searchParams;
    if (query.get('state') !== state || !query.get('code')) throw new SignInError(query.get('error') ?? 'no code');
    const result = await this.tokenRequest({ grant_type: 'authorization_code', code: query.get('code')!, code_verifier: verifier, redirect_uri: redirect.uri });
    if (!result.ok) throw new SignInError(result.error ?? 'token');
    if (result.refresh_token) this.storage.setItem(REFRESH_TOKEN, result.refresh_token);
    this.cache.set(result.access_token!, result.expires_in ?? 3600);
    return result.access_token!;
  }
}
