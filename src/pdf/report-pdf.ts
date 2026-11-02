// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A4 portrait PDF of a report (a match or the history of a squad) made of
 * the blocks the user chose: section titles, tables, charts and grids of
 * small charts, one after the other on as many pages as needed. Every page
 * has the name of the analysis and its summary on top, the credits and the
 * page number at the bottom; a last page explains the abbreviations.
 *
 * Pure function of its blocks: charts arrive as PNG images, tables as rows.
 */

import { PDFDocument, type PDFFont } from 'pdf-lib';
import type { Messages } from '../i18n/it';
import { it } from '../i18n/it';
import type { ChartImage } from './charts-pdf';
import { type PdfFontFiles, drawableText, embedPdfFonts } from './fonts';
import { MARGIN, MM, MUTED, NAVY, PAGE, ROW, RULE, Writer, footer } from './pdf-page';
import { type Group, drawTable } from './tabellino-pdf';

export type ReportBlock =
  | { readonly kind: 'section'; readonly title: string }
  | {
      readonly kind: 'table';
      readonly title: string;
      readonly note?: string;
      readonly rows: number;
      /** Draws rows [start, end) under the headings from `top`; returns the y below. */
      readonly draw: (w: Writer, top: number, start: number, end: number) => number;
    }
  | { readonly kind: 'chart'; readonly title: string; readonly note?: string; readonly image: ChartImage }
  /** Small charts side by side, each with its title (one or more images one below the other). */
  | { readonly kind: 'grid'; readonly items: readonly { readonly title: string; readonly images: readonly ChartImage[] }[] };

export interface ReportPdfOptions {
  readonly fonts: PdfFontFiles;
  readonly logoPng?: Uint8Array;
  /** Name of the analysis, on top of every page. */
  readonly title: string;
  /** E.g. "6 partite dal 01/10/26 al 06/10/26". */
  readonly summary: string;
  /** The abbreviations explained on the last page. */
  readonly legend: readonly { readonly term: string; readonly text: string }[];
  readonly legendTitle: string;
  readonly texts?: Messages['scoresheet'];
}

/** A table block: the grouped columns of the tabellino PDF, any kind of row; strong rows are totals. */
export function tableBlock<T>(title: string, groups: readonly Group<T>[], rows: readonly T[], strong: (row: T) => boolean, note?: string): ReportBlock {
  return { kind: 'table', title, ...(note && { note }), rows: rows.length, draw: (w, top, start, end) => drawTable(w, top, groups, rows.slice(start, end), strong) };
}

const WIDTH = PAGE.width - 2 * MARGIN;
const HEADER = 16 * MM;
/** Room kept for the footer. */
const BOTTOM = MARGIN + 8 * MM;
const TOP = PAGE.height - MARGIN - HEADER;
/** A section title is not left alone at the bottom of a page: it needs room for (the start of) what follows. */
const SECTION_MIN_ROOM = 40 * MM;
const GRID_COLUMNS = 2;
const GRID_GAP = 6 * MM;

