// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A scouting form filled in at random, to test the reading of a photo and to
 * illustrate the guide: shirt numbers and names, the set, the final score and
 * plausible touches, drawn as pen marks (filled or slashed bubbles) on the PDF
 * of the current layout. The same seed gives the same sheet.
 */

import { PDFDocument, degrees, rgb } from 'pdf-lib';
import type { ScoutCodeString } from '../domain/codes';
import type { SetNumber } from '../domain/model';
import { type Messages, it } from '../i18n/it';
import { type PdfFontFiles, drawableText, embedPdfFonts } from './fonts';
import { type FormLayout, type Rect, type RowKind, CURRENT_FORM_LAYOUT, cellCode } from './layout';
import { renderScoutingFormPdf } from './scouting-form-pdf';

export interface SampleRow {
  readonly index: number;
  readonly kind: RowKind;
  readonly number: number;
  readonly name: string;
  readonly counts: Readonly<Partial<Record<ScoutCodeString, number>>>;
}

/** A pen mark on a bubble: a filled disc or a slash across it. */
export type MarkShape =
  | { readonly kind: 'disc'; readonly cx: number; readonly cy: number; readonly r: number }
  | { readonly kind: 'slash'; readonly x1: number; readonly y1: number; readonly x2: number; readonly y2: number; readonly width: number };

export interface SampleSheet {
  readonly seed: number;
  readonly layoutVersion: number;
  readonly set: SetNumber;
  readonly score: { readonly team: number; readonly opponent: number };
  readonly header: { readonly team: string; readonly opponent: string; readonly competition: string; readonly date: string };
  readonly rows: readonly SampleRow[];
  /** Cells filled up with the "+" marked: the app asks for their total. */
  readonly full: readonly { readonly row: number; readonly code: ScoutCodeString }[];
  /** Every mark, in sheet millimetres: set, touches. */
  readonly marks: readonly MarkShape[];
}

export interface SampleOptions {
  /** Cells to fill up, "+" included (0 by default). */
  readonly full?: number;
}

/** Small, seedable generator (mulberry32). */
function random(seed: number) {
  let a = seed >>> 0;
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const int = (min: number, max: number) => min + Math.floor(next() * (max - min + 1));
  const pick = <T>(items: readonly T[]) => items[Math.floor(next() * items.length)]!;
  return { next, int, pick };
}

const NAMES = ['Giulia', 'Marco', 'Sara', 'Luca', 'Anna', 'Matteo', 'Elena', 'Davide', 'Chiara', 'Paolo', 'Marta', 'Andrea', 'Sofia', 'Simone', 'Alice', 'Nicola', 'Irene', 'Tommaso', 'Noemi', 'Pietro'];

/** Share of each evaluation, roughly as in DataVolley files. */
const EVALUATION_SHARES: Readonly<Record<string, readonly (readonly [string, number])[]>> = {
  B: [['#', 0.08], ['+', 0.25], ['!', 0.15], ['-', 0.35], ['/', 0.05], ['=', 0.12]],
  R: [['#', 0.25], ['+', 0.3], ['!', 0.15], ['-', 0.15], ['/', 0.07], ['=', 0.08]],
  A: [['#', 0.4], ['+', 0.15], ['!', 0.05], ['-', 0.2], ['/', 0.1], ['=', 0.1]],
  M: [['#', 0.3], ['+', 0.2], ['!', 0.15], ['-', 0.25], ['/', 0.05], ['=', 0.05]],
  P: [['=', 1]],
};

type Role = 'setter' | 'hitter' | 'middle' | 'opposite' | 'libero';

/** Touches per skill in a set, as [min, max], by role. */
const TOUCHES: Readonly<Record<Role, Readonly<Record<string, readonly [number, number]>>>> = {
  setter: { B: [1, 5], R: [0, 1], A: [0, 2], M: [0, 2], P: [0, 1] },
  hitter: { B: [1, 5], R: [2, 8], A: [3, 9], M: [0, 3], P: [0, 0] },
  middle: { B: [1, 4], R: [0, 0], A: [1, 5], M: [1, 4], P: [0, 0] },
  opposite: { B: [1, 5], R: [0, 2], A: [3, 10], M: [0, 3], P: [0, 0] },
  libero: { R: [3, 10], P: [0, 1] },
};

