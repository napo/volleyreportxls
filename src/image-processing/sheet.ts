/**
 * From a photo (or scan) of a filled-in scouting form to the ink in each
 * bubble: markers → homography (sheet millimetres → photo pixels) → QR read
 * from its known crop → ink measured inside every bubble and digit box.
 *
 * Pure functions on decoded pixels: they run in the browser, in a worker and
 * in Node (tests) alike.
 */

import jsQR from 'jsqr';
import { CURRENT_FORM_LAYOUT, type FormLayout, type Rect, formLayout } from '../pdf/layout';
import { type FormPageId, parseFormQrPayload } from '../pdf/scouting-form';
import { type GrayImage, downscale, sample, toGray } from './gray';
import { type Homography, type Point, project, solveHomography } from './homography';
import { type DetectedMarker, detectMarkers } from './markers';
import type { RgbaImage } from './synthetic';

/** Longer side of the image used to find the markers (full resolution is kept for reading). */
const DETECTION_SIDE = 1600;

export interface LocatedSheet {
  /** Sheet millimetres → pixels of the original image. */
  readonly homography: Homography;
  readonly markers: readonly DetectedMarker[];
  /** Mean distance between the detected marker corners and the fitted ones, in millimetres. */
  readonly fitError: number;
  /** Null when the QR code could not be read. */
  readonly page: FormPageId | null;
  readonly gray: GrayImage;
}

export type LocateFailure = { readonly reason: 'markers'; readonly found: number };

const cornersOf = (r: Rect): Point[] => [
  { x: r.x, y: r.y },
  { x: r.x + r.width, y: r.y },
  { x: r.x + r.width, y: r.y + r.height },
  { x: r.x, y: r.y + r.height },
];

function fit(markers: readonly DetectedMarker[], layout: FormLayout, factor: number) {
  const from: Point[] = [];
  const to: Point[] = [];
  for (const m of markers) {
    const placed = layout.markers.find((p) => p.id === m.id)!;
    from.push(...cornersOf(placed));
    to.push(...m.corners.map((c) => ({ x: c.x * factor, y: c.y * factor })));
  }
  const homography = solveHomography(from, to);
  if (!homography) return null;
  // Error in mm: pixel distance divided by the local scale (pixels per mm).
  const origin = project(homography, { x: 0, y: 0 });
  const unit = project(homography, { x: 1, y: 0 });
  const scale = Math.hypot(unit.x - origin.x, unit.y - origin.y);
  const distance = (p: Point, i: number) => {
    const q = project(homography, p);
    return Math.hypot(q.x - to[i]!.x, q.y - to[i]!.y);
  };
  const error = from.reduce((s, p, i) => s + distance(p, i), 0) / from.length / scale;
  return { homography, error };
}

/** The image of a sheet rectangle, upright, at `pxPerMm`, as RGBA (for jsQR and for crops shown to the user). */
export function warpRect(gray: GrayImage, homography: Homography, r: Rect, pxPerMm: number): RgbaImage {
  const width = Math.max(1, Math.round(r.width * pxPerMm));
  const height = Math.max(1, Math.round(r.height * pxPerMm));
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const p = project(homography, { x: r.x + (x + 0.5) / pxPerMm, y: r.y + (y + 0.5) / pxPerMm });
      const v = sample(gray, p.x, p.y);
      const i = (y * width + x) * 4;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
  }
  return { width, height, data };
}

function readQr(gray: GrayImage, homography: Homography, layout: FormLayout): FormPageId | null {
  const margin = 4;
  const area = { x: layout.qr.x - margin, y: layout.qr.y - margin, width: layout.qr.width + 2 * margin, height: layout.qr.height + 2 * margin };
  for (const pxPerMm of [8, 6, 11]) {
    const crop = warpRect(gray, homography, area, pxPerMm);
    const found = jsQR(crop.data, crop.width, crop.height, { inversionAttempts: 'dontInvert' });
    const page = found ? parseFormQrPayload(found.data) : null;
    if (page) return page;
  }
  return null;
}

