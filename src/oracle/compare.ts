/**
 * Pairs every result cell extracted from the reference workbook with the value
 * computed by the TypeScript logic. Test-only code.
 *
 * The domain follows DataVolley, not VolleyReportXLS, wherever the two define a
 * statistic differently. Such cells are not compared but tagged with the
 * definition change that explains them (DEFINITION_CHANGES), so that every
 * extracted cell is either checked or explicitly accounted for.
 */

import { type Evaluation, type Skill } from '../domain/codes';
import { type SetNumber, SET_NUMBERS } from '../domain/model';
import type { MatchStats, StatLine } from '../domain/stats/aggregate';
import type { SkillStats } from '../domain/stats/skills';
import type { Tabellino, TabellinoLine, TabellinoSetRow } from '../report/tabellino';
import type { OracleBlock, OracleBlocks, OracleValue, WorkbookFixture } from './workbook';

export const DEFINITION_CHANGES = {
  'DV-POS': 'Reception positivity is (# + +) / total ("Pos%" of DataVolley), not (# + + + !) / total.',
  'DV-EFF':
    'Efficiency follows the DataVolley table (serve (#+!/)/tot, reception (#+)/tot, attack (#−/−=)/tot), not (# − =) / total; the DataVolley scoresheet has no Eff% column.',
  'DV-NONE': 'VolleyReportXLS-only indicator with no DataVolley counterpart (serve efficacy/positivity, attack positivity, "Errori").',
  'DV-VP':
    'V-P = points won − points lost in serve, reception and attack (B=, R= R/, A= A/), not points won − (B= + A= + M= + P=) − R=.',
  'DV-LOST': 'Points lost in attack include blocked attacks (A/), as in the DataVolley point-effects table.',
} as const;

export type DefinitionChange = keyof typeof DEFINITION_CHANGES;

export interface Comparison {
  /** Sheet and cell of the workbook value, e.g. `Gioc A!B6`. */
  readonly ref: string;
  /** What the value is, e.g. `#19 set1 R- count`. */
  readonly what: string;
  readonly workbook: number | string | null;
  readonly computed: number | null;
  /** Set when the statistic is intentionally defined differently: the values are not compared. */
  readonly change?: DefinitionChange;
}

type Computed = number | null | { readonly change: DefinitionChange };

const EPSILON = 1e-9;

/**
 * Workbook cells hold numbers, or display placeholders ("-", "", "0") that the
 * scoresheet uses for zero or for "nothing to show"; those match 0 or null.
 */
export function sameValue(workbook: Comparison['workbook'], computed: Comparison['computed']): boolean {
  if (typeof workbook === 'number') return computed !== null && Math.abs(workbook - computed) < EPSILON;
  const placeholder = workbook === null || ['-', ' -', '', '0'].includes(workbook);
  return placeholder && (computed === null || computed === 0);
}

function comparison(ref: string, what: string, workbook: Comparison['workbook'], computed: Computed): Comparison {
  if (computed !== null && typeof computed === 'object') return { ref, what, workbook, computed: null, change: computed.change };
  return { ref, what, workbook, computed };
}

const changed = (change: DefinitionChange) => ({ change });

const SKILL_FIELD: Partial<Record<Skill, 'reception' | 'serve' | 'attack' | 'block' | 'setting'>> = {
  R: 'reception',
  B: 'serve',
  A: 'attack',
  M: 'block',
  P: 'setting',
};

function ratioValue(skill: Skill, ratio: 'efficiency' | 'positivity' | 'efficacy'): Computed {
  if (ratio === 'efficiency') return changed('DV-EFF');
  if (skill === 'R' && ratio === 'positivity') return changed('DV-POS');
  return changed('DV-NONE');
}

function summaryValue(line: StatLine, key: string): Computed {
  switch (key) {
    case 'pointsWon':
      return line.summary.pointsWon;
    case 'receptionErrors':
      return line.reception.errors;
    case 'blockedAttacks':
      return line.attack.blocked;
    case 'receptionEfficiency':
    case 'attackEfficiency':
      return changed('DV-EFF');
    case 'balance':
      return changed('DV-VP');
    case 'errors':
    case 'errorsIncludingReception':
      return changed('DV-NONE');
    default:
      throw new Error(`unknown summary key ${key}`);
  }
}

