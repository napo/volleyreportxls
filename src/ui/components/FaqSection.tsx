// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** Frequent questions: one closed answer per question, with the links that answer needs. */
import { type ReactNode, useState } from 'react';
import { PAYPAL_DONATION_URL, RELEASES_URL, SOURCE_REPOSITORY_URL, WEB_APP_URL, contactEmail, externalUrl } from '../../config';
import { useI18n } from '../../i18n';
import { ExternalLink } from '../../platform/ExternalLink';
import { DownloadFormButton } from './DownloadFormButton';

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

export function FaqSection() {
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
    <section id="faq" className="vr-card">
      <div className="vr-card-head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.text}</p>
        </div>
      </div>
      {t.items.map(({ id, q, a }) => (
        <details key={id} className="vr-faq">
          <summary>{q}</summary>
          {a.map((paragraph) => (
            <p key={paragraph}>{paragraph}</p>
          ))}
          {actions[id] && <p className="vr-faq-actions">{actions[id]}</p>}
        </details>
      ))}
    </section>
  );
}
