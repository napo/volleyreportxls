// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { CURRENT_FORM_LAYOUT, OPTIONAL_FORM_CODES, type Rect, allV9Layouts, cellCode, hiddenMask, inset, maskHidden, overlaps, printableLayout, v9Layout } from './layout';
import { formQrPayload, parseFormQrPayload } from './scouting-form';

const inside = (r: Rect, outer: Rect, slack = 1e-6) =>
  r.x >= outer.x - slack && r.y >= outer.y - slack && r.x + r.width <= outer.x + outer.width + slack && r.y + r.height <= outer.y + outer.height + slack;
const grow = (r: Rect, by: number): Rect => inset(r, -by);
const capacities = (layout: ReturnType<typeof v9Layout>, kind: 'player' | 'libero') =>
  Object.fromEntries(layout.rows.find((r) => r.kind === kind)!.cells.map((c) => [cellCode(c), c.bubbles.length]));

describe('form v9: columns left out, oval bubbles', () => {
  const layouts = allV9Layouts();

  test('one form for every combination of the eight columns that can be left out', () => {
    expect(layouts).toHaveLength(255);
    expect(new Set(layouts.map((l) => hiddenMask(l.hidden))).size).toBe(255);
  });

  test('with no column left out the printed form is v8; otherwise v9 without those columns', () => {
    expect(printableLayout([])).toBe(CURRENT_FORM_LAYOUT);
    const layout = printableLayout(['A/', 'R!']);
    expect(layout.version).toBe(9);
    expect(layout.hidden).toEqual(['A/', 'R!']);
    const codes = layout.rows.flatMap((r) => r.cells.map(cellCode));
    expect(codes).not.toContain('A/');
    expect(codes).not.toContain('R!');
    expect(codes).toContain('A!');
  });

  test('every kept cell holds as many bubbles as on v8: only their shape changes', () => {
    const v8 = { player: capacities(CURRENT_FORM_LAYOUT, 'player'), libero: capacities(CURRENT_FORM_LAYOUT, 'libero') };
    for (const layout of layouts) {
      for (const kind of ['player', 'libero'] as const) {
        const kept = Object.fromEntries(Object.entries(v8[kind]).filter(([code]) => !layout.hidden.includes(code as never)));
        expect(capacities(layout, kind)).toEqual(kept);
      }
    }
  });

  test('bubbles as high as v8 and wider, more with more columns left out (at most 1.8 times)', () => {
    const height = CURRENT_FORM_LAYOUT.rows[0]!.cells[0]!.bubbles[0]!.height;
    const width = (hidden: readonly string[]) => v9Layout(hidden as never).rows[0]!.cells[0]!.bubbles[0]!.width;
    for (const layout of layouts) {
      for (const b of layout.rows.flatMap((r) => r.cells.flatMap((c) => c.bubbles))) {
        expect(b.height).toBeCloseTo(height, 6);
        expect(b.width).toBeGreaterThanOrEqual(height - 1e-9);
        expect(b.width).toBeLessThanOrEqual(height * 1.8 + 1e-9);
      }
    }
    expect(width(['A/'])).toBeGreaterThan(height);
    expect(width([...OPTIONAL_FORM_CODES])).toBeGreaterThan(width(['A/']));
  });

  test('in every combination: everything inside the page, cells apart, bubbles inside their cell and apart, quiet zones free', () => {
    const page: Rect = { x: 0, y: 0, ...CURRENT_FORM_LAYOUT.page };
    const problems: string[] = [];
    for (const layout of layouts) {
      const name = layout.hidden.join(' ');
      const cells = layout.rows.flatMap((r) => r.cells);
      if (!layout.rows.every((r) => inside(r.outer, page))) problems.push(`${name}: row outside the page`);
      // Cells of a row are side by side: comparing each one with the next ones of its row and the rows is enough.
      for (let i = 0; i < cells.length; i++) {
        const cell = cells[i]!;
        for (let j = i + 1; j < cells.length; j++) if (overlaps(cell.outer, cells[j]!.outer)) problems.push(`${name}: cells ${i} and ${j} overlap`);
        if (!cell.bubbles.every((b) => inside(b, cell.outer))) problems.push(`${name}: bubble outside cell ${i}`);
        // Bubbles of a cell: each one apart from the next in its line and from the one under it.
        for (let a = 0; a < cell.bubbles.length; a++) {
          for (let b = a + 1; b < cell.bubbles.length; b++) if (overlaps(cell.bubbles[a]!, cell.bubbles[b]!)) problems.push(`${name}: bubbles ${a} and ${b} of cell ${i} overlap`);
        }
      }
      const grid = [...layout.skills.map((s) => s.outer), ...layout.rows.map((r) => r.outer), ...layout.numberHeaders.map((h) => h.outer)];
      for (const marker of layout.markers) if (grid.some((r) => overlaps(grow(marker, layout.markerQuietZone), r))) problems.push(`${name}: quiet zone of marker ${marker.id}`);
    }
    expect(problems).toEqual([]);
  });

  test('header, markers and QR stay where they are on v8', () => {
    const layout = v9Layout(['B/', 'M!']);
    for (const key of ['markers', 'qr', 'title', 'score', 'fields', 'setMarks', 'legend'] as const) expect(layout[key]).toEqual(CURRENT_FORM_LAYOUT[key]);
  });

  test('the QR carries the columns left out, and reads back the same; older payloads are unchanged', () => {
    expect(formQrPayload({ layoutVersion: 8, setNumber: null, page: 1 })).toBe('VR|8|P1');
    for (let mask = 1; mask < 256; mask++) {
      const hidden = maskHidden(mask);
      const payload = formQrPayload({ layoutVersion: 9, setNumber: null, page: 1, hidden });
      expect(payload.length).toBeLessThanOrEqual(12);
      expect(parseFormQrPayload(payload)).toEqual({ layoutVersion: 9, setNumber: null, page: 1, hidden });
    }
    expect(parseFormQrPayload('VR|8|P1')).toEqual({ layoutVersion: 8, setNumber: null, page: 1 });
  });
});

