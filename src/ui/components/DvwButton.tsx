// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Downloads the match as a DataVolley scout file (.dvw) for OpenVolleyScout,
 * where a video can be matched to the touches. Offered only when the touches
 * were entered on the screen: those have an order and a time. After the
 * download, what the file leaves out or rebuilt differently is said plainly.
 */
import { useEffect, useState } from 'react';
import { useI18n } from '../../i18n';
import { type DvwSetReport, buildDvw, hasDvwData } from '../../matches/dvw';
import type { MatchRecord } from '../../matches/record';
import { type FileKind, type SavedFile, saveFile } from '../../platform/save-file';
import { isTauriApp } from '../../platform/updates';
import { useArchive } from '../archive-context';
import { SavedFileLink } from './SavedFileLink';

const DVW: FileKind = { description: 'DataVolley', type: 'application/octet-stream', extension: 'dvw' };

const fileName = (record: MatchRecord) => {
  const teams = [record.teamName, record.opponentName].map((n) => n.trim()).filter(Boolean).join(' - ') || 'VolleyReport';
  return `${[record.date, teams].filter(Boolean).join(' ').replace(/[\\/:*?"<>|]/g, '_')}.dvw`;
};

export function DvwButton({ recordId }: { recordId: string }) {
  const { m } = useI18n();
  const t = m.dvw;
  const { archive, revision } = useArchive();
  const [record, setRecord] = useState<MatchRecord | null>(null);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const [saved, setSaved] = useState<SavedFile | null>(null);
  const [sets, setSets] = useState<readonly DvwSetReport[] | null>(null);

  useEffect(() => {
    let active = true;
    archive?.getMatch(recordId).then((found) => active && setRecord(found ?? null));
    return () => {
      active = false;
    };
  }, [archive, recordId, revision]);

  if (!record || !hasDvwData(record)) return null;

  const download = async () => {
    setBusy(true);
    setFailed(false);
    setSaved(null);
    try {
      const made = buildDvw(record);
      const file = await saveFile(fileName(record), async () => new TextEncoder().encode(made.text), DVW);
      setSets(made.sets);
      if (file?.url && !isTauriApp()) setSaved(file);
    } catch {
      setFailed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="vr-card">
      <div className="vr-card-head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.text}</p>
        </div>
        <div className="vr-actions start">
          <button type="button" className="vr-btn vr-btn-secondary" onClick={download} disabled={busy}>
            {busy ? m.common.preparing : t.download}
          </button>
        </div>
      </div>
      {failed && <p className="vr-message warning">{t.failed}</p>}
      <SavedFileLink file={saved} />
      {sets && (
        <ul className="vr-dvw-report">
          {sets.map((s) => (
            <li key={s.set}>
              {t.set(s.set, s.touches, s.rebuilt.team, s.rebuilt.opponent)}
              {s.setter !== null && ` ${t.setter(s.setter)}`}
              {s.written && <strong> {t.scoreDiffers(s.written.team, s.written.opponent)}</strong>}
              {s.missing > 0 && <strong> {t.missing(s.missing)}</strong>}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
