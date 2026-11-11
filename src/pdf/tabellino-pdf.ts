// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A4 portrait PDF of the scoresheet, laid out like the DataVolley "Tabellino".
 *
 * Pure function of the Tabellino model: no DOM, so it runs in the browser,
 * in a worker, in Node (tests) and in native shells alike.
 */

import { PDFDocument, type rgb } from 'pdf-lib';
import {
  formatBracketedPercent,
  formatCount,
  formatPercent,
  formatRating,
  formatSigned,
} from '../report/format';
import { type Tabellino, type TabellinoPlayerRow, type TabellinoSetRow, type TabellinoSkills, playedSets, setsCell } from '../report/tabellino';
import type { Messages } from '../i18n/it';
import { it } from '../i18n/it';
import type { AttackTally } from '../domain/phases';
import { type PdfFontFiles, embedPdfFonts } from './fonts';
import { type Align, MARGIN, MM, MUTED, NAVY, PAGE, ROW, Writer, drawMatchHeader, footer } from './pdf-page';


export interface Column<T> {
  readonly header: string;
  readonly width: number; // mm
  readonly align: Align;
  readonly value: (row: T) => string;
}

export interface Group<T> {
  readonly title: string;
  readonly columns: readonly Column<T>[];
}

export const num = <T,>(header: string, value: (row: T) => string, width = 7): Column<T> => ({ header, width, align: 'right', value });

type Texts = Messages['scoresheet'];

/** Serve, reception, attack and block: shared by player, total and set rows. */
export function skillGroups<T extends TabellinoSkills>(t: Texts): Group<T>[] {
  return [
    {
      title: t.serve,
      columns: [
        num(t.tot, (r) => formatCount(r.serve.total)),
        num(t.err, (r) => formatCount(r.serve.errors)),
        num(t.pt, (r) => formatCount(r.serve.points)),
      ],
    },
    {
      title: t.reception,
      columns: [
        num(t.tot, (r) => formatCount(r.reception.total)),
        num(t.err, (r) => formatCount(r.reception.errors)),
        num(t.pos, (r) => formatPercent(r.reception.positivity), 9),
        num(t.prf, (r) => formatBracketedPercent(r.reception.perfectRate), 11),
      ],
    },
    {
      title: t.attack,
      columns: [
        num(t.tot, (r) => formatCount(r.attack.total)),
        num(t.err, (r) => formatCount(r.attack.errors)),
        num(t.blocked, (r) => formatCount(r.attack.blocked)),
        num(t.pt, (r) => formatCount(r.attack.points)),
        num(t.ptPct, (r) => formatPercent(r.attack.pointRate), 9),
      ],
    },
    { title: t.block, columns: [num(t.pt, (r) => formatCount(r.blockPoints), 9)] },
  ];
}

export type PlayerOrTotal = TabellinoPlayerRow | (Omit<TabellinoPlayerRow, 'player' | 'setsPlayed' | 'rating'> & { total: true });

export function playerGroups(tabellino: Tabellino, t: Texts): Group<PlayerOrTotal>[] {
  const { showNames } = tabellino;
  const isPlayer = (r: PlayerOrTotal): r is TabellinoPlayerRow => 'player' in r;
  const libero = (r: TabellinoPlayerRow) => (r.player.role === 'L' ? ' (L)' : '');
  // Without names the shirt number column also carries the libero mark and the totals label.
  const identity: Column<PlayerOrTotal>[] = showNames
    ? [
        { header: t.number, width: 6, align: 'right', value: (r) => (isPlayer(r) ? String(r.player.number) : '') },
        { header: '', width: 34, align: 'left', value: (r) => (isPlayer(r) ? `${r.player.name}${libero(r)}` : t.teamTotals) },
      ]
    : [{ header: t.number, width: 14, align: 'left', value: (r) => (isPlayer(r) ? `${r.player.number}${libero(r)}` : t.totals) }];
  return [
    { title: '', columns: identity },
    {
      title: t.set,
      columns: [
        {
          header: playedSets(tabellino).join(' '),
          width: 14,
          align: 'center',
          value: (r) => (isPlayer(r) ? setsCell(tabellino, r) : ''),
        },
      ],
    },
    { title: '', columns: [num(t.rating, (r) => (isPlayer(r) ? formatRating(r.rating) : ''), 8)] },
    {
      title: t.points,
      columns: [num(t.tot, (r) => formatCount(r.points.total)), num(t.balance, (r) => formatSigned(r.points.balance))],
    },
    ...skillGroups<PlayerOrTotal>(t),
  ];
}

