// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Pieces shared by the app's A4 PDFs (tabellino, charts): units, colours,
 * a small text/line writer and the match header.
 */

import { type PDFImage, type PDFPage, rgb } from 'pdf-lib';
import { WEB_APP_URL } from '../config';
import type { Messages } from '../i18n/it';
import { formatDate } from '../report/format';
import type { Tabellino } from '../report/tabellino';
import { type PdfFonts, drawableText } from './fonts';

export const MM = 72 / 25.4;
export const PAGE = { width: 210 * MM, height: 297 * MM };
export const MARGIN = 10 * MM;
export const ROW = 4.6 * MM;
// Colours of the VolleyReportXLS logo (see src/ui/theme.css); legible in greyscale too.
export const TEXT = rgb(0.22, 0.22, 0.22);
export const NAVY = rgb(6 / 255, 40 / 255, 69 / 255);
export const RULE = rgb(0.72, 0.76, 0.8);
export const SHADE = rgb(227 / 255, 241 / 255, 246 / 255);
export const MUTED = rgb(0.49, 0.49, 0.49);

export type Align = 'left' | 'center' | 'right';

export class Writer {
  constructor(
    readonly page: PDFPage,
    readonly fonts: PdfFonts,
  ) {}

  text(
    text: string,
    x: number,
    y: number,
    size: number,
    options: { bold?: boolean; heading?: boolean; align?: Align; width?: number; color?: ReturnType<typeof rgb> } = {},
  ) {
    const font = options.heading ? this.fonts.heading : options.bold ? this.fonts.bold : this.fonts.regular;
    const safe = drawableText(font, text);
    const width = font.widthOfTextAtSize(safe, size);
    const box = options.width ?? 0;
    const left = options.align === 'right' ? x + box - width : options.align === 'center' ? x + (box - width) / 2 : x;
    this.page.drawText(safe, { x: left, y, size, font, color: options.color ?? TEXT });
  }

  line(x1: number, y1: number, x2: number, y2: number, thickness = 0.5, color = RULE) {
    this.page.drawLine({ start: { x: x1, y: y1 }, end: { x: x2, y: y2 }, thickness, color });
  }

  rect(x: number, y: number, width: number, height: number, fill = SHADE) {
    this.page.drawRectangle({ x, y, width, height, color: fill });
  }
}

/**
 * Logo, title, competition, venue and date on the left; the result box (sets
 * won and set scores, the shown set shaded) on the right. Returns the y below.
 */
export function drawMatchHeader(w: Writer, t: Tabellino, logo: PDFImage | null, title: string, texts: Messages['scoresheet']): number {
  let y = PAGE.height - MARGIN;
  const date = formatDate(t.date);
  let left = MARGIN;
  if (logo) {
    const height = 14 * MM;
    const width = (logo.width / logo.height) * height;
    w.page.drawImage(logo, { x: MARGIN, y: y - height, width, height });
    left += width + 3 * MM;
  }
  w.text(title, left, y - 6 * MM, 16, { heading: true, color: NAVY });
  w.text([t.competition, t.venue, date].filter(Boolean).join('  ·  '), left, y - 11 * MM, 9, { color: MUTED });

  // Result box: teams with sets won, then the final score of each set.
  const boxX = PAGE.width - MARGIN - 95 * MM;
  const teams: [string, number, (s: Tabellino['setScores'][number]) => number][] = [
    [t.teamName, t.setsWon.team, (s) => s.score.team],
    [t.opponentName, t.setsWon.opponent, (s) => s.score.opponent],
  ];
  w.rect(boxX, y - 5 * MM, 95 * MM, 5 * MM);
  w.text(texts.team, boxX + 1.5 * MM, y - 3.6 * MM, 7, { bold: true });
  w.text(texts.set, boxX + 52 * MM, y - 3.6 * MM, 7, { bold: true, align: 'center', width: 8 * MM });
  // A one-set scoresheet shades its set in the result box.
  const shown = t.setScores.findIndex((s) => s.number === t.set);
  if (shown >= 0) w.rect(boxX + (61 + shown * 6.8) * MM, y - 15.5 * MM, 6.8 * MM, 15.5 * MM);
  t.setScores.forEach((s, i) =>
    w.text(String(s.number), boxX + (61 + i * 6.8) * MM, y - 3.6 * MM, 7, { bold: true, align: 'center', width: 6.8 * MM }),
  );
  teams.forEach(([name, sets, score], i) => {
    const rowY = y - (10 + i * 5.5) * MM;
    w.text(name, boxX + 1.5 * MM, rowY, 9, { bold: i === 0 });
    w.text(String(sets), boxX + 52 * MM, rowY, 10, { bold: true, align: 'center', width: 8 * MM });
    t.setScores.forEach((s, j) => w.text(String(score(s)), boxX + (61 + j * 6.8) * MM, rowY, 9, { align: 'center', width: 6.8 * MM }));
  });
  w.line(boxX, y - 17 * MM, boxX + 95 * MM, y - 17 * MM, 0.4);
  return y - 22 * MM;
}

/** Credits line at the bottom of every page. */
export const footer = (texts: Messages['scoresheet']) => texts.footer(WEB_APP_URL.replace(/\/$/, ''));
