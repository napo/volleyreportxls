// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Dropbox API (v2), only what synchronisation needs. The app has the "App
 * folder" permission: it sees only its own folder, visible in the user's
 * Dropbox, and the archive is found by its path, so the file must stay there:
 * moved or renamed, it counts as deleted and the app writes a new one.
 */

import { SYNC_FILE_NAME } from './file';
import { type Fetch, type RemoteFile, type RemoteStorage, StorageError } from './storage';

const API = 'https://api.dropboxapi.com/2/files';
const CONTENT = 'https://content.dropboxapi.com/2/files';
const PATH = `/${SYNC_FILE_NAME}`;

export const DROPBOX_SCOPE = 'files.content.read files.content.write files.metadata.read';

/** A refused request, with what Dropbox says of it ("path/not_found/…", "path/conflict/file/…"). */
class DropboxError extends StorageError {
  constructor(
    status: number,
    readonly summary: string,
  ) {
    super(status, summary);
  }
}

export class DropboxClient implements RemoteStorage {
  constructor(
    private readonly accessToken: string,
    private readonly fetchFn: Fetch = (input, init) => fetch(input, init),
  ) {}

  private async request(url: string, init: RequestInit): Promise<Response> {
    const response = await this.fetchFn(url, { method: 'POST', ...init, headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}` } });
    if (response.ok) return response;
    const { error_summary: summary = '' } = (await response.json().catch(() => ({}))) as { error_summary?: string };
    throw new DropboxError(response.status, summary);
  }

  private rpc(name: string, args: object): Promise<Response> {
    return this.request(`${API}/${name}`, { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
  }

  private async upload(bytes: Uint8Array, mode: unknown): Promise<RemoteFile> {
    const response = await this.request(`${CONTENT}/upload`, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Dropbox-API-Arg': JSON.stringify({ path: PATH, mode, autorename: false, mute: true, strict_conflict: true }),
      },
      body: new Blob([bytes as BlobPart]),
    });
    return { id: PATH, version: ((await response.json()) as { rev: string }).rev };
  }

  async findArchive(): Promise<RemoteFile | null> {
    const version = await this.version();
    return version ? { id: PATH, version } : null;
  }

  async version(): Promise<string | null> {
    try {
      return ((await (await this.rpc('get_metadata', { path: PATH })).json()) as { rev: string }).rev;
    } catch (e) {
      if (e instanceof DropboxError && e.status === 409 && e.summary.includes('not_found')) return null;
      throw e;
    }
  }

  async download(): Promise<Uint8Array> {
    const response = await this.request(`${CONTENT}/download`, { headers: { 'Dropbox-API-Arg': JSON.stringify({ path: PATH }) } });
    return new Uint8Array(await response.arrayBuffer());
  }

  create(bytes: Uint8Array): Promise<RemoteFile> {
    return this.upload(bytes, 'add');
  }

  async update(_id: string, bytes: Uint8Array, expected: string): Promise<RemoteFile | null> {
    try {
      return await this.upload(bytes, { '.tag': 'update', update: expected });
    } catch (e) {
      if (e instanceof DropboxError && e.status === 409 && e.summary.includes('conflict')) return null;
      throw e;
    }
  }

  /** Dropbox keeps deleted files for a while, and the user can restore them. */
  async trash(): Promise<void> {
    await this.rpc('delete_v2', { path: PATH });
  }
}
