// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Everything the review screen needs from one photo of a sheet: which set and
 * layout, the touches counted in every cell (with the uncertain ones), and the
 * crops of what the user has to read or check (shirt numbers, final score,
 * uncertain cells). Pure: runs in a worker, in the main thread or in Node.
 */

import type { ScoutCodeString } from '../domain/codes';
import type { SetNumber } from '../domain/model';
import { type FormLayout, type FormSkill, type Rect, type RowKind, FORM_LAYOUTS, cellCode, formLayout } from '../pdf/layout';
import type { FormPageId } from '../pdf/scouting-form';
import { BUBBLE_MARKED, readCell } from './cells';
import { type GrayImage, sample } from './gray';
import { type Homography, project } from './homography';
import { inkInCircle, inkInRect, isLocated, locateSheet, paperLevel, warpRect } from './sheet';
import type { RgbaImage } from './synthetic';

/** Resolution of the crops shown to the user. */
const CROP_PX_PER_MM = 8;
/** v6: cell border left out of the reading, past the heavy rules between skills (half a 1.6 pt rule is 0.28 mm). */
export const COMPACT_CELL_INSET = 0.5;
/** Ink share of a digit box that means something is written in it. */
const WRITTEN = 0.01;

export interface CellResult {
  /** Null for cells of an old layout the app no longer records. */
  readonly code: ScoutCodeString | null;
  readonly skill: FormSkill;
  readonly evaluation: string;
  readonly count: number;
  readonly uncertain: boolean;
  /** The "+" bubble is marked: the cell is full and the total must be entered. */
  readonly overflow: boolean;
  /** Only for uncertain or full cells. */
  readonly crop: RgbaImage | null;
}

export interface RowResult {
  readonly index: number;
  readonly kind: RowKind;
  /** Something is written in the shirt number boxes. */
  readonly numberWritten: boolean;
  readonly numberCrop: RgbaImage;
  readonly cells: readonly CellResult[];
}

export interface SheetResult {
  readonly ok: true;
  /** From the QR code; null when it could not be read. */
  readonly page: FormPageId | null;
  /** From the QR, or recognised from the printed grid when the QR is unreadable. */
  readonly layoutVersion: number;
  /** Printed in the QR (up to v4) or marked on the sheet (v5 on); null when unknown or ambiguous. */
  readonly setNumber: SetNumber | null;
  /** Set bubbles marked on the sheet (v5 on): empty or several when the set must be chosen. */
  readonly setsMarked: readonly SetNumber[];
  /** "Extra sheet" marked: the sheet continues a set started on another sheet. */
  readonly extraSheet: boolean;
  readonly fitError: number;
  readonly rows: readonly RowResult[];
  readonly score: { readonly written: boolean; readonly team: RgbaImage; readonly opponent: RgbaImage };
}

export interface SheetFailure {
  readonly ok: false;
  /** Too few markers, or markers that do not fit the layout. */
  readonly reason: 'markers' | 'fit';
  readonly markersFound: number;
}

const grow = (r: Rect, by: number): Rect => ({ x: r.x - by, y: r.y - by, width: r.width + 2 * by, height: r.height + 2 * by });
const join = (a: Rect, b: Rect): Rect => {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  return { x, y, width: Math.max(a.x + a.width, b.x + b.width) - x, height: Math.max(a.y + a.height, b.y + b.height) - y };
};

/**
 * Which printed layout is in the photo, when the QR cannot tell: the printed
 * bubble outlines are darker than their centres only where the layout puts them.
 */
export function guessLayout(gray: GrayImage, homography: Homography): FormLayout {
  let best = formLayout(Math.max(...Object.keys(FORM_LAYOUTS).map(Number)));
  let bestScore = -Infinity;
  for (const layout of Object.values(FORM_LAYOUTS)) {
    let ring = 0;
    let centre = 0;
    let n = 0;
    for (const row of layout.rows.slice(0, 3)) {
      for (const cell of row.cells) {
        for (const b of cell.bubbles) {
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          const r = b.width / 2;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * 2 * Math.PI;
            const p = project(homography, { x: cx + r * 0.97 * Math.cos(a), y: cy + r * 0.97 * Math.sin(a) });
            ring += 255 - sample(gray, p.x, p.y);
          }
          const c = project(homography, { x: cx + r * 0.6, y: cy - r * 0.6 });
          centre += (255 - sample(gray, c.x, c.y)) * 8;
          n++;
        }
      }
    }
    const score = (ring - centre) / n;
    if (score > bestScore) {
      bestScore = score;
      best = layout;
    }
  }
  return best;
}