function compareBlock(sheet: string, label: string, oracle: OracleBlock, line: StatLine): Comparison[] {
  const out: Comparison[] = [];
  const push = (cell: OracleValue, what: string, computed: Computed) =>
    out.push(comparison(`${sheet}!${cell.cell}`, `${label} ${what}`, cell.value, computed));

  for (const [skill, table] of Object.entries(oracle.skills)) {
    const field = SKILL_FIELD[skill as Skill];
    if (!field) throw new Error(`unexpected skill ${skill}`);
    const stats: SkillStats = line[field];
    for (const [code, cell] of Object.entries(table.counts)) {
      push(cell, `${code} count`, stats.counts[code[1] as Evaluation]);
    }
    for (const [code, cell] of Object.entries(table.distribution ?? {})) {
      push(cell, `${code} share`, stats.distribution[code[1] as Evaluation]);
    }
    if (table.total) push(table.total, `${skill} total`, stats.total);
    if (table.distributionTotal) push(table.distributionTotal, `${skill} share total`, stats.total > 0 ? 1 : 0);
    for (const ratio of ['efficiency', 'positivity', 'efficacy'] as const) {
      const cell = table[ratio];
      if (cell) push(cell, `${skill} ${ratio}`, ratioValue(skill as Skill, ratio));
    }
  }
  for (const [key, cell] of Object.entries(oracle.summary)) push(cell, key, summaryValue(line, key));
  return out;
}

function compareBlocks(sheet: string, who: string, oracle: OracleBlocks, match: StatLine, bySet: Record<SetNumber, StatLine>) {
  return [
    ...compareBlock(sheet, `${who} match`, oracle.match, match),
    ...SET_NUMBERS.flatMap((n) => compareBlock(sheet, `${who} set${n}`, oracle[`set${n}`], bySet[n])),
  ];
}

export function comparePlayerSheets(fixture: WorkbookFixture, stats: MatchStats): Comparison[] {
  return Object.values(fixture.oracle.players).flatMap((oracle) => {
    const player = stats.players.find((p) => p.player.number === oracle.number);
    if (!player) throw new Error(`player #${oracle.number} missing from the computed stats`);
    return compareBlocks(oracle.sheet, `#${oracle.number}`, oracle, player.match, player.bySet);
  });
}

export function compareTeamSheet(fixture: WorkbookFixture, stats: MatchStats): Comparison[] {
  return compareBlocks('Squadra', 'team', fixture.oracle.team, stats.team.match, stats.team.bySet);
}

/** Columns of the workbook scoresheet's player and total rows. */
const LINE_COLUMNS: readonly [string, string, (l: TabellinoLine) => Computed][] = [
  ['G', 'points', (l) => l.points.total],
  ['H', 'balance', () => changed('DV-VP')],
  ['J', 'serve total', (l) => l.serve.total],
  ['K', 'serve errors', (l) => l.serve.errors],
  ['L', 'serve points', (l) => l.serve.points],
  ['N', 'reception total', (l) => l.reception.total],
  ['O', 'reception errors', (l) => l.reception.errors],
  ['P', 'reception positivity', () => changed('DV-POS')],
  ['Q', 'reception perfect', (l) => l.reception.perfectRate],
  ['R', 'reception efficiency', () => changed('DV-EFF')],
  ['T', 'attack total', (l) => l.attack.total],
  ['U', 'attack errors', (l) => l.attack.errors],
  ['V', 'attack blocked', (l) => l.attack.blocked],
  ['W', 'attack points', (l) => l.attack.points],
  ['X', 'attack point rate', (l) => l.attack.pointRate],
  ['Y', 'attack efficiency', () => changed('DV-EFF')],
  ['AA', 'block points', (l) => l.blockPoints],
];

