// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Live scouting on a tablet or a touch screen: the paper form as a sheet of
 * counters, full screen. A tap on a cell adds one, a long press (right click
 * with a mouse) takes one away, "Undo" takes back the last touch. Closing a
 * set asks for its score; a closed set is read-only until it is reopened.
 * Every change is saved on the device at once.
 */
import { type CSSProperties, type KeyboardEvent, Fragment, useCallback, useEffect, useRef, useState } from 'react';
import type { ScoutCodeString } from '../../domain/codes';
import type { SetNumber } from '../../domain/model';
import { useI18n } from '../../i18n';
import { type Touch, bump, checkScore, closeSet, currentSet, reachableSets, setShirtNumber, undoTouch } from '../../matches/live';
import { type MatchRecord, type RowKind, type SetRecord, matchWinner } from '../../matches/record';
import type { Archive } from '../../storage/archive';
import { useArchive } from '../archive-context';
import { codeOf, parseShirtNumber, skillColumns } from '../components/counts-columns';
import { href } from '../routes';

const LONG_PRESS = 500;

/** The columns of the player rows; libero rows have only some of them. */
const COLUMNS = skillColumns('player');
const LIBERO_SKILLS = new Set(skillColumns('libero').map((c) => c.skill));
const CELLS = COLUMNS.flatMap((c) => c.evaluations.map((e, i) => ({ skill: c.skill, code: codeOf(c.skill, e), evaluation: e, first: i === 0 })));

/** Saves every change at once, one write at a time, the latest record last. */
function useAutosave(archive: Archive | null, record: MatchRecord | null): boolean {
  const [saved, setSaved] = useState(true);
  const latest = useRef<MatchRecord | null>(null);
  const dirty = useRef(false);
  const busy = useRef(false);

  const flush = useCallback(async () => {
    if (!archive || busy.current) return;
    busy.current = true;
    try {
      while (dirty.current && latest.current) {
        dirty.current = false;
        await archive.saveMatch(latest.current);
      }
      setSaved(true);
    } catch {
      dirty.current = true;
    } finally {
      busy.current = false;
    }
  }, [archive]);

  useEffect(() => {
    if (!record) return;
    // The record as loaded needs no saving.
    if (latest.current === null) {
      latest.current = record;
      return;
    }
    latest.current = record;
    dirty.current = true;
    setSaved(false);
    void flush();
  }, [record, flush]);

  return saved;
}

/** Keeps the screen on while the sheet is open (where the browser allows it). */
function useWakeLock() {
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    let active = true;
    const request = async () => {
      if (document.visibilityState !== 'visible' || !('wakeLock' in navigator)) return;
      try {
        lock = await navigator.wakeLock.request('screen');
        if (!active) void lock.release();
      } catch {
        // Not allowed (battery saver, old browser): the screen may turn off.
      }
    };
    void request();
    // The lock is released when the page is hidden: take it again on return.
    const onVisibility = () => void request();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', onVisibility);
      void lock?.release();
    };
  }, []);
}

interface CellProps {
  readonly count: number;
  readonly label: string;
  readonly locked: boolean;
  readonly last: boolean;
  readonly first: boolean;
  /** A tap: +1, or −1 while correcting. */
  readonly onTap: () => void;
  readonly onRemove: () => void;
}

function Cell({ count, label, locked, last, first, onTap, onRemove }: CellProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pointer = useRef('');
  // The long press already removed one: the click that follows does nothing.
  const pressed = useRef(false);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      type="button"
      className={`vr-live-cell${count > 0 ? ' counted' : ''}${last ? ' last' : ''}${first ? ' first' : ''}`}
      disabled={locked}
      aria-label={label}
      onPointerDown={(e) => {
        pointer.current = e.pointerType;
        pressed.current = false;
        cancel();
        if (e.pointerType === 'mouse') return;
        timer.current = setTimeout(() => {
          timer.current = null;
          pressed.current = true;
          onRemove();
        }, LONG_PRESS);
      }}
      onPointerUp={cancel}
      onPointerLeave={cancel}
      onPointerCancel={cancel}
      onClick={() => {
        if (pressed.current) pressed.current = false;
        else onTap();
      }}
      // A long press on a touch screen is handled by the timer; with a mouse
      // (or the menu key) the context menu takes one away.
      onContextMenu={(e) => {
        e.preventDefault();
        if (pointer.current !== 'touch' && pointer.current !== 'pen') onRemove();
      }}
      onKeyDown={(e: KeyboardEvent) => {
        if (e.key === '-' || e.key === 'Backspace' || e.key === 'Delete') {
          e.preventDefault();
          onRemove();
        }
      }}
    >
      {count}
    </button>
  );
}

