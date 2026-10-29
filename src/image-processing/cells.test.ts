// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { TallyCell } from '../pdf/layout';
import type { GrayImage } from './gray';
import type { Homography } from './homography';
import { readCell } from './cells';

const scale = 16;
const homography: Homography = [scale, 0, 0, 0, scale, 0, 0, 0, 1];
const cell: TallyCell = {
  skill: 'M', evaluation: '=', outer: { x: 0, y: 0, width: 6, height: 12 }, overflow: null,
  bubbles: Array.from({ length: 6 }, (_, i) => ({
    number: i + 1, x: 0.5 + (i % 2) * 3, y: 1 + Math.floor(i / 2) * 4, width: 2, height: 2,
  })),
};

/** A displaced separator crossing the outer bubbles, with optional pen marks. */
function scan(side: 'left' | 'right' | null, marked: number[] = []): GrayImage {
  const width = 6 * scale;
  const height = 12 * scale;
  const data = new Uint8Array(width * height).fill(255);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const mmX = x / scale;
    const mmY = y / scale;
    const line = side === 'left' ? 0.75 + 0.2 * mmY / 12 : 5.25 - 0.2 * mmY / 12;
    const rule = side !== null && Math.abs(mmX - line) < 0.18;
    const ink = cell.bubbles.some((b) => marked.includes(b.number) && (mmX - b.x - 1) ** 2 + (mmY - b.y - 1) ** 2 < 0.8 ** 2);
    if (rule || ink) data[y * width + x] = 15;
  }
  return { width, height, data };
}

test.each(['left', 'right'] as const)('a displaced %s rule counts as neither a stroke nor a filled bubble', (side) => {
  expect(readCell(scan(side), homography, cell, 0.5)).toMatchObject({ count: 0, strokes: 0, markedBubbles: [], uncertain: false });
});

test.each([['left', 1], ['right', 2]] as const)('a pen mark next to the %s rule is retained', (side, number) => {
  expect(readCell(scan(side, [number]), homography, cell, 0.5)).toMatchObject({ count: 1, markedBubbles: [number], uncertain: false });
});

test('three vertically aligned pen marks are retained', () => {
  expect(readCell(scan(null, [1, 3, 5]), homography, cell, 0.5)).toMatchObject({ count: 3, markedBubbles: [1, 3, 5], uncertain: false });
});

/** A v8 cell on a grey row band (0.92), with light rules (0.55) on the sides and across, and grey bubble outlines (0.6). */
function scanV8(marked: number[] = []): GrayImage {
  const width = 6 * scale;
  const height = 12 * scale;
  const data = new Uint8Array(width * height).fill(235);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const mmX = x / scale;
    const mmY = y / scale;
    const rule = Math.abs(mmX - 0.75) < 0.25 || Math.abs(mmX - 5.25) < 0.25 || Math.abs(mmY - 0.6) < 0.15;
    const outline = cell.bubbles.some((b) => Math.abs(Math.hypot(mmX - b.x - 1, mmY - b.y - 1) - 1) < 0.07);
    const ink = cell.bubbles.some((b) => marked.includes(b.number) && (mmX - b.x - 1) ** 2 + (mmY - b.y - 1) ** 2 < 0.8 ** 2);
    if (ink) data[y * width + x] = 15;
    else if (rule) data[y * width + x] = 140;
    else if (outline) data[y * width + x] = 153;
  }
  return { width, height, data };
}

test('v8: the row band, the light rules and the bubble outlines are not ink', () => {
  expect(readCell(scanV8(), homography, cell, 0.5)).toMatchObject({ count: 0, strokes: 0, markedBubbles: [], uncertain: false });
  expect(readCell(scanV8([1, 4]), homography, cell, 0.5)).toMatchObject({ count: 2, markedBubbles: [1, 4], uncertain: false });
});