export function randomSampleSheet(seed: number, layout: FormLayout = CURRENT_FORM_LAYOUT, options: SampleOptions = {}): SampleSheet {
  const rng = random(seed);
  const players = layout.rows.filter((r) => r.kind === 'player');
  const liberos = layout.rows.filter((r) => r.kind === 'libero');
  const roles: Role[] = ['setter', 'opposite', 'hitter', 'hitter', 'middle', 'middle'];
  // Six on court, then substitutions.
  const substitutes = rng.int(1, Math.min(4, players.length - 6));
  for (let i = 0; i < substitutes; i++) roles.push(rng.pick(['setter', 'hitter', 'middle', 'opposite'] as const));
  const liberoRows = rng.int(1, Math.min(2, liberos.length));

  const numbers = new Set<number>();
  const names = new Set<string>();
  const unique = <T>(taken: Set<T>, draw: () => T) => {
    let v = draw();
    while (taken.has(v)) v = draw();
    taken.add(v);
    return v;
  };

  const marks: MarkShape[] = [];
  const mark = (bubble: Rect) => {
    const d = bubble.width;
    const cx = bubble.x + d / 2 + (rng.next() - 0.5) * 0.15 * d;
    const cy = bubble.y + d / 2 + (rng.next() - 0.5) * 0.15 * d;
    if (rng.next() < 0.6) {
      marks.push({ kind: 'disc', cx, cy, r: d * (0.32 + rng.next() * 0.08) });
    } else {
      const angle = (-50 + rng.next() * 30) * (Math.PI / 180);
      const half = d * 0.42;
      marks.push({ kind: 'slash', x1: cx - half * Math.cos(angle), y1: cy - half * Math.sin(angle), x2: cx + half * Math.cos(angle), y2: cy + half * Math.sin(angle), width: 0.5 });
    }
  };

  const fill = (row: (typeof layout.rows)[number], role: Role): SampleRow => {
    const counts: Partial<Record<ScoutCodeString, number>> = {};
    for (const [skill, [min, max]] of Object.entries(TOUCHES[role])) {
      let touches = rng.int(min, max);
      while (touches-- > 0) {
        let r = rng.next();
        const evaluation = EVALUATION_SHARES[skill]!.find(([, share]) => (r -= share) <= 0)?.[0] ?? EVALUATION_SHARES[skill]![0]![0];
        const cell = row.cells.find((c) => c.skill === skill && c.evaluation === evaluation);
        const code = cell && cellCode(cell);
        // A full cell would need the "+": the sample stays within the bubbles.
        if (!cell || !code || (counts[code] ?? 0) >= cell.bubbles.length) continue;
        counts[code] = (counts[code] ?? 0) + 1;
      }
    }
    for (const cell of row.cells) {
      const n = counts[cellCode(cell)!] ?? 0;
      cell.bubbles.slice(0, n).forEach(mark);
    }
    return {
      index: row.index,
      kind: row.kind,
      number: unique(numbers, () => rng.int(1, 30)),
      name: unique(names, () => rng.pick(NAMES)),
      counts,
    };
  };

  const set = rng.int(1, 3) as SetNumber;
  if (layout.setMarks) mark(layout.setMarks.sets[set - 1]!);
  const rows = [
    ...roles.map((role, i) => fill(players[i]!, role)),
    ...liberos.slice(0, liberoRows).map((row) => fill(row, 'libero')),
  ];
  // Full cells: the remaining bubbles and the "+"; the count is the capacity, the true total is entered in the app.
  const full: { row: number; code: ScoutCodeString }[] = [];
  for (let k = 0; k < (options.full ?? 0); k++) {
    const sample = rows[rng.int(0, roles.length - 1)]!;
    const row = layout.rows[sample.index]!;
    const cell = rng.pick(row.cells.filter((c) => c.bubbles.length >= 5 && !full.some((f) => f.row === row.index && f.code === cellCode(c))));
    const code = cellCode(cell)!;
    const counts = sample.counts as Partial<Record<ScoutCodeString, number>>;
    cell.bubbles.slice(counts[code] ?? 0).forEach(mark);
    mark(cell.overflow);
    counts[code] = cell.bubbles.length;
    full.push({ row: row.index, code });
  }
  const loser = rng.int(14, 23);
  const won = rng.next() < 0.6;
  const day = rng.int(1, 28);
  const month = rng.int(1, 12);
  return {
    seed,
    layoutVersion: layout.version,
    set,
    score: won ? { team: 25, opponent: loser } : { team: loser, opponent: 25 },
    header: {
      team: 'Volley Esempio',
      opponent: 'Pallavolo Ospite',
      competition: 'Under 16',
      date: `${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}/26`,
    },
    rows,
    full,
    marks,
  };
}