describe('form v9: the PDF and the match', () => {
  test('the columns that can be left out are the same for the live sheet and for the printed form', async () => {
    const { OPTIONAL_CODES } = await import('../matches/record');
    expect([...OPTIONAL_CODES]).toEqual([...OPTIONAL_FORM_CODES]);
  });

  test('a v9 form is made as a one-page PDF, its QR code with the columns left out', async () => {
    const { renderScoutingFormPdf } = await import('./scouting-form-pdf');
    const { TEST_FONTS } = await import('./test-fonts');
    const { PDFDocument } = await import('pdf-lib');
    const { renderSyntheticForm } = await import('../image-processing/synthetic');
    const jsQR = (await import('jsqr')).default;
    const layout = printableLayout(['A/', 'M!']);
    const bytes = await renderScoutingFormPdf({ layout, fonts: TEST_FONTS });
    expect((await PDFDocument.load(bytes)).getPageCount()).toBe(1);
    // The payload drawn in the QR reads back with its columns.
    const payload = formQrPayload({ layoutVersion: 9, setNumber: null, page: 1, hidden: layout.hidden });
    const image = renderSyntheticForm(layout, payload, 8);
    const crop = 8;
    const { qr } = layout;
    const x0 = Math.round((qr.x - 3) * crop);
    const y0 = Math.round((qr.y - 3) * crop);
    const w = Math.round((qr.width + 6) * crop);
    const h = Math.round((qr.height + 6) * crop);
    const data = new Uint8ClampedArray(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) for (let c = 0; c < 4; c++) data[(y * w + x) * 4 + c] = image.data[((y0 + y) * image.width + x0 + x) * 4 + c]!;
    expect(parseFormQrPayload(jsQR(data, w, h)!.data)).toEqual({ layoutVersion: 9, setNumber: null, page: 1, hidden: ['M!', 'A/'] });
  });

  test('a column is not recorded in a match only when every sheet left it out', async () => {
    const { untrackedOf } = await import('../matches/from-sheets');
    const { newMatchRecord } = await import('../matches/record');
    expect(untrackedOf([['A/', 'R!'], ['A/']], null)).toEqual(['A/']);
    expect(untrackedOf([[], ['A/']], null)).toEqual([]);
    expect(untrackedOf([], null)).toEqual([]);
    // Sets already played with every column: nothing is untracked.
    const played = { ...newMatchRecord(), sets: newMatchRecord().sets.map((s, i) => (i === 0 ? { ...s, score: { team: 25, opponent: 20 } } : s)) };
    expect(untrackedOf([['A/']], played)).toEqual([]);
    expect(untrackedOf([['A/']], { ...played, untracked: ['A/', 'B!'] })).toEqual(['A/']);
    expect(untrackedOf([['A/']], newMatchRecord())).toEqual(['A/']);
  });
});
