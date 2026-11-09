// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The order of the skill columns of the live sheet and of the keypad, as last
 * chosen on this device. Set faults stay last; the printed form keeps its own.
 */
import { DEFAULT_ORDER, type MovableSkill } from './components/counts-columns';

const ORDER_SETTING = 'volleyreport.live.order';

export function lastOrder(): MovableSkill[] {
  try {
    const stored = JSON.parse(localStorage.getItem(ORDER_SETTING) ?? '[]') as unknown;
    if (Array.isArray(stored) && stored.length === DEFAULT_ORDER.length && DEFAULT_ORDER.every((s) => stored.includes(s))) return stored as MovableSkill[];
  } catch {
    // Nothing usable: the order of the form.
  }
  return [...DEFAULT_ORDER];
}

export function rememberOrder(order: readonly MovableSkill[]) {
  try {
    localStorage.setItem(ORDER_SETTING, JSON.stringify(order));
  } catch {
    // Not kept: the order of the form next time.
  }
}
