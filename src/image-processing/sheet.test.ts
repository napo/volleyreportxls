import { existsSync, readFileSync } from 'node:fs';
import { PNG } from 'pngjs';
import { formLayout } from '../pdf/layout';
import { readCell } from './cells';
import { guessLayout, readSheetImage } from './read-sheet';
import { isLocated, locateSheet } from './sheet';

// Sheets filled in by hand on layout v3 (raw_data/, not shipped with the app).
const sample = (n: number) => `raw_data/${n}.png`;
const available = [1, 2, 3].every((n) => existsSync(sample(n)));

function read(n: number) {
  const png = PNG.sync.read(readFileSync(sample(n)));
  const located = locateSheet({ width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) });
  if (!isLocated(located)) throw new Error(`sheet ${n} not located`);
  const layout = formLayout(located.page!.layoutVersion);
  const cell = (row: number, code: string) => {
    const found = layout.rows[row]!.cells.find((c) => `${c.skill}${c.evaluation}` === code)!;
    return readCell(located.gray, located.homography, found);
  };
  return { located, layout, cell };
}

describe.runIf(available)('hand-filled v3 sheets', () => {
  test('markers, fit and QR: layout and set of every sheet', () => {
    for (const n of [1, 2, 3]) {
      const { located } = read(n);
      expect(located.markers).toHaveLength(6);
      expect(located.fitError).toBeLessThan(0.3);
      expect(located.page).toEqual({ layoutVersion: 3, setNumber: n, page: 1 });
    }
  });

  test('set 3, checked by eye: crosses (X) count as one touch, rows without marks read nothing', () => {
    const png = PNG.sync.read(readFileSync(sample(3)));
    const result = readSheetImage({ width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) });
    if (!result.ok) throw new Error('not read');
    const marked = result.rows.map((row) =>
      row.cells.filter((c) => c.count > 0 || c.uncertain).map((c) => `${c.skill}${c.evaluation}=${c.count}${c.uncertain ? '?' : ''}`),
    );
    expect(marked).toEqual([
      ['B-=3', 'R#=3', 'R==1'],
      ['B-=3', 'R+=1', 'R!=1', 'R==2'],
      [],
      ['B+=2', 'B-=2', 'B==3', 'A#=2', 'M==1'],
      [],
      [],
      ['B+=2', 'B!=1', 'B-=2', 'B==1'],
      [],
      [],
      ['B+=3', 'A+=1', 'A!=1'],
      [],
      ['B#=5', 'B!=1', 'A#=1', 'A+=1', 'A!=1', 'M#=1'],
      ['R#=2', 'R+=1'],
      ['R!=2'],
    ]);
  });

  test('counts checked by eye on set 1', () => {
    const { cell } = read(1);
    expect([cell(0, 'B#'), cell(0, 'B+'), cell(0, 'A+'), cell(0, 'R='), cell(6, 'B-')].map((c) => c.count)).toEqual([1, 3, 6, 2, 5]);
    expect(cell(0, 'B+').uncertain).toBe(false);
    expect(cell(3, 'A#').count).toBe(0);
  });

  test('whole-sheet reading: written shirt numbers and score, layout recognised without the QR', () => {
    const png = PNG.sync.read(readFileSync(sample(1)));
    const image = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
    const result = readSheetImage(image);
    if (!result.ok) throw new Error('not read');
    expect(result.layoutVersion).toBe(3);
    expect(result.rows.map((r) => r.numberWritten)).toEqual(Array(14).fill(true));
    expect(result.score.written).toBe(true);
    expect(result.rows[0]!.numberCrop.width).toBeGreaterThan(60);
    // Crops only where the user has to look.
    expect(result.rows.flatMap((r) => r.cells).filter((c) => c.crop).every((c) => c.uncertain || c.overflow)).toBe(true);
    const { located } = read(1);
    expect(guessLayout(located.gray, located.homography).version).toBe(3);
  });
});
