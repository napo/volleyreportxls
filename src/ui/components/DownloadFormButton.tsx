// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Downloads the printable scouting form (PDF, one page per set) in the current language.
 * The form is a file published with the site (src/pdf/form-files.ts): in the browser a plain
 * link to it, in the installed apps the "Save as" dialog.
 */
import { useState } from 'react';
import { messagesFor, useI18n } from '../../i18n';
import { saveFile } from '../../platform/save-file';
import { isTauriApp } from '../../platform/updates';
import { FORM_FILES } from '../../pdf/form-files';

interface Props {
  readonly label?: string;
  /** Primary button, secondary button, or a link inside a sentence. */
  readonly variant?: 'primary' | 'secondary' | 'link';
}

export function DownloadFormButton({ label, variant = 'primary' }: Props) {
  const { m, lang } = useI18n();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const url = import.meta.env.BASE_URL + FORM_FILES[lang];
  const fileName = messagesFor(lang).form.fileName;
  const className = variant === 'link' ? 'vr-link-button' : `vr-btn vr-btn-${variant}`;
  const text = label ?? m.info.formButton;

  if (!isTauriApp()) {
    return (
      <a className={className} href={url} download={fileName}>
        {text}
      </a>
    );
  }

  async function download() {
    setBusy(true);
    setFailed(false);
    try {
      await saveFile(fileName, async () => {
        const response = await fetch(url);
        if (!response.ok) throw Error(`${url}: ${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      });
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button type="button" className={className} onClick={download} disabled={busy}>
        {busy ? m.common.preparing : text}
      </button>
      {failed && <p className="vr-message warning">{m.common.pdfError}</p>}
    </>
  );
}
