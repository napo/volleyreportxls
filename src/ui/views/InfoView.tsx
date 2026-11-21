// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useState } from 'react';
import { VOLLEYREPORTXLS_URL } from '../../config';
import { ExternalLink } from '../../platform/ExternalLink';
import { CodeLegend } from '../components/CodeLegend';
import { DownloadSection, GuideSection, PrivacySection, ProjectSection, SupportSection, UpdatesSection } from '../components/ProjectSections';
import { useI18n } from '../../i18n';
import { DownloadFormButton } from '../components/DownloadFormButton';
import { parseRoute } from '../routes';

/** The cards of the page, in order: the bar shows one at a time. */
const TABS = ['support', 'guide', 'download', 'form', 'how', 'live', 'keypad', 'codes', 'stats', 'project', 'updates', 'privacy'] as const;
type InfoTab = (typeof TABS)[number];

function initialTab(): InfoTab {
  const name = parseRoute(window.location.hash).name;
  return name === 'modulo' ? 'form' : name === 'download' ? 'download' : 'support';
}

export function InfoView() {
  const { m } = useI18n();
  const t = m.info;
  const [tab, setTab] = useState<InfoTab>(initialTab);
  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">{t.eyebrow}</p>
        <h1>VolleyReport</h1>
        <p className="vr-lead">
          {t.leadBefore} <ExternalLink href={VOLLEYREPORTXLS_URL}>VolleyReportXLS</ExternalLink>
          {t.leadAfter}
        </p>
      </header>

      <div className="vr-info-tabs" role="tablist" aria-label={t.tabs.label}>
        {TABS.map((key) => (
          <button key={key} type="button" role="tab" id={`vr-info-tab-${key}`} aria-selected={tab === key} aria-controls="vr-info-panel" className={`vr-info-tab${tab === key ? ' active' : ''}`} onClick={() => setTab(key)}>
            {t.tabs[key]}
          </button>
        ))}
      </div>

      <div id="vr-info-panel" role="tabpanel" aria-labelledby={`vr-info-tab-${tab}`}>
      {tab === 'support' && <SupportSection />}

      {tab === 'guide' && <GuideSection />}

      {tab === 'download' && <DownloadSection />}

      {tab === 'form' && (
      <section id="modulo" className="vr-card vr-dropzone">
        <span className="vr-icon-tile" aria-hidden="true">
          ↓
        </span>
        <h2>{t.formTitle}</h2>
        <p>{t.formText}</p>
        <p>{t.formColumnsText}</p>
        <div className="vr-actions">
          <DownloadFormButton />
        </div>
      </section>
      )}

      {tab === 'how' && (
<section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.howTitle}</h2>
            <p>{t.howText}</p>
          </div>
        </div>
        <ol>
          {t.howSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      )}

      {tab === 'live' && (
<section id="tablet" className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.liveTitle}</h2>
            <p>{t.liveText}</p>
          </div>
        </div>
        <ol>
          {t.liveSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      )}

      {tab === 'keypad' && (
<section id="tastierino" className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.keypadTitle}</h2>
            <p>{t.keypadText}</p>
          </div>
        </div>
        <ol>
          {t.keypadSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </section>
      )}

      {tab === 'codes' && (
<section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.codesTitle}</h2>
            <p>{t.codesText}</p>
          </div>
        </div>
        <CodeLegend />
      </section>
      )}

      {tab === 'stats' && (
<section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.statsTitle}</h2>
          </div>
        </div>
        <p>{t.statsText}</p>
      </section>
      )}

      {tab === 'project' && <ProjectSection />}
      {tab === 'updates' && <UpdatesSection />}
      {tab === 'privacy' && <PrivacySection />}
      </div>
    </>
  );
}
