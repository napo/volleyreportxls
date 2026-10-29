// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { formLayout } from '../pdf/layout';
import { readSheetImage } from './read-sheet';

// Samples filled in by tools/sample-sheet (seed 123) on the printed PDF, rendered at 100 dpi in grey.
// v7 and v8 have their bubbles in nearly the same places with different meanings.
function load(version: number, withQr: boolean) {
  const png = PNG.sync.read(readFileSync(`raw_data/modulo-v${version}.png`));
  const data = new Uint8ClampedArray(png.data);
  if (!withQr) {
    const px = png.width / 297;
    const qr = formLayout(version).qr;
    for (let y = Math.floor((qr.y - 1) * px); y <= (qr.y + qr.height + 1) * px; y++) {
      for (let x = Math.floor((qr.x - 1) * px); x <= (qr.x + qr.width + 1) * px; x++) data.fill(255, (y * png.width + x) * 4, (y * png.width + x) * 4 + 3);
    }
  }
  return { width: png.width, height: png.height, data };
}

describe.each([7, 8])('filled-in v%i sheet', (version) => {
  const expected = JSON.parse(readFileSync(`raw_data/modulo-v${version}.json`, 'utf8')) as { rows: { row: number; counts: Record<string, number> }[] };
  test.each([true, false])('with the QR readable: %s, every touch is read under its own code', (withQr) => {
    const result = readSheetImage(load(version, withQr));
    if (!result.ok) throw new Error('not read');
    expect(result.layoutVersion).toBe(version);
    const read = result.rows.map((row) => Object.fromEntries(row.cells.filter((c) => c.code && c.count > 0).map((c) => [c.code, c.count])));
    expect(read).toEqual(result.rows.map((row) => expected.rows.find((r) => r.row === row.index + 1)?.counts ?? {}));
    expect(result.rows.flatMap((row) => row.cells).filter((c) => c.uncertain)).toEqual([]);
  });
});
