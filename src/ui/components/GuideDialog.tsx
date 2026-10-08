/**
 * The 5-step guide, one step at a time, in a modal dialog, and a last page on
 * scouting on a tablet instead. It opens when the app starts unless the user
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
  // The pages: the five steps, then the tablet.
  const pages = [...steps.map((s, i) => ({ ...s, image: STEP_IMAGES[lang][i]! })), { ...t.tablet, image: TABLET_IMAGE[lang] }];
  const page = pages[index]!;
  const isTablet = index === steps.length;
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
          <p className="vr-eyebrow">{isTablet ? t.tablet.eyebrow : t.stepOf(index + 1, steps.length)}</p>
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
            {!isTablet && <span className="vr-step-number">{index + 1}</span>}
            {page.title}
          </h3>
          <p>{page.text}</p>
          {index === 0 && <DownloadFormButton label={m.home.formButton} variant="secondary" />}
          {index === 2 && (
            <a className="vr-btn vr-btn-secondary" href={href('foto')} onClick={closeGuide}>
              {t.upload}
            </a>
          )}
          {index === 4 && (
            <a className="vr-btn vr-btn-secondary" href={href('tabellino', SAMPLE_ID)} onClick={closeGuide}>
              {t.example}
            </a>
          )}
          {isTablet && (
            <button type="button" className="vr-btn vr-btn-secondary" onClick={startOnTablet} disabled={!archive}>
              {t.tablet.start}
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
