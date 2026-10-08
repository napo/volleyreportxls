/** Saving matches to a .vrp file and reading them back. */
import type { MatchRecord } from '../matches/record';
import { VRP_EXTENSION, VRP_MEDIA_TYPE, exportVrp, importVrp, vrpFileName } from '../matches/vrp';
import { type FileKind, saveFile } from '../platform/save-file';
import type { Archive, ImportResult } from '../storage/archive';
import { APP_VERSION } from '../version';

/** The matches, with the athletes their players are linked to. */
export function exportMatches(archive: Archive | null, records: readonly MatchRecord[], description: string) {
  const kind: FileKind = { description, type: VRP_MEDIA_TYPE, extension: VRP_EXTENSION };
  return saveFile(vrpFileName(records), async () => exportVrp(records, APP_VERSION, new Date(), (await archive?.listAthletes()) ?? []), kind);
}

/** Throws VrpError when the file is not a valid .vrp. */
export async function importMatchFile(archive: Archive, file: File): Promise<ImportResult> {
  const { matches, athletes } = importVrp(new Uint8Array(await file.arrayBuffer()));
  await archive.importAthletes(athletes);
  return archive.importMatches(matches);
}
