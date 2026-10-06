/**
 * ArUco marker detection for the scouting form (DICT_4X4_50, ids 0–5).
 *
 * Dark blobs of a plausible size are found by adaptive threshold and
 * connected components; the four outer corners of each blob are its extreme
 * points; the 6×6 grid inside is sampled and matched against the dictionary
 * in the four rotations. Enough for a sheet photographed roughly upright
 * (within about ±30°), which is how a phone frames a page.
 */

import { ARUCO_GRID, DICT_4X4_50 } from '../pdf/aruco';
import { type GrayImage, sample } from './gray';
import { type Point, project, solveHomography } from './homography';

export interface DetectedMarker {
  readonly id: number;
  /** Image corners matching the printed marker's top-left, top-right, bottom-right, bottom-left. */
  readonly corners: readonly [Point, Point, Point, Point];
  /** Wrong bits against the dictionary code (0 or 1). */
  readonly errors: number;
}

/** Dark pixels: darker than their neighbourhood mean (integral image, square window). */
export function adaptiveThreshold(image: GrayImage, window: number, offset = 12): Uint8Array {
  const { width, height, data } = image;
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 0; y < height; y++) {
    let row = 0;
    for (let x = 0; x < width; x++) {
      row += data[y * width + x]!;
      integral[(y + 1) * (width + 1) + x + 1] = integral[y * (width + 1) + x + 1]! + row;
    }
  }
  const half = Math.max(1, Math.floor(window / 2));
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height, y + half + 1);
    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width, x + half + 1);
      const sum =
        integral[y1 * (width + 1) + x1]! - integral[y0 * (width + 1) + x1]! - integral[y1 * (width + 1) + x0]! + integral[y0 * (width + 1) + x0]!;
      const mean = sum / ((x1 - x0) * (y1 - y0));
      const v = data[y * width + x]!;
      out[y * width + x] = v < mean - offset && v < 160 ? 1 : 0;
    }
  }
  return out;
}

interface Blob {
  area: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  /** Extreme points: min(x+y), max(x−y), max(x+y), min(x−y). */
  tl: Point;
  tr: Point;
  br: Point;
  bl: Point;
}

/** 8-connected components of the dark pixels, with bounding box and extreme points. */
function blobs(mask: Uint8Array, width: number, height: number, minArea: number): Blob[] {
  const label = new Int32Array(width * height);
  const stack = new Int32Array(width * height);
  const found: Blob[] = [];
  let next = 1;
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || label[start]) continue;
    const b: Blob = { area: 0, minX: width, maxX: 0, minY: height, maxY: 0, tl: { x: 0, y: 0 }, tr: { x: 0, y: 0 }, br: { x: 0, y: 0 }, bl: { x: 0, y: 0 } };
    let sMin = Infinity;
    let sMax = -Infinity;
    let dMin = Infinity;
    let dMax = -Infinity;
    let top = 0;
    stack[top++] = start;
    label[start] = next;
    while (top > 0) {
      const i = stack[--top]!;
      const x = i % width;
      const y = (i - x) / width;
      b.area++;
      if (x < b.minX) b.minX = x;
      if (x > b.maxX) b.maxX = x;
      if (y < b.minY) b.minY = y;
      if (y > b.maxY) b.maxY = y;
      const s = x + y;
      const d = x - y;
      if (s < sMin) (sMin = s), (b.tl = { x, y });
      if (s > sMax) (sMax = s), (b.br = { x, y });
      if (d > dMax) (dMax = d), (b.tr = { x, y });
      if (d < dMin) (dMin = d), (b.bl = { x, y });
      for (let dy = -1; dy <= 1; dy++) {
        const ny = y + dy;
        if (ny < 0 || ny >= height) continue;
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx;
          if (nx < 0 || nx >= width) continue;
          const j = ny * width + nx;
          if (mask[j] && !label[j]) {
            label[j] = next;
            stack[top++] = j;
          }
        }
      }
    }
    next++;
    if (b.area >= minArea) found.push(b);
  }
  return found;
}

const rotate = (m: boolean[][]): boolean[][] => m.map((_, r) => m.map((_, c) => m[m.length - 1 - c]![r]!));

