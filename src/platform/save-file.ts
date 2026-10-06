/**
 * Saving a file made by the app (PDFs): the user always chooses where it goes.
 * - Installed apps (Tauri): the system "Save as" dialog.
 * - Browsers with the File System Access API (Chrome, Edge on desktop): the same dialog.
 * - Other browsers (Firefox, Safari, mobile): a download; the browser asks where to save
 *   it when its "always ask where to save files" setting is on.
 *
 * The location is asked first and the file made afterwards: browsers open the dialog only
 * right after a click, and making a PDF can take a moment.
 */
import { isTauriApp } from './updates';

export interface SavedFile {
  readonly fileName: string;
  /** Only in the installed apps. */
  readonly path?: string;
}

export interface FileKind {
  /** Shown in the dialog's filter, e.g. "PDF". */
  readonly description: string;
  readonly type: string;
  readonly extension: string;
}

export const PDF: FileKind = { description: 'PDF', type: 'application/pdf', extension: 'pdf' };

function browserDownload(bytes: Uint8Array, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
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

const isAbort = (error: unknown) => error instanceof DOMException && error.name === 'AbortError';

async function saveInApp(fileName: string, make: () => Promise<Uint8Array>, kind: FileKind): Promise<SavedFile | null> {
  let path: string | null;
  try {
    const { save } = await import('@tauri-apps/plugin-dialog');
    path = await save({ defaultPath: await defaultPath(fileName), filters: [{ name: kind.description, extensions: [kind.extension] }] });
  } catch {
    browserDownload(await make(), fileName, kind.type);
    return { fileName };
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

  const picker = (window as unknown as { showSaveFilePicker?: SaveFilePicker }).showSaveFilePicker;
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
      const writable = await handle.createWritable();
      await writable.write(new Blob([bytes as BlobPart], { type: kind.type }));
      await writable.close();
      return { fileName };
    }
  }
  browserDownload(await make(), fileName, kind.type);
  return { fileName };
}
