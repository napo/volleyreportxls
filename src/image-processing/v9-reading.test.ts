// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Reading v9 forms end to end on synthetic photos: markers, QR, the oval
 * bubbles and grey row bands as printed, pen marks in some cells. The
 * geometry must come back from the QR, or be recognised from the printed
 * grid when the QR cannot be read.
 */

import type { ScoutCodeString } from '../domain/codes';
import { type FormLayout, type FormOrder, OPTIONAL_FORM_CODES, cellCode, maskHidden, printableLayout, v9Layout } from '../pdf/layout';
import { formQrPayload } from '../pdf/scouting-form';
import { readSheetImage, withBlockColumnLeftOut } from './read-sheet';
import { type RgbaImage, renderSyntheticForm } from './synthetic';

const PX = 6;

function setPixel(image: RgbaImage, x: number, y: number, value: number) {
  if (x < 0 || y < 0 || x >= image.width || y >= image.height) return;
  const i = (y * image.width + x) * 4;
  if (image.data[i]! <= value) return;
  image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
}

/** The printed grid: grey bands on every other player row, grey oval outlines; then the pen marks. */
function photo(layout: FormLayout, qr: string, marks: ReadonlyMap<string, number>): RgbaImage {
  const image = renderSyntheticForm(layout, qr, PX);
  for (const row of layout.rows) {
    if (row.kind === 'player' && row.index % 2 === 1) {
      const o = row.outer;
      for (let y = Math.round(o.y * PX); y < (o.y + o.height) * PX; y++) for (let x = Math.round(o.x * PX); x < (o.x + o.width) * PX; x++) setPixel(image, x, y, 235);
    }
    for (const cell of row.cells) {
      const marked = marks.get(`${row.index}:${cellCode(cell)}`) ?? 0;
      cell.bubbles.forEach((b, n) => {
        const cx = (b.x + b.width / 2) * PX;
        const cy = (b.y + b.height / 2) * PX;
        const rx = (b.width / 2) * PX;
        const ry = (b.height / 2) * PX;
        for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y++) {
          for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x++) {
            const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
            if (n < marked && d <= 0.8) setPixel(image, x, y, 20);
            else if (Math.abs(d - 1) * Math.min(rx, ry) < 0.6) setPixel(image, x, y, 150);
          }
        }
      });
    }
  }
  return image;
}

/** Some cells of the first rows that the layout has, with how many touches to mark. */
function marksFor(layout: FormLayout): Map<string, number> {
  const marks = new Map<string, number>();
  for (const [row, code, n] of [[0, 'B#', 2], [0, 'A#', 3], [1, 'R+', 1], [2, 'M=', 2], [0, 'A/', 2], [1, 'R!', 1], [12, 'R#', 2]] as const) {
    if (!layout.hidden.includes(code as ScoutCodeString)) marks.set(`${row}:${code}`, n);
  }
  return marks;
}

function counts(result: Exclude<ReturnType<typeof readSheetImage>, { ok: false }>) {
  const found = new Map<string, number>();
  for (const row of result.rows) for (const cell of row.cells) if (cell.count > 0) found.set(`${row.index}:${cell.code}`, cell.count);
  return found;
}

const samples = [['A/'], ['B/', 'B!'], ['R!', 'R/'], ['B!', 'M!', 'A!', 'R!'], [...OPTIONAL_FORM_CODES], maskHidden(0b10100101)] as ScoutCodeString[][];

