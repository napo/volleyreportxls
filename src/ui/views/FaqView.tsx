// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Frequent questions by topic: one closed answer per question, with the links that answer needs. */
import { type ReactNode, useState } from 'react';
import { PAYPAL_DONATION_URL, RELEASES_URL, SOURCE_REPOSITORY_URL, WEB_APP_URL, contactEmail, externalUrl } from '../../config';
import { useI18n } from '../../i18n';
import { ExternalLink } from '../../platform/ExternalLink';
import { CodeLegend } from '../components/CodeLegend';
import { DownloadFormButton } from '../components/DownloadFormButton';

/** The address appears only after a tap, so that it is not on the page for those who collect addresses. */
function ContactEmail() {
  const { m } = useI18n();
  const [address, setAddress] = useState<string | null>(null);
  if (!address) {
    return (
      <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => setAddress(contactEmail())}>
        {m.faq.showEmail}
      </button>
    );
  }
  return <ExternalLink href={`mailto:${address}`}>{address}</ExternalLink>;
}

export function FaqView() {
  const { m } = useI18n();
  const t = m.faq;
  const donation = externalUrl(PAYPAL_DONATION_URL);
  const actions: Readonly<Record<string, ReactNode>> = {
    cost: (
      <>
        {donation && <ExternalLink href={donation}>{t.donate}</ExternalLink>}
        <ExternalLink href={SOURCE_REPOSITORY_URL}>{t.source}</ExternalLink>
      </>
    ),
    download: (
      <>
        <ExternalLink href={WEB_APP_URL}>{t.web}</ExternalLink>
        <ExternalLink href={RELEASES_URL}>{t.releases}</ExternalLink>
      </>
    ),
    evaluations: <CodeLegend />,
    form: <DownloadFormButton variant="link" label={m.home.formButton} />,
    languages: <ExternalLink href={`${SOURCE_REPOSITORY_URL}/blob/main/CONTRIBUTING.md`}>{t.translate}</ExternalLink>,
    request: (
      <>
        <ExternalLink href={`${SOURCE_REPOSITORY_URL}/issues`}>{t.issues}</ExternalLink>
        <ContactEmail />
      </>
    ),
  };
  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">{t.eyebrow}</p>
        <h1>{t.title}</h1>
        <p className="vr-lead">{t.text}</p>
      </header>
      {t.groups.map((group) => (
        <section key={group.title} className="vr-card">
          <h2>{group.title}</h2>
          {group.items.map(({ id, q, a }) => (
            <details key={id} className="vr-faq">
              <summary>{q}</summary>
              {a.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {actions[id] && <div className="vr-faq-actions">{actions[id]}</div>}
            </details>
          ))}
        </section>
      ))}
    </>
  );
}
