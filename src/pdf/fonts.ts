/**
 * Fonts embedded in every generated PDF: the app's own typefaces (Roboto for
 * text, Montserrat for titles), subset to the glyphs actually used. Nothing
 * depends on the fonts installed on the reader's device.
 *
 * The font files are passed in as bytes, so the renderers stay pure: the app
 * loads them from its bundled assets, tests read them from disk.
 */

import fontkit from '@pdf-lib/fontkit';
import type { PDFDocument, PDFFont } from 'pdf-lib';

export interface PdfFontFiles {
  /** Roboto Regular */
  readonly regular: Uint8Array;
  /** Roboto Bold */
  readonly bold: Uint8Array;
  /** Montserrat ExtraBold */
  readonly heading: Uint8Array;
}

export interface PdfFonts {
  readonly regular: PDFFont;
  readonly bold: PDFFont;
  readonly heading: PDFFont;
}

export async function embedPdfFonts(doc: PDFDocument, files: PdfFontFiles): Promise<PdfFonts> {
  doc.registerFontkit(fontkit);
  const [regular, bold, heading] = await Promise.all(
    [files.regular, files.bold, files.heading].map((bytes) => doc.embedFont(bytes, { subset: true })),
  );
  return { regular: regular!, bold: bold!, heading: heading! };
}

const supported = new WeakMap<PDFFont, Set<number>>();

/**
 * Replaces the characters a font cannot draw: first with the same letter
 * without diacritics (Ł → L), otherwise with "?".
 */
export function drawableText(font: PDFFont, text: string): string {
  let set = supported.get(font);
  if (!set) {
    set = new Set(font.getCharacterSet());
    supported.set(font, set);
  }
  const has = (s: string) => [...s].every((ch) => set.has(ch.codePointAt(0)!));
  return [...text]
    .map((ch) => {
      if (has(ch)) return ch;
      const plain = ch.normalize('NFD').replace(/\p{M}/gu, '');
      return plain && has(plain) ? plain : '?';
    })
    .join('');
}
