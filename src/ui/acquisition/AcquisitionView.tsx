// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Photos of the filled-in sheets → a match. The user adds photos (camera,
 * files, drag and drop), the app reads them one by one, then the user checks
 * what the app cannot be sure of: the set when it is not marked clearly
 * (or the QR is unreadable), the
 * shirt numbers (handwritten: read from the crop), the final score, the
 * uncertain or full cells. Problems that would give wrong data block the
 * confirmation; the rest is reported and can be fixed later in the editor.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import type { ScoutCodeString } from '../../domain/codes';
import { SET_NUMBERS, type SetNumber, type SetScore } from '../../domain/model';
import type { SheetResult } from '../../image-processing/read-sheet';
import { type SetMerge, correctionKey, ignoredTouches, numbersNotInAll, setFromSheet, withSets } from '../../matches/from-sheets';
import { type MatchRecord, type SetRecord, newMatchRecord, newId, setIsPlayed } from '../../matches/record';
import { mobilePlatform } from '../../platform/updates';
import { useI18n } from '../../i18n';
import { useArchive } from '../archive-context';
import { href, navigate } from '../routes';
import { CameraCapture } from './CameraCapture';
import { decodePhoto, imageUrl, readPhoto } from './photos';

interface Urls {
  readonly numbers: readonly string[];
  readonly team: string;
  readonly opponent: string;
  /** Crops of the cells to check, by `${row}:${cell index}`. */
  readonly cells: Readonly<Record<string, string>>;
}

interface Photo {
  readonly id: string;
  readonly name: string;
  readonly thumbnail: string | null;
  readonly status: 'reading' | 'read' | 'failed' | 'error';
  readonly result: SheetResult | null;
  readonly markersFound: number;
  /** Why a failed photo was not read. */
  readonly failure: 'markers' | 'fit';
  readonly urls: Urls | null;
  readonly setNumber: SetNumber | null;
  /** The sheet continues a set started on another sheet: its counts are added up. */
  readonly extra: boolean;
  readonly numbers: Readonly<Record<number, string>>;
  readonly corrections: Readonly<Record<string, number>>;
  readonly score: { readonly team: string; readonly opponent: string };
}

const digits = (text: string, max = 2) => text.replace(/\D/g, '').slice(0, max);
const total = (row: SheetResult['rows'][number]) => row.cells.reduce((n, c) => n + (c.code ? c.count : 0), 0);
const rowUsed = (row: SheetResult['rows'][number]) => row.numberWritten || total(row) > 0;

function scoreOf(photo: Photo): SetScore | null {
  if (photo.score.team === '' || photo.score.opponent === '') return null;
  return { team: Number(photo.score.team), opponent: Number(photo.score.opponent) };
}

function setOf(photo: Photo): SetRecord {
  return setFromSheet({
    setNumber: photo.setNumber!,
    rows: photo.result!.rows,
    numbers: Object.fromEntries(Object.entries(photo.numbers).map(([k, v]) => [Number(k), digits(v) === '' ? null : Number(digits(v))])),
    corrections: photo.corrections,
    score: scoreOf(photo),
  });
}

function urlsOf(result: SheetResult): Urls {
  const cells: Record<string, string> = {};
  result.rows.forEach((row) => row.cells.forEach((cell, i) => cell.crop && (cells[`${row.index}:${i}`] = imageUrl(cell.crop))));
  return { numbers: result.rows.map((r) => imageUrl(r.numberCrop)), team: imageUrl(result.score.team), opponent: imageUrl(result.score.opponent), cells };
}

