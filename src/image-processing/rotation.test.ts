import { CURRENT_FORM_LAYOUT as layout } from '../pdf/layout';
import { formQrPayload } from '../pdf/scouting-form';
import { isLocated, locateSheet } from './sheet';
import { type RgbaImage, renderSyntheticForm } from './synthetic';

const PX_PER_MM = 6;
const payload = formQrPayload({ layoutVersion: layout.version, setNumber: null, page: 1 });

/** A quarter turn clockwise. */
function turn(image: RgbaImage): RgbaImage {
  const width = image.height;
  const height = image.width;
  const data = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < image.height; y++) {
    for (let x = 0; x < image.width; x++) {
      const from = (y * image.width + x) * 4;
      data.set(image.data.subarray(from, from + 4), (x * width + (image.height - 1 - y)) * 4);
    }
  }
  return { width, height, data };
}

/** The sheet on a grey background, as in a photo. */
function onTable(image: RgbaImage, margin = 100): RgbaImage {
  const width = image.width + 2 * margin;
  const height = image.height + 2 * margin;
  const data = new Uint8ClampedArray(width * height * 4).fill(120);
  for (let y = 0; y < image.height; y++) data.set(image.data.subarray(y * image.width * 4, (y + 1) * image.width * 4), ((y + margin) * width + margin) * 4);
  return { width, height, data };
}

test.each([0, 1, 2, 3])('a sheet turned by %i quarter turns (phone held upright) is located and its QR read', (turns) => {
  let image = renderSyntheticForm(layout, payload, PX_PER_MM);
  for (let k = 0; k < turns; k++) image = turn(image);
  const located = locateSheet(onTable(image));
  if (!isLocated(located)) throw new Error(`not located: ${JSON.stringify(located)}`);
  expect(located.markers).toHaveLength(6);
  expect(located.fitError).toBeLessThan(0.5);
  expect(located.page?.layoutVersion).toBe(layout.version);
});

test('markers that do not fit the layout are a failure, not a misread sheet', () => {
  // One marker printed 30 mm away from where the layout puts it.
  const moved = { ...layout, markers: layout.markers.map((m, i) => (i === 0 ? { ...m, x: m.x + 30, y: m.y + 30 } : m)) };
  const located = locateSheet(onTable(renderSyntheticForm(moved, payload, PX_PER_MM)));
  expect(located).toEqual({ reason: 'fit', found: 6 });
});
