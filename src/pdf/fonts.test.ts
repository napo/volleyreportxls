import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib';
import { calculateMatchStats } from '../domain';
import { matchFromWorkbook } from '../oracle/workbook';
import { buildTabellino } from '../report';
import { drawableText, embedPdfFonts } from './fonts';
import { renderScoutingFormPdf } from './scouting-form-pdf';
import { renderTabellinoPdf } from './tabellino-pdf';
import { TEST_FONTS } from './test-fonts';

/** The fonts used by a PDF, and whether each one carries its own font file. */
async function fontsIn(bytes: Uint8Array) {
  const doc = await PDFDocument.load(bytes);
  const fonts: { name: string; embedded: boolean }[] = [];
  for (const [, object] of doc.context.enumerateIndirectObjects()) {
    if (!(object instanceof PDFDict) || object.get(PDFName.of('Type')) !== PDFName.of('Font')) continue;
    const subtype = object.get(PDFName.of('Subtype'));
    if (subtype === PDFName.of('CIDFontType2')) continue; // descendant of a Type0 font, checked below
    const name = String(object.get(PDFName.of('BaseFont')));
    if (subtype !== PDFName.of('Type0')) {
      fonts.push({ name, embedded: false }); // e.g. a standard Type1 font
      continue;
    }
    const descendant = object.lookup(PDFName.of('DescendantFonts'), PDFArray).lookup(0, PDFDict);
    const descriptor = descendant.lookup(PDFName.of('FontDescriptor'), PDFDict);
    fonts.push({ name, embedded: descriptor.has(PDFName.of('FontFile2')) });
  }
  return fonts;
}

const match = matchFromWorkbook();

test.each([
  ['tabellino', () => renderTabellinoPdf(buildTabellino(match, calculateMatchStats(match)), { fonts: TEST_FONTS })],
  ['scouting form', () => renderScoutingFormPdf({ sets: [1], fonts: TEST_FONTS })],
])('the %s embeds Roboto and Montserrat and no other font', async (_, render) => {
  const fonts = await fontsIn(await render());
  expect(fonts.map((f) => f.name.replace(/^\/(.*)-\d+$/, '$1')).sort()).toEqual([
    'Montserrat-ExtraBold',
    'Roboto-Bold',
    'Roboto-Regular',
  ]);
  expect(fonts.every((f) => f.embedded)).toBe(true);
});

test('characters missing from the font are replaced, not dropped silently', async () => {
  const doc = await PDFDocument.create();
  const { regular } = await embedPdfFonts(doc, TEST_FONTS);
  expect(drawableText(regular, 'Bertè Łucja')).toBe('Bertè Łucja');
  expect(drawableText(regular, '李娜')).toBe('??');
});
