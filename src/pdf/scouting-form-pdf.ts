// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * PDF of the scouting form: a tally sheet, A4 landscape, a single page to
 * print as many times as needed (the set is marked by hand), drawn from the layout so that print and recognition share the same
 * coordinates. It is printed before the match is known: team, opponent and
 * roster are entered in the app after the photo.
 *
 * Markers and QR are pure black on white; bubbles, numbers and guide lines are
 * light grey and thin, so that only pen marks survive the binarisation of a photo.
 */

import { type PDFImage, type PDFPage, PDFDocument, rgb } from 'pdf-lib';
import { WEB_APP_URL } from '../config';
import { SET_NUMBERS, type SetNumber } from '../domain/model';
import { arucoMatrix } from './aruco';
import { type Messages, it } from '../i18n/it';
import { type PdfFontFiles, type PdfFonts, drawableText, embedPdfFonts } from './fonts';
import { type FormLayout, type Rect, type RowKind, CURRENT_FORM_LAYOUT } from './layout';
import { qrMatrix } from './qr';
import { type FormPageId, formQrPayload } from './scouting-form';

const MM = 72 / 25.4;
const BLACK = rgb(0, 0, 0);
const GUIDE = rgb(0.62, 0.62, 0.62);
const LABEL = rgb(0.45, 0.45, 0.45);
const NUMBER = rgb(0.4, 0.4, 0.4);
const BUBBLE = rgb(0.6, 0.6, 0.6);
/**
 * v6: numbers inside the bubbles, lighter than the outline so that the bubble stays easy to see,
 * with the same contrast on white and on the grey bands.
 */
const FAINT_CONTRAST = 0.22;
const faintNumber = (background: number) => rgb(background - FAINT_CONTRAST, background - FAINT_CONTRAST, background - FAINT_CONTRAST);
/** v6: rules between skills, heavier so that each skill reads as a block. */
const SKILL_RULE_V6 = { thickness: 1.6, color: rgb(0.15, 0.15, 0.15) };
const BAND_LEVEL = 0.95;
const BAND = rgb(BAND_LEVEL, BAND_LEVEL, BAND_LEVEL);
const SKILL_RULE = rgb(0.3, 0.3, 0.3);

/** Draws in layout coordinates (mm, top-left origin). */
class Sheet {
  constructor(
    readonly page: PDFPage,
    readonly layout: FormLayout,
    readonly fonts: PdfFonts,
    readonly texts: Messages,
    readonly logo: PDFImage | null,
  ) {}

  image(image: PDFImage, r: Rect) {
    this.page.drawImage(image, { x: r.x * MM, y: this.y(r.y + r.height), width: r.width * MM, height: r.height * MM });
  }

  private y(mmFromTop: number): number {
    return (this.layout.page.height - mmFromTop) * MM;
  }

  fill(r: Rect, color = BLACK) {
    this.page.drawRectangle({ x: r.x * MM, y: this.y(r.y + r.height), width: r.width * MM, height: r.height * MM, color });
  }

  box(r: Rect, thickness = 0.4, color = GUIDE) {
    this.page.drawRectangle({
      x: r.x * MM,
      y: this.y(r.y + r.height),
      width: r.width * MM,
      height: r.height * MM,
      borderColor: color,
      borderWidth: thickness,
    });
  }

  circle(r: Rect, color = BUBBLE) {
    this.page.drawCircle({
      x: (r.x + r.width / 2) * MM,
      y: this.y(r.y + r.height / 2),
      size: (r.width / 2) * MM,
      borderColor: color,
      borderWidth: 0.35,
    });
  }

  vline(x: number, y1: number, y2: number, thickness: number, color = GUIDE) {
    this.page.drawLine({ start: { x: x * MM, y: this.y(y1) }, end: { x: x * MM, y: this.y(y2) }, thickness, color });
  }

  dashed(x: number, y1: number, y2: number) {
    this.page.drawLine({
      start: { x: x * MM, y: this.y(y1) },
      end: { x: x * MM, y: this.y(y2) },
      thickness: 0.4,
      color: GUIDE,
      dashArray: [1.2, 1.6],
    });
  }

