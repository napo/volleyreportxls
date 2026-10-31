// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** What synchronisation needs from a cloud service holding the archive file (a fake one in the tests). */

export type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export interface RemoteFile {
  readonly id: string;
  /** Opaque: it only changes when the file changes. */
  readonly version: string;
}

/** A request refused by the service; status 401 means the access token is no longer valid. */
export class StorageError extends Error {
  constructor(
    readonly status: number,
    /** What the service says of it, when it says something: shown to the user with the status. */
    readonly code = '',
  ) {
    super(`storage: ${status} ${code}`);
  }
}

export interface RemoteStorage {
  /** The archive file of the app, or null when there is none (never synchronised, or deleted by the user). */
  findArchive(): Promise<RemoteFile | null>;
  version(id: string): Promise<string | null>;
  download(id: string): Promise<Uint8Array>;
  create(bytes: Uint8Array): Promise<RemoteFile>;
  /** Writes only over the `expected` version; null when another device wrote the file first. */
  update(id: string, bytes: Uint8Array, expected: string): Promise<RemoteFile | null>;
  /** Moves the file to the bin of the service. */
  trash(id: string): Promise<void>;
}
