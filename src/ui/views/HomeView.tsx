import { VOLLEYREPORTXLS_URL } from '../../config';
import { useI18n } from '../../i18n';
import { ExternalLink } from '../../platform/ExternalLink';
import { DownloadFormButton } from '../components/DownloadFormButton';
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
        <div className="vr-actions start vr-hero-actions">
          <DownloadFormButton label={t.formButton} />
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
