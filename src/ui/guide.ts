/**
 * The 5-step guide, in a dialog. It does not open at start unless the user
 * turns that on (a preference of this device); it can be opened at any time
 * from the About page.
 */
import { useSyncExternalStore } from 'react';

const KEY = 'volleyreport.show-guide';
const listeners = new Set<() => void>();

function readShowAtStart(): boolean {
  try {
    return globalThis.localStorage?.getItem(KEY) === 'on';
  } catch {
    return false;
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
