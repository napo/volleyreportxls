// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { COMPACT_CELL_INSET } from '../image-processing/read-sheet';
import { CURRENT_FORM_LAYOUT, type Rect, cellCode, formLayout, inset, overlaps } from './layout';

const layout = formLayout(6);
const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.width <= layout.page.width && r.y + r.height <= layout.page.height;
const grow = (r: Rect, by: number): Rect => inset(r, -by);
const cells = layout.rows.flatMap((row) => row.cells);

const capacities = (kind: 'player' | 'libero') =>
  Object.fromEntries(layout.rows.find((r) => r.kind === kind)!.cells.map((c) => [`${c.skill}${c.evaluation}`, c.bubbles.length]));

test('tally sheet v6: A4 landscape, 12 player rows and 2 libero rows', () => {
  expect(layout.version).toBe(6);
  expect(formLayout(6)).toBe(layout);
  expect(() => formLayout(2)).toThrow();
  expect(layout.page).toEqual({ width: 297, height: 210 });
  expect(layout.rows.map((r) => r.kind)).toEqual([...Array(12).fill('player'), 'libero', 'libero']);
  expect(formLayout(5).rows.map((r) => r.kind)).toEqual([...Array(12).fill('player'), 'libero', 'libero']);
});

test('player rows: bubbles per evaluation sized on DataVolley statistics', () => {
  expect(capacities('player')).toEqual({
    'B#': 5, 'B+': 8, 'B!': 5, 'B-': 8, 'B/': 5, 'B=': 5,
    'R#': 8, 'R+': 8, 'R!': 8, 'R-': 8, 'R/': 5, 'R=': 5,
    'A#': 11, 'A+': 8, 'A!': 5, 'A-': 8, 'A/': 5, 'A=': 8,
    'M#': 5, 'M+': 5, 'M!': 5, 'M-': 5, 'M/': 5, 'M=': 5,
    'P=': 5,
  });
  // v5 and earlier: two bubbles for block - and /.
  const v5 = formLayout(5).rows[0]!.cells.filter((c) => c.skill === 'M').map((c) => c.bubbles.length);
  expect(v5).toEqual([5, 5, 5, 2, 2, 5]);
});

test('libero rows: reception and set faults, the two side by side on one line', () => {
  expect(capacities('libero')).toEqual({
    'R#': 8, 'R+': 8, 'R!': 8, 'R-': 8, 'R/': 5, 'R=': 5,
    'P=': 5,
  });
  const [first, second] = [layout.rows[12]!, layout.rows[13]!];
  expect(second.outer.y).toBe(first.outer.y);
  expect(first.outer.height).toBe(layout.rows[0]!.outer.height);
  // Each block: number and name, then reception and set faults; the second one starts under attack.
  for (const row of [first, second]) {
    expect(row.cells[0]!.outer.x).toBeCloseTo(row.number.x + row.number.width, 6);
    expect(row.cells.map((c) => c.skill)).toEqual(['R', 'R', 'R', 'R', 'R', 'R', 'P']);
  }
  expect(second.number.x).toBe(layout.rows[0]!.cells.find((c) => c.skill === 'A')!.outer.x);
  expect(overlaps(first.outer, second.outer)).toBe(false);
  // Hatched: from the end of each block to the next block, or to the end of the grid.
  expect(first.unused).toEqual([{ ...first.unused[0]!, x: first.outer.x + first.outer.width, width: second.number.x - (first.outer.x + first.outer.width) }]);
  expect(second.unused[0]!.x + second.unused[0]!.width).toBeCloseTo(layout.rows[0]!.outer.x + layout.rows[0]!.outer.width, 6);
});

test('v6 bubbles are all the same size, bigger than v5 (3.2 mm against 2.7), and never touch each other', () => {
  expect(new Set(cells.flatMap((c) => [...c.bubbles, ...(c.overflow ? [c.overflow] : [])].map((b) => b.width.toFixed(6))))).toHaveLength(1);
  expect(formLayout(5).rows[0]!.cells[0]!.bubbles[0]!.width).toBeLessThan(2.7);
  for (const cell of cells) {
    const all = [...cell.bubbles, ...(cell.overflow ? [cell.overflow] : [])];
    for (const b of all) {
      expect(b.width).toBeGreaterThanOrEqual(3.2);
      // Clear of the cell border that the reading leaves out (the heavy rules between skills reach into it).
      expect(b.x - cell.outer.x).toBeGreaterThan(COMPACT_CELL_INSET);
      expect(b.y - cell.outer.y).toBeGreaterThan(COMPACT_CELL_INSET);
      expect(cell.outer.x + cell.outer.width - b.x - b.width).toBeGreaterThan(COMPACT_CELL_INSET);
      expect(cell.outer.y + cell.outer.height - b.y - b.height).toBeGreaterThan(COMPACT_CELL_INSET);
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i]!, all[j]!)).toBe(false);
  }
});

