// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { SKILLS, skillEvaluations } from '../domain/codes';
import { SCALE_COLORS, evaluationColor, evaluationTint, scalePlace } from './evaluation-colors';

test('colours follow the place on the scale of the skill, not the symbol', () => {
  expect(skillEvaluations('B')).toEqual(['#', '/', '+', '!', '-', '=']);
  expect(skillEvaluations('R')).toEqual(['#', '+', '!', '-', '/', '=']);
  expect(skillEvaluations('P')).toEqual(['=']);
  expect(evaluationColor('B', '/')).toBe(SCALE_COLORS[1]);
  expect(evaluationColor('R', '/')).toBe(SCALE_COLORS[4]);
  expect(scalePlace('B', '+')).toBe(2);
  // "#" is always the most favourable, "=" always the least.
  for (const skill of SKILLS) {
    expect(evaluationColor(skill, '=')).toBe(SCALE_COLORS[5]);
    if (skillEvaluations(skill).includes('#')) expect(evaluationColor(skill, '#')).toBe(SCALE_COLORS[0]);
  }
});

test('printed tints keep black text readable in black and white', () => {
  for (const skill of SKILLS) {
    for (const evaluation of skillEvaluations(skill)) {
      const [r, g, b] = evaluationTint(skill, evaluation);
      expect(0.299 * r + 0.587 * g + 0.114 * b).toBeGreaterThan(0.6);
    }
  }
});