export function AcquisitionView({ matchId }: { matchId: string | null }) {
  const { m } = useI18n();
  const t = m.acquisition;
  const { archive } = useArchive();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [camera, setCamera] = useState(false);
  const [target, setTarget] = useState<MatchRecord | null>(null);
  // Sets with more than one sheet (in the photos or already in the match): the user decides,
  // unless the sheets marked as extra already tell (null: the user took the choice back).
  const [merge, setMerge] = useState<Partial<Record<SetNumber, SetMerge | null>>>({});
  const [dragging, setDragging] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const replacing = useRef<string | null>(null);
  // Photos are read one at a time: decoding a 12 MP photo takes memory.
  const queue = useRef<Promise<void>>(Promise.resolve());

  useEffect(() => {
    if (archive && matchId) archive.getMatch(matchId).then((r) => setTarget(r ?? null));
  }, [archive, matchId]);

  const update = (id: string, change: (p: Photo) => Photo) => setPhotos((list) => list.map((p) => (p.id === id ? change(p) : p)));

  const read = (id: string, file: Blob) => {
    queue.current = queue.current.then(async () => {
      try {
        const decoded = await decodePhoto(file);
        update(id, (p) => ({ ...p, thumbnail: decoded.thumbnail }));
        const result = await readPhoto(decoded.image);
        if (!result.ok) return update(id, (p) => ({ ...p, status: 'failed', markersFound: result.markersFound, failure: result.reason }));
        update(id, (p) => ({ ...p, status: 'read', result, urls: urlsOf(result), setNumber: result.setNumber, extra: result.extraSheet }));
      } catch {
        update(id, (p) => ({ ...p, status: 'error' }));
      }
    });
  };

  const blank = (name: string): Photo => ({
    id: newId(),
    name,
    thumbnail: null,
    status: 'reading',
    result: null,
    markersFound: 0,
    failure: 'markers',
    urls: null,
    setNumber: null,
    extra: false,
    numbers: {},
    corrections: {},
    score: { team: '', opponent: '' },
  });

  const addFiles = (files: readonly File[] | readonly Blob[]) => {
    const images = [...files].filter((f) => f.type === '' || f.type.startsWith('image/'));
    if (replacing.current && images[0]) {
      const id = replacing.current;
      replacing.current = null;
      update(id, (p) => ({ ...blank(p.name), id, name: images[0] instanceof File ? images[0].name : p.name }));
      read(id, images[0]);
      return;
    }
    const added = images.map((f, i) => blank(f instanceof File ? f.name : `${t.camera.title} ${photos.length + i + 1}`));
    setPhotos((list) => [...list, ...added]);
    added.forEach((p, i) => read(p.id, images[i]!));
  };

  const mobile = mobilePlatform() !== null;
  const takePhoto = () => {
    if (!mobile && typeof navigator.mediaDevices?.getUserMedia === 'function') setCamera(true);
    else cameraInput.current?.click();
  };

  // Checks across the photos.
  const read_ = photos.filter((p) => p.status === 'read');
  const setCounts = new Map<number, number>();
  read_.forEach((p) => p.setNumber && setCounts.set(p.setNumber, (setCounts.get(p.setNumber) ?? 0) + 1));
  const duplicate = (p: Photo) => p.setNumber !== null && (setCounts.get(p.setNumber) ?? 0) > 1;
  const saved = (n: SetNumber) => (target ? target.sets.find((s) => s.number === n) ?? null : null);
  const conflicts = SET_NUMBERS.filter((n) => {
    const sheets = setCounts.get(n) ?? 0;
    const inMatch = saved(n);
    return sheets > 1 || (sheets > 0 && inMatch !== null && setIsPlayed(inMatch));
  });
  const savedConflict = (n: SetNumber) => (setCounts.get(n) ?? 0) > 0 && saved(n) !== null && setIsPlayed(saved(n)!);
  /** Sheets marked as extra: every sheet but one, or all of them on a set already saved, means they add up. */
  const auto = (n: SetNumber): SetMerge | null => {
    const sheets = read_.filter((p) => p.setNumber === n);
    const extras = sheets.filter((p) => p.extra).length;
    if (extras === 0) return null;
    return extras >= (savedConflict(n) ? sheets.length : sheets.length - 1) ? 'sum' : null;
  };
  const choice = (n: SetNumber) => (merge[n] === undefined ? auto(n) : merge[n]);
  const decided = (n: SetNumber) => choice(n) !== null;
  const lonely = (p: Photo) => p.extra && p.setNumber !== null && (setCounts.get(p.setNumber) ?? 0) === 1 && !savedConflict(p.setNumber);
  const waiting = photos.some((p) => p.status === 'reading');
  const blocking =
    photos.some((p) => p.status === 'failed' || p.status === 'error' || (p.status === 'read' && p.setNumber === null)) ||
    conflicts.some((n) => !decided(n));
  const missingNumbers = read_.reduce(
    (n, p) => n + p.result!.rows.filter((r) => total(r) > 0 && digits(p.numbers[r.index] ?? '') === '').length,
    0,
  );
  const readySets = read_.map((p) => p.setNumber).filter((s): s is SetNumber => s !== null).sort();

  const confirm = async () => {
    if (!archive) return;
    const sum = new Set(conflicts.filter((n) => savedConflict(n) && choice(n) === 'sum'));
    const record = await archive.saveMatch(withSets(target ?? newMatchRecord(), read_.map(setOf), sum));
    navigate('partita', record.id);
  };

  /** Shirt numbers not written on every sheet that will be summed for set n. */
  const unmatched = (n: SetNumber) => {
    const sheets = read_.filter((p) => p.setNumber === n).map(setOf);
    return numbersNotInAll(savedConflict(n) && choice(n) === 'sum' ? [saved(n)!, ...sheets] : sheets);
  };

  const otherNumbers = (photo: Photo) =>
    read_.filter((p) => p.id !== photo.id && p.setNumber && Object.values(p.numbers).some((v) => digits(v) !== ''));

  return (
    <>
      <header className="vr-hero">
        <p className="vr-eyebrow">{t.eyebrow}</p>
        <h1>{target ? t.titleAdd(`${target.teamName || '…'} – ${target.opponentName || '…'}`) : t.titleNew}</h1>
        <p className="vr-lead">{t.lead}</p>
      </header>

      <section
        className={`vr-card vr-dropzone${dragging ? ' dragging' : ''}`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          addFiles([...e.dataTransfer.files]);
        }}
      >
        <div className="vr-actions">
          <button type="button" className="vr-btn vr-btn-primary" onClick={takePhoto}>
            {photos.length ? t.takeAnother : t.takePhoto}
          </button>
          <button type="button" className="vr-btn vr-btn-secondary" onClick={() => fileInput.current?.click()}>
            {t.choose}
          </button>
        </div>
        <p className="vr-dropzone-help">{t.drop}</p>
        <ul className="vr-tips">
          {t.tips.map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>
        <input ref={fileInput} type="file" accept="image/*" multiple hidden onChange={(e) => (addFiles([...(e.target.files ?? [])]), (e.target.value = ''))} />
        <input
          ref={cameraInput}
          type="file"
          accept="image/*"
          capture="environment"
          hidden
          onChange={(e) => (addFiles([...(e.target.files ?? [])]), (e.target.value = ''))}
        />
      </section>

      {camera && <CameraCapture onShot={(photo) => addFiles([photo])} onClose={() => setCamera(false)} />}

      {photos.map((photo) => (
        <SheetCard
          key={photo.id}
          photo={photo}
          duplicate={duplicate(photo) && !decided(photo.setNumber!)}
          lonely={lonely(photo)}
          others={otherNumbers(photo)}
          onChange={(change) => update(photo.id, change)}
          onRemove={() => {
            setPhotos((list) => list.filter((p) => p.id !== photo.id));
            // A new photo of the same set asks again.
            if (photo.setNumber) setMerge((c) => ({ ...c, [photo.setNumber!]: undefined }));
          }}
          onReplace={() => {
            replacing.current = photo.id;
            fileInput.current?.click();
          }}
        />
      ))}

      {photos.length > 0 && (
        <section className="vr-card vr-acq-summary" aria-live="polite">
          {!waiting && conflicts.length > 0 && (
            <div className="vr-acq-merge">
              <h2>{t.merge.title}</h2>
              {conflicts.map((n) => {
                const sheets = setCounts.get(n) ?? 0;
                const numbers = unmatched(n);
                return (
                  <fieldset key={n} className="vr-choices">
                    <legend>
                      {t.sheet.set} {n}
                    </legend>
                    <p className="vr-note">{savedConflict(n) ? t.merge.saved(sheets) : t.merge.sheets(sheets)}</p>
                    {merge[n] === undefined && auto(n) && <p className="vr-note">{t.merge.extra}</p>}
                    {savedConflict(n) ? (
                      (['sum', 'replace'] as const).map((option) => (
                        <label key={option} className="vr-choice">
                          <input type="radio" name={`merge-${n}`} checked={choice(n) === option} onChange={() => setMerge((c) => ({ ...c, [n]: option }))} />
                          {t.merge[option]}
                        </label>
                      ))
                    ) : (
                      <label className="vr-choice">
                        <input
                          type="checkbox"
                          checked={choice(n) === 'sum'}
                          onChange={(e) => setMerge((c) => ({ ...c, [n]: e.target.checked ? 'sum' : null }))}
                        />
                        {t.merge.sumSheets}
                      </label>
                    )}
                    {(sheets > 1 || choice(n) === 'sum') && numbers.length > 0 && <p className="vr-message warning">{t.merge.numbers(numbers)}</p>}
                  </fieldset>
                );
              })}
              <p className="vr-note">{t.merge.score}</p>
            </div>
          )}
          {waiting ? (
            <p>{t.summary.waiting}</p>
          ) : blocking ? (
            <p className="vr-message warning">{t.summary.blocking}</p>
          ) : (
            <>
              {readySets.length > 0 && <p>{t.summary.ready(readySets)}</p>}
              {missingNumbers > 0 && <p className="vr-message warning">{t.summary.missingNumbers(missingNumbers)}</p>}
              <p className="vr-note">{t.summary.after}</p>
            </>
          )}
          <div className="vr-actions start">
            <button type="button" className="vr-btn vr-btn-primary" disabled={waiting || blocking || read_.length === 0 || !archive} onClick={confirm}>
              {target ? t.summary.add : t.summary.create}
            </button>
          </div>
        </section>
      )}
    </>
  );
}

