// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { a11y, a11yChanged, resetA11y, scrollBehavior, setA11y } from './a11y';
import { lostColor, scaleColors, wonColor } from './charts/tokens';
import { SCALE_COLORS } from '../report/evaluation-colors';

afterEach(resetA11y);

test('the choices change the charts: blue and orange for colour blindness, no motion, larger text', () => {
  expect(a11yChanged()).toBe(false);
  expect(scaleColors()).toEqual(SCALE_COLORS);
  setA11y({ colorblind: true, still: true, text: 2 });
  expect(a11y()).toMatchObject({ colorblind: true, still: true, text: 2, legible: false });
  expect(a11yChanged()).toBe(true);
  expect([wonColor(), lostColor()]).toEqual(['#0072b2', '#e69f00']);
  expect(scaleColors()).not.toEqual(SCALE_COLORS);
  expect(scrollBehavior()).toBe('auto');
});

test('back to the system settings', () => {
  setA11y({ explain: true });
  resetA11y();
  expect(a11y().explain).toBe(false);
  expect(a11yChanged()).toBe(false);
});
