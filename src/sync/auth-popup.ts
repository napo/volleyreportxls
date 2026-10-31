// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The way back of a PKCE sign-in in the web version: the page of the service
 * opens in a window, which comes back to public/oauth-callback.html; that page
 * hands over its address on a channel of this origin. The window is opened
 * before anything else, as browsers block it when it is far from the user's tap.
 */

import { type Redirect, SignInError } from './auth-pkce';

const CHANNEL = 'volleyreport-oauth';
const TIMEOUT_MS = 5 * 60_000;

export function popupSignIn(): { redirect: () => Promise<Redirect>; openBrowser: (url: string) => Promise<void> } {
  let popup: Window | null = null;
  return {
    async redirect() {
      popup = window.open('about:blank', 'volleyreport-oauth', 'popup,width=520,height=720');
      if (!popup) throw new SignInError('popup blocked');
      return {
        uri: `${location.origin}${import.meta.env.BASE_URL}oauth-callback.html`,
        wait: () =>
          new Promise<string>((resolve, reject) => {
            const channel = new BroadcastChannel(CHANNEL);
            const timer = setTimeout(() => {
              channel.close();
              reject(new SignInError('timeout'));
            }, TIMEOUT_MS);
            channel.onmessage = (event) => {
              clearTimeout(timer);
              channel.close();
              resolve(String(event.data));
            };
          }),
      };
    },
    async openBrowser(url) {
      popup!.location.href = url;
    },
  };
}
