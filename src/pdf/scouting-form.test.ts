import { AR } from 'js-aruco2';
import 'js-aruco2/src/dictionaries/aruco_4x4_1000.js';
import jsQR from 'jsqr';
import { PDFDocument } from 'pdf-lib';
import { TEST_FONTS } from './test-fonts';
import { renderSyntheticForm } from '../image-processing/synthetic';
import { ARUCO_DICTIONARY, DICT_4X4_50, arucoMatrix } from './aruco';
import { CURRENT_FORM_LAYOUT as layout, formLayout } from './layout';
import { formQrPayload, parseFormQrPayload } from './scouting-form';
import { renderScoutingFormPdf } from './scouting-form-pdf';

test('QR payload round trip', () => {
  const id = { layoutVersion: 4, setNumber: 2 as const, page: 1 };
  expect(formQrPayload(id)).toBe('VR|4|S2|P1');
  expect(parseFormQrPayload('VR|4|S2|P1')).toEqual(id);
  expect(parseFormQrPayload('something else')).toBeNull();
  expect(parseFormQrPayload('VR|4|S6|P1')).toBeNull();
  // From v5 the set is marked on the sheet, not in the QR.
  expect(formQrPayload({ layoutVersion: 5, setNumber: null, page: 1 })).toBe('VR|5|P1');
  expect(parseFormQrPayload('VR|5|P1')).toEqual({ layoutVersion: 5, setNumber: null, page: 1 });
});

test('the embedded DICT_4X4_50 codes are those of the detector (js-aruco2)', () => {
  const detector = AR.DICTIONARIES[ARUCO_DICTIONARY]!.codeList.slice(0, 50) as number[][];
  expect(DICT_4X4_50).toEqual(detector.map(([hi, lo]) => hi! * 256 + lo!));
});

test('marker matrices: black border, 4×4 data bits from the OpenCV 4×4 dictionary', () => {
  const m = arucoMatrix(0);
  expect(m).toHaveLength(6);
  expect(m[0]!.every(Boolean) && m[5]!.every(Boolean) && m.every((r) => r[0] && r[5])).toBe(true);
  // DICT_4X4_50 id 0 = bytes [181, 50] = 1011 0101 0011 0010 (1 = white).
  expect(m.slice(1, 5).map((r) => r.slice(1, 5).map((black) => (black ? 0 : 1)).join(''))).toEqual(['1011', '0101', '0011', '0010']);
});

test.each([3, 6])('a synthetic scan at %i px/mm is read back: 6 markers in place and the QR payload', (pxPerMm) => {
  const payload = formQrPayload({ layoutVersion: layout.version, setNumber: null, page: 1 });
  const image = renderSyntheticForm(layout, payload, pxPerMm);

  const markers = new AR.Detector({ dictionaryName: ARUCO_DICTIONARY, maxHammingDistance: 0 }).detect(image);
  expect(markers.map((m) => m.id).sort()).toEqual([0, 1, 2, 3, 4, 5]);
  for (const marker of markers) {
    const placed = layout.markers.find((m) => m.id === marker.id)!;
    const cx = marker.corners.reduce((s, c) => s + c.x, 0) / 4 / pxPerMm;
    const cy = marker.corners.reduce((s, c) => s + c.y, 0) / 4 / pxPerMm;
    expect(Math.abs(cx - (placed.x + placed.width / 2))).toBeLessThan(1);
    expect(Math.abs(cy - (placed.y + placed.height / 2))).toBeLessThan(1);
  }
  expect(jsQR(image.data, image.width, image.height)?.data).toBe(payload);
});

test('the PDF has a single A4 landscape page for every set; v4 had one page per set', async () => {
  const pdf = await PDFDocument.load(await renderScoutingFormPdf({ fonts: TEST_FONTS }));
  expect(pdf.getPageCount()).toBe(1);
  const v4 = (sets?: [2]) => renderScoutingFormPdf({ ...(sets && { sets }), fonts: TEST_FONTS, layout: formLayout(4) }).then((b) => PDFDocument.load(b));
  expect((await v4()).getPageCount()).toBe(5);
  expect((await v4([2])).getPageCount()).toBe(1);
  const { width, height } = pdf.getPage(0).getSize();
  expect([Math.round(width), Math.round(height)]).toEqual([842, 595]);
});