/** Finds the sheet in the image; fails when fewer than three markers are found. */
export function locateSheet(image: RgbaImage): LocatedSheet | LocateFailure {
  const gray = toGray(image);
  const { image: small, factor } = downscale(gray, DETECTION_SIDE);
  // Every printed layout puts the markers in the same places.
  const layout = CURRENT_FORM_LAYOUT;
  const ids = layout.markers.map((m) => m.id);
  const longSide = Math.max(small.width, small.height);
  let markers: DetectedMarker[] = [];
  // The page may fill the photo or only part of it: try a few marker sizes.
  for (const pageShare of [0.95, 0.75, 0.55]) {
    const side = ((layout.markers[0]!.width / layout.page.width) * longSide * pageShare) | 0;
    const found = detectMarkers(small, ids, side);
    if (found.length > markers.length) markers = found;
    if (markers.length === ids.length) break;
  }
  if (markers.length < 3) return { reason: 'markers', found: markers.length };
  const fitted = fit(markers, layout, factor);
  if (!fitted) return { reason: 'markers', found: markers.length };
  return { homography: fitted.homography, markers, fitError: fitted.error, page: readQr(gray, fitted.homography, layout), gray };
}

export const isLocated = (r: LocatedSheet | LocateFailure): r is LocatedSheet => 'homography' in r;

/**
 * Ink is darker than this share of the paper brightness. Pen strokes are near
 * black; the printed grid is grey (40–60%) and the "+" glyph, the darkest
 * printed element in the cells, stays above it.
 */
export const INK_LEVEL = 0.35;

/**
 * Share of dark pixels inside a bubble (0 empty … 1 fully inked). The printed
 * circle and number are light grey and stay below the ink threshold, which
 * follows the paper brightness around the bubble (shadows, uneven light).
 */
export function inkInCircle(gray: GrayImage, homography: Homography, r: Rect, paper: number, shrink = 0.9): number {
  const cx = r.x + r.width / 2;
  const cy = r.y + r.height / 2;
  const radius = (Math.min(r.width, r.height) / 2) * shrink;
  const steps = 9;
  const threshold = paper * INK_LEVEL;
  let dark = 0;
  let total = 0;
  for (let i = -steps; i <= steps; i++) {
    for (let j = -steps; j <= steps; j++) {
      const dx = (i / steps) * radius;
      const dy = (j / steps) * radius;
      if (dx * dx + dy * dy > radius * radius) continue;
      const p = project(homography, { x: cx + dx, y: cy + dy });
      total++;
      if (sample(gray, p.x, p.y) < threshold) dark++;
    }
  }
  return total ? dark / total : 0;
}

/** Ink share of a rectangle (digit boxes), its border excluded. */
export function inkInRect(gray: GrayImage, homography: Homography, r: Rect, paper: number, inset = 0.8): number {
  const steps = 24;
  const threshold = paper * INK_LEVEL;
  let dark = 0;
  let total = 0;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const p = project(homography, { x: r.x + inset + ((r.width - 2 * inset) * i) / steps, y: r.y + inset + ((r.height - 2 * inset) * j) / steps });
      total++;
      if (sample(gray, p.x, p.y) < threshold) dark++;
    }
  }
  return dark / total;
}

/** Paper brightness around a rectangle: a high percentile of its samples (ink and print are the minority). */
export function paperLevel(gray: GrayImage, homography: Homography, r: Rect): number {
  const values: number[] = [];
  const steps = 12;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const p = project(homography, { x: r.x + (r.width * i) / steps, y: r.y + (r.height * j) / steps });
      values.push(sample(gray, p.x, p.y));
    }
  }
  values.sort((a, b) => a - b);
  return Math.max(120, values[Math.floor(values.length * 0.85)]!);
}

export { formLayout };
