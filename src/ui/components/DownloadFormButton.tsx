// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Downloads the printable scouting form in the current language. A window
 * first asks which "!" and "/" columns to print (the last choice of the
 * device): with all of them, the form published with the site (a plain file,
 * made at build time, src/pdf/form-files.ts); without some, a v9 form made
 * here, whose other columns are wider and whose bubbles are ovals, with the
 * columns left out in its QR code.
 */
import { useState } from 'react';
import type { ScoutCodeString } from '../../domain/codes';
import { messagesFor, useI18n } from '../../i18n';
import { OPTIONAL_FORM_CODES, printableLayout } from '../../pdf/layout';
import { FORM_FILES } from '../../pdf/form-files';
import { type SavedFile, saveFile } from '../../platform/save-file';
import { isTauriApp } from '../../platform/updates';
import { rememberUntracked } from '../untracked-setting';
import { ColumnsChoice } from './ColumnsChoice';
import { SavedFileLink } from './SavedFileLink';

interface Props {
  readonly label?: string;
  /** Primary button, secondary button, or a link inside a sentence. */
  readonly variant?: 'primary' | 'secondary' | 'link';
}

export function DownloadFormButton({ label, variant = 'primary' }: Props) {
  const { m, lang } = useI18n();
  const [choosing, setChoosing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<SavedFile | null>(null);
  const className = variant === 'link' ? 'vr-link-button' : `vr-btn vr-btn-${variant}`;
  const text = label ?? m.info.formButton;

  async function download(hidden: readonly ScoutCodeString[]) {
    setChoosing(false);
    // Every column, in a browser: a plain link to the published file, followed at once within the tap
    // (phones download a real file far more reliably than one made in the page).
    if (hidden.length === 0 && !isTauriApp()) {
      rememberUntracked(hidden);
      const link = document.createElement('a');
      link.href = import.meta.env.BASE_URL + FORM_FILES[lang];
      link.download = messagesFor(lang).form.fileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      return;
    }
    setBusy(true);
    setFailed(false);
    setSaved(null);
    rememberUntracked(hidden);
    const texts = messagesFor(lang);
    try {
      const file = await saveFile(texts.form.fileName, async () => {
        if (hidden.length === 0) {
          // Every column: the form published with the site.
          const url = import.meta.env.BASE_URL + FORM_FILES[lang];
          const response = await fetch(url);
          if (!response.ok) throw Error(`${url}: ${response.status}`);
          return new Uint8Array(await response.arrayBuffer());
        }
        const [{ renderScoutingFormPdf }, { loadPdfFonts, loadLogoPng }] = await Promise.all([import('../../pdf/scouting-form-pdf'), import('../pdf-assets')]);
        const [fonts, logoPng] = await Promise.all([loadPdfFonts(), loadLogoPng()]);
        return renderScoutingFormPdf({ layout: printableLayout(hidden), fonts, logoPng, texts });
      });
      // A link for the browsers that ignore a download started a moment after the tap.
      if (file?.url && !isTauriApp()) setSaved(file);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={() => setChoosing(true)} disabled={busy}>
        {busy ? m.common.preparing : text}
      </button>
      {failed && <p className="vr-message warning">{m.common.pdfError}</p>}
      {saved && <SavedFileLink file={saved} />}
      {choosing && <FormColumnsDialog onCancel={() => setChoosing(false)} onConfirm={download} />}
    </>
  );
}

/** The "!" and "/" columns to print, skill by skill; "#", "+", "-" and "=" are always there. */
function FormColumnsDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (hidden: ScoutCodeString[]) => void }) {
  const { m } = useI18n();
  const t = m.formColumns;
  // Every column selected at first: the standard form, unless the user leaves some out.
  const [hidden, setHidden] = useState<ReadonlySet<ScoutCodeString>>(new Set());
  return (
    <div className="vr-live-overlay" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form
        className="vr-live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vr-form-columns-title"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(OPTIONAL_FORM_CODES.filter((code) => hidden.has(code)));
        }}
      >
        <h2 id="vr-form-columns-title">{t.title}</h2>
        <p>{t.text}</p>
        <ColumnsChoice hidden={hidden} onChange={setHidden} />
        <p className="vr-note">{hidden.size === 0 ? t.standard : t.custom}</p>
        <div className="vr-live-dialog-actions">
          <button type="button" className="vr-btn vr-btn-secondary" onClick={onCancel}>
            {t.cancel}
          </button>
          <button type="submit" className="vr-btn vr-btn-primary">
            {t.download}
          </button>
        </div>
      </form>
    </div>
  );
}
