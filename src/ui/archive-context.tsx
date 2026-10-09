// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The local archive, opened once and shared by the views. */
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { Archive, requestPersistentStorage } from '../storage/archive';

type ArchiveState = { readonly archive: Archive | null; readonly error: boolean };

const ArchiveContext = createContext<ArchiveState>({ archive: null, error: false });

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ArchiveState>({ archive: null, error: false });
  useEffect(() => {
    let archive: Archive | null = null;
    Archive.open()
      .then((opened) => {
        archive = opened;
        setState({ archive: opened, error: false });
        void requestPersistentStorage();
      })
      .catch(() => setState({ archive: null, error: true }));
    return () => archive?.close();
  }, []);
  return <ArchiveContext.Provider value={state}>{children}</ArchiveContext.Provider>;
}

export const useArchive = () => useContext(ArchiveContext);