const SET_COLUMNS: readonly [string, string, (s: TabellinoSetRow) => Computed][] = [
  ['E', 'serve points won', (s) => s.pointsWon.serve],
  ['F', 'attack points won', (s) => s.pointsWon.attack],
  ['G', 'block points won', (s) => s.pointsWon.block],
  ['H', 'opponent errors', (s) => s.pointsWon.opponentErrors],
  ['J', 'serve total', (s) => s.serve.total],
  ['K', 'serve errors', (s) => s.serve.errors],
  ['L', 'serve points', (s) => s.serve.points],
  ['N', 'reception total', (s) => s.reception.total],
  ['O', 'reception errors', (s) => s.reception.errors],
  ['P', 'reception positivity', () => changed('DV-POS')],
  ['Q', 'reception perfect', (s) => s.reception.perfectRate],
  ['T', 'attack total', (s) => s.attack.total],
  ['U', 'attack errors', (s) => s.attack.errors],
  ['V', 'attack blocked', (s) => s.attack.blocked],
  ['W', 'attack points', (s) => s.attack.points],
  ['X', 'attack point rate', (s) => s.attack.pointRate],
  ['AA', 'block points', (s) => s.blockPoints],
];

export function compareTabellino(fixture: WorkbookFixture, tabellino: Tabellino, stats: MatchStats): Comparison[] {
  const cells = fixture.oracle.tabellino.cells;
  const out: Comparison[] = [];
  const push = (ref: string, what: string, computed: Computed) =>
    out.push(comparison(`Tabellino!${ref}`, what, cells[ref] ?? null, computed));

  push('G2', 'sets won (team)', tabellino.setsWon.team);
  push('G3', 'sets won (opponent)', tabellino.setsWon.opponent);
  SET_NUMBERS.forEach((n, i) => {
    const score = tabellino.setScores.find((s) => s.number === n)?.score ?? null;
    const col = 'IJKLM'[i]!;
    push(`${col}2`, `set${n} score (team)`, score?.team ?? null);
    push(`${col}3`, `set${n} score (opponent)`, score?.opponent ?? null);
  });

  // Rows 7–20 list the roster slots A–N in order.
  fixture.roster.forEach((slot, i) => {
    const row = tabellino.players.find((p) => p.player.number === slot.number);
    if (!row) throw new Error(`player #${slot.number} missing from the scoresheet`);
    for (const [col, what, get] of LINE_COLUMNS) push(`${col}${7 + i}`, `#${slot.number} ${what}`, get(row));
  });
  for (const [col, what, get] of LINE_COLUMNS) push(`${col}21`, `team ${what}`, get(tabellino.totals));

  SET_NUMBERS.forEach((n) => {
    const set = tabellino.sets.find((s) => s.setNumber === n);
    for (const [col, what, get] of SET_COLUMNS) push(`${col}${22 + n}`, `set${n} ${what}`, set ? get(set) : null);
  });

  push('E28', 'errors', changed('DV-NONE'));
  push('E29', 'opponent errors', tabellino.opponentErrors);
  push('M28', 'block errors (M=)', stats.team.match.block.errors);
  push('M29', 'setting errors (P=)', stats.team.match.setting.errors);
  return out;
}

export function compareVintiPersi(fixture: WorkbookFixture, tabellino: Tabellino): Comparison[] {
  const cells = fixture.oracle.vintiPersi;
  const { won, lost } = tabellino.pointsBreakdown;
  const rows: [string, string, Computed][] = [
    // B3 sums attack, serve and block only: opponent errors (B8) are listed apart.
    ['B3', 'won (attack+serve+block)', won.attack + won.serve + won.block],
    ['C3', 'lost', changed('DV-LOST')],
    ['B4', 'won attack', won.attack],
    ['C4', 'lost attack', changed('DV-LOST')],
    ['B5', 'won serve', won.serve],
    ['C5', 'lost serve', lost.B],
    ['B6', 'won block', won.block],
    ['C6', 'lost block', lost.M],
    ['C7', 'lost setting', lost.P],
    ['B8', 'won opponent errors', won.opponentErrors],
  ];
  return rows.map(([ref, what, computed]) =>
    comparison(`Vinti-Persi Squadra!${ref}`, what, cells[ref] ?? null, computed),
  );
}
