// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The 5-step guide shown in a dialog when the app starts. The user can turn
 * it off (a preference of this device) and turn it on again, or open it at
 * any time, from the About page.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'volleyreport.show-guide';
const listeners = new Set<() => void>();

function readShowAtStart(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) !== 'off';
  } catch {
    return true;
  }
}

let state = { showAtStart: readShowAtStart(), open: readShowAtStart() };

function set(next: Partial<typeof state>) {
  state = { ...state, ...next };
  listeners.forEach((notify) => notify());
}

export function setShowGuideAtStart(show: boolean) {
  try {
    globalThis.localStorage?.setItem(KEY, show ? 'on' : 'off');
  } catch {
    // Kept for this session only.
  }
  set({ showAtStart: show });
}

export const openGuide = () => set({ open: true });
export const closeGuide = () => set({ open: false });

export function useGuide(): { readonly showAtStart: boolean; readonly open: boolean } {
  return useSyncExternalStore(
    (notify) => {
      listeners.add(notify);
      return () => listeners.delete(notify);
    },
    () => state,
  );
}