  /** Text with its baseline at `baseline` mm from the top. */
  text(
    text: string,
    x: number,
    baseline: number,
    size: number,
    options: { bold?: boolean; heading?: boolean; color?: ReturnType<typeof rgb>; align?: 'left' | 'center'; width?: number } = {},
  ) {
    const font = options.heading ? this.fonts.heading : options.bold ? this.fonts.bold : this.fonts.regular;
    const safe = drawableText(font, text);
    const width = font.widthOfTextAtSize(safe, size) / MM;
    const left = options.align === 'center' ? x + ((options.width ?? 0) - width) / 2 : x;
    this.page.drawText(safe, { x: left * MM, y: this.y(baseline), size, font, color: options.color ?? BLACK });
  }

  matrix(cells: boolean[][], r: Rect) {
    const cell = r.width / cells.length;
    cells.forEach((row, i) =>
      row.forEach((black, j) => {
        // Slight overlap avoids hairline gaps between adjacent modules in some viewers.
        if (black) this.fill({ x: r.x + j * cell, y: r.y + i * cell, width: cell + 0.02, height: cell + 0.02 });
      }),
    );
  }
}

/** Font size (pt) whose capital letters and digits are `mm` high (Roboto cap height ≈ 0.71 em). */
function pointsForCapHeight(mm: number): number {
  return (mm / 0.71) * MM;
}

function drawField(s: Sheet, label: string, { x, y, width }: Rect) {
  const baseline = y + 4;
  s.text(label, x, baseline, 6.5, { color: LABEL });
  const start = x + s.fonts.regular.widthOfTextAtSize(label, 6.5) / MM + 1.5;
  s.page.drawLine({
    start: { x: start * MM, y: (s.layout.page.height - baseline - 0.6) * MM },
    end: { x: (x + width) * MM, y: (s.layout.page.height - baseline - 0.6) * MM },
    thickness: 0.4,
    color: GUIDE,
  });
}

/** A bubble with its number inside, as in the tally cells. */
function numberedBubble(s: Sheet, bubble: Rect, number: number, color = BUBBLE, numberColor = color) {
  s.circle(bubble, color);
  // Digits about half the bubble high, baseline set so they sit in its centre.
  const height = bubble.height * 0.5;
  s.text(String(number), bubble.x, bubble.y + (bubble.height + height) / 2, pointsForCapHeight(height), {
    color: numberColor,
    align: 'center',
    width: bubble.width,
  });
}

function drawHeader(s: Sheet, page: FormPageId) {
  const { title, score, qr, setMarks, fields, compact } = s.layout;
  // Handwritten notes for the paper archive; the app does not read them.
  for (const { field, outer } of fields) drawField(s, s.texts.form[field], outer);
  if (setMarks) {
    s.text(s.texts.form.setLabel, title.x, setMarks.sets[0]!.y + 4.1, 13, { heading: true });
    for (const bubble of setMarks.sets) numberedBubble(s, bubble, bubble.number);
    s.circle(setMarks.extra);
    s.text(s.texts.form.extra, setMarks.extra.x + setMarks.extra.width + 1.5, setMarks.extra.y + 2.9, 7, { bold: true });
    if (!compact) s.text(s.texts.form.instruction, title.x, title.y + 21, 6.5, { color: LABEL });
  } else {
    s.text(s.texts.form.set(page.setNumber ?? 1), title.x, title.y + 8, 22, { heading: true });
    s.text(s.texts.form.instruction, title.x, title.y + 18.5, 6.5, { color: LABEL });
  }

  if (compact) s.text(s.texts.form.finalScore, fields[2]!.outer.x, score.team[0].y + 4.8, 7, { color: LABEL });
  else s.text(s.texts.form.finalScore, score.team[0].x - 20, score.team[0].y - 1.5, 7, { color: LABEL });
  // Labels end just before their boxes, whatever their length.
  const label = (text: string, box: (typeof score.team)[0]) =>
    s.text(text, box.x - 2 - s.fonts.bold.widthOfTextAtSize(text, 9) / MM, box.y + 6.5, 9, { bold: true });
  label(s.texts.form.us, score.team[0]);
  label(s.texts.form.them, score.opponent[0]);
  for (const digit of [...score.team, ...score.opponent]) s.box(digit, 0.6);

  s.matrix(qrMatrix(formQrPayload(page)), qr);
}

