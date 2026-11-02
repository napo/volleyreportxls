// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** "PDF": the user chooses the blocks of the page to put in the report PDF, then saves it. */
import { useRef, useState } from 'react';
import { type SavedFile, saveFile } from '../../platform/save-file';
import { type ShareKind, type ShareSection, SHARE_SECTIONS } from '../../share/payload';
import { useI18n } from '../../i18n';
import { SavedFileLink } from './SavedFileLink';

/** "Analisi storica - Volley Lago.pdf" */
export const reportFileName = (title: string) => `${title.replace(/\s*·\s*/g, ' - ').replace(/[\\/:*?"<>|]/g, '_')}.pdf`;

interface Props {
  readonly kind: ShareKind;
  readonly fileName: string;
  /** The PDF with the chosen blocks (loaded only when asked: PDF library and charts are heavy). */
  readonly make: (sections: ReadonlySet<ShareSection>) => Promise<Uint8Array>;
}

export function ReportPdfButton({ kind, fileName, make }: Props) {
  const { m } = useI18n();
  const t = m.reportPdf;
  const dialog = useRef<HTMLDialogElement>(null);
  const [chosen, setChosen] = useState<ReadonlySet<ShareSection>>(new Set(SHARE_SECTIONS[kind]));
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<SavedFile | null>(null);

  const toggle = (section: ShareSection) => {
    const next = new Set(chosen);
    if (!next.delete(section)) next.add(section);
    setChosen(next);
  };
  const create = async () => {
    setBusy(true);
    setFailed(false);
    setSaved(null);
    try {
      setSaved(await saveFile(fileName, () => make(chosen)));
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className="vr-btn vr-btn-secondary"
        onClick={() => {
          setSaved(null);
          setFailed(false);
          dialog.current?.showModal();
        }}
      >
        {t.button}
      </button>
      <dialog ref={dialog} className="vr-guide vr-share" aria-labelledby="vr-pdf-title">
        <div className="vr-guide-head">
          <h2 id="vr-pdf-title">{t.title}</h2>
          <button type="button" className="vr-icon-button" aria-label={m.share.close} onClick={() => dialog.current?.close()}>
            ×
          </button>
        </div>
        <p>{t.intro}</p>
        <fieldset className="vr-choices">
          <legend>{t.blocks}</legend>
          {SHARE_SECTIONS[kind].map((section) => (
            <label key={section} className="vr-choice">
              <input type="checkbox" checked={chosen.has(section)} onChange={() => toggle(section)} />
              {m.share.sectionNames[section]}
            </label>
          ))}
        </fieldset>
        {failed && <p className="vr-message warning">{m.common.pdfError}</p>}
        <SavedFileLink file={saved} />
        <div className="vr-actions start">
          <button type="button" className="vr-btn vr-btn-primary" onClick={create} disabled={busy || chosen.size === 0}>
            {busy ? t.preparing : t.create}
          </button>
          {chosen.size === 0 && <span className="vr-note">{t.none}</span>}
        </div>
      </dialog>
    </>
  );
}
