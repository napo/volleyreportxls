// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The local archive, opened once and shared by the views, with the
 * synchronisation with Google Drive. `revision` grows when a synchronisation
 * brings changes from other devices: the views listing the archive reload.
 */
import { type ReactNode, createContext, useContext, useEffect, useState } from 'react';
import { Archive, requestPersistentStorage } from '../storage/archive';
import { SyncController, type SyncStatus } from '../sync/controller';
import { APP_VERSION } from '../version';

type ArchiveState = { readonly archive: Archive | null; readonly error: boolean; readonly revision: number; readonly sync: SyncController | null };

const ArchiveContext = createContext<ArchiveState>({ archive: null, error: false, revision: 0, sync: null });

export function ArchiveProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ArchiveState>({ archive: null, error: false, revision: 0, sync: null });
  useEffect(() => {
    let archive: Archive | null = null;
    let sync: SyncController | null = null;
    let stop = () => {};
    Archive.open()
      .then((opened) => {
        archive = opened;
        sync = new SyncController(opened, APP_VERSION);
        stop = opened.onChange((origin) => origin === 'sync' && setState((s) => ({ ...s, revision: s.revision + 1 })));
        setState({ archive: opened, error: false, revision: 0, sync });
        void requestPersistentStorage();
        void sync.init();
      })
      .catch(() => setState({ archive: null, error: true, revision: 0, sync: null }));
    return () => {
      stop();
      sync?.dispose();
      archive?.close();
    };
  }, []);
  return <ArchiveContext.Provider value={state}>{children}</ArchiveContext.Provider>;
}

export const useArchive = () => useContext(ArchiveContext);

/** The synchronisation and its state, updated as it changes. */
export function useSync(): { readonly sync: SyncController | null; readonly status: SyncStatus | null } {
  const { sync } = useArchive();
  const [status, setStatus] = useState<SyncStatus | null>(sync?.status ?? null);
  useEffect(() => {
    if (!sync) return;
    setStatus(sync.status);
    return sync.subscribe(setStatus);
  }, [sync]);
  return { sync, status };
}
