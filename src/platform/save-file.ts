// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Saving a file made by the app (PDFs): the user always chooses where it goes.
 * - Installed apps (Tauri): the system "Save as" dialog.
 * - Browsers with the File System Access API (Chrome, Edge on desktop): the same dialog.
 *   Not on phones: Chrome for Android has it, but leaves the file empty.
 * - Other browsers (Firefox, Safari, mobile): a download; the browser asks where to save
 *   it when its "always ask where to save files" setting is on.
 *
 * The location is asked first and the file made afterwards: browsers open the dialog only
 * right after a click, and making a PDF can take a moment.
 *
 * A download started after that moment may be ignored (Safari on iOS, some Android browsers):
 * the result then carries the file's address, for a link the user can tap.
 */
import { isTauriApp } from './updates';

export interface SavedFile {
  readonly fileName: string;
  /** Only in the installed apps. */
  readonly path?: string;
  /** Only for a browser download: the file, for a link the user can tap if the download did not start. */
  readonly url?: string;
}

export interface FileKind {
  /** Shown in the dialog's filter, e.g. "PDF". */
  readonly description: string;
  readonly type: string;
  readonly extension: string;
}

export const PDF: FileKind = { description: 'PDF', type: 'application/pdf', extension: 'pdf' };

// The last file stays available until the next one: mobile browsers read it after a
// confirmation or later on, and the user may tap the link offered with it.
let lastUrl: string | undefined;

function browserDownload(bytes: Uint8Array, fileName: string, type: string): SavedFile {
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  lastUrl = url;
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  // Some browsers follow only links that are in the page.
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  return { fileName, url };
}

/** Dialog opened in the Downloads folder (desktop); just the name where the folder is not known (mobile). */
async function defaultPath(fileName: string) {
  try {
    const { downloadDir, join } = await import('@tauri-apps/api/path');
    return await join(await downloadDir(), fileName);
  } catch {
    return fileName;
  }
}

interface WritableFile {
  createWritable(): Promise<{ write(data: Blob): Promise<void>; close(): Promise<void> }>;
}
type SaveFilePicker = (options: {
  suggestedName: string;
  types: { description: string; accept: Record<string, string[]> }[];
}) => Promise<WritableFile>;

function isPhone() {
  const ua = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return ua.userAgentData?.mobile === true || /Android|iPhone|iPad|Mobile/i.test(navigator.userAgent);
}

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

async function saveInApp(fileName: string, make: () => Promise<Uint8Array>, kind: FileKind): Promise<SavedFile | null> {
  let path: string | null;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    path = await save({ defaultPath: await defaultPath(fileName), filters: [{ name: kind.description, extensions: [kind.extension] }] });
  } catch {
    return browserDownload(await make(), fileName, kind.type);
  }
  if (!path) return null;
  const bytes = await make();
  const { writeFile } = await import('@tauri-apps/plugin-fs');
  await writeFile(path, bytes);
  return { fileName, path };
}

/** The saved file, or null if the user cancels the dialog. */
export async function saveFile(fileName: string, make: () => Promise<Uint8Array>, kind: FileKind = PDF): Promise<SavedFile | null> {
  if (isTauriApp()) return saveInApp(fileName, make, kind);

  // On phones (Chrome for Android) the dialog creates the file but writing to it fails,
  // leaving it empty: a download works there.
  const picker = isPhone() ? undefined : (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
  if (picker) {
    let handle: WritableFile | null = null;
    try {
      handle = await picker({ suggestedName: fileName, types: [{ description: kind.description, accept: { [kind.type]: [`.${kind.extension}`] } }] });
    } catch (error) {
      if (isAbort(error)) return null;
      // Not allowed here (e.g. inside a frame): fall back to a download.
    }
    if (handle) {
      const bytes = await make();
      try {
        const writable = await handle.createWritable();
        await writable.write(new Blob([bytes as BlobPart], { type: kind.type }));
        await writable.close();
        return { fileName };
      } catch {
        // The file could not be written there: download it instead.
        return browserDownload(bytes, fileName, kind.type);
      }
    }
  }
  return browserDownload(await make(), fileName, kind.type);
}