interface CardProps {
  readonly photo: Photo;
  readonly duplicate: boolean;
  /** Marked as extra, with no other sheet of its set. */
  readonly lonely: boolean;
  readonly others: readonly Photo[];
  readonly onChange: (change: (p: Photo) => Photo) => void;
  readonly onRemove: () => void;
  readonly onReplace: () => void;
}

function SheetCard({ photo, duplicate, lonely, others, onChange, onRemove, onReplace }: CardProps) {
  const { m } = useI18n();
  const t = m.acquisition.sheet;
  const result = photo.result;
  const rows = useMemo(() => (result ? result.rows.filter(rowUsed) : []), [result]);
  const ignored = result ? ignoredTouches(result.rows) : 0;
  const toCheck = rows.flatMap((row) => row.cells.flatMap((cell, i) => (cell.code && (cell.uncertain || cell.overflow) ? [{ row, cell, i }] : [])));

  return (
    <section className={`vr-card vr-sheet${photo.status === 'failed' || photo.status === 'error' || duplicate ? ' vr-warning' : ''}`}>
      <div className="vr-sheet-head">
        {photo.thumbnail ? <img className="vr-sheet-thumb" src={photo.thumbnail} alt="" /> : <span className="vr-sheet-thumb" />}
        <div className="vr-sheet-title">
          <h2>
            {photo.status === 'read' && photo.setNumber ? `${t.set} ${photo.setNumber}` : photo.name}
            {result && <span className="vr-badge">{t.form(result.layoutVersion)}</span>}
          </h2>
          {photo.status === 'reading' && <p>{t.reading}</p>}
          {photo.status === 'failed' && (
            <p className="vr-message warning">{photo.failure === 'fit' ? t.misaligned : t.notFound(photo.markersFound)}</p>
          )}
          {photo.status === 'error' && <p className="vr-message warning">{t.error}</p>}
          {photo.status === 'read' && (result!.page === null || result!.setNumber === null) && (
            <label className="vr-field vr-sheet-set">
              <span>
                {result!.page === null
                  ? t.qrUnread
                  : result!.setsMarked.length > 1
                    ? t.manySets(result!.setsMarked)
                    : result!.page.setNumber === null && result!.setsMarked.length === 0
                      ? t.noSet
                      : t.chooseSet}
              </span>
              <select
                value={photo.setNumber ?? ''}
                onChange={(e) => onChange((p) => ({ ...p, setNumber: e.target.value ? (Number(e.target.value) as SetNumber) : null }))}
              >
                <option value="">{t.chooseSet}</option>
                {SET_NUMBERS.map((n) => (
                  <option key={n} value={n}>
                    {t.set} {n}
                  </option>
                ))}
              </select>
            </label>
          )}
          {photo.status === 'read' && (
            <label className="vr-choice">
              <input type="checkbox" checked={photo.extra} onChange={(e) => onChange((p) => ({ ...p, extra: e.target.checked }))} />
              {t.extra}
            </label>
          )}
          {duplicate && <p className="vr-message warning">{t.duplicate(photo.setNumber!)}</p>}
          {lonely && <p className="vr-message warning">{t.extraAlone(photo.setNumber!)}</p>}
          {ignored > 0 && <p className="vr-message warning">{t.ignored(ignored)}</p>}
        </div>
        <div className="vr-actions start">
          {photo.status !== 'reading' && (
            <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={onReplace}>
              {t.reload}
            </button>
          )}
          {(photo.status === 'failed' || photo.status === 'error') && (
            <a className="vr-btn vr-btn-secondary vr-btn-small" href={href('partite')}>
              {t.manual}
            </a>
          )}
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small vr-btn-danger" onClick={onRemove}>
            {t.remove}
          </button>
        </div>
      </div>

      {result && photo.urls && (
        <>
          <div className="vr-sheet-score">
            <h3>{t.score}</h3>
            {!result.score.written && <p className="vr-note">{t.scoreMissing}</p>}
            <div className="vr-sheet-score-row">
              {(['team', 'opponent'] as const).map((side) => (
                <label key={side} className="vr-crop-field">
                  <img src={photo.urls![side]} alt="" />
                  <span>{side === 'team' ? t.us : t.them}</span>
                  <input
                    inputMode="numeric"
                    value={photo.score[side]}
                    onChange={(e) => onChange((p) => ({ ...p, score: { ...p.score, [side]: digits(e.target.value) } }))}
                  />
                </label>
              ))}
            </div>
          </div>

          <div className="vr-sheet-rows">
            <div className="vr-sheet-rows-head">
              <div>
                <h3>{t.players}</h3>
                <p className="vr-note">{t.playersHint}</p>
              </div>
              {others.map((o) => (
                <button
                  key={o.id}
                  type="button"
                  className="vr-btn vr-btn-secondary vr-btn-small"
                  onClick={() => onChange((p) => ({ ...p, numbers: copyNumbers(rows, o.numbers, p.numbers) }))}
                >
                  {t.copyNumbers(o.setNumber!)}
                </button>
              ))}
            </div>
            {rows.length === 0 && <p className="vr-note">{t.noRows}</p>}
            <ul className="vr-sheet-list">
              {rows.map((row) => (
                <li key={row.index} className="vr-sheet-row">
                  <label className="vr-crop-field">
                    <img src={photo.urls!.numbers[row.index]} alt="" />
                    <span>
                      {t.shirt}
                      {row.kind === 'libero' && <span className="vr-badge vr-badge-orange">{t.libero}</span>}
                    </span>
                    <input
                      inputMode="numeric"
                      value={photo.numbers[row.index] ?? ''}
                      placeholder="—"
                      onChange={(e) => onChange((p) => ({ ...p, numbers: { ...p.numbers, [row.index]: digits(e.target.value) } }))}
                    />
                  </label>
                  <span className="vr-sheet-touches">{t.touches(rowTotal(row, photo))}</span>
                </li>
              ))}
            </ul>
          </div>

          {toCheck.length > 0 && (
            <div className="vr-sheet-check">
              <h3>{t.check}</h3>
              <p className="vr-note">{t.checkHint}</p>
              <div className="vr-sheet-check-cells">
                {toCheck.map(({ row, cell, i }) => {
                  const key = correctionKey(row.index, cell.code as ScoutCodeString);
                  const shirt = digits(photo.numbers[row.index] ?? '');
                  return (
                    <label key={`${row.index}:${i}`} className="vr-crop-field small">
                      <img src={photo.urls!.cells[`${row.index}:${i}`]} alt="" />
                      <span>
                        <strong>{shirt ? `${t.shirt} ${shirt}` : `${t.row} ${row.index + 1}`}</strong> · {m.skills[cell.skill]} {cell.evaluation}
                        {cell.overflow && <em> · {t.full}</em>}
                      </span>
                      <input
                        inputMode="numeric"
                        value={photo.corrections[key] ?? cell.count}
                        onChange={(e) => onChange((p) => ({ ...p, corrections: { ...p.corrections, [key]: Number(digits(e.target.value, 3) || 0) } }))}
                      />
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </section>
  );
}

/** Numbers of another sheet for the rows used here, keeping the ones already typed. */
function copyNumbers(rows: readonly SheetResult['rows'][number][], from: Photo['numbers'], current: Photo['numbers']): Photo['numbers'] {
  const copied: Record<number, string> = {};
  for (const r of rows) copied[r.index] = current[r.index] || from[r.index] || '';
  return { ...current, ...copied };
}

function rowTotal(row: SheetResult['rows'][number], photo: Photo) {
  return row.cells.reduce((n, c) => (c.code ? n + (photo.corrections[correctionKey(row.index, c.code)] ?? c.count) : n), 0);
}
