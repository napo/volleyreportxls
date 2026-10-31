// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Project identity and links: the single place for the URLs shown in the app
 * (Informazioni page, footer, update notice). Components import them from here.
 */

export const APP_NAME = 'VolleyReport';
export const AUTHOR_NAME = 'Maurizio Napolitano';
export const AUTHOR_URL = 'https://github.com/napo';
/** Article presenting VolleyReportXLS, the spreadsheet this app comes from. */
export const VOLLEYREPORTXLS_URL = 'https://napo.medium.com/volleyreportxls-84e4a11b5350';
export const SOURCE_REPOSITORY = 'napo/volleyreportxls';
export const SOURCE_REPOSITORY_URL = `https://github.com/${SOURCE_REPOSITORY}`;
/** Web version (GitHub Pages with the custom domain in public/CNAME, see .github/workflows/deploy-pages.yml). */
export const WEB_APP_URL = 'https://report.volleyserve.it/';
export const LICENSE_URL = `${SOURCE_REPOSITORY_URL}/blob/main/LICENSE`;
/** Privacy policy (public/privacy.html), linked from the footer as Google requires for its sign-in. */
export const PRIVACY_URL = `${WEB_APP_URL}privacy.html`;
export const LICENSE_NAME = 'GNU Affero General Public License v3.0 or later';
export const LICENSE_SPDX = 'AGPL-3.0-or-later';
export const RELEASES_URL = `${SOURCE_REPOSITORY_URL}/releases/latest`;
export const RELEASES_API = `https://api.github.com/repos/${SOURCE_REPOSITORY}/releases/latest`;
export const releaseUrl = (version: string) => `${SOURCE_REPOSITORY_URL}/releases/tag/v${version}`;

/**
 * Voluntary donation link (https://paypal.me/… or https://www.paypal.com/donate/…).
 * Empty: the "Sostieni lo sviluppo" section shows no PayPal button. It is a
 * plain link: PayPal is contacted only when the user opens it.
 */
export const PAYPAL_DONATION_URL = 'https://paypal.me/MNapolitano570';

/**
 * Contact address, kept reversed so that it is not in the published code as plain text:
 * it is put together only when the user asks to see it.
 */
const CONTACT_EMAIL = ['onatilopan.oiziruam', 'moc.liamg'] as const;
const reversed = (text: string) => [...text].reverse().join('');
export const contactEmail = () => CONTACT_EMAIL.map(reversed).join('@');

/** A configured external link: http(s) only, otherwise null (no broken button). */
export function externalUrl(value: string | undefined): string | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : null;
  } catch {
    return null;
  }
}

/**
 * OAuth clients of the project on Google Cloud, for the synchronisation with
 * the user's Google Drive (scope drive.file). One client per platform, as
 * Google requires; an empty id hides the synchronisation on that platform.
 * None of these is a secret: an installed app cannot keep one (RFC 8252), and
 * Google treats the desktop "secret" as public, but it stays out of the
 * repository (see below). See docs/google-drive.md.
 */
export const GOOGLE_OAUTH = {
  /** "Web application" client, origin https://report.volleyserve.it. */
  web: '780810157215-39pllq0u4mh9hek906kg37imf4s6epg2.apps.googleusercontent.com',
  /**
   * "Desktop app" client (Windows, macOS, Linux): sign-in in the system browser, back to 127.0.0.1.
   * The secret is read at build time (.env.local, GitHub secret GOOGLE_DESKTOP_CLIENT_SECRET), not kept in
   * the repository, where secret scanning would report it; it ends up in the installed app anyway.
   */
  desktop: {
    clientId: '780810157215-mfv1558snp4pcif3i5d7hksr461e5d0a.apps.googleusercontent.com',
    // import.meta.env is missing when vite.config.ts loads this file (form PDFs).
    clientSecret: import.meta.env?.VITE_GOOGLE_DESKTOP_CLIENT_SECRET ?? '',
  },
  /** "Android" client: package it.napolitano.volleyreport and SHA-1 of the signing certificate. */
  android: '780810157215-68o4lmar3p8jdirdbp3ravv8huns8tje.apps.googleusercontent.com',
  /** "iOS" client: bundle id it.napolitano.volleyreport; Google redirects to its reversed id. */
  ios: '',
} as const;