function codeOf(m: boolean[][]): number {
  let code = 0;
  for (let r = 1; r < ARUCO_GRID - 1; r++) for (let c = 1; c < ARUCO_GRID - 1; c++) code = (code << 1) | (m[r]![c] ? 0 : 1);
  return code;
}

const popcount = (n: number) => {
  let c = 0;
  for (let v = n; v; v &= v - 1) c++;
  return c;
};

/** Reads the 6×6 grid inside a quad; null when it is not one of the wanted markers. */
function decode(image: GrayImage, quad: readonly [Point, Point, Point, Point], ids: readonly number[]): DetectedMarker | null {
  const n = ARUCO_GRID;
  const h = solveHomography(
    [{ x: 0, y: 0 }, { x: n, y: 0 }, { x: n, y: n }, { x: 0, y: n }],
    quad,
  );
  if (!h) return null;
  // Mean of a 3×3 patch around every cell centre.
  const values = Array.from({ length: n }, (_, r) =>
    Array.from({ length: n }, (_, c) => {
      let sum = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const p = project(h, { x: c + 0.5 + dx * 0.18, y: r + 0.5 + dy * 0.18 });
        sum += sample(image, p.x, p.y);
      }
      return sum / 9;
    }),
  );
  const flat = values.flat();
  const lo = Math.min(...flat);
  const hi = Math.max(...flat);
  if (hi - lo < 40) return null;
  const mid = (lo + hi) / 2;
  let matrix = values.map((row) => row.map((v) => v < mid));
  const border = matrix.flatMap((row, r) => row.filter((_, c) => r === 0 || c === 0 || r === n - 1 || c === n - 1));
  if (border.filter(Boolean).length < border.length - 1) return null;

  let best: DetectedMarker | null = null;
  for (let k = 0; k < 4; k++) {
    const code = codeOf(matrix);
    for (const id of ids) {
      const errors = popcount(code ^ DICT_4X4_50[id]!);
      if (errors <= 1 && (!best || errors < best.errors)) {
        // After k clockwise turns of the image grid, printed corner i sits at image corner (i + k) % 4.
        const corners = [0, 1, 2, 3].map((i) => quad[(i + k) % 4]!) as unknown as DetectedMarker['corners'];
        best = { id, corners, errors };
      }
    }
    matrix = rotate(matrix);
  }
  return best;
}

/**
 * Markers with the given ids, at most one per id (the one with fewest errors,
 * then the largest). `expectedSide` is the rough marker side in pixels.
 */
export function detectMarkers(image: GrayImage, ids: readonly number[], expectedSide: number): DetectedMarker[] {
  const window = Math.max(15, Math.round(expectedSide * 2.5)) | 1;
  const mask = adaptiveThreshold(image, window);
  const minSide = expectedSide * 0.4;
  const maxSide = expectedSide * 2.5;
  const candidates = blobs(mask, image.width, image.height, minSide * minSide * 0.3).filter((b) => {
    const w = b.maxX - b.minX + 1;
    const h = b.maxY - b.minY + 1;
    return w >= minSide && h >= minSide && w <= maxSide && h <= maxSide && w / h > 0.5 && w / h < 2 && b.area / (w * h) > 0.3;
  });
  const byId = new Map<number, { marker: DetectedMarker; area: number }>();
  for (const b of candidates) {
    // Extreme pixels are pixel centres: push them half a pixel outwards.
    const quad: [Point, Point, Point, Point] = [
      { x: b.tl.x, y: b.tl.y },
      { x: b.tr.x + 1, y: b.tr.y },
      { x: b.br.x + 1, y: b.br.y + 1 },
      { x: b.bl.x, y: b.bl.y + 1 },
    ];
    const marker = decode(image, quad, ids);
    if (!marker) continue;
    const previous = byId.get(marker.id);
    if (!previous || marker.errors < previous.marker.errors || (marker.errors === previous.marker.errors && b.area > previous.area)) {
      byId.set(marker.id, { marker, area: b.area });
    }
  }
  return [...byId.values()].map((v) => v.marker).sort((a, b) => a.id - b.id);
}
