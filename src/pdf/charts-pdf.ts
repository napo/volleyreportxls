/**
 * A4 portrait PDF of the charts: the match header, then section titles and
 * charts one below the other, on as many pages as needed.
 *
 * The charts arrive as PNG images (the app draws them with the same options
 * used on screen), so this module stays a pure function: no DOM.
 */

import { PDFDocument } from 'pdf-lib';
import type { Tabellino } from '../report/tabellino';
import type { Messages } from '../i18n/it';
import { it } from '../i18n/it';
import { type PdfFontFiles, embedPdfFonts } from './fonts';
import { MARGIN, MM, MUTED, NAVY, PAGE, RULE, Writer, drawMatchHeader, footer } from './pdf-page';
import { tabellinoFileName } from './tabellino-pdf';

export interface ChartImage {
  readonly png: Uint8Array;
  /** Size in pixels: only the proportions matter. */
  readonly width: number;
  readonly height: number;
}

export type ChartsPdfBlock =
  | { readonly kind: 'section'; readonly title: string }
  | {
      readonly kind: 'chart';
      readonly title: string;
      readonly note?: string;
      /** Key figures printed under the title, e.g. ["Voto", "7.0"]. */
      readonly figures?: readonly (readonly [string, string])[];
      readonly image: ChartImage;
    };

export interface ChartsPdfOptions {
  readonly fonts: PdfFontFiles;
  readonly logoPng?: Uint8Array;
  /** Title of the document ("Grafici"/"Charts"). */
  readonly title?: string;
  /** Labels in the user's language (Italian by default). */
  readonly texts?: Messages['scoresheet'];
}

const WIDTH = PAGE.width - 2 * MARGIN;
/** Room kept for the footer. */
const BOTTOM = MARGIN + 8 * MM;
/** A section title is not left alone at the bottom of a page. */
const SECTION_MIN_ROOM = 70 * MM;

function chartHeight(block: Extract<ChartsPdfBlock, { kind: 'chart' }>): number {
  const image = (block.image.height / block.image.width) * WIDTH;
  return 6 * MM + (block.figures?.length ? 5 * MM : 0) + (block.note ? 4.5 * MM : 0) + image + 6 * MM;
}

export async function renderChartsPdf(tabellino: Tabellino, blocks: readonly ChartsPdfBlock[], options: ChartsPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.setTitle(`${options.title ?? 'Grafici'} ${tabellino.teamName} - ${tabellino.opponentName} ${tabellino.setsWon.team}-${tabellino.setsWon.opponent}`);
  doc.setProducer('VolleyReport');
  doc.setCreator('VolleyReport');
  const fonts = await embedPdfFonts(doc, options.fonts);
  const logo = options.logoPng ? await doc.embedPng(options.logoPng) : null;

  const writers: Writer[] = [];
  const newPage = () => {
    const w = new Writer(doc.addPage([PAGE.width, PAGE.height]), fonts);
    writers.push(w);
    return w;
  };

  let w = newPage();
  const texts = options.texts ?? it.scoresheet;
  let y = drawMatchHeader(w, tabellino, logo, options.title ?? 'Grafici', texts);

  for (const block of blocks) {
    if (block.kind === 'section') {
      if (y - SECTION_MIN_ROOM < BOTTOM) {
        w = newPage();
        y = PAGE.height - MARGIN;
      }
      y -= 6 * MM;
      w.text(block.title, MARGIN, y, 13, { heading: true, color: NAVY });
      y -= 2 * MM;
      w.line(MARGIN, y, MARGIN + WIDTH, y, 0.6, NAVY);
      y -= 2 * MM;
      continue;
    }

    if (y - chartHeight(block) < BOTTOM) {
      w = newPage();
      y = PAGE.height - MARGIN;
    }
    y -= 6 * MM;
    w.text(block.title, MARGIN, y, 10, { heading: true, color: NAVY });
    if (block.figures?.length) {
      y -= 5 * MM;
      let x = MARGIN;
      for (const [label, value] of block.figures) {
        w.text(`${label} `, x, y, 8, { color: MUTED });
        x += w.fonts.regular.widthOfTextAtSize(`${label} `, 8);
        w.text(value, x, y, 9, { bold: true });
        x += w.fonts.bold.widthOfTextAtSize(value, 9) + 6 * MM;
      }
    }
    if (block.note) {
      y -= 4.5 * MM;
      w.text(block.note, MARGIN, y, 7.5, { color: MUTED });
    }
    const png = await doc.embedPng(block.image.png);
    const height = (block.image.height / block.image.width) * WIDTH;
    y -= 2 * MM + height;
    w.page.drawImage(png, { x: MARGIN, y, width: WIDTH, height });
    y -= 4 * MM;
  }

  writers.forEach((page, i) => {
    page.line(MARGIN, MARGIN + 4 * MM, MARGIN + WIDTH, MARGIN + 4 * MM, 0.3, RULE);
    page.text(footer(texts), MARGIN, MARGIN, 6, { color: MUTED });
    page.text(`${i + 1} / ${writers.length}`, MARGIN, MARGIN, 7, { color: MUTED, align: 'right', width: WIDTH });
  });
  return doc.save();
}

/** "Grafici - Home - Guest 3-1 (…).pdf" */
export function chartsFileName(t: Tabellino, title = 'Grafici'): string {
  return `${title} - ${tabellinoFileName({ ...t, set: null })}`;
}
