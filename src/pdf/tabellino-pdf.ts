/**
 * A4 portrait PDF of the scoresheet, laid out like the DataVolley "Tabellino".
 *
 * Pure function of the Tabellino model: no DOM, so it runs in the browser,
 * in a worker, in Node (tests) and in native shells alike.
 */

import { PDFDocument } from 'pdf-lib';
import { SET_NUMBERS } from '../domain/model';
import {
  formatBracketedPercent,
  formatCount,
  formatPercent,
  formatRating,
  formatSigned,
} from '../report/format';
import type { Tabellino, TabellinoPlayerRow, TabellinoSetRow, TabellinoSkills } from '../report/tabellino';
import type { Messages } from '../i18n/it';
import { it } from '../i18n/it';
import { type PdfFontFiles, embedPdfFonts } from './fonts';
import { type Align, MARGIN, MM, MUTED, NAVY, PAGE, ROW, Writer, drawMatchHeader, footer } from './pdf-page';


interface Column<T> {
  readonly header: string;
  readonly width: number; // mm
  readonly align: Align;
  readonly value: (row: T) => string;
}

interface Group<T> {
  readonly title: string;
  readonly columns: readonly Column<T>[];
}

const num = <T,>(header: string, value: (row: T) => string, width = 7): Column<T> => ({ header, width, align: 'right', value });

type Texts = Messages['scoresheet'];

/** Serve, reception, attack and block: shared by player, total and set rows. */
function skillGroups<T extends TabellinoSkills>(t: Texts): Group<T>[] {
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

type PlayerOrTotal = TabellinoPlayerRow | (Omit<TabellinoPlayerRow, 'player' | 'setsPlayed' | 'rating'> & { total: true });

function playerGroups(showNames: boolean, t: Texts): Group<PlayerOrTotal>[] {
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
          header: SET_NUMBERS.join(' '),
          width: 14,
          align: 'center',
          value: (r) => (isPlayer(r) ? SET_NUMBERS.map((n) => (r.setsPlayed.includes(n) ? String(n) : '·')).join(' ') : ''),
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

function setGroups(t: Texts): Group<TabellinoSetRow>[] {
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


/** Draws a grouped table and returns the y below it. */
function drawTable<T>(w: Writer, top: number, groups: readonly Group<T>[], rows: readonly T[], emphasise: (row: T) => boolean): number {
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
      w.text(column.value(row), x + cellPad, y - ROW + 1.4 * MM, 7.5, {
        bold: strong,
        align: column.align,
        width: column.width * MM - 2 * cellPad,
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
  y = drawTable(w, y, playerGroups(tabellino.showNames, t), rows, (r) => 'total' in r);

  y -= 6 * MM;
  w.text(tabellino.set ? t.oneSetStats : t.setStats, MARGIN, y, 9, { heading: true, color: NAVY });
  y = drawTable(w, y - 1.5 * MM, setGroups(t), tabellino.sets, () => false);
  w.text(tabellino.set ? t.opponentErrorsSet(tabellino.opponentErrors) : t.opponentErrorsTotal(tabellino.opponentErrors), MARGIN, y - 4.5 * MM, 7.5);

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