/** The words of a text in lines no wider than `width`. */
export function wrap(font: PDFFont, text: string, size: number, width: number): string[] {
  const lines: string[] = [];
  let line = '';
  for (const word of drawableText(font, text).split(/\s+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && font.widthOfTextAtSize(next, size) > width) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

const tableHeight = (rows: number) => (2 + rows) * ROW;
const imageHeight = (image: ChartImage, width: number) => (image.height / image.width) * width;

export async function renderReportPdf(blocks: readonly ReportBlock[], options: ReportPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${options.title} - ${options.summary}`);
  doc.setProducer('VolleyReport');
  doc.setCreator('VolleyReport');
  const fonts = await embedPdfFonts(doc, options.fonts);
  const logo = options.logoPng ? await doc.embedPng(options.logoPng) : null;
  const texts = options.texts ?? it.scoresheet;

  const writers: Writer[] = [];
  let w!: Writer;
  let y = 0;
  const newPage = () => {
    w = new Writer(doc.addPage([PAGE.width, PAGE.height]), fonts);
    writers.push(w);
    y = TOP;
  };
  /** A new page unless `height` still fits on this one. */
  const room = (height: number) => {
    if (y - height < BOTTOM) newPage();
  };
  const title = (text: string, size: number) => {
    y -= 6 * MM;
    w.text(text, MARGIN, y, size, { heading: true, color: NAVY });
  };
  const note = (text: string) => {
    for (const line of wrap(fonts.regular, text, 7.5, WIDTH)) {
      y -= 3.8 * MM;
      w.text(line, MARGIN, y, 7.5, { color: MUTED });
    }
  };
  const noteHeight = (text?: string) => (text ? wrap(fonts.regular, text, 7.5, WIDTH).length * 3.8 * MM : 0);

  /** Room taken by the first part of a block, the one that must stay with the section title above it. */
  const firstPart = (block: ReportBlock | undefined): number => {
    const cell = (WIDTH - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;
    switch (block?.kind) {
      case 'chart':
        return 8 * MM + noteHeight(block.note) + imageHeight(block.image, WIDTH);
      case 'table':
        return 8 * MM + noteHeight(block.note) + tableHeight(Math.min(block.rows, 5));
      case 'grid':
        return 7 * MM + Math.max(0, ...block.items.slice(0, GRID_COLUMNS).map((i) => i.images.reduce((h, image) => h + imageHeight(image, cell), 0)));
      default:
        return 0;
    }
  };

  newPage();
  for (const [index, block] of blocks.entries()) {
    switch (block.kind) {
      case 'section':
        room(12 * MM + Math.max(SECTION_MIN_ROOM, Math.min(firstPart(blocks[index + 1]), TOP - BOTTOM - 12 * MM)));
        y -= 2 * MM;
        title(block.title, 13);
        y -= 2 * MM;
        w.line(MARGIN, y, MARGIN + WIDTH, y, 0.6, NAVY);
        y -= 1 * MM;
        break;

      case 'table': {
        // A table longer than a page goes on with its headings on the next one.
        const perPage = Math.floor((TOP - BOTTOM - 12 * MM) / ROW) - 2;
        for (let start = 0; start < block.rows; start += perPage) {
          const end = Math.min(block.rows, start + perPage);
          room(6 * MM + (start === 0 ? noteHeight(block.note) : 0) + 2 * MM + tableHeight(end - start));
          title(block.title, 10);
          if (start === 0 && block.note) note(block.note);
          y = block.draw(w, y - 2 * MM, start, end);
          y -= 2 * MM;
        }
        break;
      }

      case 'chart': {
        const height = imageHeight(block.image, WIDTH);
        room(6 * MM + noteHeight(block.note) + 2 * MM + height);
        title(block.title, 10);
        if (block.note) note(block.note);
        const png = await doc.embedPng(block.image.png);
        y -= 2 * MM + height;
        w.page.drawImage(png, { x: MARGIN, y, width: WIDTH, height });
        y -= 2 * MM;
        break;
      }

      case 'grid': {
        const cell = (WIDTH - (GRID_COLUMNS - 1) * GRID_GAP) / GRID_COLUMNS;
        for (let start = 0; start < block.items.length; start += GRID_COLUMNS) {
          const row = block.items.slice(start, start + GRID_COLUMNS);
          const height = Math.max(...row.map((item) => item.images.reduce((h, image) => h + imageHeight(image, cell), 0)));
          room(7 * MM + height);
          y -= 6 * MM;
          const top = y - 1 * MM;
          for (const [i, item] of row.entries()) {
            const x = MARGIN + i * (cell + GRID_GAP);
            w.text(item.title, x, y, 9.5, { heading: true, color: NAVY });
            let imageTop = top;
            for (const image of item.images) {
              const h = imageHeight(image, cell);
              imageTop -= h;
              w.page.drawImage(await doc.embedPng(image.png), { x, y: imageTop, width: cell, height: h });
            }
          }
          y = top - height - 2 * MM;
        }
        break;
      }
    }
  }

  // The legend on a page of its own (the first one, if nothing came before).
  if (y < TOP) newPage();
  title(options.legendTitle, 13);
  y -= 2 * MM;
  for (const { term, text } of options.legend) {
    const termWidth = 32 * MM;
    const lines = wrap(fonts.regular, text, 8.5, WIDTH - termWidth);
    room(lines.length * 4.4 * MM + 2 * MM);
    y -= 4.4 * MM;
    w.text(term, MARGIN, y, 8.5, { bold: true });
    lines.forEach((line, i) => w.text(line, MARGIN + termWidth, y - i * 4.4 * MM, 8.5));
    y -= (lines.length - 1) * 4.4 * MM + 1.5 * MM;
  }

  // Header and footer of every page.
  for (const [i, page] of writers.entries()) {
    const top = PAGE.height - MARGIN;
    let left = MARGIN;
    if (logo) {
      const height = 10 * MM;
      const width = (logo.width / logo.height) * height;
      page.page.drawImage(logo, { x: MARGIN, y: top - height, width, height });
      left += width + 3 * MM;
    }
    page.text(options.title, left, top - 4.5 * MM, 12, { heading: true, color: NAVY });
    page.text(options.summary, left, top - 9 * MM, 8, { color: MUTED });
    page.line(MARGIN, top - 12 * MM, MARGIN + WIDTH, top - 12 * MM, 0.4, RULE);
    page.line(MARGIN, MARGIN + 4 * MM, MARGIN + WIDTH, MARGIN + 4 * MM, 0.3, RULE);
    page.text(footer(texts), MARGIN, MARGIN, 6, { color: MUTED });
    page.text(`${i + 1} / ${writers.length}`, MARGIN, MARGIN, 7, { color: MUTED, align: 'right', width: WIDTH });
  }
  return doc.save();
}
