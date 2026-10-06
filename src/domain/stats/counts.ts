import { type Evaluation, type Skill, EVALUATIONS } from '../codes';
import type { ScoutEvent, SetNumber } from '../model';

export type EvaluationCounts = Readonly<Record<Evaluation, number>>;
export type EvaluationRatios = Readonly<Record<Evaluation, number>>;

/**
 * Share of `part` over `whole`; 0 when there is nothing to divide.
 * This is the `IF(tot>0, x/tot, 0)` guard used throughout the workbook.
 */
export function ratio(part: number, whole: number): number {
  return whole > 0 ? part / whole : 0;
}

export function countEvaluations(events: readonly ScoutEvent[], skill: Skill): EvaluationCounts {
  const counts = Object.fromEntries(EVALUATIONS.map((e) => [e, 0])) as Record<Evaluation, number>;
  for (const event of events) {
    if (event.code.skill === skill) counts[event.code.evaluation] += 1;
  }
  return counts;
}

export function sumCounts(counts: EvaluationCounts, evaluations: readonly Evaluation[] = EVALUATIONS): number {
  return evaluations.reduce((sum, e) => sum + counts[e], 0);
}

export function distribution(counts: EvaluationCounts): EvaluationRatios {
  const total = sumCounts(counts);
  return Object.fromEntries(EVALUATIONS.map((e) => [e, ratio(counts[e], total)])) as Record<Evaluation, number>;
}

export interface EventFilter {
  readonly setNumber?: SetNumber;
  readonly playerNumber?: number;
}

export function filterEvents(events: readonly ScoutEvent[], filter: EventFilter): ScoutEvent[] {
  return events.filter(
    (e) =>
      (filter.setNumber === undefined || e.setNumber === filter.setNumber) &&
      (filter.playerNumber === undefined || e.playerNumber === filter.playerNumber),
  );
}
