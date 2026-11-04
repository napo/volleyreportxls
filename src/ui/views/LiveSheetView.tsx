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
import {
  type MatchDetails,
  type Touch,
  bump,
  bumpShirt,
  canEnter,
  canLeave,
  checkScore,
  closeSet,
  courtNow,
  currentSet,
  placeNumbers,
  playerName,
  proposedLineup,
  reachableSets,
  returnsDue,
  setMatchDetails,
  setPlayerName,
  setLineup,
  setShirtNumber,
  substitute,
  substitutionState,
  undoSubstitution,
  undoTouch,
} from '../../matches/live';
import { type MatchRecord, type PlayerRecord, type RowKind, type SetRecord, matchWinner, OPTIONAL_CODES, sameContent, setIsPlayed } from '../../matches/record';
import type { Archive } from '../../storage/archive';
import { useArchive } from '../archive-context';
import { codeOf, parseShirtNumber, skillColumns } from '../components/counts-columns';
import { evaluationTint } from '../../report/evaluation-colors';
import { href } from '../routes';
import { LineupDialog, LiveKeypad, SubstitutionDialog } from './LiveKeypad';

/** What "Undo" takes back: a touch, or a substitution of the keypad. */
type Step = Touch | { readonly set: SetNumber; readonly sub: true };
const isTouch = (step: Step | undefined): step is Touch => !!step && 'code' in step;

const LONG_PRESS = 500;

/** The columns of the player rows; libero rows have only some of them. */
const COLUMNS = skillColumns('player');
const LIBERO_SKILLS = new Set(skillColumns('libero').map((c) => c.skill));
const CELLS = COLUMNS.flatMap((c) => c.evaluations.map((e, i) => ({ skill: c.skill, code: codeOf(c.skill, e), evaluation: e, first: i === 0 })));
/** Evaluation headers in the colours of the charts and of the printed form. */
const tint = (c: (typeof CELLS)[number]) => `rgb(${evaluationTint(c.skill, c.evaluation).map((v) => Math.round(v * 255)).join(' ')})`;

/** Keypad or grid, as last chosen on this device; phones start with the keypad. */
const MODE_SETTING = 'volleyreport.live.mode';
type Mode = 'keypad' | 'grid';

function initialMode(): Mode {
  try {
    const stored = localStorage.getItem(MODE_SETTING);
    if (stored === 'keypad' || stored === 'grid') return stored;
  } catch {
    // No stored choice: by screen size.
  }
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 760px)').matches ? 'keypad' : 'grid';
}

function rememberMode(mode: Mode) {
  try {
    localStorage.setItem(MODE_SETTING, mode);
  } catch {
    // Not kept: chosen again by screen size.
  }
}

/** The columns left out of the last match set up on this device: a new match starts from them. */
const UNTRACKED_SETTING = 'volleyreport.live.untracked';

function lastUntracked(): ScoutCodeString[] {
  try {
    const stored = JSON.parse(localStorage.getItem(UNTRACKED_SETTING) ?? '[]') as unknown;
    return Array.isArray(stored) ? OPTIONAL_CODES.filter((code) => stored.includes(code)) : [];
  } catch {
    return [];
  }
}

function rememberUntracked(codes: readonly ScoutCodeString[]) {
  try {
    localStorage.setItem(UNTRACKED_SETTING, JSON.stringify(codes));
  } catch {
    // Not kept: the next match starts with every column.
  }
}

const hasTouches = (record: MatchRecord) => record.sets.some((s) => s.rows.some((row) => Object.values(row.counts).some((n) => (n ?? 0) > 0)));

/** Touches already counted in a column, over the whole match. */
const columnTouches = (record: MatchRecord, code: ScoutCodeString) =>
  record.sets.reduce((n, s) => n + s.rows.reduce((k, row) => k + (row.counts[code] ?? 0), 0), 0);

/**
 * The columns "!" and "/" to show, skill by skill. Hiding one keeps its
 * touches already counted; the match remembers which columns were not recorded.
 */
