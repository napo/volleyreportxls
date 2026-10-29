// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Colours of the evaluations, shared by the charts, the printed form and the
 * live sheet: the official VolleyReportXLS palette (theme of the workbook's
 * charts), from green for what goes well to red for what goes badly.
 *
 * A colour belongs to a place on the scale of the skill, not to a symbol: the
 * serve "/" is the second best and is light green, the reception "/" is
 * orange. See EVALUATION_SCALES.
 */

import { EVALUATION_SCALES, type Evaluation, type Skill } from '../domain/codes';

/** From the most to the least favourable place on a scale. */
export const SCALE_COLORS = ['#00ff00', '#90ee90', '#adff2f', '#ffff99', '#f79646', '#ff0000'] as const;

/** Ink for a label drawn inside a fill: dark on the light fills, white on red. */
export const SCALE_LABELS = ['#383838', '#383838', '#383838', '#383838', '#383838', '#ffffff'] as const;

/** Place of an evaluation on the scale of its skill, 0 = most favourable. */
export const scalePlace = (skill: Skill, evaluation: Evaluation) => EVALUATION_SCALES[skill].indexOf(evaluation);

export const evaluationColor = (skill: Skill, evaluation: Evaluation) => SCALE_COLORS[scalePlace(skill, evaluation)]!;

/**
 * The colour of an evaluation mixed with white, as 0–1 RGB: for printed
 * backgrounds, where the full colours would hide black text, above all in
 * black and white (pure red prints as a dark grey).
 */
export function evaluationTint(skill: Skill, evaluation: Evaluation, strength = 0.55): [number, number, number] {
  const hex = evaluationColor(skill, evaluation);
  return [1, 3, 5].map((i) => 1 - strength + (strength * parseInt(hex.slice(i, i + 2), 16)) / 255) as [number, number, number];
}