function CloseSetDialog({ set, onCancel, onConfirm }: { set: SetRecord; onCancel: () => void; onConfirm: (team: number, opponent: number) => void }) {
  const { m } = useI18n();
  const t = m.live;
  const [team, setTeam] = useState(set.score ? String(set.score.team) : '');
  const [opponent, setOpponent] = useState(set.score ? String(set.score.opponent) : '');
  const num = (text: string) => (text === '' ? null : Number(text));
  const check = checkScore(num(team), num(opponent), set.number);
  const ok = check === 'ok' || check === 'unusual';
  const digits = (text: string) => text.replace(/\D/g, '').slice(0, 2);
  return (
    <div className="vr-live-overlay" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form
        className="vr-live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vr-live-dialog-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onConfirm(Number(team), Number(opponent));
        }}
      >
        <h2 id="vr-live-dialog-title">{t.dialogTitle(set.number)}</h2>
        <p>{t.dialogText}</p>
        <div className="vr-live-score">
          <label>
            {m.editor.us}
            <input inputMode="numeric" autoFocus value={team} placeholder={set.number === 5 ? '15' : '25'} onChange={(e) => setTeam(digits(e.target.value))} />
          </label>
          <span aria-hidden="true">–</span>
          <label>
            {m.editor.them}
            <input inputMode="numeric" value={opponent} onChange={(e) => setOpponent(digits(e.target.value))} />
          </label>
        </div>
        {(check === 'tied' || check === 'unusual') && (
          <p className="vr-live-warning" role="status">
            {check === 'tied' ? t.tied : t.unusual(set.number === 5 ? 15 : 25)}
          </p>
        )}
        <div className="vr-live-dialog-actions">
          <button type="button" className="vr-btn vr-btn-secondary" onClick={onCancel}>
            {t.back}
          </button>
          <button type="submit" className="vr-btn vr-live-primary" disabled={!ok}>
            {t.closeSet}
          </button>
        </div>
      </form>
    </div>
  );
}

