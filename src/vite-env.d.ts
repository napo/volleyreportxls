// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Secret of the Google "Desktop app" client, from .env.local or the CI secret (src/config.ts). */
  readonly VITE_GOOGLE_DESKTOP_CLIENT_SECRET?: string;
}

/** "version" of package.json, defined by vite.config.ts. */
declare const __APP_VERSION__: string;
