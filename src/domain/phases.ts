// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * What depends on the order of the touches within a rally, as in the tables at
 * the bottom of the DataVolley scoresheet: the attack on reception (the first
 * attack after a positive or a negative reception), the counter-attack (every
 * other attack), and the points won receiving ("CP", side-out) and serving
 * ("BP", break point). Only a scout who enters the touches in order gives
 * them: the keypad of the live sheet does, the paper form does not.
 */

export interface AttackTally {
  readonly total: number;
  /** A= */
  readonly errors: number;
  /** A/ */
  readonly blocked: number;
  /** A# */
  readonly points: number;
}

export interface PhaseStats {
  /** First attack after a reception "#" or "+". */
  readonly onPositive: AttackTally;
  /** First attack after a reception "!" or "-". */
  readonly onNegative: AttackTally;
  /** Every other attack of a rally followed by the keypad. */
  readonly counter: AttackTally;
  /** Receptions followed by the keypad: the rallies played receiving. */
  readonly receptions: number;
  /** Rallies won receiving (side-out, "punti CP"). */
  readonly sideOuts: number;
  /** Serves followed by the keypad: the rallies played serving. */
  readonly serves: number;
  /** Rallies won serving (break points, "punti BP"). */
  readonly breakPoints: number;
}

export const NO_ATTACKS: AttackTally = { total: 0, errors: 0, blocked: 0, points: 0 };

export const NO_PHASES: PhaseStats = { onPositive: NO_ATTACKS, onNegative: NO_ATTACKS, counter: NO_ATTACKS, receptions: 0, sideOuts: 0, serves: 0, breakPoints: 0 };

const addTally = (a: AttackTally, b: AttackTally): AttackTally => ({
  total: a.total + b.total,
  errors: a.errors + b.errors,
  blocked: a.blocked + b.blocked,
  points: a.points + b.points,
});

export const addPhases = (a: PhaseStats, b: PhaseStats): PhaseStats => ({
  onPositive: addTally(a.onPositive, b.onPositive),
  onNegative: addTally(a.onNegative, b.onNegative),
  counter: addTally(a.counter, b.counter),
  receptions: a.receptions + b.receptions,
  sideOuts: a.sideOuts + b.sideOuts,
  serves: a.serves + b.serves,
  breakPoints: a.breakPoints + b.breakPoints,
});

/** The phases of several sets together; null when none has any. */
export function sumPhases(all: readonly (PhaseStats | undefined)[]): PhaseStats | null {
  const known = all.filter((p): p is PhaseStats => p !== undefined);
  return known.length ? known.reduce(addPhases, NO_PHASES) : null;
}

/** An attack added to a tally, by its evaluation. */
export const withAttack = (tally: AttackTally, evaluation: string): AttackTally => ({
  total: tally.total + 1,
  errors: tally.errors + (evaluation === '=' ? 1 : 0),
  blocked: tally.blocked + (evaluation === '/' ? 1 : 0),
  points: tally.points + (evaluation === '#' ? 1 : 0),
});
