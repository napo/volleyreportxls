// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Synchronisation with Google Drive: what it does, the user's explicit
 * consent before connecting, then its state and the way to disconnect.
 * Hidden where the project has no Google client for the platform.
 */
import { useState } from 'react';
import { useI18n } from '../../i18n';
import { prepareSignIn, syncAvailable } from '../../sync/platform';
import { useSync } from '../archive-context';

export function SyncCard() {
  const { m, lang } = useI18n();
  const t = m.sync;
  const { sync, status } = useSync();
  const [step, setStep] = useState<'idle' | 'confirm' | 'disconnect'>('idle');
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [deleteFromDrive, setDeleteFromDrive] = useState(false);
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
      const ok = await sync.connect();
      setFailed(!ok);
      if (ok) setStep('idle');
    });
  const disconnect = () =>
    run(async () => {
      await sync.disconnect(deleteFromDrive).catch(() => undefined);
      setStep('idle');
      setDeleteFromDrive(false);
    });
  const when = (iso: string) => new Date(iso).toLocaleString(lang, { dateStyle: 'medium', timeStyle: 'short' });

  if (status.state === 'off') {
    return (
      <section className="vr-card vr-sync">
        <h2>{t.title}</h2>
        <p>{t.text}</p>
        {step === 'confirm' ? (
          <div className="vr-sync-confirm">
            <h3>{t.confirmTitle}</h3>
            <ul>
              {t.confirmPoints.map((point) => (
                <li key={point}>{point}</li>
              ))}
            </ul>
            {failed && <p className="vr-message warning">{t.signInFailed}</p>}
            <div className="vr-actions start">
              <button type="button" className="vr-btn vr-btn-primary" onClick={connect} disabled={busy}>
                {t.confirmButton}
              </button>
              <button type="button" className="vr-btn vr-btn-secondary" onClick={() => setStep('idle')} disabled={busy}>
                {t.cancel}
              </button>
            </div>
          </div>
        ) : (
          <div className="vr-actions start">
            <button
              type="button"
              className="vr-btn vr-btn-secondary"
              onClick={() => {
                setFailed(false);
                setStep('confirm');
                void prepareSignIn();
              }}
            >
              {t.connect}
            </button>
          </div>
        )}
      </section>
    );
  }

  const problem = status.state === 'paused' ? t.paused : status.state === 'error' && status.problem ? t.problems[status.problem] : null;
  return (
    <section className="vr-card vr-sync">
      <h2>{t.title}</h2>
      <p className="vr-sync-status" aria-live="polite">
        <span className={`vr-sync-dot ${status.state}`} aria-hidden="true" />
        <strong>{t.connected}</strong>
        <span>{status.state === 'syncing' ? t.syncing : status.lastSyncedAt ? t.last(when(status.lastSyncedAt)) : t.never}</span>
      </p>
      {problem && <p className="vr-message warning">{problem}</p>}
      {status.conflicts > 0 && <p className="vr-message">{t.conflicts(status.conflicts)}</p>}
      {step === 'disconnect' ? (
        <div className="vr-sync-confirm">
          <h3>{t.disconnectTitle}</h3>
          <p>{t.disconnectText}</p>
          <label className="vr-check">
            <input type="checkbox" checked={deleteFromDrive} onChange={(e) => setDeleteFromDrive(e.target.checked)} />
            <span>{t.disconnectDelete}</span>
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
