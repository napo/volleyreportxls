// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Synchronisation with a cloud service chosen by the user: what it does, the
 * user's explicit consent before connecting, then its state and the way to
 * disconnect. Hidden where the project has no client for the platform.
 */
import { useState } from 'react';
import dropboxIcon from '../../assets/services/dropbox.svg';
import googleDriveIcon from '../../assets/services/google-drive.svg';
import onedriveIcon from '../../assets/services/onedrive.svg';
import { useI18n } from '../../i18n';
import { syncPlatform } from '../../sync/platform';
import type { ProviderId, SyncProvider } from '../../sync/provider';
import { DEFAULT_PROVIDER, PROVIDERS, prepareSignIn, syncAvailable } from '../../sync/providers';
import { useSync } from '../archive-context';

const ICONS: Record<ProviderId, string> = { 'google-drive': googleDriveIcon, dropbox: dropboxIcon, onedrive: onedriveIcon };

export function SyncCard() {
  const { m, lang } = useI18n();
  const t = m.sync;
  const { sync, status } = useSync();
  const [step, setStep] = useState<'idle' | 'confirm' | 'disconnect'>('idle');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleteRemote, setDeleteRemote] = useState(false);
  const [chosen, setChosen] = useState<SyncProvider>(DEFAULT_PROVIDER);
  if (!syncAvailable() || !sync || !status) return null;

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };
  const connect = () =>
    run(async () => {
      const ok = await sync.connect(chosen);
      setFailed(!ok);
      if (ok) setStep('idle');
    });
  const disconnect = () =>
    run(async () => {
      await sync.disconnect(deleteRemote).catch(() => undefined);
      setStep('idle');
      setDeleteRemote(false);
    });
  const when = (iso: string) => new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });

  if (status.state === 'off') {
    return (
      <section className="vr-card vr-sync">
        <h2>{t.title}</h2>
        <p>{t.text}</p>
        <p>{t.exclusive}</p>
        {step === 'confirm' ? (
          <div className="vr-sync-confirm">
            <h3>{t.confirmTitle}</h3>
            <ul>
              {t.services[chosen.id].confirmPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            {failed && <p className="vr-message warning">{t.signInFailed(t.services[chosen.id].account)}</p>}
            <div className="vr-actions start">
              <button type="button" className="vr-btn vr-btn-primary" onClick={connect} disabled={busy}>
                {t.confirmButton(t.services[chosen.id].account)}
              </button>
              <button type="button" className="vr-btn vr-btn-secondary" onClick={() => setStep('idle')} disabled={busy}>
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="vr-actions start">
            {PROVIDERS.filter((p) => p.available(syncPlatform())).map((provider) => (
              <button
                key={provider.id}
                type="button"
                className="vr-btn vr-btn-secondary"
                onClick={() => {
                  setChosen(provider);
                  setFailed(false);
                  setStep('confirm');
                  void prepareSignIn();
                }}
              >
                <span className="vr-service-icon" aria-hidden="true" style={{ maskImage: `url("${ICONS[provider.id]}")`, WebkitMaskImage: `url("${ICONS[provider.id]}")` }} />
                {t.connect(t.services[provider.id].name)}
              </button>
            ))}
          </div>
        )}
      </section>
    );
  }

  const service = t.services[status.provider];
  const problem = status.state === 'paused' ? t.paused(service.account) : status.state === 'error' && status.problem ? t.problems(service)[status.problem] : null;
  return (
    <section className="vr-card vr-sync">
      <h2>{t.title}</h2>
      <p className="vr-sync-status" aria-live="polite">
        <span className={`vr-sync-dot ${status.state}`} aria-hidden="true" />
        <strong>{t.connected(service.name)}</strong>
        <span>{status.state === 'syncing' ? t.syncing : status.lastSyncedAt ? t.last(when(status.lastSyncedAt)) : t.never}</span>
      </p>
      {problem && (
        <p className="vr-message warning">
          {problem}
          {status.detail && ` (${status.detail})`}
        </p>
      )}
      {status.conflicts > 0 && <p className="vr-message">{t.conflicts(status.conflicts)}</p>}
      {step === 'disconnect' ? (
        <div className="vr-sync-confirm">
          <h3>{t.disconnectTitle(service.name)}</h3>
          <p>{t.disconnectText(service.name)}</p>
          <p>{t.exclusive}</p>
          <label className="vr-check">
            <input type="checkbox" checked={deleteRemote} onChange={(e) => setDeleteRemote(e.target.checked)} />
            <span>{service.disconnectDelete}</span>
          </label>
          <div className="vr-actions start">
            <button type="button" className="vr-btn vr-btn-primary vr-btn-danger" onClick={disconnect} disabled={busy}>
              {t.disconnectButton}
            </button>
            <button type="button" className="vr-btn vr-btn-secondary" onClick={() => setStep('idle')} disabled={busy}>
              {t.cancel}
            </button>
          </div>
        </div>
      ) : (
        <div className="vr-actions start">
          <button type="button" className="vr-btn vr-btn-primary vr-btn-small" onClick={() => run(() => sync.syncNow(true))} disabled={busy || status.state === 'syncing'}>
            {t.syncNow}
          </button>
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => setStep('disconnect')} disabled={busy}>
            {t.disconnect}
          </button>
        </div>
      )}
    </section>
  );
}
