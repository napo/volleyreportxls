import { VOLLEYREPORTXLS_URL } from '../../config';
import { useI18n } from '../../i18n';
import { ExternalLink } from '../../platform/ExternalLink';
import step1 from '../../assets/howto/1-modulo.webp';
import step2 from '../../assets/howto/2-compilato.webp';
import step3 from '../../assets/howto/3-caricamento.webp';
import step4 from '../../assets/howto/4-verifica.webp';
import step5 from '../../assets/howto/5-tabellino.webp';
import { DownloadFormButton } from '../components/DownloadFormButton';
import { MatchList } from '../components/MatchList';
import { Scoreboard } from '../components/Scoreboard';
import { SAMPLE_REPORT } from '../match-report';
import { SAMPLE_ID, href } from '../routes';

/** Pictures of the five steps, in order. */
const STEP_IMAGES = [step1, step2, step3, step4, step5];

export function HomeView() {
  const { m } = useI18n();
  const t = m.home;
  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">VolleyReport</p>
        <h1>{t.title}</h1>
        <p className="vr-lead">{t.lead}</p>
        <div className="vr-actions start vr-hero-actions">
          <DownloadFormButton label={t.formButton} />
          <a className="vr-btn vr-btn-secondary" href={href('foto')}>
            {t.photoButton}
          </a>
        </div>
        <ul className="vr-meta">
          <li>{t.local}</li>
          <li>
            {t.evolution} <ExternalLink href={VOLLEYREPORTXLS_URL}>VolleyReportXLS</ExternalLink>
          </li>
        </ul>
      </header>

      <section className="vr-card vr-dropzone">
        <span className="vr-icon-tile" aria-hidden="true">
          ↑
        </span>
        <h2>{t.photoTitle}</h2>
        <p>{t.photoText}</p>
        <div className="vr-actions">
          <a className="vr-btn vr-btn-primary" href={href('foto')}>
            {t.photoButton}
          </a>
        </div>
        <p className="vr-dropzone-help">
          {t.noForm} <DownloadFormButton label={t.noFormLink} variant="link" />
        </p>
      </section>

      <section className="vr-card" id="come-si-fa">
        <div className="vr-card-head">
          <div>
            <h2>{t.howTitle}</h2>
            <p>{t.howText}</p>
          </div>
        </div>
        <ol className="vr-howto">
          {t.steps.map((step, i) => (
            <li key={step.title} className="vr-howto-step">
              <img src={STEP_IMAGES[i]} alt={step.alt} loading="lazy" />
              <h3>
                <span className="vr-step-number">{i + 1}</span>
                {step.title}
              </h3>
              <p>{step.text}</p>
              {i === 0 && <DownloadFormButton label={t.formButton} variant="secondary" />}
              {i === 2 && (
                <a className="vr-btn vr-btn-secondary" href={href('foto')}>
                  {t.stepUpload}
                </a>
              )}
              {i === 4 && (
                <a className="vr-btn vr-btn-secondary" href={href('tabellino', SAMPLE_ID)}>
                  {t.stepExample}
                </a>
              )}
            </li>
          ))}
        </ol>
      </section>

      <MatchList />

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.exampleTitle}</h2>
            <p>{t.exampleText(SAMPLE_REPORT.tabellino.competition, SAMPLE_REPORT.tabellino.venue)}</p>
          </div>
          <div className="vr-actions start">
            <a className="vr-btn vr-btn-primary vr-btn-small" href={href('tabellino', SAMPLE_ID)}>
              {t.openTabellino}
            </a>
          </div>
        </div>
        <Scoreboard tabellino={SAMPLE_REPORT.tabellino} />
      </section>
    </>
  );
}