export function setGroups(t: Texts): Group<TabellinoSetRow>[] {
  return [
    {
      title: '',
      columns: [
        {
          header: t.set,
          width: 22,
          align: 'left',
          value: (r) => `${t.set} ${r.setNumber}${r.score ? `  ${r.score.team}-${r.score.opponent}` : ''}`,
        },
      ],
    },
    {
      title: t.pointsWon,
      columns: [
        num(t.srv, (r) => formatCount(r.pointsWon.serve)),
        num(t.att, (r) => formatCount(r.pointsWon.attack)),
        num(t.blk, (r) => formatCount(r.pointsWon.block)),
        num(t.oppErr, (r) => formatCount(r.pointsWon.opponentErrors), 9),
      ],
    },
    ...skillGroups<TabellinoSetRow>(t),
  ];
}


/**
 * How a cell stands out, e.g. above the team: a background and a triangle
 * (up or down) before the value, so that the colour is never the only sign.
 */
export type CellStyle<T> = (row: T, column: Column<T>) => { readonly fill?: ReturnType<typeof rgb>; readonly mark?: 'up' | 'down' } | undefined;

/** A small triangle at the left of a cell, drawn (the fonts have no such symbol). */
function drawMark(w: Writer, x: number, baseline: number, mark: 'up' | 'down') {
  const size = 1.9 * MM;
  const path = mark === 'up' ? `M0,${size} L${size / 2},0 L${size},${size} Z` : `M0,0 L${size},0 L${size / 2},${size} Z`;
  w.page.drawSvgPath(path, { x, y: baseline + size, color: NAVY });
}

/** Draws a grouped table and returns the y below it. */
export function drawTable<T>(
  w: Writer,
  top: number,
  groups: readonly Group<T>[],
  rows: readonly T[],
  emphasise: (row: T) => boolean,
  style?: CellStyle<T>,
): number {
  const cellPad = 0.8 * MM;
  const width = groups.flatMap((g) => g.columns).reduce((sum, c) => sum + c.width * MM, 0);
  let y = top;

  // Group titles and column headers on a shaded band.
  w.rect(MARGIN, y - 2 * ROW, width, 2 * ROW);
  let x = MARGIN;
  for (const group of groups) {
    const groupWidth = group.columns.reduce((sum, c) => sum + c.width * MM, 0);
    if (group.title) {
      w.text(group.title.toUpperCase(), x, y - ROW + 1.4 * MM, 7, { bold: true, align: 'center', width: groupWidth, color: NAVY });
    }
    for (const column of group.columns) {
      w.text(column.header, x + cellPad, y - 2 * ROW + 1.4 * MM, 6.5, {
        bold: true,
        align: column.align,
        width: column.width * MM - 2 * cellPad,
        color: NAVY,
      });
      x += column.width * MM;
    }
    w.line(x, y, x, y - 2 * ROW - rows.length * ROW, 0.4);
  }
  y -= 2 * ROW;

  for (const row of rows) {
    const strong = emphasise(row);
    if (strong) w.line(MARGIN, y, MARGIN + width, y, 1.2, NAVY);
    x = MARGIN;
    for (const column of groups.flatMap((g) => g.columns)) {
      const look = style?.(row, column);
      if (look?.fill) w.rect(x, y - ROW, column.width * MM, ROW, look.fill);
      if (look?.mark) {
        // Just before a value aligned on the right, at the start of the cell otherwise.
        const font = strong ? w.fonts.bold : w.fonts.regular;
        const end = x + column.width * MM - cellPad - font.widthOfTextAtSize(column.value(row), 7.5);
        drawMark(w, column.align === 'right' ? end - 3 * MM : x + cellPad, y - ROW + 1.4 * MM, look.mark);
      }
      // A triangle at the start of a cell aligned on the left pushes the text after it.
      const shift = look?.mark && column.align !== 'right' ? 3 * MM : 0;
      w.text(column.value(row), x + cellPad + shift, y - ROW + 1.4 * MM, 7.5, {
        bold: strong,
        align: column.align,
        width: column.width * MM - 2 * cellPad - shift,
      });
      x += column.width * MM;
    }
    y -= ROW;
    w.line(MARGIN, y, MARGIN + width, y, 0.2);
  }
  w.line(MARGIN, top, MARGIN, y, 0.4);
  w.line(MARGIN, top, MARGIN + width, top, 0.4);
  w.line(MARGIN, y, MARGIN + width, y, 0.4);
  return y;
}


export interface TabellinoPdfOptions {
  /** Fonts to embed (the app's bundled Roboto and Montserrat). */
  readonly fonts: PdfFontFiles;
  /** PNG of the logo printed in the header. */
  readonly logoPng?: Uint8Array;
  /** Labels in the user's language (Italian by default). */
  readonly texts?: Texts;
}

