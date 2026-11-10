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
import { type FormLayout, type FormSkill, type Rect, type RowKind, CURRENT_FORM_LAYOUT, FORM_LAYOUTS, DEFAULT_FORM_ORDER, type FormOrder, OPTIONAL_FORM_CODES, allV9Layouts, cellCode, formLayout, maskHidden, v9Layout } from '../pdf/layout';
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
  /** v9: the columns left out of the printed form: not recorded in this set. */
  readonly untracked: readonly ScoutCodeString[];
  /** v9: the order of serve, block, attack and reception on the printed form. */
  readonly order: FormOrder;
  /**
   * v9 without the QR, one of the two block columns "!" and "/" left out: the
   * grid is the same either way, so the user is asked which (blockColumn).
   */
  readonly blockColumnAsked: boolean;
  /**
   * v8 or v9 without the QR: the order of the skills cannot be told from the
   * bubbles, so the user is asked, and the photo read again with that order.
   */
  readonly orderAsked: boolean;
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

/** Paper inside the bubbles of a row (median of their centres, so a few pen marks do not count). */
function rowPaper(gray: GrayImage, homography: Homography, row: FormLayout['rows'][number]): number {
  const values = row.cells.flatMap((cell) =>
    cell.bubbles.map((b) => {
      const p = project(homography, { x: b.x + b.width / 2, y: b.y + b.height / 2 });
      return sample(gray, p.x, p.y);
    }),
  );
  values.sort((a, b) => a - b);
  return values[Math.floor(values.length / 2)] ?? 255;
}

/** v8 prints every other player row on a light grey band: the second row is darker than the first and the third. */
function looksBanded(gray: GrayImage, homography: Homography, layout: FormLayout): boolean {
  const [first, second, third] = layout.rows.map((row) => rowPaper(gray, homography, row));
  return second! < Math.min(first!, third!) * 0.97;
}

/**
 * Which printed layout is in the photo, when the QR cannot tell: the printed
 * bubble outlines are darker than their centres only where the layout puts them.
 * The median over the bubbles of the first rows leaves out the ones filled in
 * by hand (dark centre and outline alike). v7 and v8 have nearly the same
 * bubbles with different meanings: only a layout whose grey row bands (v8)
 * match the photo is taken, when there is one.
 */
export function guessLayout(gray: GrayImage, homography: Homography, order: FormOrder = DEFAULT_FORM_ORDER): FormLayout {
  // Every printed layout, v9 in all its combinations of columns; the older ones first, so they win a tie.
  const score = (layout: FormLayout) => {
    const contrasts: number[] = [];
    for (const row of layout.rows.slice(0, 3)) {
      for (const cell of row.cells) {
        for (const b of cell.bubbles) {
          const cx = b.x + b.width / 2;
          const cy = b.y + b.height / 2;
          // The outline of the bubble: a circle, or an ellipse (v9).
          const rx = b.width / 2;
          const ry = b.height / 2;
          let ring = 0;
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * 2 * Math.PI;
            const p = project(homography, { x: cx + rx * Math.cos(a), y: cy + ry * Math.sin(a) });
            ring += 255 - sample(gray, p.x, p.y);
          }
          // The centre, well clear of the outline: blank on an empty bubble.
          const c = project(homography, { x: cx, y: cy });
          contrasts.push(ring / 8 - (255 - sample(gray, c.x, c.y)));
        }
      }
    }
    contrasts.sort((a, b) => a - b);
    const mean = contrasts.reduce((n, c) => n + c, 0) / (contrasts.length || 1);
    return { layout, score: contrasts[Math.floor(contrasts.length / 2)]!, mean };
  };
  // Another order (told by the user): only v9 forms with that order, every set of columns.
  const standard = order.join('') === DEFAULT_FORM_ORDER.join('');
  const candidates = standard
    ? [...Object.values(FORM_LAYOUTS), ...allV9Layouts()]
    : Array.from({ length: 1 << OPTIONAL_FORM_CODES.length }, (_, mask) => v9Layout(maskHidden(mask), order));
  const scored = candidates.map(score);
  const banded = looksBanded(gray, homography, CURRENT_FORM_LAYOUT);
  const fitting = scored.filter((s) => s.layout.rowBands === banded);
  // The oldest on a tie, as before: v4 and v5 share the grid, and the set marks are not read without the QR.
  const pool = fitting.length > 0 ? fitting : scored;
  const best = pool.reduce((a, b) => (b.score > a.score ? b : a));
  if (best.layout.version !== 9) return best.layout;
  // v9 forms differ only where their columns were left out: the median hides that, the mean over
  // every bubble does not. Among the v9 forms nearly as good as the best, the one whose outlines
  // are where the bubbles are printed everywhere. The order of the skills cannot be told from the
  // bubbles (they sit on the same grid of columns whatever the order): without the QR, the order of v8.
  return pool
    .filter((s) => s.layout.version === 9 && s.score >= best.score * 0.8)
    .reduce((a, b) => (b.mean > a.mean ? b : a)).layout;
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

/** The photo read again without the QR, with the order of the skills the user gave. */
export interface SheetForcing {
  readonly order?: FormOrder;
}

export function readSheetImage(image: RgbaImage, forcing: SheetForcing = {}): SheetResult | SheetFailure {
  const located = locateSheet(image);
  if (!isLocated(located)) return { ok: false, reason: located.reason, markersFound: located.found };
  const { gray, homography } = located;
  const page = located.page;
  const known = page && (page.layoutVersion === 9 ? formLayout(9, page.hidden ?? [], page.order) : FORM_LAYOUTS[page.layoutVersion]);
  const layout = known ?? guessLayout(gray, homography, forcing.order);
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
    untracked: layout.hidden,
    order: layout.order,
    blockColumnAsked: !page && layout.version === 9 && layout.hidden.includes('M!') !== layout.hidden.includes('M/'),
    orderAsked: !known && layout.rowBands,
    rows,
    score: { written, team: crop(grow(join(t1, t2), 0.5)), opponent: crop(grow(join(o1, o2), 0.5)) },
  };
}

/**
 * The same reading with the other block column left out ("M!" or "M/"): the
 * block cells are where they were, their evaluations shift to those of the
 * columns printed on that form.
 */
export function withBlockColumnLeftOut(result: SheetResult, hidden: 'M!' | 'M/'): SheetResult {
  const current = result.untracked.includes('M!') ? 'M!' : 'M/';
  if (current === hidden || !result.blockColumnAsked) return result;
  const untracked = [...result.untracked.filter((c) => c !== current), hidden];
  const layout = formLayout(9, untracked, result.order);
  const rows = result.rows.map((row) => {
    const printed = layout.rows[row.index]!.cells;
    return { ...row, cells: row.cells.map((cell, i) => (cell.skill === 'M' ? { ...cell, code: cellCode(printed[i]!), evaluation: printed[i]!.evaluation } : cell)) };
  });
  return { ...result, untracked: layout.hidden, rows };
}