/** Diagonal hatching for areas with nothing to fill. */
function hatch(s: Sheet, r: Rect) {
  const step = 2.5;
  for (let d = -r.height; d < r.width; d += step) {
    const x1 = Math.max(r.x, r.x + d);
    const y1 = r.y + (x1 - (r.x + d));
    const x2 = Math.min(r.x + r.width, r.x + d + r.height);
    const y2 = r.y + (x2 - (r.x + d));
    s.page.drawLine({
      start: { x: x1 * MM, y: (s.layout.page.height - y1) * MM },
      end: { x: x2 * MM, y: (s.layout.page.height - y2) * MM },
      thickness: 0.3,
      color: GUIDE,
    });
  }
}

function drawGrid(s: Sheet) {
  const { numberHeaders, skills, rows } = s.layout;
  const rowsOf = (kind: RowKind) => rows.filter((r) => r.kind === kind);
  const extent = (kind: RowKind) => {
    const section = rowsOf(kind);
    return { top: section[0]!.outer.y, bottom: section[section.length - 1]!.outer.y + section[0]!.outer.height };
  };

  for (const { kind, outer } of numberHeaders) {
    const label = kind === 'libero' ? s.texts.form.libero : s.layout.compact ? s.texts.form.shirtAndName : s.texts.form.shirt;
    s.text(label, outer.x, outer.y + outer.height - 1, kind === 'player' ? 6 : 7, {
      bold: true,
      color: kind === 'player' ? LABEL : BLACK,
      align: 'center',
      width: outer.width,
    });
  }

  // Grey bands and skill rules, by kind of row: v6 draws the rules over the cells.
  const banded: { kind: RowKind; x: number; width: number }[] = [];
  const rules: { x: number; top: number; bottom: number }[] = [];
  for (const kind of ['player', 'libero'] as const) {
    const { bottom } = extent(kind);
    const section = skills.filter((h) => h.kind === kind);
    const small = kind === 'libero';
    section.forEach((skill, i) => {
      // Alternate light bands tell the skills apart at a glance.
      if (i % 2 === 0) {
        s.fill({ x: skill.outer.x, y: skill.outer.y, width: skill.outer.width, height: bottom - skill.outer.y }, BAND);
        banded.push({ kind, x: skill.outer.x, width: skill.outer.width });
      }
      // Narrow blocks (the set faults) drop the letter, then shrink the name to fit.
      const size = small ? 6 : 7.5;
      const fits = (text: string, at: number) => s.fonts.bold.widthOfTextAtSize(text, at) / MM <= skill.outer.width - 0.6;
      const name = s.texts.skills[skill.skill];
      const full = `${name} (${skill.skill})`;
      const label = fits(full, size) ? full : name;
      let labelSize = size;
      while (!fits(label, labelSize) && labelSize > 4.5) labelSize -= 0.25;
      s.text(label, skill.outer.x, skill.outer.y + skill.outer.height - (small ? 0.5 : 0.8), labelSize, {
        bold: true,
        align: 'center',
        width: skill.outer.width,
      });
      for (const { evaluation, outer } of skill.evaluations) {
        s.text(evaluation, outer.x, outer.y + outer.height - (small ? 0.4 : 0.6), small ? 7 : 9, { bold: true, align: 'center', width: outer.width });
      }
      // Heavier rules between skills.
      for (const x of [skill.outer.x, skill.outer.x + skill.outer.width]) {
        if (s.layout.compact) rules.push({ x, top: skill.outer.y, bottom });
        else s.vline(x, skill.outer.y, bottom, 0.9, SKILL_RULE);
      }
    });
  }
  const onBand = (kind: RowKind, x: number) => banded.some((b) => b.kind === kind && x > b.x && x < b.x + b.width);

  for (const row of rows) {
    // The shirt-number box is drawn heavier than the tally cells, so the two are not confused.
    s.box(row.number, 1.1, NUMBER);
    if (row.name) {
      // v6: two digit boxes, then a line for the name.
      for (const digit of row.numberDigits) s.box(digit, 0.4);
      const baseline = row.name.y + row.name.height - 1.2;
      s.page.drawLine({
        start: { x: (row.name.x + 1.5) * MM, y: (s.layout.page.height - baseline) * MM },
        end: { x: (row.name.x + row.name.width - 1.5) * MM, y: (s.layout.page.height - baseline) * MM },
        thickness: 0.4,
        color: GUIDE,
      });
    } else {
      s.dashed(row.numberDigits[1].x, row.number.y + 1, row.number.y + row.number.height - 1);
    }
    for (const area of row.unused) hatch(s, area);
    for (const cell of row.cells) {
      s.box(cell.outer, 0.3);
      const numberColor = s.layout.compact ? faintNumber(onBand(row.kind, cell.outer.x + cell.outer.width / 2) ? BAND_LEVEL : 1) : BUBBLE;
      for (const bubble of cell.bubbles) numberedBubble(s, bubble, bubble.number, BUBBLE, numberColor);
      s.circle(cell.overflow, NUMBER);
      const plus = cell.overflow.height * 0.6;
      s.text('+', cell.overflow.x, cell.overflow.y + (cell.overflow.height + plus) / 2, pointsForCapHeight(plus), {
        bold: true,
        color: NUMBER,
        align: 'center',
        width: cell.overflow.width,
      });
    }
  }
  for (const rule of rules) s.vline(rule.x, rule.top, rule.bottom, SKILL_RULE_V6.thickness, SKILL_RULE_V6.color);
}

