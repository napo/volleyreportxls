// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Accessibility choices of this device: colours for colour blindness, larger
 * text, high contrast, less motion, a highly legible typeface, the data of
 * the charts always in tables, explanations always in view.
 *
 * Contrast and motion follow the system until the user chooses. The choices
 * are written on <html> as data attributes (for the CSS) and read by the
 * charts, like the language.
 */
import { useSyncExternalStore } from 'react';

export interface A11y {
  /** Blue and orange instead of green and red. */
  readonly colorblind: boolean;
  /** 0 normal, 1 large, 2 larger. */
  readonly text: 0 | 1 | 2;
  readonly contrast: boolean;
  /** No animations, no smooth scrolling. */
  readonly still: boolean;
  /** Atkinson Hyperlegible Next for the text. */
  readonly legible: boolean;
  /** Every "Show the data" open. */
  readonly tables: boolean;
  /** What every indicator measures, next to it. */
  readonly explain: boolean;
}

const STORAGE_KEY = 'volleyreport.a11y';

const query = (q: string) => globalThis.matchMedia?.(q).matches ?? false;

/** What the system asks for, before any choice in the app. */
const system = (): A11y => ({
  colorblind: false,
  text: 0,
  contrast: query('(prefers-contrast: more)'),
  still: query('(prefers-reduced-motion: reduce)'),
  legible: false,
  tables: false,
  explain: false,
});

function stored(): Partial<A11y> {
  try {
    const value: unknown = JSON.parse(globalThis.localStorage?.getItem(STORAGE_KEY) ?? '{}');
    if (typeof value !== 'object' || value === null) return {};
    const v = value as Record<string, unknown>;
    const flag = (k: keyof A11y) => (typeof v[k] === 'boolean' ? { [k]: v[k] } : {});
    return {
      ...flag('colorblind'),
      ...flag('contrast'),
      ...flag('still'),
      ...flag('legible'),
      ...flag('tables'),
      ...flag('explain'),
      ...(v.text === 0 || v.text === 1 || v.text === 2 ? { text: v.text } : {}),
    };
  } catch {
    return {};
  }
}

let choices = stored();
let current: A11y = { ...system(), ...choices };
const listeners = new Set<() => void>();

function apply() {
  if (typeof document === 'undefined') return;
  const d = document.documentElement.dataset;
  const set = (key: string, on: boolean, value = 'on') => (on ? (d[key] = value) : delete d[key]);
  set('colorblind', current.colorblind);
  set('text', current.text > 0, String(current.text));
  set('contrast', current.contrast);
  set('still', current.still);
  set('legible', current.legible);
}

function update() {
  current = { ...system(), ...choices };
  apply();
  listeners.forEach((notify) => notify());
}
apply();

// A change of the system settings counts until the user chooses in the app.
for (const q of ['(prefers-contrast: more)', '(prefers-reduced-motion: reduce)']) {
  globalThis.matchMedia?.(q).addEventListener?.('change', update);
}

function save() {
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(choices));
  } catch {
    // Kept for this session only.
  }
}

export function setA11y(change: Partial<A11y>) {
  choices = { ...choices, ...change };
  save();
  update();
}

/** Back to the system settings. */
export function resetA11y() {
  choices = {};
  save();
  update();
}

export const a11y = (): A11y => current;

/** Whether anything differs from the system settings. */
export const a11yChanged = () => Object.keys(choices).length > 0;

export function useA11y(): A11y {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => current,
  );
}

/** "smooth", unless the user (or the system) asked for less motion. */
export const scrollBehavior = (): ScrollBehavior => (current.still ? 'auto' : 'smooth');
