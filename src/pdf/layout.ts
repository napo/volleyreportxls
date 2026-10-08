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
  /** "+" bubble: filled when all the bubbles are used; the total is then entered in the app. */
  readonly overflow: Rect;
}

export type RowKind = 'player' | 'libero';

export interface FormRow {
  readonly index: number;
  readonly kind: RowKind;
  readonly outer: Rect;
  /** Shirt number area, two digit boxes written by hand. */
  readonly number: Rect;
  readonly numberDigits: readonly [Rect, Rect];
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
  readonly page: { readonly width: number; readonly height: number };
  readonly markers: readonly MarkerPlacement[];
  /** Blank margin to keep around every marker. */
  readonly markerQuietZone: number;
  readonly qr: Rect;
  readonly title: Rect;
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
}

const rect = (x: number, y: number, width: number, height: number): Rect => ({ x, y, width, height });

/** Bubble rows in every cell; a cell `columns` wide holds 3 × columns − 1 bubbles plus "+". */
const BUBBLE_ROWS = 3;

/** Columns per evaluation, in skill order; capacity = 3 × columns − 1 bubbles. */
type Columns = readonly (readonly [Evaluation, number])[];
type SkillColumns = readonly (readonly [FormSkill, Columns])[];

const SERVE: Columns = [['#', 2], ['+', 3], ['!', 2], ['-', 3], ['/', 2], ['=', 2]]; // 5 8 5 8 5 5
const RECEPTION: Columns = [['#', 3], ['+', 3], ['!', 3], ['-', 3], ['/', 2], ['=', 2]]; // 8 8 8 8 5 5
const ATTACK: Columns = [['#', 4], ['+', 3], ['!', 2], ['-', 3], ['/', 2], ['=', 3]]; // 11 8 5 8 5 8
const BLOCK: Columns = [['#', 2], ['+', 2], ['!', 2], ['-', 1], ['/', 1], ['=', 2]]; // 5 5 5 2 2 5

