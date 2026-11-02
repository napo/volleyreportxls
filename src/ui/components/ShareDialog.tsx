// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * "Share": a link that opens the page read-only. The user chooses how long it
 * lasts (a week unless changed), whether names travel with it and what to
 * leave out; the dialog says that a link sent cannot be withdrawn. Then it is
 * sent with WhatsApp (which asks to whom), with another app of the device, or
 * copied, saying plainly that it has to be pasted where it should go.
 */
import { type ReactNode, useRef, useState } from 'react';
import { SHARE_BASE_URL } from '../../config';
import { type ShareKind, type SharePayload, type ShareSection, SHARE_SECTIONS, encodeShare, shareUrl } from '../../share/payload';
import { useI18n } from '../../i18n';
import { ExternalLink } from '../../platform/ExternalLink';

const DURATIONS = [1, 7, 30, 180] as const;

/** End of the day, `days` days from now. */
function expiryAfter(days: number, now = new Date()): Date {
  const end = new Date(now);
  end.setDate(end.getDate() + days);
  end.setHours(23, 59, 59, 0);
  return end;
}

interface Props {
  readonly kind: ShareKind;
  /** What is shared, in the message that goes with the link (e.g. "Volley Lago – Borgo"). */
  readonly subject: string;
  /** A wider button, for the box at the bottom of the page. */
  readonly primary?: boolean;
  /** What the link carries, with or without names. */
  readonly build: (names: boolean) => Promise<Pick<SharePayload, 'matches' | 'athletes' | 'title' | 'numbers'>>;
}

/** The box at the bottom of a page: share it (and download it), now that the page has been read. */
export function ShareBox({ children }: { children: ReactNode }) {
  const t = useI18n().m.share;
  return (
    <section className="vr-card vr-share-cta">
      <div>
        <h2>{t.ctaTitle}</h2>
        <p>{t.ctaText}</p>
      </div>
      <div className="vr-actions start">{children}</div>
    </section>
  );
}

export function ShareButton({ kind, subject, primary = false, build }: Props) {
  const { m, lang } = useI18n();
  const t = m.share;
  const dialog = useRef<HTMLDialogElement>(null);
  const [days, setDays] = useState<number>(7);
  const [names, setNames] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<ShareSection>>(new Set());
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState<'yes' | 'failed' | null>(null);
  const linkInput = useRef<HTMLInputElement>(null);

  const expires = expiryAfter(days);
  const until = expires.toLocaleDateString(lang, { dateStyle: 'long' });
  const reset = () => {
    setUrl(null);
    setCopied(null);
  };
  const message = url ? t.message(subject, until, url) : '';

  const create = async () => {
    const content = await build(names);
    setUrl(shareUrl(SHARE_BASE_URL, encodeShare({ kind, expires: expires.toISOString(), hidden: [...hidden], ...content })));
  };
  const copy = async () => {
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopied('yes');
    } catch {
      // No clipboard (an old browser, a page without permission): the link is selected to copy by hand.
      linkInput.current?.select();
      setCopied('failed');
    }
  };
  const toggle = (section: ShareSection) => {
    const next = new Set(hidden);
    if (!next.delete(section)) next.add(section);
    setHidden(next);
    reset();
  };

  return (
    <>
      <button
        type="button"
        className={`vr-btn ${primary ? 'vr-btn-primary' : 'vr-btn-secondary'}`}
        onClick={() => {
          reset();
          dialog.current?.showModal();
        }}
      >
        {t.button}
      </button>
      <dialog ref={dialog} className="vr-guide vr-share" aria-labelledby="vr-share-title">
        <div className="vr-guide-head">
          <h2 id="vr-share-title">{t.title}</h2>
          <button type="button" className="vr-icon-button" aria-label={t.close} onClick={() => dialog.current?.close()}>
            ×
          </button>
        </div>
        <p>{t.intro}</p>

        <label className="vr-field">
          <span>{t.duration}</span>
          <select
            value={days}
            onChange={(e) => {
              setDays(Number(e.target.value));
              reset();
            }}
          >
            {DURATIONS.map((d) => (
              <option key={d} value={d}>
                {t.durations[d]}
              </option>
            ))}
          </select>
        </label>

        <label className="vr-check">
          <input
            type="checkbox"
            checked={names}
            onChange={(e) => {
              setNames(e.target.checked);
              reset();
            }}
          />
          {t.names}
        </label>

        <fieldset className="vr-choices">
          <legend>{t.sections}</legend>
          {SHARE_SECTIONS[kind].map((section) => (
            <label key={section} className="vr-choice">
              <input type="checkbox" checked={!hidden.has(section)} onChange={() => toggle(section)} />
              {t.sectionNames[section]}
            </label>
          ))}
        </fieldset>

        <p className="vr-message warning">{t.warning(until)}</p>

        {url ? (
          <div className="vr-share-link">
            <h3>{t.ready}</h3>
            <div className="vr-share-ways">
              <ExternalLink className="vr-btn vr-btn-primary vr-btn-whatsapp" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>
                {t.whatsapp}
              </ExternalLink>
              <button type="button" className="vr-btn vr-btn-secondary" onClick={copy}>
                {copied === 'yes' ? t.copied : t.copy}
              </button>
              {'share' in navigator && (
                <button type="button" className="vr-btn vr-btn-secondary" onClick={() => navigator.share({ title: subject, text: message }).catch(() => undefined)}>
                  {t.send}
                </button>
              )}
            </div>
            <p className="vr-note">{t.whatsappHelp}</p>
            {copied === 'yes' && (
              <p className="vr-message" role="status">
                {t.copiedHelp}
              </p>
            )}
            {copied === 'failed' && (
              <p className="vr-message warning" role="status">
                {t.copyFailed}
              </p>
            )}
            <details className="vr-share-raw" open={copied === 'failed'}>
              <summary>{t.showLink}</summary>
              <input ref={linkInput} type="text" readOnly value={url} aria-label={t.title} onFocus={(e) => e.target.select()} />
              <span className="vr-note">{t.size(url.length)}</span>
            </details>
          </div>
        ) : (
          <div className="vr-actions start">
            <button type="button" className="vr-btn vr-btn-primary" onClick={create}>
              {t.create}
            </button>
          </div>
        )}
      </dialog>
    </>
  );
}
