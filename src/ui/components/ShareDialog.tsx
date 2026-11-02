// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * "Share": a link that opens the page read-only. The user chooses how long it
 * lasts (a week unless changed), whether names travel with it and what to
 * leave out; the dialog says that a link sent cannot be withdrawn.
 */
import { useRef, useState } from 'react';
import { SHARE_BASE_URL } from '../../config';
import { type ShareKind, type SharePayload, type ShareSection, SHARE_SECTIONS, encodeShare, shareUrl } from '../../share/payload';
import { useI18n } from '../../i18n';

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
  /** What the link carries, with or without names. */
  readonly build: (names: boolean) => Promise<Pick<SharePayload, 'matches' | 'athletes' | 'title' | 'numbers'>>;
}

export function ShareButton({ kind, build }: Props) {
  const { m, lang } = useI18n();
  const t = m.share;
  const dialog = useRef<HTMLDialogElement>(null);
  const [days, setDays] = useState<number>(7);
  const [names, setNames] = useState(false);
  const [hidden, setHidden] = useState<ReadonlySet<ShareSection>>(new Set());
  const [url, setUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const expires = expiryAfter(days);
  const until = expires.toLocaleDateString(lang, { dateStyle: 'long' });
  const reset = () => {
    setUrl(null);
    setCopied(false);
  };

  const create = async () => {
    const content = await build(names);
    setUrl(shareUrl(SHARE_BASE_URL, encodeShare({ kind, expires: expires.toISOString(), hidden: [...hidden], ...content })));
  };
  const copy = async () => {
    if (!url) return;
    await navigator.clipboard.writeText(url);
    setCopied(true);
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
        className="vr-btn vr-btn-secondary"
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
            <input type="text" readOnly value={url} aria-label={t.title} onFocus={(e) => e.target.select()} />
            <div className="vr-actions start">
              <button type="button" className="vr-btn vr-btn-primary" onClick={copy}>
                {copied ? t.copied : t.copy}
              </button>
              {'share' in navigator && (
                <button type="button" className="vr-btn vr-btn-secondary" onClick={() => navigator.share({ url }).catch(() => undefined)}>
                  {t.send}
                </button>
              )}
              <span className="vr-note">{t.size(url.length)}</span>
            </div>
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
