// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

// Vite plugin: makes the printable scouting forms (src/pdf/form-files.ts) at build time,
// and serves them from memory in the dev server.
import { readFileSync } from 'node:fs';
import type { Plugin } from 'vite';
import { en } from '../src/i18n/en';
import { it } from '../src/i18n/it';
import { FORM_FILES } from '../src/pdf/form-files';
import { renderScoutingFormPdf } from '../src/pdf/scouting-form-pdf';

const asset = (path: string) => new Uint8Array(readFileSync(new URL(`../src/assets/${path}`, import.meta.url)));

async function makeForms(): Promise<Map<string, Uint8Array>> {
  const fonts = {
    regular: asset('fonts/Roboto-Regular.ttf'),
    bold: asset('fonts/Roboto-Bold.ttf'),
    heading: asset('fonts/Montserrat-ExtraBold.ttf'),
  };
  const logoPng = asset('volleyreportxls-logo.png');
  const texts = { it, en };
  const forms = new Map<string, Uint8Array>();
  for (const [lang, path] of Object.entries(FORM_FILES)) {
    forms.set(path, await renderScoutingFormPdf({ fonts, logoPng, texts: texts[lang as keyof typeof texts] }));
  }
  return forms;
}

export function formPdfs(): Plugin {
  let forms: Promise<Map<string, Uint8Array>> | undefined;
  const get = () => (forms ??= makeForms());
  return {
    name: 'volleyreport-form-pdfs',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const path = req.url?.split('?')[0]?.replace(/^\/+/, '') ?? '';
        const bytes = (await get()).get(path);
        if (!bytes) return next();
        res.setHeader('Content-Type', 'application/pdf');
        res.end(bytes);
      });
    },
    async generateBundle() {
      for (const [fileName, source] of await get()) this.emitFile({ type: 'asset', fileName, source });
    },
  };
}
