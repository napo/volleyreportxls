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
