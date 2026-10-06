/**
 * Reading a tally cell: how many touches are marked.
 *
 * Scouts mark quickly: a stroke often lands beside its bubble, crosses two
 * bubbles or spills over the cell border. So a cell is read in two ways and
 * the two are compared:
 * - strokes: ink blobs inside the cell (one stroke = one touch);
 * - bubbles: bubbles with ink inside their circle.
 * Small blobs on the cell edge are tails of strokes from the next cell and are
 * not counted. When the two readings disagree, or the "+" bubble is inked,
 * the cell is uncertain and the user is asked to check it.
 */

import type { TallyCell } from '../pdf/layout';
import type { GrayImage } from './gray';
import type { Homography } from './homography';
import { INK_LEVEL, inkInCircle, paperLevel, warpRect } from './sheet';

/** Resolution of the cell crop. */
const PX_PER_MM = 8;
/** Smallest blob counted as a stroke, in mm² (dots of dust and jpeg noise are smaller). */
const MIN_STROKE_MM2 = 0.3;
/** A blob touching the cell edge and smaller than this (mm²) is the tail of a stroke in the next cell. */
const SPILL_MM2 = 0.6;
/** Ink share inside a bubble circle that counts as marked. */
export const BUBBLE_MARKED = 0.06;

export interface CellReading {
  readonly strokes: number;
  /** Bubbles with ink, by position (1-based). */
  readonly markedBubbles: readonly number[];
  readonly overflow: boolean;
  /** Best estimate of the touches. */
  readonly count: number;
  readonly uncertain: boolean;
}

function inkBlobs(mask: Uint8Array, width: number, height: number, minArea: number) {
  const seen = new Uint8Array(mask.length);
  const stack: number[] = [];
  const result: { area: number; touchesBorder: boolean }[] = [];
  for (let start = 0; start < mask.length; start++) {
    if (!mask[start] || seen[start]) continue;
    let area = 0;
    let touchesBorder = false;
    stack.push(start);
    seen[start] = 1;
    while (stack.length) {
      const i = stack.pop()!;
      const x = i % width;
      const y = (i - x) / width;
      area++;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) touchesBorder = true;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const j = ny * width + nx;
        if (mask[j] && !seen[j]) {
          seen[j] = 1;
          stack.push(j);
        }
      }
    }
    if (area >= minArea) result.push({ area, touchesBorder });
  }
  return result;
}

export function readCell(gray: GrayImage, homography: Homography, cell: TallyCell): CellReading {
  const paper = paperLevel(gray, homography, cell.outer);
  // The cell without its printed border.
  const inset = 0.25;
  const area = { x: cell.outer.x + inset, y: cell.outer.y + inset, width: cell.outer.width - 2 * inset, height: cell.outer.height - 2 * inset };
  const crop = warpRect(gray, homography, area, PX_PER_MM);
  const mask = new Uint8Array(crop.width * crop.height);
  // The "+" bubble is left out of the strokes: it is checked on its own.
  const o = cell.overflow;
  const ox = (o.x + o.width / 2 - area.x) * PX_PER_MM;
  const oy = (o.y + o.height / 2 - area.y) * PX_PER_MM;
  const or = (o.width / 2) * PX_PER_MM;
  for (let i = 0; i < mask.length; i++) {
    const x = i % crop.width;
    const y = (i - x) / crop.width;
    const inOverflow = (x + 0.5 - ox) ** 2 + (y + 0.5 - oy) ** 2 <= or * or;
    mask[i] = !inOverflow && crop.data[i * 4]! < paper * INK_LEVEL ? 1 : 0;
  }
  const blobs = inkBlobs(mask, crop.width, crop.height, MIN_STROKE_MM2 * PX_PER_MM * PX_PER_MM);

  const markedBubbles = cell.bubbles.filter((b) => inkInCircle(gray, homography, b, paper, 1) >= BUBBLE_MARKED).map((b) => b.number);
  const overflow = inkInCircle(gray, homography, cell.overflow, paper, 1) >= BUBBLE_MARKED;
  const spill = SPILL_MM2 * PX_PER_MM * PX_PER_MM;
  const strokes = blobs.filter((b) => !(b.touchesBorder && b.area < spill)).length;
  const count = Math.max(strokes, markedBubbles.length);
  const uncertain = strokes !== markedBubbles.length || overflow;
  return { strokes, markedBubbles, overflow, count, uncertain };
}
