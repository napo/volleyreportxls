// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PDFDocument } from 'pdf-lib';
import { en } from '../i18n/en';
import { it } from '../i18n/it';
import { EVALUATION_FILLS, EVALUATION_TONES } from './evaluation-style';
import { embedPdfFonts } from './fonts';
import { CURRENT_FORM_LAYOUT } from './layout';
import { TEST_FONTS } from './test-fonts';
import type { Skill } from '../domain/codes';

test('meanings fit their columns in both languages and remain readable without colour', async () => {
  const fonts = await embedPdfFonts(await PDFDocument.create(), TEST_FONTS);
  for (const texts of [it, en]) {
    for (const skill of CURRENT_FORM_LAYOUT.skills.filter((s) => s.kind === 'player')) {
      for (const column of skill.evaluations) {
        const caption = texts.form.evaluationCaptions[skill.skill]?.[column.evaluation];
        expect(caption).toBeTruthy();
        expect(EVALUATION_TONES[skill.skill as Skill][column.evaluation]).toBeTruthy();
        for (const line of caption!.split('|')) {
          expect(fonts.regular.widthOfTextAtSize(line, 6.2) / (72 / 25.4)).toBeLessThan(column.outer.width - 0.4);
        }
      }
    }
  }
  // Captions are black on these pastel fills: at least 4.5:1 in each case.
  for (const fill of Object.values(EVALUATION_FILLS)) {
    const linear = fill.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    const luminance = linear[0]! * 0.2126 + linear[1]! * 0.7152 + linear[2]! * 0.0722;
    expect((luminance + 0.05) / 0.05).toBeGreaterThanOrEqual(4.5);
  }
});

test('the same symbol can have different qualitative meanings across skills', () => {
  expect(EVALUATION_TONES.B['/']).toBe('favourable');
  expect(EVALUATION_TONES.R['/']).toBe('unfavourable');
  expect(EVALUATION_TONES.A['/']).toBe('unfavourable');
  expect(EVALUATION_TONES.B['!']).toBe('favourable');
  expect(EVALUATION_TONES.A['!']).toBe('intermediate');
  expect(EVALUATION_TONES.R['!']).toBe('unfavourable');
});