export function LiveSheetView({ id }: { id: string }) {
  const { m } = useI18n();
  const t = m.live;
  const { archive } = useArchive();
  const [record, setRecord] = useState<MatchRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState<SetNumber>(1);
  // Closed sets reopened in this session.
  const [reopened, setReopened] = useState<ReadonlySet<SetNumber>>(new Set());
  const [history, setHistory] = useState<readonly Touch[]>([]);
  const [last, setLast] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [closing, setClosing] = useState(false);
  const saved = useAutosave(archive, record);
  useWakeLock();

  useEffect(() => {
    if (!archive) return;
    archive.getMatch(id).then((found) => {
      if (!found) return setMissing(true);
      setRecord(found);
      setView(currentSet(found));
    });
  }, [archive, id]);

  if (missing) {
    return (
      <main className="vr-shell">
        <section className="vr-card">
          <p>{m.common.matchNotFound}</p>
          <a className="vr-btn vr-btn-secondary" href={href('partite')}>
            {m.common.backToMatches}
          </a>
        </section>
      </main>
    );
  }
  if (!record) return <p className="vr-note">{m.common.loading}</p>;

  const set = record.sets.find((s) => s.number === view)!;
  const locked = (s: SetRecord) => s.score !== null && !reopened.has(s.number);
  const isLocked = locked(set);
  const reachable = reachableSets(record);
  const scored = record.sets.flatMap((s) => (s.score ? [s.score] : []));
  const won = scored.filter((s) => s.team > s.opponent).length;
  const lost = scored.filter((s) => s.opponent > s.team).length;
  const over = matchWinner(record) !== null;
  const total = set.rows.reduce((n, r) => n + Object.values(r.counts).reduce((a: number, b) => a + (b ?? 0), 0), 0);
  const title = `${record.teamName || m.common.team} – ${record.opponentName || m.common.opponent}`;

  const touch = (rowId: string, code: ScoutCodeString, delta: number) => {
    if (isLocked) return;
    const done = bump(record, view, rowId, code, delta);
    if (!done) return;
    setRecord(done.record);
    setHistory((h) => [...h, done.touch].slice(-500));
    setLast(`${rowId}:${code}`);
  };

  const lastTouch = history.at(-1);
  const lastSet = lastTouch && record.sets.find((s) => s.number === lastTouch.set);
  const canUndo = !!lastTouch && !!lastSet && !locked(lastSet);
  const undo = () => {
    if (!lastTouch || !canUndo) return;
    setRecord(undoTouch(record, lastTouch));
    setHistory((h) => h.slice(0, -1));
    setView(lastTouch.set);
    setLast(`${lastTouch.rowId}:${lastTouch.code}`);
  };
  const undoText = lastTouch && lastSet && canUndo ? t.undoLast(lastTouch.delta, lastTouch.code, lastSet.rows.find((r) => r.id === lastTouch.rowId)?.playerNumber ?? null) : t.undoNothing;

  const confirmClose = (team: number, opponent: number) => {
    const closed = closeSet(record, view, { team, opponent });
    setRecord(closed.record);
    setReopened((r) => new Set([...r].filter((n) => n !== view)));
    setClosing(false);
    setCorrecting(false);
    setLast(null);
    if (closed.next !== null) setView(closed.next);
  };

  const rows = (kind: RowKind) => set.rows.filter((r) => r.kind === kind);
  const players = rows('player');
  const liberos = rows('libero');
  const gridRows = `auto auto repeat(${players.length}, minmax(2.25rem, 1fr)) auto repeat(${liberos.length}, minmax(2.25rem, 1fr))`;

  const renderRow = (row: SetRecord['rows'][number], index: number) => {
    const libero = row.kind === 'libero';
    return (
      <Fragment key={row.id}>
        <input
          className={`vr-live-number${libero ? ' libero' : ''}`}
          inputMode="numeric"
          placeholder="–"
          aria-label={t.shirtOf(libero, index + 1)}
          value={row.playerNumber ?? ''}
          disabled={isLocked}
          onChange={(e) => setRecord(setShirtNumber(record, view, row.id, parseShirtNumber(e.target.value)))}
        />
        {CELLS.map((c) =>
          libero && !LIBERO_SKILLS.has(c.skill) ? (
            <span key={c.code} className={`vr-live-unused${c.first ? ' first' : ''}`} />
          ) : (
            <Cell
              key={c.code}
              count={row.counts[c.code] ?? 0}
              label={t.cell(c.code, row.playerNumber, row.counts[c.code] ?? 0)}
              locked={isLocked}
              first={c.first}
              last={!isLocked && last === `${row.id}:${c.code}`}
              onTap={() => touch(row.id, c.code, correcting ? -1 : 1)}
              onRemove={() => touch(row.id, c.code, -1)}
            />
          ),
        )}
      </Fragment>
    );
  };

  return (
    <div className={`vr-live${correcting && !isLocked ? ' correcting' : ''}`}>
      <header className="vr-live-bar">
        <a className="vr-live-exit" href={href('partita', record.id)} aria-label={t.exitLabel}>
          ‹ {t.exit}
        </a>
        <div className="vr-live-title">
          <strong>{title}</strong>
          <span>
            {t.setsWon(won, lost)}
            {over ? ` · ${t.matchOver}` : ''}
          </span>
        </div>
        <div className="vr-live-sets" role="group" aria-label={t.sets}>
          {record.sets.map((s) => {
            const open = reachable.has(s.number) || reopened.has(s.number);
            return (
              <button
                key={s.number}
                type="button"
                className={`vr-live-set${s.number === view ? ' current' : ''}`}
                aria-current={s.number === view ? 'step' : undefined}
                disabled={!open}
                onClick={() => {
                  setView(s.number);
                  setLast(null);
                  setCorrecting(false);
                }}
              >
                <strong>{t.set(s.number)}</strong>
                <span>{s.score ? `${s.score.team}–${s.score.opponent}` : open ? t.inProgress : '—'}</span>
              </button>
            );
          })}
        </div>
        <div className="vr-live-tools">
          <button type="button" className="vr-live-tool" disabled={!canUndo} onClick={undo} aria-label={`${t.undoLabel}: ${undoText}`}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h11a5 5 0 0 1 0 10h-3" />
            </svg>
            <span>
              <strong>{t.undo}</strong>
              <small>{undoText}</small>
            </span>
          </button>
          <button type="button" className="vr-live-tool correct" aria-pressed={correcting && !isLocked} disabled={isLocked} onClick={() => setCorrecting((c) => !c)}>
            <strong>{t.correct}</strong>
          </button>
          {isLocked ? (
            <>
              <button type="button" className="vr-btn vr-btn-secondary" onClick={() => setReopened((r) => new Set([...r, view]))}>
                {t.reopen}
              </button>
              {over && (
                <a className="vr-btn vr-live-primary" href={href('tabellino', record.id)}>
                  {t.openTabellino}
                </a>
              )}
            </>
          ) : (
            <button type="button" className="vr-btn vr-live-primary" onClick={() => setClosing(true)}>
              {t.closeSet}
            </button>
          )}
        </div>
      </header>

      <p className="vr-live-narrow">{t.narrow}</p>

      <div className={`vr-live-sheet${isLocked ? ' locked' : ''}`}>
        <div className="vr-live-grid" style={{ gridTemplateRows: gridRows } as CSSProperties}>
          <span className="vr-live-head">{t.number}</span>
          {COLUMNS.map((c) => (
            <span key={c.skill} className="vr-live-head skill" style={{ gridColumn: `span ${c.evaluations.length}` }}>
              {c.skill === 'P' ? t.setFault : m.skills[c.skill]}
            </span>
          ))}
          <span className="vr-live-eval number">{t.shirt}</span>
          {CELLS.map((c) => (
            <span key={c.code} className={`vr-live-eval${c.first ? ' first' : ''}`} title={m.codes[c.skill][c.evaluation]}>
              {c.evaluation}
            </span>
          ))}
          {players.map(renderRow)}
          <span className="vr-live-head libero">{t.libero}</span>
          {liberos.map(renderRow)}
        </div>
      </div>

      <footer className="vr-live-foot">
        <span className="vr-live-hint">{isLocked && set.score ? t.hintClosed(view, set.score.team, set.score.opponent) : correcting ? t.hintCorrect : t.hint}</span>
        <span>
          {t.touches}: <strong>{total}</strong> · {saved ? t.saved : t.saving}
        </span>
      </footer>

      {closing && <CloseSetDialog set={set} onCancel={() => setClosing(false)} onConfirm={confirmClose} />}
    </div>
  );
}
