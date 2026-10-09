// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The matches saved on this device: open, edit, export, delete; import from a .vrp file. */
import { useEffect, useRef, useState } from 'react';
import { type MatchRecord, newMatchRecord } from '../../matches/record';
import { VrpError } from '../../matches/vrp';
import { formatDate } from '../../report/format';
import { useArchive } from '../archive-context';
import { exportMatches, importMatchFile } from '../match-files';
import { type Messages, useI18n } from '../../i18n';
import { href, navigate } from '../routes';

const title = (r: MatchRecord, m: Messages) => `${r.teamName || m.common.team} – ${r.opponentName || m.common.opponent}`;

function summary(m: MatchRecord) {
  const scored = m.sets.flatMap((s) => (s.score ? [s.score] : []));
  const won = scored.filter((s) => s.team > s.opponent).length;
  const lost = scored.filter((s) => s.opponent > s.team).length;
  const result = scored.length ? `${won}-${lost} (${scored.map((s) => `${s.team}-${s.opponent}`).join(', ')})` : null;
  return [m.competition, formatDate(m.date), result].filter(Boolean).join(' · ');
}

export function MatchList() {
  const { m } = useI18n();
  const t = m.matches;
  const { archive, error } = useArchive();
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);
  const [message, setMessage] = useState<{ text: string; warning?: boolean } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const reload = () => archive?.listMatches().then(setMatches);
  useEffect(() => {
    reload();
  }, [archive]);

  const create = async () => {
    if (!archive) return;
    const record = await archive.saveMatch(newMatchRecord());
    navigate('partita', record.id);
  };

  const remove = async (r: MatchRecord) => {
    if (!archive || !window.confirm(t.confirmDelete(title(r, m)))) return;
    await archive.deleteMatch(r.id);
    setMessage({ text: t.deleted(title(r, m)) });
    reload();
  };

  const exportAll = async (records: readonly MatchRecord[]) => {
    const saved = await exportMatches(archive, records, t.fileKind);
    if (saved) setMessage({ text: t.exported(saved.path ?? saved.fileName) });
  };

  const importFile = async (file: File | undefined) => {
    if (!archive || !file) return;
    try {
      setMessage({ text: `${file.name}: ${t.imported(await importMatchFile(archive, file))}` });
      reload();
    } catch (e) {
      setMessage({ text: e instanceof VrpError ? t.vrpErrors[e.kind] : t.unreadable, warning: true });
    } finally {
      if (fileInput.current) fileInput.current.value = '';
    }
  };

  return (
    <section className="vr-card">
      <div className="vr-card-head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.subtitle}</p>
        </div>
        <div className="vr-actions start">
          <button type="button" className="vr-btn vr-btn-primary vr-btn-small" onClick={create} disabled={!archive}>
            {t.newManual}
          </button>
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => fileInput.current?.click()} disabled={!archive}>
            {t.import}
          </button>
          {matches && matches.length > 1 && (
            <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => exportAll(matches)}>
              {t.exportAll}
            </button>
          )}
          <input ref={fileInput} type="file" accept=".vrp,application/zip" hidden onChange={(e) => importFile(e.target.files?.[0])} />
        </div>
      </div>
      {message && (
        <p className={`vr-message${message.warning ? ' warning' : ''}`} role="status">
          {message.text}
        </p>
      )}
      {error && <p className="vr-note">{t.noArchive}</p>}
      {matches && matches.length === 0 && <p className="vr-note">{t.none}</p>}
      {matches && matches.length > 0 && (
        <ul className="vr-matches">
          {matches.map((r) => (
            <li key={r.id}>
              <a href={href('partita', r.id)}>
                <strong>{title(r, m)}</strong>
                <span>{summary(r)}</span>
              </a>
              <span className="vr-actions start">
                <a className="vr-btn vr-btn-secondary vr-btn-small" href={href('tabellino', r.id)}>
                  {m.nav.tabellino}
                </a>
                <a className="vr-btn vr-btn-secondary vr-btn-small" href={href('grafici', r.id)}>
                  {m.nav.grafici}
                </a>
                <a className="vr-btn vr-btn-secondary vr-btn-small" href={href('partita', r.id)}>
                  {t.edit}
                </a>
                <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => exportAll([r])}>
                  {t.export}
                </button>
                <button type="button" className="vr-btn vr-btn-secondary vr-btn-small vr-btn-danger" onClick={() => remove(r)}>
                  {t.delete}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
