#!/usr/bin/env node
// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

// Writes a scouting form filled in at random (PDF) and what the app should read from it (JSON).
// Usage: npm run sample:sheet -- [--seed N] [--lang it|en] [--full N] [--out file.pdf]
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { createServer } from 'vite';

const { values } = parseArgs({ options: { seed: { type: 'string' }, full: { type: 'string', default: '0' }, lang: { type: 'string', default: 'it' }, out: { type: 'string' } } });
const seed = values.seed ? Number(values.seed) : Math.floor(Math.random() * 1e6);
const out = values.out ?? `modulo-compilato-${seed}.pdf`;
const root = fileURLToPath(new URL('../..', import.meta.url));
const asset = (path) => new Uint8Array(readFileSync(`${root}/src/assets/${path}`));

// Vite loads the TypeScript modules of the app, as in the dev server.
const server = await createServer({ root, configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false }, logLevel: 'error' });
try {
  const { randomSampleSheet, renderSampleSheetPdf, sampleSummary } = await server.ssrLoadModule('/src/pdf/sample-sheet.ts');
  const { [values.lang]: texts } = await server.ssrLoadModule(`/src/i18n/${values.lang}.ts`);
  const sheet = randomSampleSheet(seed, undefined, { full: Number(values.full) });
  const fonts = { regular: asset('fonts/Roboto-Regular.ttf'), bold: asset('fonts/Roboto-Bold.ttf'), heading: asset('fonts/Montserrat-ExtraBold.ttf') };
  writeFileSync(out, await renderSampleSheetPdf(sheet, { fonts, texts, logoPng: asset('volleyreportxls-logo.png') }));
  writeFileSync(out.replace(/\.pdf$/, '.json'), `${JSON.stringify(sampleSummary(sheet), null, 2)}\n`);
  console.log(`${out} (seed ${seed}, set ${sheet.set}, ${sheet.score.team}-${sheet.score.opponent}) and ${out.replace(/\.pdf$/, '.json')}`);
} finally {
  await server.close();
}
