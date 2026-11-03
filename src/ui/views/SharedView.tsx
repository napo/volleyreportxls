// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * A shared report, read from its link: the page of the match (scoresheet and
 * charts) or the history of the squad, read-only, without the menus of the
 * app and without opening its archive. It says where the app is, and lets
 * the page be printed or saved as PDF.
 */
import { useMemo } from 'react';
import { WEB_APP_URL } from '../../config';
import { toMatch } from '../../matches/record';
import { formatDate } from '../../report/format';
import { type SharePayload, decodeShare, isExpired } from '../../share/payload';
import { useI18n } from '../../i18n';
import { ExternalLink } from '../../platform/ExternalLink';
import { SquadHistory } from '../components/SquadHistory';
import { reportOf } from '../match-report';
import GraficiView from './GraficiView';
import { TabellinoView } from './TabellinoView';

function Promo() {
  const t = useI18n().m.share;
  return (
    <section className="vr-card vr-share-promo">
      <h2>{t.promoTitle}</h2>
      <p>{t.promo}</p>
      <ExternalLink className="vr-btn vr-btn-primary" href={WEB_APP_URL}>
        {t.promoLink(new URL(WEB_APP_URL).host)}
      </ExternalLink>
    </section>
  );
}

function SharedMatch({ payload }: { payload: SharePayload }) {
  const report = useMemo(() => reportOf(toMatch(payload.matches[0]!), null), [payload]);
  return (
    <>
      {/* The summary first, then the scoresheet. */}
      <GraficiView report={report} shared={payload} />
      <TabellinoView report={report} shared={payload} />
    </>
  );
}

function SharedHistory({ payload }: { payload: SharePayload }) {
  const { m } = useI18n();
  const dates = payload.matches.map((r) => r.date).filter(Boolean).sort();
  // The shirt numbers next to every name, as in the app.
  const athletes = payload.athletes.map((a) => {
    const numbers = [...new Set(payload.matches.flatMap((r) => r.players.filter((p) => p.athleteId === a.id).map((p) => p.number)))];
    return { ...a, hint: `n. ${numbers.join(', ')}` };
  });
  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">{m.share.eyebrow}</p>
        <h1>{m.share.historyTitle(payload.title)}</h1>
        <ul className="vr-meta">
          <li>{m.share.summary(payload.matches.length, formatDate(dates[0] ?? ''), formatDate(dates.at(-1) ?? ''))}</li>
        </ul>
      </header>
      <SquadHistory records={payload.matches} athletes={athletes} title={payload.title} shared={payload} />
    </>
  );
}

export default function SharedView({ encoded }: { encoded: string }) {
  const { m, lang } = useI18n();
  const t = m.share;
  const payload = useMemo(() => decodeShare(encoded), [encoded]);
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang, { dateStyle: 'long' });

  if (typeof payload === 'string' || isExpired(payload)) {
    return (
      <>
        <section className="vr-card vr-warning">
          <p>{typeof payload === 'string' ? (payload === 'newer' ? t.newer : t.invalid) : t.expired(date(payload.expires))}</p>
        </section>
        <Promo />
      </>
    );
  }

  return (
    <>
      <p className="vr-shared-info">{t.validUntil(date(payload.expires))}</p>
      {payload.kind === 'match' ? <SharedMatch payload={payload} /> : <SharedHistory payload={payload} />}
      <Promo />
    </>
  );
}
