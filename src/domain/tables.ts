/**
 * Evaluation tables, as in DataVolley 4 ("Tabelle", manual §2.3.4).
 *
 * They decide which evaluations win or lose a point, how efficiency is
 * computed and how the weighted index is built. The defaults are the
 * DataVolley defaults; a coach may adapt them, as DataVolley allows.
 */

import type { Evaluation, Skill } from './codes';

export interface PointEffects {
  /** Evaluations that win the rally ("effetti vinc."). */
  readonly won: readonly Evaluation[];
  /** Evaluations that lose the rally ("effetti perd."). */
  readonly lost: readonly Evaluation[];
}

/** Efficiency "*E%" = (positive − negative) / total. */
export interface EfficiencyRule {
  readonly positive: readonly Evaluation[];
  readonly negative: readonly Evaluation[];
}

/** Index "Ind." = Σ (count × weight) / total × factor. */
export interface IndexRule {
  readonly weights: Readonly<Record<Evaluation, number>>;
  readonly factor: number;
}

export interface EvaluationTables {
  readonly pointEffects: Readonly<Record<Skill, PointEffects>>;
  readonly efficiency: Readonly<Record<Skill, EfficiencyRule>>;
  readonly index: Readonly<Record<Skill, IndexRule>>;
}

const weights = (eq: number, slash: number, minus: number, bang: number, plus: number, hash: number) =>
  ({ '=': eq, '/': slash, '-': minus, '!': bang, '+': plus, '#': hash }) as const;

/**
 * DataVolley 4 defaults (DataVolley skill letters: S=B, B=M, E=P), with one
 * project change: a block net touch (M/) loses the point too.
 */
export const DATAVOLLEY_TABLES: EvaluationTables = {
  pointEffects: {
    B: { won: ['#'], lost: ['='] },
    R: { won: [], lost: ['=', '/'] },
    A: { won: ['#'], lost: ['=', '/'] },
    // DataVolley's default loses the point on M= only; M/ (net touch) is added
    // because it gives the point to the opponent as well (project decision).
    M: { won: ['#'], lost: ['=', '/'] },
    P: { won: [], lost: ['='] },
    F: { won: [], lost: ['='] },
  },
  // Serve and reception use the share of positive touches ("positività"),
  // attack, block and set the positive minus the negative ones (Italian national team system).
  efficiency: {
    B: { positive: ['#', '+', '!', '/'], negative: [] },
    R: { positive: ['#', '+'], negative: [] },
    A: { positive: ['#'], negative: ['/', '='] },
    M: { positive: ['#', '+'], negative: ['/', '='] },
    P: { positive: [], negative: ['='] },
    F: { positive: ['#', '+'], negative: ['/', '='] },
  },
  index: {
    B: { weights: weights(0, 8, 4, 0, 7, 10), factor: 1 },
    R: { weights: weights(-3, -3, -1, 0, 7, 10), factor: 1 },
    A: { weights: weights(0, 0, 5, 0, 5, 10), factor: 1 },
    M: { weights: weights(0, 0, 0, 0, 0, 10), factor: 1 },
    P: { weights: weights(0, 0, 0, 0, 7, 10), factor: 1 },
    F: { weights: weights(0, 0, 0, 0, 0, 10), factor: 1 },
  },
};
