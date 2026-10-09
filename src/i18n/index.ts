// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Language of the app: Italian or English.
 * - First start: the system language (Italian if it is Italian, English otherwise).
 * - A choice made in the language menu is remembered on this device and wins over the system.
 * Texts live in it.ts (the reference) and en.ts (same shape, checked by the compiler).
 */
import { useSyncExternalStore } from 'react';
import { en } from './en';
import { type Messages, it } from './it';

export type Lang = 'it' | 'en';
export type { Messages };

export const LANGUAGES: readonly { readonly lang: Lang; readonly name: string }[] = [
  { lang: 'it', name: 'Italiano' },
  { lang: 'en', name: 'English' },
];

const MESSAGES: Readonly<Record<Lang, Messages>> = { it, en };
const STORAGE_KEY = 'volleyreport.lang';

/** Italian when the first preferred system language is Italian, English otherwise. */
export function systemLang(languages: readonly string[] = globalThis.navigator?.languages ?? []): Lang {
  const first = languages[0] ?? globalThis.navigator?.language ?? '';
  return first.toLowerCase().startsWith('it') ? 'it' : 'en';
}

function storedLang(): Lang | null {
  try {
    const value = globalThis.localStorage?.getItem(STORAGE_KEY);
    return value === 'it' || value === 'en' ? value : null;
  } catch {
    return null;
  }
}

let current: Lang = storedLang() ?? systemLang();
const listeners = new Set<() => void>();

function apply(lang: Lang) {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = lang;
  document.title = MESSAGES[lang].appTitle;
}
apply(current);

/** The user's choice: it becomes the default every time the app opens. */
export function setLang(lang: Lang) {
  current = lang;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, lang);
  } catch {
    // Remembered for this session only.
  }
  apply(lang);
  listeners.forEach((notify) => notify());
}

export const currentLang = (): Lang => current;
export const messagesFor = (lang: Lang): Messages => MESSAGES[lang];

export function useI18n(): { readonly lang: Lang; readonly m: Messages } {
  const lang = useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => current,
  );
  return { lang, m: MESSAGES[lang] };
}
