// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from 'node:fs';
import { PDFDocument } from 'pdf-lib';
import { TEST_FONTS } from './test-fonts';
import { calculateMatchStats } from '../domain';
import { line, match, set, team } from '../domain/testing';
import { matchFromWorkbook } from '../oracle/workbook';
import { buildSetTabellino, buildTabellino } from '../report';
import { renderTabellinoPdf, tabellinoFileName } from './tabellino-pdf';

const tabellinoOf = (m: ReturnType<typeof matchFromWorkbook>) => buildTabellino(m, calculateMatchStats(m));

test('the scoresheet of the reference match is a single A4 portrait page', async () => {
  const pdf = await PDFDocument.load(await renderTabellinoPdf(tabellinoOf(matchFromWorkbook()), { fonts: TEST_FONTS }));
  expect(pdf.getPageCount()).toBe(1);
  const { width, height } = pdf.getPage(0).getSize();
  expect([Math.round(width), Math.round(height)]).toEqual([595, 842]);
  expect(pdf.getTitle()).toBe('Tabellino Melodic Spikers - Rhythmic Blockers 3-0');
});

test('names with characters outside the standard fonts do not break the export', async () => {
  const m = match(team([[1, 'Łucja Żółć'], [2, '李娜']]), [set(1, { team: 25, opponent: 20 }, [line(1, 'A#')])]);
  await expect(renderTabellinoPdf(tabellinoOf(m), { fonts: TEST_FONTS })).resolves.toBeInstanceOf(Uint8Array);
});

test('file name follows the match summary format', () => {
  expect(tabellinoFileName(tabellinoOf(matchFromWorkbook()))).toBe(
    'Melodic Spikers - Rhythmic Blockers 3-0 (25-16, 25-18, 25-22).pdf',
  );
});

test('the logo can be printed in the header', async () => {
  const logoPng = new Uint8Array(readFileSync('src/assets/volleyreportxls-logo.png'));
  const pdf = await PDFDocument.load(await renderTabellinoPdf(tabellinoOf(matchFromWorkbook()), { fonts: TEST_FONTS, logoPng }));
  expect(pdf.getPageCount()).toBe(1);
});

test('players without names: the scoresheet still fits one page', async () => {
  const m = match(team([[1, ''], [2, '']]), [set(1, { team: 25, opponent: 20 }, [line(1, 'A# B='), line(2, 'R#')])]);
  const pdf = await PDFDocument.load(await renderTabellinoPdf(tabellinoOf(m), { fonts: TEST_FONTS }));
  expect(pdf.getPageCount()).toBe(1);
});

test('the scoresheet of one set: title and file name name the set', async () => {
  const m = matchFromWorkbook();
  const second = buildSetTabellino(m, tabellinoOf(m), 2);
  const pdf = await PDFDocument.load(await renderTabellinoPdf(second, { fonts: TEST_FONTS }));
  expect(pdf.getPageCount()).toBe(1);
  expect(pdf.getTitle()).toBe('Tabellino Melodic Spikers - Rhythmic Blockers 3-0 - Set 2');
  expect(tabellinoFileName(second)).toBe('Melodic Spikers - Rhythmic Blockers 3-0 (25-16, 25-18, 25-22) - Set 2.pdf');
});