/** A bubble as marked by hand: the share of ink inside its circle, printed outline left out. */
const inkIn = (gray: GrayImage, homography: Homography, bubble: Rect) =>
  inkInCircle(gray, homography, bubble, paperLevel(gray, homography, grow(bubble, 1)), 0.85);

/**
 * The set marked on the sheet: the most inked bubble, unless another one is
 * nearly as inked (two sets marked, or a mark spilling between bubbles).
 */
function readSetMarks(gray: GrayImage, homography: Homography, layout: FormLayout) {
  if (!layout.setMarks) return { setsMarked: [], setNumber: null, extraSheet: false };
  const inks = layout.setMarks.sets.map((b) => ({ set: b.number as SetNumber, ink: inkIn(gray, homography, b) }));
  const marked = inks.filter((b) => b.ink >= BUBBLE_MARKED).sort((a, b) => b.ink - a.ink);
  const clear = marked.length === 1 || (marked.length > 1 && marked[1]!.ink < marked[0]!.ink / 3);
  return {
    setsMarked: marked.map((b) => b.set).sort(),
    setNumber: clear ? marked[0]!.set : null,
    extraSheet: inkIn(gray, homography, layout.setMarks.extra) >= BUBBLE_MARKED,
  };
}

export function readSheetImage(image: RgbaImage): SheetResult | SheetFailure {
  const located = locateSheet(image);
  if (!isLocated(located)) return { ok: false, reason: located.reason, markersFound: located.found };
  const { gray, homography } = located;
  const known = located.page && FORM_LAYOUTS[located.page.layoutVersion];
  const layout = known ?? guessLayout(gray, homography);
  const crop = (r: Rect) => warpRect(gray, homography, r, CROP_PX_PER_MM);
  // The set marks are read only on a layout known from the QR: v4 and v5 share the grid.
  const marks = known ? readSetMarks(gray, homography, layout) : { setsMarked: [], setNumber: null, extraSheet: false };

  const rows = layout.rows.map((row): RowResult => {
    const paper = paperLevel(gray, homography, row.number);
    return {
      index: row.index,
      kind: row.kind,
      numberWritten: row.numberDigits.some((d) => inkInRect(gray, homography, d, paper) >= WRITTEN),
      numberCrop: crop(grow(row.number, 0.5)),
      cells: row.cells.map((cell) => {
        const reading = readCell(gray, homography, cell, layout.compact ? COMPACT_CELL_INSET : undefined);
        return {
          code: cellCode(cell),
          skill: cell.skill,
          evaluation: cell.evaluation,
          count: reading.count,
          uncertain: reading.uncertain,
          overflow: reading.overflow,
          crop: reading.uncertain || reading.overflow ? crop(grow(cell.outer, 1.5)) : null,
        };
      }),
    };
  });

  const [t1, t2] = layout.score.team;
  const [o1, o2] = layout.score.opponent;
  const scorePaper = paperLevel(gray, homography, join(t1, o2));
  const written = [t1, t2, o1, o2].some((d) => inkInRect(gray, homography, d, scorePaper) >= WRITTEN);
  return {
    ok: true,
    page: located.page,
    layoutVersion: layout.version,
    setNumber: located.page?.setNumber ?? marks.setNumber,
    setsMarked: marks.setsMarked,
    extraSheet: marks.extraSheet,
    fitError: located.fitError,
    rows,
    score: { written, team: crop(grow(join(t1, t2), 0.5)), opponent: crop(grow(join(o1, o2), 0.5)) },
  };
}