export async function renderTabellinoPdf(tabellino: Tabellino, options: TabellinoPdfOptions): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const title = `${tabellino.teamName} - ${tabellino.opponentName} ${tabellino.setsWon.team}-${tabellino.setsWon.opponent}`;
  const texts = options.texts ?? it.scoresheet;
  doc.setTitle(`${texts.title} ${title}${tabellino.set ? ` - ${texts.set} ${tabellino.set}` : ''}`);
  doc.setProducer('VolleyReport');
  doc.setCreator('VolleyReport');

  const page = doc.addPage([PAGE.width, PAGE.height]);
  const w = new Writer(page, await embedPdfFonts(doc, options.fonts));

  const logo = options.logoPng ? await doc.embedPng(options.logoPng) : null;
  const t = texts;
  let y = drawMatchHeader(w, tabellino, logo, tabellino.set ? t.titleSet(tabellino.set) : t.title, t);
  w.text(tabellino.teamName, MARGIN, y, 11, { heading: true, color: NAVY });
  y -= 2 * MM;
  const rows: PlayerOrTotal[] = [...tabellino.players, { ...tabellino.totals, total: true }];
  y = drawTable(w, y, playerGroups(tabellino, t), rows, (r) => 'total' in r);

  y -= 6 * MM;
  w.text(tabellino.set ? t.oneSetStats : t.setStats, MARGIN, y, 9, { heading: true, color: NAVY });
  y = drawTable(w, y - 1.5 * MM, setGroups(t), tabellino.sets, () => false);
  w.text(tabellino.set ? t.opponentErrorsSet(tabellino.opponentErrors) : t.opponentErrorsTotal(tabellino.opponentErrors), MARGIN, y - 4.5 * MM, 7.5);
  y -= 4.5 * MM;

  // Attack on reception, counter-attack, side-out and break points: only when the touches were entered in order.
  if (tabellino.phases) {
    const phases = tabellino.phases;
    const needed = 6 * MM + 5 * ROW + 14 * MM;
    // No room left under a long roster: on a page of its own.
    const onNewPage = y - needed < MARGIN + 8 * MM;
    const pw = onNewPage ? new Writer(doc.addPage([PAGE.width, PAGE.height]), w.fonts) : w;
    let py = onNewPage ? PAGE.height - MARGIN - 6 * MM : y - 7 * MM;
    pw.text(t.phases.title, MARGIN, py, 9, { heading: true, color: NAVY });
    type PhaseRow = { label: string; a: AttackTally };
    const attacks: PhaseRow[] = [
      { label: t.phases.onPositive, a: phases.onPositive },
      { label: t.phases.onNegative, a: phases.onNegative },
      { label: t.phases.counter, a: phases.counter },
    ];
    py = drawTable(
      pw,
      py - 1.5 * MM,
      [
        { title: '', columns: [{ header: t.attack, width: 50, align: 'left', value: (r) => r.label }] },
        {
          title: '',
          columns: [
            num<PhaseRow>(t.tot, (r) => formatCount(r.a.total)),
            num<PhaseRow>(t.err, (r) => formatCount(r.a.errors)),
            num<PhaseRow>(t.blocked, (r) => formatCount(r.a.blocked)),
            num<PhaseRow>(t.pt, (r) => formatCount(r.a.points)),
            num<PhaseRow>(t.ptPct, (r) => formatPercent(r.a.total ? r.a.points / r.a.total : null), 9),
          ],
        },
      ],
      attacks,
      () => false,
    );
    pw.text(`${t.phases.sideOut} ${t.phases.sideOutText(phases.sideOuts, phases.receptions)}`, MARGIN, py - 4.5 * MM, 7.5);
    pw.text(`${t.phases.breakPoint} ${t.phases.breakPointText(phases.breakPoints, phases.serves)}`, MARGIN, py - 8.5 * MM, 7.5);
    pw.text(t.phases.pdfNote, MARGIN, py - 12.5 * MM, 6, { color: MUTED });
    if (onNewPage) pw.text(footer(t), MARGIN, MARGIN, 6, { color: MUTED });
  }

  w.text(t.pdfLegend, MARGIN, MARGIN + 4 * MM, 6, { color: MUTED });
  w.text(footer(t), MARGIN, MARGIN, 6, { color: MUTED });
  return doc.save();
}

/** File name in the official summary format, e.g. "Home - Guest 3-0 (25-16, 25-18, 25-22).pdf", plus " - Set 2" for one set. */
export function tabellinoFileName(t: Tabellino): string {
  const scores = t.setScores.map((s) => `${s.score.team}-${s.score.opponent}`).join(', ');
  const teams = [t.teamName, t.opponentName].map((n) => n.trim()).filter(Boolean).join(' - ') || 'VolleyReport';
  const name = `${teams} ${t.setsWon.team}-${t.setsWon.opponent}${scores ? ` (${scores})` : ''}`;
  const set = t.set ? ` - Set ${t.set}` : '';
  return `${(name + set).replace(/[\\/:*?"<>|]/g, '_')}.pdf`;
}
