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

/**
 * The note shown when scouting on the device starts: the grid or the keypad.
 * "Don't show again" is a preference of this device; the About page opens it anyway.
 */
const MODE_KEY = 'volleyreport.show-scout-mode';
const modeListeners = new Set<() => void>();

function readShowModeNote(): boolean {
  try {
    return globalThis.localStorage?.getItem(MODE_KEY) !== 'off';
  } catch {
    return true;
  }
}

let modeState = { show: readShowModeNote(), open: false };

function setMode(next: Partial<typeof modeState>) {
  modeState = { ...modeState, ...next };
  modeListeners.forEach((notify) => notify());
}

export function setShowScoutModeNote(show: boolean) {
  try {
    globalThis.localStorage?.setItem(MODE_KEY, show ? 'on' : 'off');
  } catch {
    // Kept for this session only.
  }
  setMode({ show });
}

/** When scouting starts: opens the note unless the user turned it off. */
export const openScoutModeNote = () => {
  if (modeState.show) setMode({ open: true });
};
/** From About: always opens. */
export const forceScoutModeNote = () => setMode({ open: true });
export const closeScoutModeNote = () => setMode({ open: false });

export function useScoutModeNote(): { readonly show: boolean; readonly open: boolean } {
  return useSyncExternalStore(
    (notify) => {
      modeListeners.add(notify);
      return () => modeListeners.delete(notify);
    },
    () => modeState,
  );
}