interface LayoutSpec {
  readonly version: number;
  readonly player: SkillColumns;
  /** Libero blocks, each starting at the x of a player block ("under") or right after the previous one. */
  readonly libero: readonly { readonly skill: FormSkill; readonly columns: Columns; readonly under?: FormSkill }[];
  /** Player blocks hatched in the libero rows, as [from, to) ranges of player skills. */
  readonly liberoUnused: readonly (readonly [FormSkill, FormSkill])[];
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

const columnsOf = (columns: Columns) => columns.reduce((n, [, c]) => n + c, 0);

function buildTallyLayout(spec: LayoutSpec): FormLayout {
  const page = { width: 297, height: 210 }; // A4 landscape
  const margin = 7;
  const marker = 12;
  const quietZone = 2;
  const right = page.width - margin - marker;
  const bottom = page.height - margin - marker;
  const centre = (page.width - marker) / 2;

  const left = margin;
  const numberWidth = 11;
  const gridWidth = 272;
  const gridLeft = left + numberWidth;
  const pitch = gridWidth / spec.player.reduce((n, [, c]) => n + columnsOf(c), 0);

  const skillBand = 4;
  const evaluationBand = 4;
  const liberoHeader = 6;
  const playerRows = 12;
  const liberoRows = 2;
  const playerTop = 29 + skillBand + evaluationBand;
  const rowsBottom = bottom - quietZone - 0.5;
  const rowHeight = (rowsBottom - playerTop - liberoHeader) / (playerRows + liberoRows);
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

  const header = (kind: RowKind, skill: FormSkill, columns: Columns, top: number, height: number): SkillHeader => {
    const x0 = blocks.get(`${kind}:${skill}`)!;
    const evaluations = [];
    let cx = x0;
    for (const [evaluation, c] of columns) {
      evaluations.push({ evaluation, outer: rect(cx, top + height / 2, c * pitch, height / 2) });
      cx += c * pitch;
    }
    return { kind, skill, label: FORM_SKILL_LABELS[skill], outer: rect(x0, top, columnsOf(columns) * pitch, height / 2), evaluations };
  };

  const pad = 0.3;
  const cell = (skill: FormSkill, evaluation: Evaluation, outer: Rect, columns: number): TallyCell => {
    const pitchX = (outer.width - 2 * pad) / columns;
    const pitchY = (outer.height - 2 * pad) / BUBBLE_ROWS;
    const d = Math.min(pitchX, pitchY) * 0.82;
    const slot = (i: number): Rect => {
      const cx = outer.x + pad + pitchX * ((i % columns) + 0.5);
      const cy = outer.y + pad + pitchY * (Math.floor(i / columns) + 0.5);
      return rect(cx - d / 2, cy - d / 2, d, d);
    };
    const slots = columns * BUBBLE_ROWS;
    return {
      skill,
      evaluation,
      outer,
      bubbles: Array.from({ length: slots - 1 }, (_, i) => ({ ...slot(i), number: i + 1 })),
      overflow: slot(slots - 1),
    };
  };

  const row = (index: number, kind: RowKind, y: number): FormRow => {
    const half = numberWidth / 2;
    const skills = kind === 'player' ? spec.player : liberoSkills;
    const cells = skills.flatMap(([skill, columns]) => {
      let cx = blocks.get(`${kind}:${skill}`)!;
      return columns.map(([evaluation, c]) => {
        const result = cell(skill, evaluation, rect(cx, y, c * pitch, rowHeight), c);
        cx += c * pitch;
        return result;
      });
    });
    return {
      index,
      kind,
      outer: rect(left, y, numberWidth + gridWidth, rowHeight),
      number: rect(left, y, numberWidth, rowHeight),
      numberDigits: [rect(left, y, half, rowHeight), rect(left + half, y, half, rowHeight)],
      cells,
      unused: kind === 'libero' ? spec.liberoUnused.map(([from, to]) => rect(playerX(from), y, playerX(to) - playerX(from), rowHeight)) : [],
    };
  };

  const rows = [
    ...Array.from({ length: playerRows }, (_, i) => row(i, 'player', playerTop + i * rowHeight)),
    ...Array.from({ length: liberoRows }, (_, i) => row(playerRows + i, 'libero', liberoTop + i * rowHeight)),
  ];

  const digit = (dx: number): Rect => rect(dx, 13, 7, 9.5);
  return {
    version: spec.version,
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
    qr: rect(right - 4 - 19, margin, 19, 19),
    title: rect(margin + marker + 4, margin, centre - (margin + marker + 4) - 4, 20),
    score: {
      team: [digit(178), digit(185)],
      opponent: [digit(214), digit(221)],
    },
    numberHeaders: [
      { kind: 'player', outer: rect(left, 29, numberWidth, skillBand + evaluationBand) },
      { kind: 'libero', outer: rect(left, liberoTop - liberoHeader, numberWidth, liberoHeader) },
    ],
    skills: [
      ...spec.player.map(([skill, columns]) => header('player', skill, columns, 29, skillBand + evaluationBand)),
      ...liberoSkills.map(([skill, columns]) => header('libero', skill, columns, liberoTop - liberoHeader, liberoHeader)),
    ],
    rows,
    legend: [
      rect(margin + marker + 4, bottom + 1, centre - (margin + marker + 4) - 4, marker - 2),
      rect(centre + marker + 4, bottom + 1, right - 4 - (centre + marker + 4), marker - 2),
    ],
    cropInset: 0.8,
  };
}

/** Every layout ever printed, by version; new sheets use the current one. */
export const FORM_LAYOUTS: Readonly<Record<number, FormLayout>> = { 3: buildTallyLayout(V3), 4: buildTallyLayout(V4) };
export const CURRENT_FORM_LAYOUT = FORM_LAYOUTS[4]!;

/** The code a cell counts, or null for cells of an old layout the app no longer records (v3 dig and graded sets). */
export function cellCode(cell: TallyCell): ScoutCodeString | null {
  if (cell.skill === 'D') return null;
  const code = `${cell.skill}${cell.evaluation}` as ScoutCodeString;
  return SKILL_DEFINITIONS[cell.skill].evaluations[cell.evaluation] !== undefined ? code : null;
}

export function formLayout(version: number): FormLayout {
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
