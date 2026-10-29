// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Google Drive REST API (v3), only what synchronisation needs. The app asks
 * for the drive.file scope: it sees only the files it created, a
 * "VolleyReport" folder and the archive file inside it, both visible in the
 * user's Drive. They are found by a property of the app (appProperties), so
 * the user may rename or move them.
 */

import { SYNC_FILE_NAME } from './file';

const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const PROPERTY = 'volleyreport';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file';

export interface DriveFile {
  readonly id: string;
  /** Increases at every change of the file. */
  readonly version: string;
}

/** A request refused by Drive; status 401 means the access token is no longer valid. */
export class DriveError extends Error {
  constructor(readonly status: number) {
    super(`drive: ${status}`);
  }
}

type Fetch = (input: string, init?: RequestInit) => Promise<Response>;

export class DriveClient {
  constructor(
    private readonly accessToken: string,
    private readonly fetchFn: Fetch = (input, init) => fetch(input, init),
  ) {}

  private async request(url: string, init: RequestInit = {}): Promise<Response> {
    const response = await this.fetchFn(url, { ...init, headers: { ...init.headers, Authorization: `Bearer ${this.accessToken}` } });
    if (!response.ok) throw new DriveError(response.status);
    return response;
  }

  private async find(value: string, extra = ''): Promise<DriveFile | null> {
    const q = `appProperties has { key='${PROPERTY}' and value='${value}' } and trashed=false${extra}`;
    const response = await this.request(`${API}?${new URLSearchParams({ q, spaces: 'drive', fields: 'files(id,version)', orderBy: 'modifiedTime desc' })}`);
    const { files } = (await response.json()) as { files?: DriveFile[] };
    return files?.[0] ?? null;
  }

  /** The archive file of the app, or null when there is none (never synchronised, or deleted by the user). */
  findArchive(): Promise<DriveFile | null> {
    return this.find('archive');
  }

  async version(id: string): Promise<string | null> {
    try {
      const response = await this.request(`${API}/${id}?fields=version,trashed`);
      const file = (await response.json()) as { version: string; trashed?: boolean };
      return file.trashed ? null : file.version;
    } catch (e) {
      if (e instanceof DriveError && e.status === 404) return null;
      throw e;
    }
  }

  async download(id: string): Promise<Uint8Array> {
    return new Uint8Array(await (await this.request(`${API}/${id}?alt=media`)).arrayBuffer());
  }

  private async folder(): Promise<string> {
    const found = await this.find('folder', ` and mimeType='${FOLDER_MIME}'`);
    if (found) return found.id;
    const response = await this.request(`${API}?fields=id`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'VolleyReport', mimeType: FOLDER_MIME, appProperties: { [PROPERTY]: 'folder' } }),
    });
    return ((await response.json()) as { id: string }).id;
  }

  async create(bytes: Uint8Array): Promise<DriveFile> {
    const metadata = { name: SYNC_FILE_NAME, parents: [await this.folder()], mimeType: 'application/zip', appProperties: { [PROPERTY]: 'archive' } };
    const boundary = `volleyreport${Math.random().toString(36).slice(2)}`;
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`,
      `--${boundary}\r\nContent-Type: application/zip\r\n\r\n`,
      bytes as BlobPart,
      `\r\n--${boundary}--`,
    ]);
    const response = await this.request(`${UPLOAD}?uploadType=multipart&fields=id,version`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body,
    });
    return (await response.json()) as DriveFile;
  }

  /** Moves the file to the bin of the user's Drive, where it can still be restored for 30 days. */
  async trash(id: string): Promise<void> {
    await this.request(`${API}/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ trashed: true }) });
  }

  async update(id: string, bytes: Uint8Array): Promise<DriveFile> {
    const response = await this.request(`${UPLOAD}/${id}?uploadType=media&fields=id,version`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/zip' },
      body: new Blob([bytes as BlobPart]),
    });
    return (await response.json()) as DriveFile;
  }
}

/** What synchronisation uses of Drive (a fake one in the tests). */
export type DriveApi = Pick<DriveClient, 'findArchive' | 'version' | 'download' | 'create' | 'update'>;