test('v5: the grid of v4, plus the set marked by hand in the header', () => {
  const v4 = formLayout(4);
  expect(formLayout(5).rows).toEqual(v4.rows);
  expect(v4.setMarks).toBeUndefined();
});

test('v6 keeps the set marks of v5; markers in the same places, QR in the compact header', () => {
  const v5 = formLayout(5);
  expect(layout.setMarks).toEqual(v5.setMarks);
  expect(layout.markers).toEqual(v5.markers);
  expect(layout.qr.height).toBe(layout.markers[0]!.height);
  const { sets, extra } = layout.setMarks!;
  expect(sets.map((b) => b.number)).toEqual([1, 2, 3, 4, 5]);
  const all = [...sets, extra];
  for (const b of all) {
    expect(b.width).toBeGreaterThanOrEqual(4);
    expect(overlaps(b, layout.title)).toBe(true);
  }
  // At least a millimetre between bubbles, so a mark does not spill into the next one.
  for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlaps(grow(all[i]!, 0.5), grow(all[j]!, 0.5))).toBe(false);
});

test('every element lies inside the page, cells do not overlap', () => {
  const header = [layout.qr, layout.title, ...layout.score.team, ...layout.score.opponent, ...layout.fields.map((f) => f.outer)];
  const all = [...layout.markers, ...header, ...layout.legend, ...layout.rows.map((r) => r.outer)];
  expect(all.filter((r) => !inside(r))).toEqual([]);
  // The compact header stays above the grid and its parts do not overlap.
  const gridTop = Math.min(...layout.skills.map((s) => s.outer.y));
  expect(header.filter((r) => r.y + r.height > gridTop)).toEqual([]);
  for (let i = 0; i < header.length; i++) for (let j = i + 1; j < header.length; j++) {
    if (header[i] !== layout.title && header[j] !== layout.title) expect(overlaps(header[i]!, header[j]!)).toBe(false);
  }
  for (let i = 0; i < cells.length; i++) {
    for (let j = i + 1; j < cells.length; j++) expect(overlaps(cells[i]!.outer, cells[j]!.outer)).toBe(false);
  }
});

test('markers keep their quiet zone free from every other element', () => {
  const others = [
    layout.qr,
    ...layout.setMarks!.sets,
    layout.setMarks!.extra,
    layout.title,
    ...layout.fields.map((f) => f.outer),
    ...layout.score.team,
    ...layout.score.opponent,
    ...layout.legend,
    ...layout.numberHeaders.map((h) => h.outer),
    ...layout.skills.map((s) => s.outer),
    ...layout.rows.map((r) => r.outer),
  ];
  for (const marker of layout.markers) {
    expect(others.filter((r) => overlaps(grow(marker, layout.markerQuietZone), r))).toEqual([]);
  }
});

test('digit boxes for the shirt number (≥ 6 × 6 mm), and a line for the name under them', () => {
  for (const row of layout.rows) {
    for (const box of row.numberDigits) {
      expect(box.width).toBeGreaterThanOrEqual(6);
      expect(box.height).toBeGreaterThanOrEqual(6);
      expect(overlaps(box, row.name!)).toBe(false);
    }
    expect(row.name!.width).toBeGreaterThanOrEqual(18);
    expect(row.name!.height).toBeGreaterThanOrEqual(5);
  }
});

test('v3 (read only) keeps the geometry of the sheets already filled in', () => {
  const v3 = formLayout(3);
  const libero = Object.fromEntries(v3.rows[12]!.cells.map((c) => [`${c.skill}${c.evaluation}`, c.bubbles.length]));
  expect(libero).toEqual({
    'R#': 8, 'R+': 8, 'R!': 8, 'R-': 8, 'R/': 5, 'R=': 5,
    'D#': 5, 'D+': 8, 'D!': 5, 'D-': 5, 'D/': 5, 'D=': 8,
    'P#': 5, 'P+': 8, 'P-': 8, 'P=': 5,
  });
  expect(v3.rows[0]!.cells.map((c) => c.skill)).not.toContain('P');
  // Dig and graded sets are read but not counted.
  expect(v3.rows[12]!.cells.filter((c) => cellCode(c) !== null).map(cellCode)).toEqual(['R#', 'R+', 'R!', 'R-', 'R/', 'R=', 'P=']);
});


