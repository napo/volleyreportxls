// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import type { Evaluation, Skill } from '../domain/codes';

/** Qualitative reading aid, independent of the weights used in statistics. */
export type EvaluationTone = 'favourable' | 'intermediate' | 'unfavourable';
export const EVALUATION_TONES: Readonly<Record<Skill, Readonly<Partial<Record<Evaluation, EvaluationTone>>>>> = {
  B: { '#': 'favourable', '+': 'favourable', '!': 'favourable', '-': 'unfavourable', '/': 'favourable', '=': 'unfavourable' },
  R: { '#': 'favourable', '+': 'favourable', '!': 'unfavourable', '-': 'unfavourable', '/': 'unfavourable', '=': 'unfavourable' },
  A: { '#': 'favourable', '+': 'favourable', '!': 'intermediate', '-': 'unfavourable', '/': 'unfavourable', '=': 'unfavourable' },
  M: { '#': 'favourable', '+': 'favourable', '!': 'unfavourable', '-': 'unfavourable', '/': 'unfavourable', '=': 'unfavourable' },
  P: { '=': 'unfavourable' },
  F: { '#': 'favourable', '+': 'favourable', '-': 'unfavourable', '/': 'unfavourable', '=': 'unfavourable' },
};
export const EVALUATION_FILLS: Readonly<Record<EvaluationTone, readonly [number, number, number]>> = {
  favourable: [0.89, 0.95, 0.89],
  intermediate: [1, 0.96, 0.84],
  unfavourable: [0.98, 0.89, 0.87],
};
