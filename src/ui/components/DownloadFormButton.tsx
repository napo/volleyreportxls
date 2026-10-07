/** Downloads the printable scouting form (PDF, one page per set) in the current language. */
import { useState } from 'react';
import { messagesFor, useI18n } from '../../i18n';
import { saveFile } from '../../platform/save-file';
import { loadLogoPng, loadPdfFonts } from '../pdf-assets';

interface Props {
  readonly label?: string;
  /** Primary button, secondary button, or a link inside a sentence. */
  readonly variant?: 'primary' | 'secondary' | 'link';
}

export function DownloadFormButton({ label, variant = 'primary' }: Props) {
  const { m, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      const { renderScoutingFormPdf } = await import('../../pdf/scouting-form-pdf');
      const texts = messagesFor(lang);
      await saveFile(texts.form.fileName, async () => {
        const [fonts, logoPng] = await Promise.all([loadPdfFonts(), loadLogoPng()]);
        return renderScoutingFormPdf({ fonts, logoPng, texts });
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  const className = variant === 'link' ? 'vr-link-button' : `vr-btn vr-btn-${variant}`;
  return (
    <>
      <button type="button" className={className} onClick={download} disabled={busy}>
        {busy ? m.common.preparing : (label ?? m.info.formButton)}
      </button>
      {failed && <p className="vr-message warning">{m.common.pdfError}</p>}
    </>
  );
}
