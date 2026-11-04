// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The 5-step guide, one step at a time, in a modal dialog: optional pages on
 * the simpler form (after the first step) and on sharing a link (after the
 * last), then two pages on scouting on a tablet or with the keypad of
 * smartphones instead. It opens when the app starts unless the user
 * turned it off; it can be reopened from About.
 */
import { useEffect, useRef, useState } from 'react';
import step1 from '../../assets/howto/1-modulo.webp';
import step2 from '../../assets/howto/2-compilato.webp';
import step3 from '../../assets/howto/3-caricamento.webp';
import step4 from '../../assets/howto/4-verifica.webp';
import step5 from '../../assets/howto/5-tabellino.webp';
import step1en from '../../assets/howto/1-modulo-en.webp';
import step2en from '../../assets/howto/2-compilato-en.webp';
import step3en from '../../assets/howto/3-caricamento-en.webp';
import step4en from '../../assets/howto/4-verifica-en.webp';
import step5en from '../../assets/howto/5-tabellino-en.webp';
import tablet from '../../assets/howto/6-tablet.webp';
import tableten from '../../assets/howto/6-tablet-en.webp';
import custom from '../../assets/howto/1b-modulo-colonne.webp';
import sharing from '../../assets/howto/5b-condivisione.webp';
import sharingen from '../../assets/howto/5b-condivisione-en.webp';
import customen from '../../assets/howto/1b-modulo-colonne-en.webp';
import phone from '../../assets/howto/7-smartphone.webp';
import phoneen from '../../assets/howto/7-smartphone-en.webp';
import { type Lang, useI18n } from '../../i18n';
import { newMatchRecord } from '../../matches/record';
import { useArchive } from '../archive-context';
import { closeGuide, setShowGuideAtStart, useGuide } from '../guide';
import { SAMPLE_ID, href, navigate } from '../routes';
import { DownloadFormButton } from './DownloadFormButton';

/**
 * Pictures of the five steps, in order, in each language. The English filled-in
 * form carries the same pen marks as the Italian one, moved cell by cell.
 */
const STEP_IMAGES: Readonly<Record<Lang, readonly string[]>> = {
  it: [step1, step2, step3, step4, step5],
  en: [step1en, step2en, step3en, step4en, step5en],
};
const TABLET_IMAGE: Readonly<Record<Lang, string>> = { it: tablet, en: tableten };
const PHONE_IMAGE: Readonly<Record<Lang, string>> = { it: phone, en: phoneen };
const CUSTOM_IMAGE: Readonly<Record<Lang, string>> = { it: custom, en: customen };
const SHARE_IMAGE: Readonly<Record<Lang, string>> = { it: sharing, en: sharingen };

/** A page of the guide: one of the numbered steps, or an optional page with its own label. */
type Page = { readonly title: string; readonly text: string; readonly alt: string; readonly image: string } & (
  | { readonly kind: 'step'; readonly step: number }
  | { readonly kind: 'custom' | 'share' | 'tablet' | 'phone'; readonly eyebrow: string }
);

export function GuideDialog() {
  const { m, lang } = useI18n();
  const t = m.guide;
  const { open, showAtStart } = useGuide();
  const dialog = useRef<HTMLDialogElement>(null);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) {
      setIndex(0);
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const { archive } = useArchive();
  const steps = t.steps;
  // The pages: the five steps, the simpler form after the first one, sharing after the last one, then the tablet and the keypad of smartphones.
  const numbered: Page[] = steps.map((s, i) => ({ ...s, kind: 'step', step: i + 1, image: STEP_IMAGES[lang][i]! }));
  const pages: Page[] = [
    numbered[0]!,
    { ...t.customForm, kind: 'custom', image: CUSTOM_IMAGE[lang] },
    ...numbered.slice(1),
    { ...t.share, kind: 'share', image: SHARE_IMAGE[lang] },
    { ...t.tablet, kind: 'tablet', image: TABLET_IMAGE[lang] },
    { ...t.phone, kind: 'phone', image: PHONE_IMAGE[lang] },
  ];
  const page = pages[index]!;
  const step = page.kind === 'step' ? page.step : null;
  const last = index === pages.length - 1;

  const startOnTablet = async () => {
    if (!archive) return;
    const record = await archive.saveMatch(newMatchRecord());
    closeGuide();
    navigate('rileva', record.id);
  };

  return (
    // The dialog closes with Esc too: keep the store in sync.
    <dialog ref={dialog} className="vr-guide" aria-labelledby="vr-guide-title" onClose={closeGuide}>
      <div className="vr-guide-head">
        <div>
          <p className="vr-eyebrow">{page.kind === 'step' ? t.stepOf(page.step, steps.length) : page.eyebrow}</p>
          <h2 id="vr-guide-title">{t.title}</h2>
        </div>
        <button type="button" className="vr-icon-button" aria-label={t.close} onClick={closeGuide}>
          ×
        </button>
      </div>

      <figure className="vr-guide-step">
        <img src={page.image} alt={page.alt} />
        <figcaption>
          <h3>
            {step !== null && <span className="vr-step-number">{step}</span>}
            {page.title}
          </h3>
          <p>{page.text}</p>
          {(step === 1 || page.kind === 'custom') && <DownloadFormButton label={m.home.formButton} variant="secondary" />}
          {step === 3 && (
            <a className="vr-btn vr-btn-secondary" href={href('foto')} onClick={closeGuide}>
              {t.upload}
            </a>
          )}
          {step === 5 && (
            <a className="vr-btn vr-btn-secondary" href={href('tabellino', SAMPLE_ID)} onClick={closeGuide}>
              {t.example}
            </a>
          )}
          {(page.kind === 'tablet' || page.kind === 'phone') && (
            <button type="button" className="vr-btn vr-btn-secondary" onClick={startOnTablet} disabled={!archive}>
              {page.kind === 'phone' ? t.phone.start : t.tablet.start}
            </button>
          )}
        </figcaption>
      </figure>

      <div className="vr-guide-foot">
        <label className="vr-check">
          <input type="checkbox" checked={!showAtStart} onChange={(e) => setShowGuideAtStart(!e.target.checked)} />
          {t.dontShow}
        </label>
        <div className="vr-guide-dots" aria-hidden="true">
          {pages.map((s, i) => (
            <button key={s.title} type="button" tabIndex={-1} className={i === index ? 'active' : undefined} onClick={() => setIndex(i)} />
          ))}
        </div>
        <div className="vr-actions">
          <button type="button" className="vr-btn vr-btn-secondary" disabled={index === 0} onClick={() => setIndex(index - 1)}>
            {t.back}
          </button>
          <button type="button" className="vr-btn vr-btn-primary" onClick={() => (last ? closeGuide() : setIndex(index + 1))}>
            {last ? t.done : t.next}
          </button>
        </div>
      </div>
    </dialog>
  );
}
