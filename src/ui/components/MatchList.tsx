// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The matches saved on this device: open, edit, export, delete; import from a .vrp file. */
import { useEffect, useMemo, useRef, useState } from 'react';
import { type MatchRecord, newMatchRecord } from '../../matches/record';
import { VrpError } from '../../matches/vrp';
import { formatDate } from '../../report/format';
import { useArchive } from '../archive-context';
import { exportMatches, importMatchFile } from '../match-files';
import { type Messages, useI18n } from '../../i18n';
import { href, navigate } from '../routes';
import { DEFAULT_SORT, MATCH_COLUMNS, type MatchRow, type MatchSort, filterRows, matchResult, nextSort, sortRows } from '../match-table';

const title = (r: MatchRecord, m: Messages) => `${r.teamName || m.common.team} – ${r.opponentName || m.common.opponent}`;

const SORT_MARK = { ascending: '▲', descending: '▼' } as const;

export function MatchList() {
  const { lang, m } = useI18n();
  const t = m.matches;
  const { archive, error, revision } = useArchive();
  const [matches, setMatches] = useState<MatchRecord[] | null>(null);
  const [message, setMessage] = useState<{ text: string; warning?: boolean } | null>(null);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MatchSort>(DEFAULT_SORT);
  const fileInput = useRef<HTMLInputElement>(null);

  const rows = useMemo<readonly MatchRow[]>(() => {
    const when = (iso: string) => {
      const d = new Date(iso);
      return iso && !Number.isNaN(d.getTime()) ? d.toLocaleString(lang, { dateStyle: 'short', timeStyle: 'short' }) : '';
    };
    const all = (matches ?? []).map((r) => ({
      record: r,
      cells: {
        match: title(r, m),
        competition: r.competition,
        date: formatDate(r.date),
        createdAt: when(r.createdAt),
        updatedAt: when(r.updatedAt),
      },
    }));
    return sortRows(filterRows(all, query), sort);
  }, [matches, query, sort, lang, m]);

  const reload = () => archive?.listMatches().then(setMatches);
  useEffect(() => {
    reload();
  }, [archive, revision]);

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
        <>
          <label className="vr-field vr-match-filter">
            <span>{t.filter}</span>
            <input type="search" value={query} placeholder={t.filterPlaceholder} onChange={(e) => setQuery(e.target.value)} />
          </label>
          <div className="vr-match-sort" role="group" aria-label={t.sortBy}>
            <span>{t.sortBy}</span>
            {MATCH_COLUMNS.map((c) => {
              const sorted = sort.column === c ? (sort.descending ? 'descending' : 'ascending') : undefined;
              return (
                <button key={c} type="button" className={`vr-sort${sorted ? ' active' : ''}`} aria-pressed={!!sorted} onClick={() => setSort(nextSort(sort, c))}>
                  {t.columns[c]}
                  <span aria-hidden="true">{sorted ? SORT_MARK[sorted] : ''}</span>
                </button>
              );
            })}
          </div>
          <ul className="vr-matches">
            {rows.map(({ record: r, cells }) => (
              <li key={r.id}>
                <a href={href('partita', r.id)}>
                  <strong>{cells.match}</strong>
                  <span>{[cells.competition, cells.date, matchResult(r)].filter(Boolean).join(' · ')}</span>
                  <span>
                    {[cells.createdAt && `${t.columns.createdAt} ${cells.createdAt}`, cells.updatedAt && `${t.columns.updatedAt} ${cells.updatedAt}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
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
          {rows.length === 0 && <p className="vr-note">{t.noneFiltered}</p>}
        </>
      )}
    </section>
  );
}
