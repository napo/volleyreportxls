/**
 * "Informazioni" page: voluntary support, the project, downloads, updates and privacy — the same
 * sections as Referto Volley. Links come from config.ts; the GitHub API is queried only for the list
 * of the latest release's files (no match data is sent).
 */
import { useEffect, useState } from 'react';
import paypalLogo from '../../assets/paypal.svg';
import {
  APP_NAME,
  AUTHOR_NAME,
  AUTHOR_URL,
  LICENSE_NAME,
  LICENSE_SPDX,
  LICENSE_URL,
  PAYPAL_DONATION_URL,
  RELEASES_URL,
  SOURCE_REPOSITORY_URL,
  WEB_APP_URL,
  externalUrl,
  releaseUrl,
  VOLLEYREPORTXLS_URL,
} from '../../config';
import { type LatestDownloads, fetchLatestDownloads } from '../../platform/downloads';
import { ExternalLink } from '../../platform/ExternalLink';
import { isTauriApp, setUpdateChecksEnabled, updateChecksEnabled } from '../../platform/updates';
import { formatDate } from '../../report/format';
import { APP_VERSION } from '../../version';
import { useI18n } from '../../i18n';
import { openGuide, setShowGuideAtStart, useGuide } from '../guide';

function CardHead({ title, subtitle }: { title: string; subtitle?: string | undefined }) {
  return (
    <div className="vr-card-head">
      <div>
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    </div>
  );
}

export function SupportSection() {
  const t = useI18n().m.info;
  const url = externalUrl(PAYPAL_DONATION_URL);
  return (
    <section className="vr-card" id="sostieni">
      <CardHead title={t.supportTitle} />
      {url ? (
        <>
          <p>{t.supportText}</p>
          <p>
            <ExternalLink href={url} className="vr-btn vr-btn-secondary vr-paypal">
              <img src={paypalLogo} alt="" width="64" height="16" />
              <span>{t.supportButton}</span>
            </ExternalLink>
          </p>
          <p className="vr-note">{t.supportNote}</p>
        </>
      ) : (
        <p>
          {t.contributeBefore} <ExternalLink href={SOURCE_REPOSITORY_URL}>{t.contributeLink}</ExternalLink>.
        </p>
      )}
    </section>
  );
}

export function GuideSection() {
  const t = useI18n().m.guide;
  const { showAtStart } = useGuide();
  return (
    <section className="vr-card" id="guida">
      <CardHead title={t.infoTitle} subtitle={t.infoText} />
      <div className="vr-actions start">
        <button type="button" className="vr-btn vr-btn-secondary" onClick={openGuide}>
          {t.infoOpen}
        </button>
        <label className="vr-check">
          <input type="checkbox" checked={showAtStart} onChange={(e) => setShowGuideAtStart(e.target.checked)} />
          {t.infoShowAtStart}
        </label>
      </div>
    </section>
  );
}

export function ProjectSection() {
  const t = useI18n().m.info;
  return (
    <section className="vr-card" id="progetto">
      <CardHead title={APP_NAME} />
      <p>
        {t.projectIdea} <ExternalLink href={VOLLEYREPORTXLS_URL}>VolleyReportXLS</ExternalLink>.
      </p>
      <p>{t.projectAi}</p>
      <p>{t.projectLicense}</p>
      <dl className="vr-facts">
        <dt>{t.facts.project}</dt>
        <dd>
          <ExternalLink href={AUTHOR_URL}>{AUTHOR_NAME}</ExternalLink>
        </dd>
        <dt>{t.facts.origin}</dt>
        <dd>
          <ExternalLink href={VOLLEYREPORTXLS_URL}>{t.facts.originLink}</ExternalLink>
        </dd>
        <dt>{t.facts.source}</dt>
        <dd>
          <ExternalLink href={SOURCE_REPOSITORY_URL}>{SOURCE_REPOSITORY_URL.replace(/^https:\/\//, '')}</ExternalLink>
        </dd>
        <dt>{t.facts.license}</dt>
        <dd>
          <ExternalLink href={LICENSE_URL}>{LICENSE_NAME}</ExternalLink>
          <span className="vr-spdx">
            SPDX: <code>{LICENSE_SPDX}</code>
          </span>
        </dd>
        <dt>{t.facts.version}</dt>
        <dd>
          <ExternalLink href={releaseUrl(APP_VERSION)}>{APP_VERSION}</ExternalLink>
        </dd>
      </dl>
      <h3>{t.originsTitle}</h3>
      <p>{t.originsText}</p>
      <h3>{t.thanksTitle}</h3>
      <p>{t.thanksText}</p>
    </section>
  );
}

export function DownloadSection() {
  const t = useI18n().m.info;
  const [latest, setLatest] = useState<LatestDownloads | null>(null);
  useEffect(() => {
    let active = true;
    // Offline or GitHub not reachable: only the link to the releases page is shown.
    fetchLatestDownloads()
      .then((found) => active && setLatest(found))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);
  const app = isTauriApp();
  const date = latest?.date ? formatDate(latest.date.slice(0, 10)) : null;
  return (
    <section className="vr-card" id="download">
      <CardHead title={t.downloadTitle} subtitle={latest ? t.latestRelease(latest.version, date) : undefined} />
      <div className="vr-actions start">
        {app && (
          <ExternalLink href={WEB_APP_URL} className="vr-btn vr-btn-primary">
            {t.openWeb}
          </ExternalLink>
        )}
        <ExternalLink href={RELEASES_URL} className={`vr-btn ${app ? 'vr-btn-secondary' : 'vr-btn-primary'}`}>
          {t.allReleases}
        </ExternalLink>
      </div>
      {latest && latest.groups.length > 0 && (
        <div className="vr-downloads">
          {latest.groups.map((group) => (
            <div className="vr-download" key={group.platform}>
              <h3>{t.platformNames[group.platform] ?? group.platform}</h3>
              <p>{t.platformNotes[group.note]}</p>
              <div className="vr-chips">
                {group.files.map((file) => (
                  <ExternalLink key={file.name} href={file.url} className="vr-chip" title={file.name}>
                    {file.label}
                  </ExternalLink>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      <p className="vr-note">{t.buildsNote}</p>
    </section>
  );
}

export function UpdatesSection() {
  const t = useI18n().m.info;
  const [enabled, setEnabled] = useState(updateChecksEnabled);
  return (
    <section className="vr-card" id="aggiornamenti">
      <CardHead title={t.updatesTitle} />
      <p>{t.updatesText}</p>
      {isTauriApp() ? (
        <label className="vr-check">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) => {
              setEnabled(e.target.checked);
              setUpdateChecksEnabled(e.target.checked);
            }}
          />
          {t.updatesCheck}
        </label>
      ) : (
        <p className="vr-note">{t.updatesWeb}</p>
      )}
    </section>
  );
}

export function PrivacySection() {
  const t = useI18n().m.info;
  return (
    <section className="vr-card" id="privacy">
      <CardHead title={t.privacyTitle} />
      <ul className="vr-list">
        {t.privacy.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </section>
  );
}
