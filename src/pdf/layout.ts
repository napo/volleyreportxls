// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Geometry of the scouting form, in millimetres, origin at the top-left corner
 * of the page and y growing downwards (the image convention).
 *
 * This is the single source of truth for the form: the PDF generator draws
 * it and the image pipeline uses it to know where every bubble is once the
 * photo has been rectified on the markers. A printed layout must never
 * change: any change gets a new version, kept here so that photos of sheets
 * already printed can still be read (the version is in the QR code).
 *
 * Layout v4 is a tally sheet, one page per set: for every touch the scout fills
 * or crosses the next free bubble in the player's row, under the skill and the
 * evaluation. Cells hold as many bubbles as that evaluation needs (measured on
 * 2,100 sets of DataVolley files, with extra room for lower levels), plus a
 * "+" bubble when they are all used.
 * - 12 player rows: serve, reception, attack, block, set faults (P=, whistled by
 *   the referee on the second touch: every role can commit them).
 * - 2 libero rows: reception and set faults, under the players' ones.
 *
 * Layout v5 has the grid of v4 on a single sheet for every set: the scout marks
 * the set in the header (bubbles 1–5), and a further bubble when the sheet
 * continues a set started on another sheet. The QR carries no set.
 *
 * Layout v6 makes the bubbles bigger and easier to read, with the same rows and
 * capacities: a compact header (one band beside the markers, smaller QR), the
 * two libero rows side by side on one line, empty bubbles (no number), block
 * - and / on two columns, and room for the name under the shirt number.
 *
 * Layout v8 puts the skills in the order of a rally, serve, block, attack,
 * reception, with the set faults last; the evaluations of each skill go from
 * the most to the least favourable (serve: # / + ! - =). Every other player row
 * lies on a light grey band, and the rules between skills are light grey: the
 * dark rules of v6–v7 could be read as pen strokes. The second libero block is
 * under the players' reception. Cells are found by skill and evaluation, so
 * v6 and v7 sheets are read as before.
 *
 * Layout v9 is v8 with some "!" and "/" columns left out, chosen when the form
 * is downloaded: the other columns share the width of the page and the bubbles
 * become ovals as wide as the columns allow (the height of the rows does not
 * change). The QR carries the columns left out, so the geometry is rebuilt
 * from it when a photo is read (see formLayout). With no column left out the
 * form is v8. A v9 form can also have its skills in another order (serve,
 * block, attack and reception moved, set faults always last): the QR carries
 * that order too, when it is not the one of v8.
 *
 * Layout v5 is kept to read those sheets.
 *
 * Layout v4 (one printed page per set, the set in the QR) is kept to read those sheets.
 *
 * Layout v3 (October 2026, already used on paper) is kept to read those sheets:
 * its libero rows also had dig and graded sets, which the app no longer records.
 * Those cells are read and reported, never counted.
 */

import { type Evaluation, type ScoutCodeString, type Skill, SKILL_DEFINITIONS } from '../domain/codes';

/** Skills printed on a form: the app's ones plus dig, found on v3 sheets only. */
export type FormSkill = Skill | 'D';

const FORM_SKILL_LABELS: Readonly<Record<FormSkill, string>> = {
  ...(Object.fromEntries(Object.entries(SKILL_DEFINITIONS).map(([k, d]) => [k, d.label])) as Record<Skill, string>),
  D: 'Difesa',
};

export interface Rect {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

export interface MarkerPlacement extends Rect {
  /** ArUco id (dictionary 4×4). */
  readonly id: number;
}

/** A printed bubble: the square around its circle. */
export interface Bubble extends Rect {
  /** 1-based position printed inside the bubble. */
  readonly number: number;
}

/** The bubbles of one player for one skill and evaluation. */
export interface TallyCell {
  readonly skill: FormSkill;
  readonly evaluation: Evaluation;
  readonly outer: Rect;
  readonly bubbles: readonly Bubble[];
  /** Legacy "+" bubble; null from v7, where every slot is a normal counting bubble. */
  readonly overflow: Rect | null;
}

export type RowKind = 'player' | 'libero';

export interface FormRow {
  readonly index: number;
  readonly kind: RowKind;
  readonly outer: Rect;
  /** Shirt number area, two digit boxes written by hand. */
  readonly number: Rect;
  readonly numberDigits: readonly [Rect, Rect];
  /** Name written under the shirt number (v6 on). */
  readonly name?: Rect;
  readonly cells: readonly TallyCell[];
  /** Areas of the row with nothing to fill (the serve columns in the libero rows). */
  readonly unused: readonly Rect[];
}

export interface SkillHeader {
  readonly kind: RowKind;
  readonly skill: FormSkill;
  readonly label: string;
  /** Skill name band, over the evaluation columns. */
  readonly outer: Rect;
  readonly evaluations: readonly { readonly evaluation: Evaluation; readonly outer: Rect }[];
}

export interface FormLayout {
  readonly version: number;
  /** v9: the "!" and "/" columns left out of this form (none for every other version). */
  readonly hidden: readonly ScoutCodeString[];
  /** The order of serve, block, attack and reception on the form (set faults last); the one of v8 but on some v9 forms. */
  readonly order: FormOrder;
  /** v7: meanings under the symbols and ordinary bubbles in every slot. */
  readonly evaluationCaptions: boolean;
  readonly page: { readonly width: number; readonly height: number };
  readonly markers: readonly MarkerPlacement[];
  /** Blank margin to keep around every marker. */
  readonly markerQuietZone: number;
  readonly qr: Rect;
  readonly title: Rect;
  /** Set marked by hand (v5 on): one bubble per set, plus "extra sheet of the set". Absent when the set is printed. */
  readonly setMarks?: { readonly sets: readonly Bubble[]; readonly extra: Rect };
  /** Final score: two digit boxes for us, two for the opponent. */
  readonly score: { readonly team: readonly [Rect, Rect]; readonly opponent: readonly [Rect, Rect] };
  /** "N° divisa" label over the player rows, "Libero" over the libero rows. */
  readonly numberHeaders: readonly { readonly kind: RowKind; readonly outer: Rect }[];
  readonly skills: readonly SkillHeader[];
  readonly rows: readonly FormRow[];
  /** Legend, split on the two sides of the bottom-centre marker. */
  readonly legend: readonly [Rect, Rect];
  /** Inner margin to drop when cropping a box, so that the printed border is not read as ink. */
  readonly cropInset: number;
  /** v6 on: compact header, empty bubbles, name under the shirt number. */
  readonly compact: boolean;
  /** v8: every other player row on a light band, light rules between skills. */
  readonly rowBands: boolean;
  /** Fields written by hand for the paper archive (team, opponent, competition, date); the app does not read them. */
  readonly fields: readonly { readonly field: 'team' | 'opponent' | 'competition' | 'date'; readonly outer: Rect }[];
}

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Three rows: all slots count from v7; older sheets reserve the last for "+". */
const BUBBLE_ROWS = 3;

/** Columns per evaluation, in skill order; v7 capacity = 3 × columns. */
type Columns = readonly (readonly [Evaluation, number])[];
type SkillColumns = readonly (readonly [FormSkill, Columns])[];

const SERVE: Columns = [['#', 2], ['+', 3], ['!', 2], ['-', 3], ['/', 2], ['=', 2]]; // 5 8 5 8 5 5
const RECEPTION: Columns = [['#', 3], ['+', 3], ['!', 3], ['-', 3], ['/', 2], ['=', 2]]; // 8 8 8 8 5 5
const ATTACK: Columns = [['#', 4], ['+', 3], ['!', 2], ['-', 3], ['/', 2], ['=', 3]]; // 11 8 5 8 5 8
const BLOCK: Columns = [['#', 2], ['+', 2], ['!', 2], ['-', 1], ['/', 1], ['=', 2]]; // 5 5 5 2 2 5
/** v6: no one-column cells, so that every bubble can be as big as the others. */
const BLOCK_V6: Columns = [['#', 2], ['+', 2], ['!', 2], ['-', 2], ['/', 2], ['=', 2]]; // 5 5 5 5 5 5
/** v8: the serve from the most to the least favourable, same capacities. */
const SERVE_V8: Columns = [['#', 2], ['/', 2], ['+', 3], ['!', 2], ['-', 3], ['=', 2]];

interface LayoutSpec {
  readonly version: number;
  readonly player: SkillColumns;
  /** Libero blocks, each starting at the x of a player block ("under") or right after the previous one. */
  readonly libero: readonly { readonly skill: FormSkill; readonly columns: Columns; readonly under?: FormSkill }[];
  /** Player blocks hatched in the libero rows, as [from, to) ranges of player skills. */
  readonly liberoUnused: readonly (readonly [FormSkill, FormSkill])[];
  /** The set is marked by hand in the header instead of printed. */
  readonly setMarks?: boolean;
  /** v6 on: compact header, liberos side by side, uniform bubbles, name under the shirt number. */
  readonly compact?: boolean;
  /** Compact: the second libero block ends with the grid, its skills under the players' ones (v8); otherwise it starts under attack. */
  readonly liberoUnderPlayers?: boolean;
  readonly rowBands?: boolean;
  /** v9: columns left out; the others share the width. */
  readonly hidden?: readonly ScoutCodeString[];
  /** v9: the order of the movable skills, when it is not the one of v8. */
  readonly order?: FormOrder;
  /** v9: bubbles as wide as the columns allow, as high as before. */
  readonly ovalBubbles?: boolean;
}

/** v4: set faults (P=) on every row; liberos with reception and set faults. */
const V4: LayoutSpec = {
  version: 4,
  player: [['B', SERVE], ['R', RECEPTION], ['A', ATTACK], ['M', BLOCK], ['P', [['=', 2]]]],
  libero: [
    { skill: 'R', columns: RECEPTION, under: 'R' },
    { skill: 'P', columns: [['=', 2]], under: 'P' },
  ],
  liberoUnused: [['B', 'R'], ['A', 'P']],
};

/** v5: the grid of v4, one sheet for every set. */
const V5: LayoutSpec = { ...V4, version: 5, setMarks: true };

/** v6: the rows of v5, bigger bubbles, room for the name. */
const V6: LayoutSpec = {
  ...V5,
  version: 6,
  compact: true,
  player: V5.player.map(([skill, columns]) => [skill, skill === 'M' ? BLOCK_V6 : columns]),
};

/** v8: skills in the order of a rally, evaluations from the most to the least favourable. */
const V8: LayoutSpec = {
  ...V6,
  version: 8,
  player: [['B', SERVE_V8], ['M', BLOCK_V6], ['A', ATTACK], ['R', RECEPTION], ['P', [['=', 2]]]],
  liberoUnderPlayers: true,
  rowBands: true,
};

/** v3 (read only): liberos with reception, then dig and graded sets where attack starts. */
const V3: LayoutSpec = {
  version: 3,
  player: [['B', SERVE], ['R', RECEPTION], ['A', ATTACK], ['M', BLOCK]],
  libero: [
    { skill: 'R', columns: RECEPTION, under: 'R' },
    { skill: 'D', columns: [['#', 2], ['+', 3], ['!', 2], ['-', 2], ['/', 2], ['=', 3]], under: 'A' }, // 5 8 5 5 5 8
    { skill: 'P', columns: [['#', 2], ['+', 3], ['-', 3], ['=', 2]] }, // 5 8 8 5
  ],
  liberoUnused: [['B', 'R']],
};

/** v9: the columns that can be left out, in the order of the bits of their code (never to be changed). */
export const OPTIONAL_FORM_CODES: readonly ScoutCodeString[] = ['B/', 'B!', 'M!', 'M/', 'A!', 'A/', 'R!', 'R/'] as ScoutCodeString[];

/** Skills that can change place on a v9 form; set faults stay last. */
export type MovableFormSkill = 'B' | 'M' | 'A' | 'R';
export type FormOrder = readonly MovableFormSkill[];
/** The order of v8, and of every v9 form whose QR names none. */
export const DEFAULT_FORM_ORDER: FormOrder = ['B', 'M', 'A', 'R'];
export const isFormOrder = (order: readonly string[]): order is FormOrder =>
  order.length === DEFAULT_FORM_ORDER.length && DEFAULT_FORM_ORDER.every((skill) => order.includes(skill));
const sameOrder = (a: FormOrder, b: FormOrder) => a.every((skill, i) => skill === b[i]);

/** v9: the widest an oval bubble gets, as a multiple of its height. */
const OVAL_MAX_RATIO = 1.8;

/** v9: v8 with oval bubbles, the columns left out given when the layout is built. */
const V9: LayoutSpec = { ...V8, version: 9, ovalBubbles: true };

const columnsOf = (columns: Columns) => columns.reduce((n, [, c]) => n + c, 0);

function buildTallyLayout(base: LayoutSpec): FormLayout {
  // v9: the columns left out are simply not there; the others take their room.
  const hidden = base.hidden ?? [];
  const keep = (skill: FormSkill, columns: Columns): Columns => columns.filter(([e]) => !hidden.includes(`${skill}${e}` as ScoutCodeString));
  const order = base.order ?? DEFAULT_FORM_ORDER;
  const rank = (skill: FormSkill) => {
    const i = order.indexOf(skill as MovableFormSkill);
    return i < 0 ? order.length : i;
  };
  const spec: LayoutSpec = {
    ...base,
    player: (base.order ? [...base.player].sort(([a], [b]) => rank(a) - rank(b)) : base.player).map(([skill, columns]) => [skill, keep(skill, columns)] as const),
    libero: base.libero.map((l) => ({ ...l, columns: keep(l.skill, l.columns) })),
  };
  const page = { width: 297, height: 210 }; // A4 landscape
  const margin = 7;
  const marker = 12;
  const quietZone = 2;
  const right = page.width - margin - marker;
  const bottom = page.height - margin - marker;
  const centre = (page.width - marker) / 2;

  const compact = spec.compact ?? false;
  const left = margin;
  // Compact header: one band as high as the markers; the grid starts right under it.
  const gridTop = compact ? margin + marker + quietZone + 0.5 : 29;
  const numberWidth = compact ? 20 : 11;
  const gridWidth = page.width - 2 * margin - numberWidth;
  const gridLeft = left + numberWidth;
  const pitch = gridWidth / spec.player.reduce((n, [, c]) => n + columnsOf(c), 0);

  const skillBand = 4;
  const evaluationCaptions = spec.version >= 7;
  const evaluationBand = evaluationCaptions ? 11 : 4;
  const liberoHeader = 6;
  const playerRows = 12;
  const liberoRows = 2;
  // v6: the two libero rows side by side, on the height of one row.
  const liberoLines = compact ? 1 : liberoRows;
  const playerTop = gridTop + skillBand + evaluationBand;
  const rowsBottom = bottom - quietZone - 0.5;
  const rowHeight = (rowsBottom - playerTop - liberoHeader) / (playerRows + liberoLines);
  const liberoTop = playerTop + playerRows * rowHeight + liberoHeader;

  // x of every skill block: players in order; libero blocks under a player block or after the previous one.
  const blocks = new Map<string, number>();
  let x = gridLeft;
  for (const [skill, columns] of spec.player) {
    blocks.set(`player:${skill}`, x);
    x += columnsOf(columns) * pitch;
  }
  x = gridLeft;
  for (const { skill, columns, under } of spec.libero) {
    if (under) x = blocks.get(`player:${under}`)!;
    blocks.set(`libero:${skill}`, x);
    x += columnsOf(columns) * pitch;
  }
  const liberoSkills: SkillColumns = spec.libero.map(({ skill, columns }) => [skill, columns]);
  const gridRight = gridLeft + gridWidth;
  const playerX = (skill: FormSkill) => blocks.get(`player:${skill}`) ?? gridRight;

  const header = (kind: RowKind, skill: FormSkill, columns: Columns, top: number, height: number, at?: number): SkillHeader => {
    const x0 = at ?? blocks.get(`${kind}:${skill}`)!;
    const nameBand = evaluationCaptions && kind === 'player' ? skillBand : height / 2;
    const evaluations = [];
    let cx = x0;
    for (const [evaluation, c] of columns) {
      evaluations.push({ evaluation, outer: rect(cx, top + nameBand, c * pitch, height - nameBand) });
      cx += c * pitch;
    }
    return { kind, skill, label: FORM_SKILL_LABELS[skill], outer: rect(x0, top, columnsOf(columns) * pitch, nameBand), evaluations };
  };

  const pad = 0.3;
  // v6: every bubble as big as the narrowest cell allows, so they all look the same; without
  // numbers inside, less room between them.
  const narrowest = Math.min(...spec.player.flatMap(([, columns]) => columns.map(([, c]) => c)));
  const across = (narrowest * pitch - 2 * pad) / narrowest;
  const down = (rowHeight - 2 * pad) / BUBBLE_ROWS;
  const uniform = Math.min(across, down) * 0.86;
  // v9: as high as the round bubbles, as wide as the columns allow (up to OVAL_MAX_RATIO times the height).
  const ovalWidth = Math.min(Math.max(across * 0.86, uniform), uniform * OVAL_MAX_RATIO);
  const cell = (skill: FormSkill, evaluation: Evaluation, outer: Rect, columns: number): TallyCell => {
    const pitchX = (outer.width - 2 * pad) / columns;
    const pitchY = (outer.height - 2 * pad) / BUBBLE_ROWS;
    const d = compact ? uniform : Math.min(pitchX, pitchY) * 0.82;
    const w = spec.ovalBubbles ? ovalWidth : d;
    const slot = (i: number): Rect => {
      const cx = outer.x + pad + pitchX * ((i % columns) + 0.5);
      const cy = outer.y + pad + pitchY * (Math.floor(i / columns) + 0.5);
      return rect(cx - w / 2, cy - d / 2, w, d);
    };
    const slots = columns * BUBBLE_ROWS;
    return {
      skill,
      evaluation,
      outer,
      bubbles: Array.from({ length: evaluationCaptions ? slots : slots - 1 }, (_, i) => ({ ...slot(i), number: i + 1 })),
      overflow: evaluationCaptions ? null : slot(slots - 1),
    };
  };

  /** v6 libero blocks: shirt number and name, then the libero skills one after the other; the second block starts under attack. */
  const liberoWidth = numberWidth + liberoSkills.reduce((n, [, c]) => n + columnsOf(c), 0) * pitch;
  const liberoBlocks = [left, spec.liberoUnderPlayers ? gridRight - liberoWidth : playerX('A')];
  const liberoStart = (block: number, skill: FormSkill) => {
    let cx = liberoBlocks[block]! + numberWidth;
    for (const [s, columns] of liberoSkills) {
      if (s === skill) return cx;
      cx += columnsOf(columns) * pitch;
    }
    return cx;
  };
  const liberoEnd = (block: number) => liberoBlocks[block]! + liberoWidth;

  const row = (index: number, kind: RowKind, y: number, block?: number): FormRow => {
    const half = numberWidth / 2;
    const skills = kind === 'player' ? spec.player : liberoSkills;
    const x0 = block === undefined ? left : liberoBlocks[block]!;
    const cells = skills.flatMap(([skill, columns]) => {
      let cx = block === undefined ? blocks.get(`${kind}:${skill}`)! : liberoStart(block, skill);
      return columns.map(([evaluation, c]) => {
        const result = cell(skill, evaluation, rect(cx, y, c * pitch, rowHeight), c);
        cx += c * pitch;
        return result;
      });
    });
    // v6: two digit boxes at the top, the name on the line under them.
    const digitWidth = 6.5;
    const digitHeight = rowHeight * 0.55;
    const digitsLeft = x0 + (numberWidth - 2 * digitWidth) / 2;
    const numbering = compact
      ? {
          numberDigits: [rect(digitsLeft, y, digitWidth, digitHeight), rect(digitsLeft + digitWidth, y, digitWidth, digitHeight)] as const,
          name: rect(x0, y + digitHeight, numberWidth, rowHeight - digitHeight),
        }
      : { numberDigits: [rect(left, y, half, rowHeight), rect(left + half, y, half, rowHeight)] as const };
    const end = block === undefined ? left + numberWidth + gridWidth : liberoEnd(block);
    // Side by side, the first block hatches up to the second one, the second up to the end of the grid.
    const unused =
      kind === 'player'
        ? []
        : block === undefined
          ? spec.liberoUnused.map(([from, to]) => rect(playerX(from), y, playerX(to) - playerX(from), rowHeight))
          : [rect(end, y, (block === 0 ? liberoBlocks[1]! : gridRight) - end, rowHeight)];
    return {
      index,
      kind,
      outer: rect(x0, y, end - x0, rowHeight),
      number: rect(x0, y, numberWidth, rowHeight),
      ...numbering,
      cells,
      unused,
    };
  };

  const rows = [
    ...Array.from({ length: playerRows }, (_, i) => row(i, 'player', playerTop + i * rowHeight)),
    ...Array.from({ length: liberoRows }, (_, i) =>
      compact ? row(playerRows + i, 'libero', liberoTop, i) : row(playerRows + i, 'libero', liberoTop + i * rowHeight),
    ),
  ];

  // Compact header: left of the centre marker the set and team, opponent; right of it competition, date and score.
  const headerLeft = margin + marker + 4;
  const headerRight = centre + marker + 4;
  const qrSide = compact ? marker : 19;
  const qr = rect(right - 4 - qrSide, margin, qrSide, qrSide);
  const digit = compact ? (dx: number): Rect => rect(dx, margin + 6, 5.5, 6.5) : (dx: number): Rect => rect(dx, 13, 7, 9.5);
  const title = rect(headerLeft, margin, centre - headerLeft - 4, compact ? marker : 20);
  const half = (from: number, to: number, baseline: number) => {
    const width = to - from;
    return [rect(from, baseline - 4, width * 0.55 - 3, 4.6), rect(from + width * 0.55, baseline - 4, width * 0.45, 4.6)] as const;
  };
  // v4 (set printed): the fields beside the big "Set n"; v5: under the set marks.
  const fieldsLeft = spec.setMarks ? title.x : title.x + 30;
  const [first, second] = spec.setMarks ? [title.y + 11, title.y + 16.5] : [title.y + 4.5, title.y + 11];
  const [team, opponent] = compact ? half(title.x, title.x + title.width, margin + 11.5) : half(fieldsLeft, title.x + title.width, first);
  const [competition, date] = compact ? half(headerRight, qr.x - 4, margin + 4.6) : half(fieldsLeft, title.x + title.width, second);
  const fields = [
    { field: 'team' as const, outer: team },
    { field: 'opponent' as const, outer: opponent },
    { field: 'competition' as const, outer: competition },
    { field: 'date' as const, outer: date },
  ];
  // Set bubbles after the "Set" label, then the "extra sheet" bubble.
  const setBubble = 5;
  const setMarks = spec.setMarks
    ? {
        sets: [1, 2, 3, 4, 5].map((n) => ({ ...rect(title.x + 12 + (n - 1) * 6.5, title.y + 0.5, setBubble, setBubble), number: n })),
        extra: rect(title.x + 50, title.y + 1, 4, 4),
      }
    : undefined;
  return {
    version: spec.version,
    hidden: OPTIONAL_FORM_CODES.filter((code) => hidden.includes(code)),
    order: [...order],
    evaluationCaptions,
    page,
    markers: [
      { id: 0, ...rect(margin, margin, marker, marker) },
      { id: 1, ...rect(right, margin, marker, marker) },
      { id: 2, ...rect(right, bottom, marker, marker) },
      { id: 3, ...rect(margin, bottom, marker, marker) },
      { id: 4, ...rect(centre, margin, marker, marker) },
      { id: 5, ...rect(centre, bottom, marker, marker) },
    ],
    markerQuietZone: quietZone,
    qr,
    title,
    ...(setMarks && { setMarks }),
    score: compact
      ? { team: [digit(195), digit(200.5)], opponent: [digit(227), digit(232.5)] }
      : { team: [digit(178), digit(185)], opponent: [digit(214), digit(221)] },
    fields,
    numberHeaders: [
      { kind: 'player', outer: rect(left, gridTop, numberWidth, skillBand + evaluationBand) },
      ...(compact ? liberoBlocks : [left]).map((x0) => ({ kind: 'libero' as const, outer: rect(x0, liberoTop - liberoHeader, numberWidth, liberoHeader) })),
    ],
    skills: [
      ...spec.player.map(([skill, columns]) => header('player', skill, columns, gridTop, skillBand + evaluationBand)),
      ...(compact
        ? liberoBlocks.flatMap((_, block) =>
            liberoSkills.map(([skill, columns]) => header('libero', skill, columns, liberoTop - liberoHeader, liberoHeader, liberoStart(block, skill))),
          )
        : liberoSkills.map(([skill, columns]) => header('libero', skill, columns, liberoTop - liberoHeader, liberoHeader))),
    ],
    rows,
    legend: [
      rect(margin + marker + 4, bottom + 1, centre - (margin + marker + 4) - 4, marker - 2),
      rect(centre + marker + 4, bottom + 1, right - 4 - (centre + marker + 4), marker - 2),
    ],
    cropInset: 0.8,
    compact,
    rowBands: spec.rowBands ?? false,
  };
}

/** Every layout ever printed, by version; new sheets use the current one. */
export const FORM_LAYOUTS: Readonly<Record<number, FormLayout>> = {
  3: buildTallyLayout(V3),
  4: buildTallyLayout(V4),
  5: buildTallyLayout(V5),
  6: buildTallyLayout(V6),
  7: buildTallyLayout({ ...V6, version: 7 }),
  8: buildTallyLayout(V8),
};
export const CURRENT_FORM_LAYOUT = FORM_LAYOUTS[8]!;

/** The code a cell counts, or null for cells of an old layout the app no longer records (v3 dig and graded sets). */
export function cellCode(cell: TallyCell): ScoutCodeString | null {
  if (cell.skill === 'D') return null;
  const code = `${cell.skill}${cell.evaluation}` as ScoutCodeString;
  return SKILL_DEFINITIONS[cell.skill].evaluations[cell.evaluation] !== undefined ? code : null;
}

const v9Layouts = new Map<string, FormLayout>();

/** The code of the columns left out: one bit per OPTIONAL_FORM_CODES. */
export const hiddenMask = (hidden: readonly ScoutCodeString[]) => OPTIONAL_FORM_CODES.reduce((mask, code, i) => (hidden.includes(code) ? mask | (1 << i) : mask), 0);
export const maskHidden = (mask: number) => OPTIONAL_FORM_CODES.filter((_, i) => (mask >> i) & 1);

/** v9 with these columns left out and the skills in this order (each built once). */
export function v9Layout(hidden: readonly ScoutCodeString[], order: FormOrder = DEFAULT_FORM_ORDER): FormLayout {
  const mask = hiddenMask(hidden);
  const key = `${mask}|${order.join('')}`;
  let layout = v9Layouts.get(key);
  if (!layout) {
    layout = buildTallyLayout({ ...V9, hidden: maskHidden(mask), ...(!sameOrder(order, DEFAULT_FORM_ORDER) && { order }) });
    v9Layouts.set(key, layout);
  }
  return layout;
}

/** Every v9 form that can be printed: one per combination of columns left out (at least one). */
export const allV9Layouts = (): FormLayout[] => Array.from({ length: (1 << OPTIONAL_FORM_CODES.length) - 1 }, (_, i) => v9Layout(maskHidden(i + 1)));

/** The form to print with these columns left out and this order: v8 when nothing changes, v9 otherwise. */
export const printableLayout = (hidden: readonly ScoutCodeString[], order: FormOrder = DEFAULT_FORM_ORDER): FormLayout =>
  OPTIONAL_FORM_CODES.some((code) => hidden.includes(code)) || !sameOrder(order, DEFAULT_FORM_ORDER) ? v9Layout(hidden, order) : CURRENT_FORM_LAYOUT;

export function formLayout(version: number, hidden: readonly ScoutCodeString[] = [], order: FormOrder = DEFAULT_FORM_ORDER): FormLayout {
  if (version === 9) return v9Layout(hidden, order);
  const layout = FORM_LAYOUTS[version];
  if (!layout) throw new Error(`unknown scouting form layout v${version}`);
  return layout;
}

/** A rectangle shrunk on every side, e.g. to crop a box without its border. */
export function inset(r: Rect, by: number): Rect {
  return rect(r.x + by, r.y + by, r.width - 2 * by, r.height - 2 * by);
}

/** Shared edges are not overlaps (EPSILON absorbs floating-point rounding of the computed positions). */
const EPSILON = 1e-6;

export function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width - EPSILON &&
    b.x < a.x + a.width - EPSILON &&
    a.y < b.y + b.height - EPSILON &&
    b.y < a.y + a.height - EPSILON
  );
}
