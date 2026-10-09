// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { PDFDocument } from 'pdf-lib';
import { readSheetImage } from '../image-processing/read-sheet';
import { type RgbaImage, renderSyntheticForm } from '../image-processing/synthetic';
import { CURRENT_FORM_LAYOUT as layout, type Rect } from './layout';
import { type MarkShape, randomSampleSheet, renderSampleSheetPdf } from './sample-sheet';
import { formQrPayload } from './scouting-form';
import { TEST_FONTS } from './test-fonts';

const PX_PER_MM = 8;

function dark(image: RgbaImage, x: number, y: number) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = (y * image.width + x) * 4;
  image.data[i] = image.data[i + 1] = image.data[i + 2] = 30;
}

/** The pen marks of the sample, painted on a synthetic scan. */
function paint(image: RgbaImage, m: MarkShape) {
  const s = PX_PER_MM;
  if (m.kind === 'disc') {
    for (let y = Math.floor((m.cy - m.r) * s); y <= (m.cy + m.r) * s; y++) {
      for (let x = Math.floor((m.cx - m.r) * s); x <= (m.cx + m.r) * s; x++) {
        if ((x / s - m.cx) ** 2 + (y / s - m.cy) ** 2 <= m.r * m.r) dark(image, x, y);
      }
    }
    return;
  }
  const steps = Math.ceil(Math.hypot(m.x2 - m.x1, m.y2 - m.y1) * s * 2);
  const half = (m.width / 2) * s;
  for (let k = 0; k <= steps; k++) {
    const cx = (m.x1 + ((m.x2 - m.x1) * k) / steps) * s;
    const cy = (m.y1 + ((m.y2 - m.y1) * k) / steps) * s;
    for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) dark(image, Math.round(cx + dx), Math.round(cy + dy));
  }
}

/** Something written in a box (a digit): a stroke down its middle. */
const write = (image: RgbaImage, box: Rect) =>
  paint(image, { kind: 'slash', x1: box.x + box.width / 2, y1: box.y + box.height * 0.2, x2: box.x + box.width / 2, y2: box.y + box.height * 0.8, width: 0.5 });

test.each([1, 7, 42, 2026])('a random sample (seed %i) is read back as generated', (seed) => {
  const sheet = randomSampleSheet(seed);
  const image = renderSyntheticForm(layout, formQrPayload({ layoutVersion: layout.version, setNumber: null, page: 1 }), PX_PER_MM);
  // The heavy rules between skills, as printed (1.6 pt, near black).
  for (const skill of layout.skills) {
    const bottom = Math.max(...layout.rows.filter((r) => r.kind === skill.kind).map((r) => r.outer.y + r.outer.height));
    for (const x of [skill.outer.x, skill.outer.x + skill.outer.width]) paint(image, { kind: 'slash', x1: x, y1: skill.outer.y, x2: x, y2: bottom, width: 0.56 });
  }
  for (const m of sheet.marks) paint(image, m);
  for (const row of sheet.rows) write(image, layout.rows[row.index]!.numberDigits[0]);
  write(image, layout.score.team[0]);

  const result = readSheetImage(image);
  if (!result.ok) throw new Error('not read');
  expect(result.setNumber).toBe(sheet.set);
  expect(result.score.written).toBe(true);
  for (const row of sheet.rows) {
    const read = result.rows[row.index]!;
    expect(read.numberWritten).toBe(true);
    const counts = Object.fromEntries(read.cells.filter((c) => c.code && c.count > 0).map((c) => [c.code, c.count]));
    expect(counts).toEqual(row.counts);
    expect(read.cells.filter((c) => c.uncertain)).toEqual([]);
  }
  // Rows left empty on the sheet read nothing.
  const used = new Set(sheet.rows.map((r) => r.index));
  for (const row of result.rows.filter((r) => !used.has(r.index))) expect(row.cells.every((c) => c.count === 0)).toBe(true);
});

test('a full cell, "+" marked: read with its bubbles, flagged for the total', () => {
  const sheet = randomSampleSheet(5, layout, { full: 1 });
  const [{ row, code }] = sheet.full as [(typeof sheet.full)[number]];
  const image = renderSyntheticForm(layout, formQrPayload({ layoutVersion: layout.version, setNumber: null, page: 1 }), PX_PER_MM);
  for (const m of sheet.marks) paint(image, m);
  const result = readSheetImage(image);
  if (!result.ok) throw new Error('not read');
  const cell = result.rows[row]!.cells.find((c) => c.code === code)!;
  expect(cell).toMatchObject({ overflow: true, count: sheet.rows.find((r) => r.index === row)!.counts[code] });
});

test('the sample is plausible: a full team, at most two liberos, a finished set', () => {
  for (const seed of [1, 2, 3, 4, 5]) {
    const sheet = randomSampleSheet(seed);
    const players = sheet.rows.filter((r) => r.kind === 'player');
    expect(players.length).toBeGreaterThanOrEqual(7);
    expect(new Set(sheet.rows.map((r) => r.number)).size).toBe(sheet.rows.length);
    expect(Math.max(sheet.score.team, sheet.score.opponent)).toBe(25);
    expect(randomSampleSheet(seed)).toEqual(sheet);
  }
});

test('the PDF of the sample is the form, one page', async () => {
  const pdf = await PDFDocument.load(await renderSampleSheetPdf(randomSampleSheet(1), { fonts: TEST_FONTS }));
  expect(pdf.getPageCount()).toBe(1);
});
