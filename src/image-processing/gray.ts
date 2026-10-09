// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Grayscale images and sampling: the pipeline works on luminance only. */
import type { RgbaImage } from './synthetic';

export interface GrayImage {
  readonly width: number;
  readonly height: number;
  /** 0 black … 255 white, row-major. */
  readonly data: Uint8Array;
}

/** Luminance (Rec. 601), transparent pixels over white paper. */
export function toGray(image: RgbaImage): GrayImage {
  const { width, height, data } = image;
  const out = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) {
    const lum = 0.299 * data[i]! + 0.587 * data[i + 1]! + 0.114 * data[i + 2]!;
    const alpha = data[i + 3]! / 255;
    out[j] = Math.round(lum * alpha + 255 * (1 - alpha));
  }
  return { width, height, data: out };
}

/** Box-filtered reduction by an integer factor so that the longer side is at most `maxSide`. */
export function downscale(image: GrayImage, maxSide: number): { readonly image: GrayImage; readonly factor: number } {
  const factor = Math.max(1, Math.ceil(Math.max(image.width, image.height) / maxSide));
  if (factor === 1) return { image, factor };
  const width = Math.floor(image.width / factor);
  const height = Math.floor(image.height / factor);
  const out = new Uint8Array(width * height);
  const area = factor * factor;
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let sum = 0;
      for (let dy = 0; dy < factor; dy++) {
        const row = (y * factor + dy) * image.width + x * factor;
        for (let dx = 0; dx < factor; dx++) sum += image.data[row + dx]!;
      }
      out[y * width + x] = Math.round(sum / area);
    }
  }
  return { image: { width, height, data: out }, factor };
}

/** Bilinear sample; outside the image counts as white paper. */
export function sample(image: GrayImage, x: number, y: number): number {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= image.width - 1 || y0 >= image.height - 1) return 255;
  const fx = x - x0;
  const fy = y - y0;
  const i = y0 * image.width + x0;
  const d = image.data;
  const top = d[i]! * (1 - fx) + d[i + 1]! * fx;
  const bottom = d[i + image.width]! * (1 - fx) + d[i + image.width + 1]! * fx;
  return top * (1 - fy) + bottom * fy;
}
