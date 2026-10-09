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

function sheet(version: number, set: 2 | null, marks: { sets?: number[]; extra?: boolean; bubbles?: readonly Rect[] }) {
  const layout = formLayout(version);
  const image = renderSyntheticForm(layout, formQrPayload({ layoutVersion: version, setNumber: set, page: 1 }), PX_PER_MM);
  for (const n of marks.sets ?? []) fill(image, layout.setMarks!.sets[n - 1]!);
  if (marks.extra) fill(image, layout.setMarks!.extra);
  for (const bubble of marks.bubbles ?? []) fill(image, bubble);
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

test('v6: smaller QR in the compact header, set marks and touches read', () => {
  const layout = formLayout(6);
  const attack = layout.rows[9]!.cells.find((c) => c.skill === 'A' && c.evaluation === '#')!;
  const block = layout.rows[0]!.cells.find((c) => c.skill === 'M' && c.evaluation === '-')!;
  const result = sheet(6, null, { sets: [2], bubbles: [...attack.bubbles.slice(0, 3), ...block.bubbles.slice(0, 4)] });
  expect(result).toMatchObject({ page: { layoutVersion: 6 }, layoutVersion: 6, setNumber: 2 });
  expect(result.rows).toHaveLength(14);
  const count = (row: number, code: string) => result.rows[row]!.cells.find((c) => c.code === code)!.count;
  expect(count(9, 'A#')).toBe(3);
  expect(count(0, 'M-')).toBe(4);
});

/** A sheet as printed, without its QR: the light outlines of the bubbles, from which the layout is guessed. */
function withoutQr(version: number) {
  const layout = formLayout(version);
  const image = renderSyntheticForm(layout, formQrPayload({ layoutVersion: version, setNumber: null, page: 1 }), PX_PER_MM);
  const { qr } = layout;
  for (let y = Math.floor(qr.y * PX_PER_MM); y < (qr.y + qr.height) * PX_PER_MM; y++) {
    for (let x = Math.floor(qr.x * PX_PER_MM); x < (qr.x + qr.width) * PX_PER_MM; x++) image.data.fill(255, (y * image.width + x) * 4, (y * image.width + x) * 4 + 3);
  }
  for (const row of layout.rows) {
    for (const bubble of row.cells.flatMap((c) => c.bubbles)) {
      const cx = (bubble.x + bubble.width / 2) * PX_PER_MM;
      const cy = (bubble.y + bubble.height / 2) * PX_PER_MM;
      const r = (bubble.width / 2) * PX_PER_MM;
      for (let k = 0; k < 64; k++) {
        const x = Math.round(cx + r * Math.cos((k / 64) * 2 * Math.PI));
        const y = Math.round(cy + r * Math.sin((k / 64) * 2 * Math.PI));
        const i = (y * image.width + x) * 4;
        image.data[i] = image.data[i + 1] = image.data[i + 2] = 150;
      }
    }
  }
  const result = readSheetImage(image);
  if (!result.ok) throw new Error('not read');
  return result;
}

test('QR unreadable: v5 sheets keep their grid (shared with v4), v6 sheets are told apart', () => {
  const v5 = withoutQr(5);
  expect(v5.page).toBeNull();
  expect(formLayout(v5.layoutVersion).rows).toEqual(formLayout(5).rows);
  expect(withoutQr(6)).toMatchObject({ page: null, layoutVersion: 6 });
});
