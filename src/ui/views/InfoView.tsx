import { VOLLEYREPORTXLS_URL } from '../../config';
import { ExternalLink } from '../../platform/ExternalLink';
import { useState } from 'react';
import { CodeLegend } from '../components/CodeLegend';
import { DownloadSection, PrivacySection, ProjectSection, SupportSection, UpdatesSection } from '../components/ProjectSections';
import { saveFile } from '../../platform/save-file';
import { loadPdfFonts } from '../pdf-assets';
import { messagesFor, useI18n } from '../../i18n';

function DownloadFormButton() {
  const { m, lang } = useI18n();
  const [busy, setBusy] = useState(false);

  async function download() {
    setBusy(true);
    try {
      const { renderScoutingFormPdf } = await import('../../pdf/scouting-form-pdf');
      const texts = messagesFor(lang);
      await saveFile(texts.form.fileName, async () => renderScoutingFormPdf({ fonts: await loadPdfFonts(), texts }));
    } finally {
      setBusy(false);
    }
  }

  return (
    <button type="button" className="vr-btn vr-btn-primary" onClick={download} disabled={busy}>
      {busy ? m.common.preparing : m.info.formButton}
    </button>
  );
}

export function InfoView() {
  const { m } = useI18n();
  const t = m.info;
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

      <SupportSection />

      <section id="modulo" className="vr-card vr-dropzone">
        <span className="vr-icon-tile" aria-hidden="true">
          ↓
        </span>
        <h2>{t.formTitle}</h2>
        <p>{t.formText}</p>
        <div className="vr-actions">
          <DownloadFormButton />
        </div>
      </section>

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

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.codesTitle}</h2>
            <p>{t.codesText}</p>
          </div>
        </div>
        <CodeLegend />
      </section>

      <section className="vr-card">
        <div className="vr-card-head">
          <div>
            <h2>{t.statsTitle}</h2>
          </div>
        </div>
        <p>{t.statsText}</p>
      </section>

      <ProjectSection />
      <DownloadSection />
      <UpdatesSection />
      <PrivacySection />
    </>
  );
}
