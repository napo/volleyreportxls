import { VOLLEYREPORTXLS_URL } from '../../config';
import { useI18n } from '../../i18n';
import { ExternalLink } from '../../platform/ExternalLink';
import { MatchList } from '../components/MatchList';
import { Scoreboard } from '../components/Scoreboard';
import { SAMPLE_REPORT } from '../match-report';
import { SAMPLE_ID, href } from '../routes';

export function HomeView() {
  const { m } = useI18n();
  const t = m.home;
  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">VolleyReport</p>
        <h1>{t.title}</h1>
        <p className="vr-lead">{t.lead}</p>
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
          {t.noForm} <a href={href('modulo')}>{t.discover}</a>
        </p>
      </section>

      <MatchList />

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.howTitle}</h2>
          </div>
        </div>
        <ol className="vr-steps">
          {t.steps.map((step, i) => (
            <li key={step.title} className="vr-step">
              <span className="vr-step-number">{i + 1}</span>
              <h3>{step.title}</h3>
              <p>{step.text}</p>
            </li>
          ))}
        </ol>
      </section>

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
