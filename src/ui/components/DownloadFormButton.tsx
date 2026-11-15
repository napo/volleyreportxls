// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Downloads the printable scouting form in the current language. A window
 * first asks which "!" and "/" columns to print (the last choice of the
 * device): with all of them, the form published with the site (a plain file,
 * made at build time, src/pdf/form-files.ts); without some, a v9 form made
 * here, whose other columns are wider and whose bubbles are ovals, with the
 * columns left out in its QR code. The skills can also be printed in another
 * order (the one of the live sheet on this device), a v9 form with that order in its QR.
 */
import { useState } from 'react';
import type { ScoutCodeString } from '../../domain/codes';
import { messagesFor, useI18n } from '../../i18n';
import { DEFAULT_FORM_ORDER, DEFAULT_FORM_ROWS, MAX_FORM_ROWS, MIN_FORM_ROWS, OPTIONAL_FORM_CODES, isFormRows, printableLayout } from '../../pdf/layout';
import { FORM_FILES } from '../../pdf/form-files';
import { type SavedFile, saveFile } from '../../platform/save-file';
import { isTauriApp } from '../../platform/updates';
import { rememberUntracked } from '../untracked-setting';
import { lastOrder, rememberOrder } from '../skill-order-setting';
import type { MovableSkill } from './counts-columns';
import { OrderChoice } from './OrderChoice';
import { ColumnsChoice } from './ColumnsChoice';
import { SavedFileLink } from './SavedFileLink';

/** The player rows last printed on this device (twelve at first). */
const ROWS_SETTING = 'volleyreport.form.rows';

function lastRows(): number {
  try {
    const stored = Number(localStorage.getItem(ROWS_SETTING));
    return isFormRows(stored) ? stored : DEFAULT_FORM_ROWS;
  } catch {
    return DEFAULT_FORM_ROWS;
  }
}

function rememberRows(rows: number) {
  try {
    localStorage.setItem(ROWS_SETTING, String(rows));
  } catch {
    // Not kept: twelve next time.
  }
}

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

  async function download(hidden: readonly ScoutCodeString[], order: readonly MovableSkill[], rows: number) {
    setChoosing(false);
    rememberOrder(order);
    rememberRows(rows);
    // The form published with the site has the standard order and twelve rows.
    const standardOrder = order.join('') === DEFAULT_FORM_ORDER.join('') && rows === DEFAULT_FORM_ROWS;
    // Every column, in a browser: a plain link to the published file, followed at once within the tap
    // (phones download a real file far more reliably than one made in the page).
    if (hidden.length === 0 && standardOrder && !isTauriApp()) {
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
        if (hidden.length === 0 && standardOrder) {
          // Every column: the form published with the site.
          const url = import.meta.env.BASE_URL + FORM_FILES[lang];
          const response = await fetch(url);
          if (!response.ok) throw Error(`${url}: ${response.status}`);
          return new Uint8Array(await response.arrayBuffer());
        }
        const [{ renderScoutingFormPdf }, { loadPdfFonts, loadLogoPng }] = await Promise.all([import('../../pdf/scouting-form-pdf'), import('../pdf-assets')]);
        const [fonts, logoPng] = await Promise.all([loadPdfFonts(), loadLogoPng()]);
        return renderScoutingFormPdf({ layout: printableLayout(hidden, order, rows), fonts, logoPng, texts });
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
function FormColumnsDialog({ onCancel, onConfirm }: { onCancel: () => void; onConfirm: (hidden: ScoutCodeString[], order: MovableSkill[], rows: number) => void }) {
  const { m } = useI18n();
  const t = m.formColumns;
  // Every column selected at first: the standard form, unless the user leaves some out.
  const [hidden, setHidden] = useState<ReadonlySet<ScoutCodeString>>(new Set());
  // The order last chosen on this device, as on the live sheet.
  const [order, setOrder] = useState<MovableSkill[]>(lastOrder);
  const [rows, setRows] = useState(lastRows);
  const standard = hidden.size === 0 && order.join('') === DEFAULT_FORM_ORDER.join('') && rows === DEFAULT_FORM_ROWS;
  // Three steps, so that each fits the screen: the columns, the order, the rows.
  const STEPS = 3;
  const [step, setStep] = useState(1);
  return (
    <div className="vr-live-overlay" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form
        className="vr-live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vr-form-columns-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (step < STEPS) return setStep(step + 1);
          onConfirm(OPTIONAL_FORM_CODES.filter((code) => hidden.has(code)), order, rows);
        }}
      >
        <p className="vr-dialog-step">{m.guide.stepOf(step, STEPS)}</p>
        <h2 id="vr-form-columns-title">{step === 1 ? t.title : step === 2 ? m.live.orderTitle : t.rowsTitle}</h2>
        {step === 1 ? (
          <>
            <p>{t.text}</p>
            <ColumnsChoice hidden={hidden} onChange={setHidden} />
          </>
        ) : step === 2 ? (
          <OrderChoice order={order} onChange={setOrder} text={t.orderText} heading={false} />
        ) : (
          <>
            <p>{t.rowsText}</p>
            <div className="vr-form-rows">
              <button type="button" className="vr-sub-arrow" aria-label={t.fewerRows} disabled={rows <= MIN_FORM_ROWS} onClick={() => setRows(rows - 1)}>
                −
              </button>
              <output aria-live="polite">{t.rowsCount(rows)}</output>
              <button type="button" className="vr-sub-arrow" aria-label={t.moreRows} disabled={rows >= MAX_FORM_ROWS} onClick={() => setRows(rows + 1)}>
                +
              </button>
            </div>
            {rows > DEFAULT_FORM_ROWS && <p className="vr-live-warning">{t.rowsMany}</p>}
            {rows < DEFAULT_FORM_ROWS && <p className="vr-note">{t.rowsFew}</p>}
            <p className="vr-note">{standard ? t.standard : t.custom}</p>
          </>
        )}
        <div className="vr-live-dialog-actions">
          <button type="button" className="vr-btn vr-btn-secondary" onClick={step === 1 ? onCancel : () => setStep(step - 1)}>
            {step === 1 ? t.cancel : m.guide.back}
          </button>
          <button type="submit" className="vr-btn vr-btn-primary">
            {step < STEPS ? m.guide.next : t.download}
          </button>
        </div>
      </form>
    </div>
  );
}
