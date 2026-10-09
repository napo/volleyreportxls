// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Synthetic "scans" of the scouting form, drawn straight from the layout:
 * a white page with markers and QR code. Used to test detection and, later,
 * the rectification pipeline without printers, cameras or external tools.
 */

import { arucoMatrix } from '../pdf/aruco';
import type { FormLayout, Rect } from '../pdf/layout';
import { qrMatrix } from '../pdf/qr';

export interface RgbaImage {
  readonly width: number;
  readonly height: number;
  /** RGBA, 4 bytes per pixel, row-major. */
  readonly data: Uint8ClampedArray;
}

function paint(image: RgbaImage, matrix: boolean[][], r: Rect, pxPerMm: number) {
  const cell = (r.width * pxPerMm) / matrix.length;
  const x0 = r.x * pxPerMm;
  const y0 = r.y * pxPerMm;
  for (let py = Math.floor(y0); py < Math.ceil(y0 + r.height * pxPerMm); py++) {
    for (let px = Math.floor(x0); px < Math.ceil(x0 + r.width * pxPerMm); px++) {
      const row = Math.floor((py + 0.5 - y0) / cell);
      const col = Math.floor((px + 0.5 - x0) / cell);
      if (!matrix[row]?.[col]) continue;
      const i = (py * image.width + px) * 4;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = 0;
    }
  }
}

export function renderSyntheticForm(layout: FormLayout, qrPayload: string, pxPerMm: number): RgbaImage {
  const width = Math.round(layout.page.width * pxPerMm);
  const height = Math.round(layout.page.height * pxPerMm);
  const image = { width, height, data: new Uint8ClampedArray(width * height * 4).fill(255) };
  for (const marker of layout.markers) paint(image, arucoMatrix(marker.id), marker, pxPerMm);
  paint(image, qrMatrix(qrPayload), layout.qr, pxPerMm);
  return image;
}
