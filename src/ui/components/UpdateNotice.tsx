/** Notice of a new version in the installed apps: the user decides whether to update. */
import { useEffect, useState } from 'react';
import { PAYPAL_DONATION_URL, externalUrl } from '../../config';
import { ExternalLink } from '../../platform/ExternalLink';
import {
  type UpdateInfo,
  checkForUpdate,
  compareVersions,
  installUpdate,
  isTauriApp,
  openInSystemBrowser,
  swapLastVersion,
  updateChecksEnabled,
} from '../../platform/updates';
import { APP_VERSION } from '../../version';
import { useI18n } from '../../i18n';

export function UpdateNotice() {
  const t = useI18n().m.update;
  const [update, setUpdate] = useState<UpdateInfo | null>(null);
  const [state, setState] = useState<'idle' | 'installing' | 'error'>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState(false);
  // First start after an update (installed apps only): say so once.
  const [updated, setUpdated] = useState(() => {
    const previous = swapLastVersion(APP_VERSION);
    return isTauriApp() && previous !== null && compareVersions(APP_VERSION, previous) > 0;
  });

  useEffect(() => {
    if (!updateChecksEnabled()) return;
    let active = true;
    // Offline or GitHub not reachable: silently nothing.
    checkForUpdate(APP_VERSION)
      .then((found) => active && setUpdate(found))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const paypal = externalUrl(PAYPAL_DONATION_URL);
  const donation = paypal && (
    <ExternalLink href={paypal} className="vr-btn vr-btn-secondary vr-btn-small">
      {t.donate}
    </ExternalLink>
  );

  if (updated) {
    return (
      <div className="vr-update" role="status" aria-live="polite">
        <p>
          <strong>{t.updated(APP_VERSION)}</strong> {t.support}
        </p>
        <div className="vr-actions start">
          {donation}
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => setUpdated(false)}>
            {t.close}
          </button>
        </div>
      </div>
    );
  }
  if (!update || dismissed) return null;

  const install = async () => {
    if (update.kind === 'mobile') {
      await openInSystemBrowser(update.url).catch(() => setState('error'));
      return;
    }
    setState('installing');
    try {
      await installUpdate(update, setProgress);
    } catch {
      setState('error');
    }
  };

  return (
    <div className="vr-update" role="status" aria-live="polite">
      <p>
        <strong>{t.available(update.version)}</strong> {t.installed(APP_VERSION)}
        {state === 'installing' &&
          ` ${progress === null ? t.downloading : progress < 1 ? t.progress(Math.round(progress * 100)) : t.installing}`}
        {state === 'error' && ` ${t.failed}`}
        {update.kind === 'mobile' && state !== 'error' && ` ${t.mobileHint}`}
      </p>
      <div className="vr-actions start">
        <button type="button" className="vr-btn vr-btn-primary vr-btn-small" disabled={state === 'installing'} onClick={install}>
          {update.kind === 'mobile' ? t.downloadNew : t.updateNow}
        </button>
        {donation}
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" disabled={state === 'installing'} onClick={() => setDismissed(true)}>
          {t.later}
        </button>
      </div>
    </div>
  );
}