test('v7 adopts local captions and every slot counts, keeping old layouts intact', () => {
  const current = formLayout(7);
  expect(current.version).toBe(7);
  expect(current.evaluationCaptions).toBe(true);
  expect(formLayout(6).evaluationCaptions).toBe(false);
  expect(current.markers).toEqual(layout.markers);
  expect(current.rows).toHaveLength(14);
  for (const row of current.rows) {
    for (const cell of row.cells) {
      const old = layout.rows[row.index]!.cells.find((c) => c.skill === cell.skill && c.evaluation === cell.evaluation)!;
      expect(cell.overflow).toBeNull();
      expect(cell.bubbles.length).toBe(old.bubbles.length + 1);
      for (const b of cell.bubbles) {
        expect(b.width).toBeGreaterThanOrEqual(3);
        expect(b.x - cell.outer.x).toBeGreaterThan(COMPACT_CELL_INSET);
        expect(b.y - cell.outer.y).toBeGreaterThan(COMPACT_CELL_INSET);
        expect(cell.outer.x + cell.outer.width - b.x - b.width).toBeGreaterThan(COMPACT_CELL_INSET);
        expect(cell.outer.y + cell.outer.height - b.y - b.height).toBeGreaterThan(COMPACT_CELL_INSET);
      }
      for (let i = 0; i < cell.bubbles.length; i++) for (let j = i + 1; j < cell.bubbles.length; j++)
        expect(overlaps(cell.bubbles[i]!, cell.bubbles[j]!)).toBe(false);
    }
  }
  for (const h of current.skills.filter((s) => s.kind === 'player')) {
    for (const e of h.evaluations) expect(e.outer.y + e.outer.height).toBe(current.rows[0]!.outer.y);
  }
});

test('v8: skills in the order of a rally, evaluations from the most to the least favourable', () => {
  const v8 = CURRENT_FORM_LAYOUT;
  const v7 = formLayout(7);
  expect(v8.version).toBe(8);
  expect(v8.rowBands).toBe(true);
  expect(v7.rowBands).toBe(false);
  expect(v8.markers).toEqual(v7.markers);
  const order = (l: typeof v8, kind: 'player' | 'libero') => l.skills.filter((h) => h.kind === kind).map((h) => `${h.skill}:${h.evaluations.map((e) => e.evaluation).join('')}`);
  expect(order(v8, 'player')).toEqual(['B:#/+!-=', 'M:#+!-/=', 'A:#+!-/=', 'R:#+!-/=', 'P:=']);
  // v7 keeps the order it was printed with.
  expect(order(v7, 'player')).toEqual(['B:#+!-/=', 'R:#+!-/=', 'A:#+!-/=', 'M:#+!-/=', 'P:=']);
  // Same codes and capacities as v7: only the places change.
  const capacity = (l: typeof v8) =>
    Object.fromEntries(l.rows.flatMap((r) => r.cells.map((c) => [`${r.index}:${c.skill}${c.evaluation}`, c.bubbles.length])));
  expect(capacity(v8)).toEqual(capacity(v7));
  for (let i = 0; i < v8.rows.length; i++) for (let j = i + 1; j < v8.rows.length; j++) {
    for (const a of v8.rows[i]!.cells) for (const b of v8.rows[j]!.cells) expect(overlaps(a.outer, b.outer)).toBe(false);
  }
});

test('v8: the second libero block lies under the players reception and set faults', () => {
  const v8 = CURRENT_FORM_LAYOUT;
  const player = v8.rows[0]!;
  const [first, second] = [v8.rows[12]!, v8.rows[13]!];
  for (const cell of second.cells) {
    const above = player.cells.find((c) => c.skill === cell.skill && c.evaluation === cell.evaluation)!;
    expect(cell.outer.x).toBeCloseTo(above.outer.x, 6);
    expect(cell.outer.width).toBeCloseTo(above.outer.width, 6);
  }
  expect(first.outer.x + first.outer.width).toBeLessThan(second.number.x);
  expect(first.unused[0]!.x + first.unused[0]!.width).toBeCloseTo(second.number.x, 6);
  expect(second.unused[0]!.width).toBeCloseTo(0, 6);
});