const MM = 72 / 25.4;
/** Blue ballpoint. */
const PEN = rgb(0.1, 0.16, 0.45);

export interface SampleSheetPdfOptions {
  readonly fonts: PdfFontFiles;
  readonly layout?: FormLayout;
  readonly texts?: Messages;
  readonly logoPng?: Uint8Array;
}

/** The PDF of the form with the sample written on it, as if by hand. */
export async function renderSampleSheetPdf(sheet: SampleSheet, options: SampleSheetPdfOptions): Promise<Uint8Array> {
  const layout = options.layout ?? CURRENT_FORM_LAYOUT;
  const texts = options.texts ?? it;
  const doc = await PDFDocument.load(await renderScoutingFormPdf({ fonts: options.fonts, layout, texts, ...(options.logoPng && { logoPng: options.logoPng }) }));
  const fonts = await embedPdfFonts(doc, options.fonts);
  const page = doc.getPage(0);
  const y = (mm: number) => (layout.page.height - mm) * MM;
  const rng = random(sheet.seed ^ 0x5eed);

  for (const m of sheet.marks) {
    if (m.kind === 'disc') page.drawCircle({ x: m.cx * MM, y: y(m.cy), size: m.r * MM, color: PEN });
    else page.drawLine({ start: { x: m.x1 * MM, y: y(m.y1) }, end: { x: m.x2 * MM, y: y(m.y2) }, thickness: m.width * MM, color: PEN });
  }

  /** Handwriting stand-in: the regular font, in pen colour, slightly tilted. */
  const write = (text: string, x: number, baseline: number, height: number) => {
    const safe = drawableText(fonts.regular, text);
    page.drawText(safe, { x: x * MM, y: y(baseline), size: (height / 0.71) * MM, font: fonts.regular, color: PEN, rotate: degrees((rng.next() - 0.5) * 6) });
  };
  const inBox = (digit: string, box: Rect) => {
    const height = box.height * 0.6;
    const width = (fonts.regular.widthOfTextAtSize(digit, (height / 0.71) * MM) / MM);
    write(digit, box.x + (box.width - width) / 2, box.y + (box.height + height) / 2, height);
  };
  const digits = (n: number, boxes: readonly [Rect, Rect]) => {
    const text = String(n);
    if (text.length === 1) inBox(text, boxes[0]);
    else text.split('').forEach((d, i) => inBox(d, boxes[i as 0 | 1]));
  };

  for (const row of sheet.rows) {
    const printed = layout.rows[row.index]!;
    digits(row.number, printed.numberDigits);
    if (printed.name) write(row.name, printed.name.x + 2, printed.name.y + printed.name.height - 1.6, Math.min(2.6, printed.name.height * 0.5));
  }
  digits(sheet.score.team, layout.score.team);
  digits(sheet.score.opponent, layout.score.opponent);
  for (const { field, outer } of layout.fields) {
    const label = fonts.regular.widthOfTextAtSize(texts.form[field], 6.5) / MM;
    write(sheet.header[field], outer.x + label + 3, outer.y + 3.6, 2.4);
  }
  return doc.save();
}

/** Expected reading of the sample, for comparing with what the app reads from a photo of it. */
export function sampleSummary(sheet: SampleSheet) {
  return {
    seed: sheet.seed,
    layoutVersion: sheet.layoutVersion,
    set: sheet.set,
    score: sheet.score,
    rows: sheet.rows.map((r) => ({ row: r.index + 1, kind: r.kind, number: r.number, name: r.name, counts: r.counts })),
    /** Cells with the "+": their count is the number of bubbles, the app asks for the total. */
    full: sheet.full.map((f) => ({ row: f.row + 1, code: f.code })),
  };
}
