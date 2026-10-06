/**
 * Columns of the manual entry, as on the paper form: players have serve,
 * reception, attack, block and set faults (P=); liberos reception and set faults.
 */
import { type Evaluation, EVALUATIONS, type ScoutCodeString, type Skill, SKILL_DEFINITIONS } from '../../domain/codes';
import type { RowKind, TallyRowRecord } from '../../matches/record';

export interface SkillColumns {
  readonly skill: Skill;
  readonly evaluations: readonly Evaluation[];
}

const columns = (skill: Skill): SkillColumns => ({
  skill,
  evaluations: EVALUATIONS.filter((e) => SKILL_DEFINITIONS[skill].evaluations[e] !== undefined),
});

const SKILLS: Readonly<Record<RowKind, readonly SkillColumns[]>> = {
  player: (['B', 'R', 'A', 'M', 'P'] as const).map(columns),
  libero: (['R', 'P'] as const).map(columns),
};

export const skillColumns = (kind: RowKind): readonly SkillColumns[] => SKILLS[kind];

export const codeOf = (skill: Skill, evaluation: Evaluation) => `${skill}${evaluation}` as ScoutCodeString;

export const skillTotal = (row: TallyRowRecord, columns: SkillColumns) =>
  columns.evaluations.reduce((n, e) => n + (row.counts[codeOf(columns.skill, e)] ?? 0), 0);

/** Every touch of the row, shown or not. */
export const rowTotal = (row: TallyRowRecord) => Object.values(row.counts).reduce((n: number, v) => n + (v ?? 0), 0);

/** Digits only; empty means zero. */
export function parseCount(text: string): number {
  const digits = text.replace(/\D/g, '');
  return digits === '' ? 0 : Math.min(999, Number(digits));
}

export function parseShirtNumber(text: string): number | null {
  const digits = text.replace(/\D/g, '').slice(0, 2);
  return digits === '' ? null : Number(digits);
}
