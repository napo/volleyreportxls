// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/// <reference types="vitest/config" />
import { readFileSync } from 'node:fs';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { formPdfs } from './scripts/form-pdfs-plugin';

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

export default defineConfig({
  plugins: [react(), formPdfs()],
  // "/" for the dev server and the installed apps; the GitHub Pages workflow sets the repository path.
  base: process.env.VITE_BASE_PATH || '/',
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
  build: {
    // The PDF chunk (pdf-lib + fontkit, ~1.1 MB) is loaded only when a PDF is generated.
    chunkSizeWarningLimit: 1200,
  },
  test: {
    include: ['src/**/*.test.ts'],
    globals: true,
    // Image tests (synthetic and photographed sheets) are slow on the Windows and macOS runners.
    testTimeout: 30_000,
  },
});
