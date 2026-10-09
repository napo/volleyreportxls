// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type Rect, formLayout } from '../pdf/layout';
import { formQrPayload } from '../pdf/scouting-form';
import { readSheetImage } from './read-sheet';
import { type RgbaImage, renderSyntheticForm } from './synthetic';

const PX_PER_MM = 6;

/** A pen mark filling most of a bubble. */
function fill(image: RgbaImage, bubble: Rect) {
  const cx = (bubble.x + bubble.width / 2) * PX_PER_MM;
  const cy = (bubble.y + bubble.height / 2) * PX_PER_MM;
  const r = (bubble.width / 2) * 0.7 * PX_PER_MM;
  for (let y = Math.floor(cy - r); y <= cy + r; y++) {
    for (let x = Math.floor(cx - r); x <= cx + r; x++) {
      if ((x - cx) ** 2 + (y - cy) ** 2 > r * r) continue;
      const i = (y * image.width + x) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 20;
    }
  }
}

function sheet(version: number, set: 2 | null, marks: { sets?: number[]; extra?: boolean }) {
  const layout = formLayout(version);
  const image = renderSyntheticForm(layout, formQrPayload({ layoutVersion: version, setNumber: set, page: 1 }), PX_PER_MM);
  for (const n of marks.sets ?? []) fill(image, layout.setMarks!.sets[n - 1]!);
  if (marks.extra) fill(image, layout.setMarks!.extra);
  const result = readSheetImage(image);
  if (!result.ok) throw new Error('not read');
  return result;
}

test('v5: the set marked by hand, and the extra sheet', () => {
  expect(sheet(5, null, { sets: [3] })).toMatchObject({ layoutVersion: 5, setNumber: 3, setsMarked: [3], extraSheet: false });
  expect(sheet(5, null, { sets: [5], extra: true })).toMatchObject({ setNumber: 5, extraSheet: true });
});

test('v5: no set or two sets marked leave the choice to the user', () => {
  expect(sheet(5, null, {})).toMatchObject({ setNumber: null, setsMarked: [] });
  expect(sheet(5, null, { sets: [1, 4] })).toMatchObject({ setNumber: null, setsMarked: [1, 4] });
});

test('v4 sheets already printed: the set still comes from the QR', () => {
  expect(sheet(4, 2, {})).toMatchObject({ layoutVersion: 4, setNumber: 2, setsMarked: [], extraSheet: false });
});
