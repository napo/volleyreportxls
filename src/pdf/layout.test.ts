import { CURRENT_FORM_LAYOUT as layout, type Rect, cellCode, formLayout, inset, overlaps } from './layout';

const inside = (r: Rect) => r.x >= 0 && r.y >= 0 && r.x + r.width <= layout.page.width && r.y + r.height <= layout.page.height;
const grow = (r: Rect, by: number): Rect => inset(r, -by);
const cells = layout.rows.flatMap((row) => row.cells);

const capacities = (kind: 'player' | 'libero') =>
  Object.fromEntries(layout.rows.find((r) => r.kind === kind)!.cells.map((c) => [`${c.skill}${c.evaluation}`, c.bubbles.length]));

test('tally sheet v5: A4 landscape, 12 player rows and 2 libero rows', () => {
  expect(layout.version).toBe(5);
  expect(formLayout(5)).toBe(layout);
  expect(() => formLayout(2)).toThrow();
  expect(layout.page).toEqual({ width: 297, height: 210 });
  expect(layout.rows.map((r) => r.kind)).toEqual([...Array(12).fill('player'), 'libero', 'libero']);
});

test('player rows: bubbles per evaluation sized on DataVolley statistics', () => {
  expect(capacities('player')).toEqual({
    'B#': 5, 'B+': 8, 'B!': 5, 'B-': 8, 'B/': 5, 'B=': 5,
    'R#': 8, 'R+': 8, 'R!': 8, 'R-': 8, 'R/': 5, 'R=': 5,
    'A#': 11, 'A+': 8, 'A!': 5, 'A-': 8, 'A/': 5, 'A=': 8,
    'M#': 5, 'M+': 5, 'M!': 5, 'M-': 2, 'M/': 2, 'M=': 5,
    'P=': 5,
  });
});

test('libero rows: reception and set faults, aligned with the players', () => {
  expect(capacities('libero')).toEqual({
    'R#': 8, 'R+': 8, 'R!': 8, 'R-': 8, 'R/': 5, 'R=': 5,
    'P=': 5,
  });
  const xs = (row: number) => layout.rows[row]!.cells.filter((c) => c.skill === 'R' || c.skill === 'P').map((c) => c.outer.x);
  expect(xs(12)).toEqual(xs(0));
  expect(layout.rows[12]!.unused).toHaveLength(2);
});

test('bubbles are big enough to mark by hand (≥ 2.5 mm) and never touch each other', () => {
  for (const cell of cells) {
    const all = [...cell.bubbles, cell.overflow];
    for (const b of all) {
      expect(b.width).toBeGreaterThanOrEqual(2.5);
      expect(overlaps(b, inset(cell.outer, 0.2))).toBe(true);
    }
    for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) expect(overlaps(all[i]!, all[j]!)).toBe(false);
  }
});

test('v5: the grid of v4, plus the set marked by hand in the header', () => {
  const v4 = formLayout(4);
  expect(layout.rows).toEqual(v4.rows);
  expect(v4.setMarks).toBeUndefined();
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
  const all = [...layout.markers, layout.qr, layout.title, ...layout.score.team, ...layout.score.opponent, ...layout.legend, ...layout.rows.map((r) => r.outer)];
  expect(all.filter((r) => !inside(r))).toEqual([]);
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

test('digit boxes for the shirt number are big enough to write in (≥ 5 × 8 mm)', () => {
  for (const box of layout.rows[0]!.numberDigits) {
    expect(box.width).toBeGreaterThanOrEqual(5);
    expect(box.height).toBeGreaterThanOrEqual(8);
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
