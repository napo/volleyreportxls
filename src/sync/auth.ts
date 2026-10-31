// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Sign-in to a cloud service, one way per service and platform, all behind
 * this interface. Tokens stay on the device: no server of the project sees them.
 */

export interface CloudAuth {
  /**
   * A valid access token. When `interactive` is false nothing is shown to the
   * user: null means that the user has to sign in again (e.g. on the web, where
   * the token lasts an hour and is renewed only with a tap).
   */
  token(interactive: boolean): Promise<string | null>;
  /** The access token was refused: the next call gets a new one. */
  invalidate(): void;
  /** Forgets the tokens on this device and revokes the access when possible. */
  signOut(): Promise<void>;
}

/** An access token with its expiry, kept in memory. */
export class TokenCache {
  private value: { token: string; expires: number } | null = null;

  constructor(private readonly clock: () => number = () => Date.now()) {}

  get(): string | null {
    // A minute of margin: a token about to expire would fail during the upload.
    return this.value && this.value.expires - 60_000 > this.clock() ? this.value.token : null;
  }

  set(token: string, expiresInSeconds: number) {
    this.value = { token, expires: this.clock() + expiresInSeconds * 1000 };
  }

  clear() {
    this.value = null;
  }
}
