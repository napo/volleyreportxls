// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Content Security Policy of the web version, as a <meta> tag (GitHub Pages
 * sets no headers): scripts only from the site and from Google's sign-in,
 * connections only to the cloud services the user may connect and to GitHub
 * (latest release). A second line of defence: an injected script could not
 * load code from elsewhere nor send the tokens away.
 * Only in the web build: the dev server needs inline scripts, and the
 * installed apps (Tauri sets TAURI_ENV_PLATFORM while building) talk to Rust
 * through their own addresses.
 */

import type { Plugin } from 'vite';

const GOOGLE = 'https://accounts.google.com';

export const WEB_CSP = [
  "default-src 'self'",
  `script-src 'self' ${GOOGLE}/gsi/client`,
  // React and ECharts set inline styles.
  `style-src 'self' 'unsafe-inline' ${GOOGLE}/gsi/style`,
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "worker-src 'self' blob:",
  "media-src 'self' blob:",
  [
    "connect-src 'self' blob: data:",
    GOOGLE,
    'https://oauth2.googleapis.com',
    'https://www.googleapis.com',
    'https://api.dropboxapi.com',
    'https://content.dropboxapi.com',
    'https://login.microsoftonline.com',
    'https://graph.microsoft.com',
    'https://*.1drv.com',
    'https://*.microsoftpersonalcontent.com',
    'https://*.sharepoint.com',
    'https://api.github.com',
  ].join(' '),
  `frame-src ${GOOGLE}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

export function webCsp(): Plugin {
  return {
    name: 'volleyreport-web-csp',
    apply: 'build',
    transformIndexHtml(html) {
      if (process.env.TAURI_ENV_PLATFORM) return html;
      return html.replace('<meta charset="UTF-8" />', `<meta charset="UTF-8" />\n    <meta http-equiv="Content-Security-Policy" content="${WEB_CSP}" />`);
    },
  };
}