function ColumnsDialog({ record, onCancel, onConfirm }: { record: MatchRecord; onCancel: () => void; onConfirm: (untracked: ScoutCodeString[]) => void }) {
  const { m } = useI18n();
  const t = m.live;
  const [hidden, setHidden] = useState<ReadonlySet<ScoutCodeString>>(new Set(record.untracked ?? []));
  const toggle = (code: ScoutCodeString) =>
    setHidden((h) => {
      const next = new Set(h);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  const skills = COLUMNS.filter((c) => c.evaluations.some((e) => OPTIONAL_CODES.includes(codeOf(c.skill, e))));
  return (
    <div className="vr-live-overlay" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form
        className="vr-live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vr-live-columns-title"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm(OPTIONAL_CODES.filter((code) => hidden.has(code)));
        }}
      >
        <h2 id="vr-live-columns-title">{t.columnsTitle}</h2>
        <p>{t.columnsText}</p>
        <div className="vr-live-columns">
          {skills.map((c) => (
            <fieldset key={c.skill}>
              <legend>{c.skill === 'P' ? t.setFault : m.skills[c.skill]}</legend>
              {c.evaluations
                .map((e) => ({ e, code: codeOf(c.skill, e) }))
                .filter(({ code }) => OPTIONAL_CODES.includes(code))
                .map(({ e, code }) => {
                  const counted = columnTouches(record, code);
                  return (
                    <label key={code} className="vr-check">
                      <input type="checkbox" checked={!hidden.has(code)} onChange={() => toggle(code)} />
                      <span>
                        <strong>{e}</strong> {m.codes[c.skill][e]}
                        {hidden.has(code) && counted > 0 && <small className="vr-live-columns-note"> {t.columnsCounted(counted)}</small>}
                      </span>
                    </label>
                  );
                })}
            </fieldset>
          ))}
        </div>
        <div className="vr-live-dialog-actions">
          <button type="button" className="vr-btn vr-btn-secondary" onClick={onCancel}>
            {t.back}
          </button>
          <button type="submit" className="vr-btn vr-live-primary">
            {t.save}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Saves every change at once, one write at a time, the latest record last.
 * `adopt` marks a record read from the archive (first load, or brought by a
 * synchronisation): it needs no saving. `pending` tells whether a change is
 * still to be written.
 */
function useAutosave(archive: Archive | null, record: MatchRecord | null) {
  const [saved, setSaved] = useState(true);
  const latest = useRef<MatchRecord | null>(null);
  const adopted = useRef<MatchRecord | null>(null);
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
    // The record as read from the archive needs no saving.
    if (record === adopted.current) {
      latest.current = record;
      return;
    }
    latest.current = record;
    dirty.current = true;
    setSaved(false);
    void flush();
  }, [record, flush]);

  const adopt = useCallback((r: MatchRecord) => {
    adopted.current = r;
  }, []);
  const pending = useCallback(() => dirty.current || busy.current, []);
  return { saved, adopt, pending };
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
  /** On the light band of every other player row. */
  readonly alt: boolean;
  /** A tap: +1, or −1 while correcting. */
  readonly onTap: () => void;
  readonly onRemove: () => void;
}