describe('reading v9 forms', () => {
  test.each(samples.map((h) => [h.join(' '), h] as const))('with the QR: columns %s left out, every mark in its cell', (_, hidden) => {
    const layout = v9Layout(hidden);
    const marks = marksFor(layout);
    const result = readSheetImage(photo(layout, formQrPayload({ layoutVersion: 9, setNumber: null, page: 1, hidden }), marks));
    if (!result.ok) throw new Error(result.reason);
    expect(result.layoutVersion).toBe(9);
    expect(result.untracked).toEqual(layout.hidden);
    expect(counts(result)).toEqual(marks);
  });

  test.each(samples.slice(0, 4).map((h) => [h.join(' '), h] as const))('without the QR: the form with columns %s left out is recognised from the grid', (_, hidden) => {
    const layout = v9Layout(hidden);
    const marks = marksFor(layout);
    const result = readSheetImage(photo(layout, 'no QR here', marks));
    if (!result.ok) throw new Error(result.reason);
    expect(result.page).toBeNull();
    expect(result.layoutVersion).toBe(9);
    expect(result.untracked).toEqual(layout.hidden);
    expect(counts(result)).toEqual(marks);
  });

  test.each([['M!'], ['M/']] as const)('without the QR, block column %s left out: the user is asked, and the answer puts every mark in its cell', (left) => {
    const hidden = [left, 'B!'] as ScoutCodeString[];
    const layout = v9Layout(hidden);
    const marks = new Map([['0:M#', 1], ['0:M!', 2], ['1:M-', 1], ['2:M/', 3], ['0:M=', 1]].filter(([key]) => !String(key).endsWith(left)) as [string, number][]);
    const result = readSheetImage(photo(layout, 'no QR here', marks));
    if (!result.ok) throw new Error(result.reason);
    expect(result.blockColumnAsked).toBe(true);
    const answered = withBlockColumnLeftOut(result, left);
    expect(answered.untracked).toEqual(layout.hidden);
    expect(counts(answered)).toEqual(marks);
  });

  test('with the QR nothing is asked', () => {
    const layout = v9Layout(['M!']);
    const result = readSheetImage(photo(layout, formQrPayload({ layoutVersion: 9, setNumber: null, page: 1, hidden: layout.hidden }), new Map()));
    if (!result.ok) throw new Error(result.reason);
    expect(result.blockColumnAsked).toBe(false);
  });

  const orders: [FormOrder, ScoutCodeString[]][] = [
    [['B', 'R', 'A', 'M'], []],
    [['R', 'A', 'M', 'B'], ['R!', 'B/']],
    [['A', 'B', 'R', 'M'], ['R!', 'R/']],
  ];

  test.each(orders.map(([o, h]) => [o.join(''), h.join(' ') || 'none', o, h] as const))('with the QR: skills in order %s, columns %s left out, every mark in its cell', (_, __, order, hidden) => {
    const layout = v9Layout(hidden, order);
    expect(layout.skills.filter((h) => h.kind === 'player').map((h) => h.skill)).toEqual([...order, 'P']);
    const marks = marksFor(layout);
    const result = readSheetImage(photo(layout, formQrPayload({ layoutVersion: 9, setNumber: null, page: 1, hidden, order }), marks));
    if (!result.ok) throw new Error(result.reason);
    expect(result.page?.order).toEqual(order);
    expect(result.order).toEqual(order);
    expect(counts(result)).toEqual(marks);
  });

  test.each(orders.map(([o, h]) => [o.join(''), h.join(' ') || 'none', o, h] as const))('without the QR: the order %s is asked, and read again with it (columns %s left out)', (_, __, order, hidden) => {
    const layout = v9Layout(hidden, order);
    const marks = marksFor(layout);
    const image = photo(layout, 'no QR here', marks);
    const first = readSheetImage(image);
    if (!first.ok) throw new Error(first.reason);
    expect(first.orderAsked).toBe(true);
    const again = readSheetImage(image, { order });
    if (!again.ok) throw new Error(again.reason);
    expect(again.order).toEqual(order);
    expect(again.untracked).toEqual(layout.hidden);
    expect(counts(again)).toEqual(marks);
  });

  test('with the QR the order is not asked', () => {
    const layout = v9Layout([], ['R', 'B', 'M', 'A']);
    const result = readSheetImage(photo(layout, formQrPayload({ layoutVersion: 9, setNumber: null, page: 1, order: layout.order }), new Map()));
    if (!result.ok) throw new Error(result.reason);
    expect(result.orderAsked).toBe(false);
  });

  test('the default order is not written in the QR, and v9 with all columns and another order is printed', () => {
    expect(formQrPayload({ layoutVersion: 9, setNumber: null, page: 1, hidden: ['A/'], order: ['B', 'M', 'A', 'R'] })).toBe('VR|9|P1|H20');
    expect(formQrPayload({ layoutVersion: 9, setNumber: null, page: 1, order: ['R', 'B', 'M', 'A'] })).toBe('VR|9|P1|ORBMA');
    expect(printableLayout([], ['R', 'B', 'M', 'A']).version).toBe(9);
    expect(printableLayout([]).version).toBe(8);
  });
});