function drawLegend(s: Sheet, page: FormPageId) {
  const [left, right] = s.layout.legend;
  s.text(s.texts.form.legend1, left.x, left.y + 4, 7.5, { bold: true });
  s.text(s.texts.form.legend2, left.x, left.y + 8.5, 6.5, {
    color: LABEL,
  });
  // Right: ratings, where to go with the filled-in form, credits; the project logo at the end.
  s.text(s.texts.form.legend3, right.x, right.y + 3.2, 7, { bold: true });
  s.text(s.texts.form.after(WEB_APP_URL.replace(/\/$/, '')), right.x, right.y + 6.4, 6.5);
  s.text(s.texts.form.credits(page.layoutVersion), right.x, right.y + 9.4, 6, { color: LABEL });
  if (s.logo) {
    const height = right.height - 1;
    const width = (s.logo.width / s.logo.height) * height;
    s.image(s.logo, { x: right.x + right.width - width, y: right.y, width, height });
  }
}

function drawMarkers(s: Sheet) {
  for (const marker of s.layout.markers) s.matrix(arucoMatrix(marker.id), marker);
}

export interface ScoutingFormOptions {
  /** Sets to print, one page each, for a layout with the set printed (default: all five). */
  readonly sets?: readonly SetNumber[];
  /** Fonts to embed (the app's bundled Roboto and Montserrat). */
  readonly fonts: PdfFontFiles;
  readonly layout?: FormLayout;
  /** Printed texts in the user's language (Italian by default). */
  readonly texts?: Messages;
  /** PNG of the project logo, printed in the footer. */
  readonly logoPng?: Uint8Array;
}

export async function renderScoutingFormPdf(options: ScoutingFormOptions): Promise<Uint8Array> {
  const layout = options.layout ?? CURRENT_FORM_LAYOUT;
  const doc = await PDFDocument.create();
  const texts = options.texts ?? it;
  doc.setTitle(texts.form.fileName.replace(/\.pdf$/, ''));
  doc.setCreator('VolleyReport');
  doc.setProducer('VolleyReport');
  const fonts = await embedPdfFonts(doc, options.fonts);
  const logo = options.logoPng ? await doc.embedPng(options.logoPng) : null;

  // One sheet for every set when the set is marked by hand.
  const sets: readonly (SetNumber | null)[] = layout.setMarks ? [null] : options.sets ?? SET_NUMBERS;
  for (const setNumber of sets) {
    const page: FormPageId = { layoutVersion: layout.version, setNumber, page: 1 };
    const sheet = new Sheet(doc.addPage([layout.page.width * MM, layout.page.height * MM]), layout, fonts, texts, logo);
    drawMarkers(sheet);
    drawHeader(sheet, page);
    drawGrid(sheet);
    drawLegend(sheet, page);
  }
  return doc.save();
}

