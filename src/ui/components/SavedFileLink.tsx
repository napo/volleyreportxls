/** A link to the file just downloaded, for browsers that ignore a download started after a wait (mobile). */
import { useI18n } from '../../i18n';
import type { SavedFile } from '../../platform/save-file';

export function SavedFileLink({ file }: { file: SavedFile | null }) {
  const { m } = useI18n();
  if (!file?.url) return null;
  return (
    <p className="vr-message">
      <a href={file.url} download={file.fileName} target="_blank" rel="noopener">
        {m.common.pdfReady}
      </a>
    </p>
  );
}