function Cell({ count, label, locked, last, first, alt, onTap, onRemove }: CellProps) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const self = useRef<HTMLButtonElement>(null);
  // The cell just counted comes into view (the keypad fills cells that may be out of sight on a phone).
  // Only the sheet scrolls: scrollIntoView would move the whole screen, keypad included.
  useEffect(() => {
    const cell = self.current;
    const sheet = cell?.closest<HTMLElement>('.vr-live-sheet');
    if (!last || !cell || !sheet) return;
    const box = sheet.getBoundingClientRect();
    const at = cell.getBoundingClientRect();
    // The first column (number and name) and the two header rows stay in sight over the cells.
    const left = box.left + sheet.clientWidth * 0.3;
    const top = box.top + 80;
    let dx = 0;
    let dy = 0;
    if (at.left < left) dx = at.left - left;
    else if (at.right > box.left + sheet.clientWidth) dx = at.right - (box.left + sheet.clientWidth) + 8;
    if (at.top < top) dy = at.top - top;
    else if (at.bottom > box.top + sheet.clientHeight) dy = at.bottom - (box.top + sheet.clientHeight) + 8;
    if (dx || dy) sheet.scrollBy({ left: dx, top: dy, behavior: 'smooth' });
  }, [last, count]);
  const pointer = useRef('');
  // The long press already removed one: the click that follows does nothing.
  const pressed = useRef(false);
  const cancel = () => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  };
  return (
    <button
      ref={self}
      type="button"
      className={`vr-live-cell${count > 0 ? ' counted' : ''}${last ? ' last' : ''}${first ? ' first' : ''}${alt ? ' alt' : ''}`}
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

/** Teams, competition and date, as in the header of the paper form. */
function MatchDetailsDialog({ record, first, onCancel, onConfirm }: { record: MatchRecord; first: boolean; onCancel: () => void; onConfirm: (details: MatchDetails) => void }) {
  const { m } = useI18n();
  const t = m.live;
  const [details, setDetails] = useState<MatchDetails>({ teamName: record.teamName, opponentName: record.opponentName, competition: record.competition, date: record.date });
  const field = (key: keyof MatchDetails, label: string, type = 'text') => (
    <label className="vr-live-field">
      {label}
      <input type={type} value={details[key]} autoFocus={key === 'teamName'} onChange={(e) => setDetails((d) => ({ ...d, [key]: e.target.value }))} />
    </label>
  );
  return (
    <div className="vr-live-overlay" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form
        className="vr-live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vr-live-details-title"
        onSubmit={(e) => {
          e.preventDefault();
          onConfirm({ ...details, teamName: details.teamName.trim(), opponentName: details.opponentName.trim(), competition: details.competition.trim() });
        }}
      >
        <h2 id="vr-live-details-title">{t.details}</h2>
        <p>{t.detailsText}</p>
        <div className="vr-live-fields">
          {field('teamName', m.editor.team)}
          {field('opponentName', m.editor.opponent)}
          {field('competition', m.editor.competition)}
          {field('date', m.editor.date, 'date')}
        </div>
        <div className="vr-live-dialog-actions">
          {!first && (
            <button type="button" className="vr-btn vr-btn-secondary" onClick={onCancel}>
              {t.back}
            </button>
          )}
          <button type="submit" className="vr-btn vr-live-primary">
            {first ? t.startScouting : t.save}
          </button>
        </div>
      </form>
    </div>
  );
}

export function LiveSheetView({ id }: { id: string }) {
  const { m } = useI18n();
  const t = m.live;
  const { archive, revision } = useArchive();
  const [record, setRecord] = useState<MatchRecord | null>(null);
  const [missing, setMissing] = useState(false);
  const [view, setView] = useState<SetNumber>(1);
  // Closed sets reopened in this session.
  const [reopened, setReopened] = useState<ReadonlySet<SetNumber>>(new Set());
  const [history, setHistory] = useState<readonly Step[]>([]);
  // Open with the number chosen on the keypad (null: none); undefined: closed.
  const [substituting, setSubstituting] = useState<number | null | undefined>(undefined);
  const [last, setLast] = useState<string | null>(null);
  const [correcting, setCorrecting] = useState(false);
  const [closing, setClosing] = useState(false);
  // 'first': a new match, the details are asked before scouting.
  const [editing, setEditing] = useState<'first' | 'edit' | null>(null);
  const [choosingColumns, setChoosingColumns] = useState(false);
  const [mode, setMode] = useState<Mode>(initialMode);
  const [choosingLineup, setChoosingLineup] = useState(false);
  const switchMode = (next: Mode) => {
    setMode(next);
    setCorrecting(false);
    rememberMode(next);
  };
  // Names used for the shirt numbers of this team in earlier matches.
  const [known, setKnown] = useState<readonly PlayerRecord[]>([]);
  const { saved, adopt, pending } = useAutosave(archive, record);
  useWakeLock();

  useEffect(() => {
    if (!archive) return;
    archive.getMatch(id).then((found) => {
      if (!found) return setMissing(true);
      adopt(found);
      // A new match starts with the columns chosen last time on this device.
      const start = lastUntracked();
      setRecord(found.untracked === undefined && start.length && !hasTouches(found) ? { ...found, untracked: start } : found);
      setView(currentSet(found));
      if (!found.teamName && !found.opponentName && !found.sets.some(setIsPlayed)) setEditing('first');
    });
  }, [archive, id, adopt]);

  // A synchronisation changed the archive: take the match as it is now, unless a
  // change of this sheet is still to be saved (it goes out at the next round).
  useEffect(() => {
    if (!archive || revision === 0) return;
    archive.getMatch(id).then((found) => {
      if (pending()) return;
      if (!found) return setMissing(true);
      setRecord((current) => {
        if (current && sameContent(current, found)) return current;
        adopt(found);
        setHistory([]);
        return found;
      });
    });
  }, [archive, id, revision, adopt, pending]);

  const teamName = record?.teamName ?? '';
  const competition = record?.competition ?? '';
  useEffect(() => {
    if (!archive || !teamName.trim()) return setKnown([]);
    let active = true;
    archive.knownPlayers(teamName, competition).then((players) => active && setKnown(players));
    return () => {
      active = false;
    };
  }, [archive, teamName, competition]);

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

  const applied = (done: ReturnType<typeof bump>) => {
    if (!done) return;
    setRecord(done.record);
    setHistory((h) => [...h, done.touch].slice(-500));
    setLast(`${done.touch.rowId}:${done.touch.code}`);
  };
  const keypadTouch = (number: number, kind: RowKind, code: ScoutCodeString) => {
    if (!isLocked) applied(bumpShirt(record, view, number, kind, code, known));
  };
  // The keypad needs who is on court: asked when a set without a lineup is opened with the keypad.
  const needsLineup = mode === 'keypad' && !isLocked && !set.lineup;

  const touch = (rowId: string, code: ScoutCodeString, delta: number) => {
    if (isLocked) return;
    const done = bump(record, view, rowId, code, delta);
    if (!done) return;
    setRecord(done.record);
    setHistory((h) => [...h, done.touch].slice(-500));
    setLast(`${rowId}:${code}`);
  };

  const lastStep = history.at(-1);
  const lastTouch = isTouch(lastStep) ? lastStep : undefined;
  const lastSet = lastStep && record.sets.find((s) => s.number === lastStep.set);
  const canUndo = !!lastStep && !!lastSet && !locked(lastSet);
  const undo = () => {
    if (!lastStep || !canUndo) return;
    setHistory((h) => h.slice(0, -1));
    setView(lastStep.set);
    if (!isTouch(lastStep)) {
      setRecord(undoSubstitution(record, lastStep.set));
      setLast(null);
      return;
    }
    setRecord(undoTouch(record, lastStep));
    setLast(`${lastStep.rowId}:${lastStep.code}`);
  };
  const lastSub = lastSet?.subs?.at(-1);
  const undoText =
    !lastStep || !lastSet || !canUndo
      ? t.undoNothing
      : isTouch(lastStep)
        ? t.undoLast(lastStep.delta, lastStep.code, lastSet.rows.find((r) => r.id === lastStep.rowId)?.playerNumber ?? null)
        : lastSub
          ? t.undoSubstitution(lastSub.out, lastSub.in)
          : t.undoNothing;

  const confirmClose = (team: number, opponent: number) => {
    const closed = closeSet(record, view, { team, opponent });
    setRecord(closed.record);
    setReopened((r) => new Set([...r].filter((n) => n !== view)));
    setClosing(false);
    setCorrecting(false);
    setLast(null);
    if (closed.next !== null) setView(closed.next);
  };

  // The columns shown: every one but the "!" and "/" left out of this match; each skill starts a band.
  const untracked = new Set(record.untracked ?? []);
  const cells = CELLS.filter((c) => !untracked.has(c.code)).map((c, i, all) => ({ ...c, first: i === 0 || all[i - 1]!.skill !== c.skill }));
  const headers = COLUMNS.map((c) => ({ skill: c.skill, span: cells.filter((x) => x.skill === c.skill).length }));

  const rows = (kind: RowKind) => set.rows.filter((r) => r.kind === kind);
  const players = rows('player');
  const liberos = rows('libero');
  const gridRows = `auto auto repeat(${players.length}, minmax(2.25rem, 1fr)) auto repeat(${liberos.length}, minmax(2.25rem, 1fr))`;

  const renderRow = (row: SetRecord['rows'][number], index: number) => {
    const libero = row.kind === 'libero';
    // Every other player row on a light band, as on the printed form, to follow a row across the sheet.
    const alt = !libero && index % 2 === 1;
    return (
      <Fragment key={row.id}>
        <div className={`vr-live-player${libero ? ' libero' : ''}${alt ? ' alt' : ''}`}>
          <input
            className="vr-live-number"
            inputMode="numeric"
            placeholder="–"
            aria-label={t.shirtOf(libero, index + 1)}
            value={row.playerNumber ?? ''}
            disabled={isLocked}
            onChange={(e) => setRecord(setShirtNumber(record, view, row.id, parseShirtNumber(e.target.value), known))}
          />
          {/* The name belongs to the number for the whole match: it follows the number into the next sets. */}
          <input
            className="vr-live-name"
            placeholder={row.playerNumber === null ? '' : t.namePlaceholder}
            aria-label={t.nameOf(libero, index + 1)}
            value={playerName(record, row.playerNumber)}
            disabled={isLocked || row.playerNumber === null}
            onChange={(e) => row.playerNumber !== null && setRecord(setPlayerName(record, row.playerNumber, e.target.value))}
          />
        </div>
        {cells.map((c) =>
          libero && !LIBERO_SKILLS.has(c.skill) ? (
            <span key={c.code} className={`vr-live-unused${c.first ? ' first' : ''}`} />
          ) : (
            <Cell
              key={c.code}
              count={row.counts[c.code] ?? 0}
              label={t.cell(c.code, row.playerNumber, row.counts[c.code] ?? 0)}
              locked={isLocked}
              first={c.first}
              alt={alt}
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
    <div className={`vr-live${correcting && !isLocked ? ' correcting' : ''}${mode === 'keypad' ? ' keypad' : ''}`}>
      <header className="vr-live-bar">
        <a className="vr-live-exit" href={href('partita', record.id)} aria-label={t.exitLabel}>
          ‹ {t.exit}
        </a>
        <button type="button" className="vr-live-title" onClick={() => setEditing('edit')} aria-label={`${title}. ${t.editDetails}`}>
          <strong>
            {title} <span aria-hidden="true">✎</span>
          </strong>
          <span>
            {t.setsWon(won, lost)}
            {over ? ` · ${t.matchOver}` : ''}
          </span>
        </button>
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
          {/* With the keypad, undo is on the keypad and every touch adds one: these two belong to the grid. */}
          {mode === 'grid' && (
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
          )}
          {mode === 'grid' && (
            <button type="button" className="vr-live-tool" onClick={() => switchMode('keypad')}>
              <strong>{t.toKeypad}</strong>
            </button>
          )}
          <button type="button" className="vr-live-tool" onClick={() => setChoosingColumns(true)} aria-label={t.columnsLabel}>
            <strong>{t.columns}</strong>
            {untracked.size > 0 && <small>{t.columnsHidden(untracked.size)}</small>}
          </button>
          {mode === 'grid' && (
            <button type="button" className="vr-live-tool correct" aria-pressed={correcting && !isLocked} disabled={isLocked} onClick={() => setCorrecting((c) => !c)}>
              <strong>{t.correct}</strong>
            </button>
          )}
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

      {mode === 'grid' ? (
        <p className="vr-live-narrow">{t.narrow}</p>
      ) : (
        <LiveKeypad
          key={view}
          set={view}
          lineup={set.lineup ? { court: courtNow(set), liberos: set.lineup.liberos } : proposedLineup(record, view)}
          untracked={untracked}
          locked={isLocked}
          last={
            lastTouch && lastTouch.delta > 0
              ? `${record.sets.find((s) => s.number === lastTouch.set)?.rows.find((r) => r.id === lastTouch.rowId)?.playerNumber ?? '?'} · ${lastTouch.code}`
              : null
          }
          canUndo={canUndo}
          undoText={undoText}
          onTouch={keypadTouch}
          onUndo={undo}
          onLineup={() => setChoosingLineup(true)}
          onGrid={() => switchMode('grid')}
          subsCount={set.subs?.length ?? 0}
          onSubstitute={(chosen) => setSubstituting(chosen)}
          nameOf={(n) => playerName(record, n)}
        />
      )}

      <div className={`vr-live-sheet${isLocked ? ' locked' : ''}`}>
        <div
          className="vr-live-grid"
          style={{ gridTemplateRows: gridRows, gridTemplateColumns: `minmax(9rem, 11rem) repeat(${cells.length}, minmax(0, 1fr))` } as CSSProperties}
        >
          <span className="vr-live-head">{t.numberAndName}</span>
          {headers.map((c) => (
            <span key={c.skill} className="vr-live-head skill" style={{ gridColumn: `span ${c.span}` }}>
              {c.skill === 'P' ? t.setFault : m.skills[c.skill]}
            </span>
          ))}
          <span className="vr-live-eval number" aria-hidden="true" />
          {cells.map((c) => (
            <span key={c.code} className={`vr-live-eval${c.first ? ' first' : ''}`} style={{ background: tint(c) }} title={m.codes[c.skill][c.evaluation]}>
              {c.evaluation}
            </span>
          ))}
          {players.map(renderRow)}
          <span className="vr-live-head libero">{t.libero}</span>
          {liberos.map(renderRow)}
        </div>
      </div>

      <footer className="vr-live-foot">
        <span className="vr-live-hint">{mode === 'keypad' && !isLocked ? '' : isLocked && set.score ? t.hintClosed(view, set.score.team, set.score.opponent) : correcting ? t.hintCorrect : t.hint}</span>
        <span>
          {t.touches}: <strong>{total}</strong> · {saved ? t.saved : t.saving}
        </span>
      </footer>

      {editing && (
        <MatchDetailsDialog
          record={record}
          first={editing === 'first'}
          onCancel={() => setEditing(null)}
          onConfirm={(details) => {
            setRecord(setMatchDetails(record, details));
            setEditing(null);
          }}
        />
      )}
      {(choosingLineup || (needsLineup && !editing && !closing)) && (
        <LineupDialog
          key={view}
          set={view}
          proposed={proposedLineup(record, view)}
          nameOf={(n) => playerName(record, n)}
          onCancel={() => (choosingLineup ? setChoosingLineup(false) : switchMode('grid'))}
          onConfirm={(lineup, names) => {
            // The numbers go on the rows of the sheet too, and the names typed here are those of the sheet.
            let next = setLineup(record, view, lineup);
            next = placeNumbers(next, view, lineup.court, 'player', known);
            next = placeNumbers(next, view, lineup.liberos, 'libero', known);
            for (const [number, name] of names) next = setPlayerName(next, number, name);
            setRecord(next);
            setChoosingLineup(false);
          }}
        />
      )}
      {substituting !== undefined && set.lineup && (
        <SubstitutionDialog
          leave={canLeave(set)}
          enterFor={(out) => canEnter(record, view, out)}
          court={courtNow(set)}
          liberos={set.lineup.liberos}
          due={returnsDue(set)}
          count={set.subs?.length ?? 0}
          nameOf={(n) => playerName(record, n)}
          involved={substitutionState(set).involved}
          chosen={substituting !== null && courtNow(set).includes(substituting) ? substituting : null}
          onCancel={() => setSubstituting(undefined)}
          onConfirm={(sub, name) => {
            // Who comes in gets a row of the sheet, if not on one yet, and the name written here.
            const next = placeNumbers(substitute(record, view, sub), view, [sub.in], 'player', known);
            setRecord(name !== playerName(next, sub.in) ? setPlayerName(next, sub.in, name) : next);
            setHistory((h) => [...h, { set: view, sub: true as const }].slice(-500));
            setSubstituting(undefined);
          }}
        />
      )}
      {choosingColumns && (
        <ColumnsDialog
          record={record}
          onCancel={() => setChoosingColumns(false)}
          onConfirm={(codes) => {
            const { untracked: _, ...rest } = record;
            setRecord(codes.length ? { ...rest, untracked: codes } : rest);
            rememberUntracked(codes);
            setChoosingColumns(false);
          }}
        />
      )}
      {closing && <CloseSetDialog set={set} onCancel={() => setClosing(false)} onConfirm={confirmClose} />}
    </div>
  );
}
