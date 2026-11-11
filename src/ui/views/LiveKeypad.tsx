// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Scouting with the keypad of the live sheet, made for phones: the shirt
 * number and the skill, in either order, then the evaluation; the touch goes into the sheet
 * below. Eight keys: the six on court and the two liberos (a libero has only
 * reception and set, as on the form). The row still missing is outlined; an
 * evaluation alone in its skill is entered with the skill.
 */
import { useEffect, useRef, useState } from 'react';
import type { Evaluation, ScoutCodeString, Skill } from '../../domain/codes';
import { useI18n } from '../../i18n';
import type { Lineup, RowKind, Substitution } from '../../matches/record';
import { evaluationTint } from '../../report/evaluation-colors';
import { type MovableSkill, codeOf, orderedColumns } from '../components/counts-columns';
import { LiveSituation, type Situation } from './LiveSituation';

const tint = (skill: Skill, evaluation: Evaluation) => `rgb(${evaluationTint(skill, evaluation).map((v) => Math.round(v * 255)).join(' ')})`;

interface Chosen {
  readonly number: number;
  readonly kind: RowKind;
}

export interface KeypadProps {
  readonly set: number;
  readonly lineup: Lineup;
  readonly untracked: ReadonlySet<ScoutCodeString>;
  /** The order of the skill buttons, as the columns of the sheet. */
  readonly order: readonly MovableSkill[];
  readonly locked: boolean;
  /** The last touch, as shown at the bottom ("7 · A#"), or null. */
  readonly last: string | null;
  readonly canUndo: boolean;
  readonly undoText: string;
  readonly onTouch: (number: number, kind: RowKind, code: ScoutCodeString) => void;
  readonly onUndo: () => void;
  readonly onLineup: () => void;
  readonly onGrid: () => void;
  /** Substitutions made in the set (shown on the button, no limit enforced). */
  readonly subsCount: number;
  /** Opens the substitution, with the number chosen on the keypad (if any, not a libero) as the one leaving. */
  readonly onSubstitute: (chosen: number | null) => void;
  /** The name written for a shirt number (on the sheet or in the lineup), shown small on its key. */
  readonly nameOf: (number: number) => string;
  /** How the set and the match are going, shown on request. */
  readonly situation: Situation;
  /** Who is in each zone now, zone 1 first: the keys are laid out as the court (4 3 2 at the net, 5 6 1 behind). */
  readonly zones: readonly (number | null)[];
  /** The keys follow the rotation: whoever serves goes to zone 1 and is chosen with "Serve". */
  readonly rotate: boolean;
  /** Who is expected to serve next (zone 1, or zone 2 after a reception). */
  readonly server: number | null;
}

/** The zones as seen from behind the court, with a libero at the end of each row. */
const ZONE_ROWS: readonly (readonly number[])[] = [
  [4, 3, 2],
  [5, 6, 1],
];

export function LiveKeypad({ set, lineup, untracked, order, locked, last, canUndo, undoText, onTouch, onUndo, onLineup, onGrid, subsCount, onSubstitute, nameOf, situation, zones, rotate, server }: KeypadProps) {
  const { m } = useI18n();
  const t = m.live;
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [skill, setSkill] = useState<Skill | null>(null);
  const [looking, setLooking] = useState(false);

  // While a serve is being entered, the keys already show its server in zone 1 (the rotation is kept with the touch).
  const places = Array.from({ length: 6 }, (_, i) => zones[i] ?? null);
  const serving = rotate && skill === 'B' && chosen?.kind === 'player' ? places.indexOf(chosen.number) : -1;
  const shown = serving > 0 ? places.map((_, i) => places[(i + serving) % 6]!) : places;
  const keys: { readonly key: Chosen | null; readonly zone: number | null }[] = ZONE_ROWS.flatMap((row, r) => [
    ...row.map((zone) => {
      const number = shown[zone - 1] ?? null;
      return { key: number !== null ? { number, kind: 'player' as const } : null, zone };
    }),
    { key: lineup.liberos[r] !== undefined ? { number: lineup.liberos[r]!, kind: 'libero' as const } : null, zone: null },
  ]);
  // A formation edit or undo can remove the selected number from the court.
  // Derive validity from the current keys, before accepting another touch.
  const active = chosen && keys.some(({ key }) => key?.number === chosen.number && key.kind === chosen.kind) ? chosen : null;
  // Skills of a kind of key (a libero has fewer), each with the evaluations shown in the sheet.
  const skillsOf = (kind: RowKind) =>
    orderedColumns(kind, order).map((c) => ({
      skill: c.skill,
      evaluations: c.evaluations.filter((e) => !untracked.has(codeOf(c.skill, e))),
    }));
  const skills = skillsOf(active?.kind ?? 'player');
  const allSkills = orderedColumns('player', order);
  const liberoSkills = new Set(skillsOf('libero').map((c) => c.skill));
  const fits = (kind: RowKind, s: Skill) => kind === 'player' || liberoSkills.has(s);
  const evaluations = skills.find((c) => c.skill === skill)?.evaluations ?? [];

  const enter = (who: Chosen, code: ScoutCodeString) => {
    onTouch(who.number, who.kind, code);
    setChosen(null);
    setSkill(null);
  };
  /** A skill with a single evaluation (set faults) is entered as soon as number and skill are both there. */
  const only = (kind: RowKind, s: Skill) => {
    const found = skillsOf(kind).find((c) => c.skill === s)?.evaluations;
    return found?.length === 1 ? codeOf(s, found[0]!) : null;
  };
  // Number and skill in either order: the second one keeps the first, unless they do not go together.
  const chooseSkill = (s: Skill) => {
    const code = active && only(active.kind, s);
    if (active && code) return enter(active, code);
    setSkill(skill === s ? null : s);
    // Following the rotation, "Serve" alone already knows who serves.
    if (rotate && s === 'B' && skill !== 'B' && !active && server !== null) setChosen({ number: server, kind: 'player' });
  };
  const chooseKey = (key: Chosen) => {
    const kept = skill && fits(key.kind, skill) ? skill : null;
    const code = kept && only(key.kind, kept);
    if (code) return enter(key, code);
    setChosen(key);
    setSkill(kept);
  };
  // What is still missing, to draw the eye to its row.
  const awaiting = active && skill ? 'evals' : active ? 'skills' : skill ? 'numbers' : null;

  const room = useLegendRoom();
  const legendSkill = skill ?? null;

  return (
    <section ref={room.ref} className={`vr-keypad legend-${room.place}`} aria-label={t.keypad}>
      <div className="vr-keypad-head">
        <strong>{t.set(set)}</strong>
        <button type="button" className="vr-btn vr-btn-primary vr-btn-small" onClick={() => {
            onSubstitute(chosen?.kind === 'player' ? chosen.number : null);
            setChosen(null);
            setSkill(null);
          }} disabled={locked || lineup.court.length === 0}>
          {t.substitution}
          {subsCount > 0 && <span className="vr-keypad-count"> · {subsCount}</span>}
        </button>
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => { setChosen(null); setSkill(null); onLineup(); }} disabled={locked}>
          {t.lineup}
        </button>
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" aria-pressed={looking} onClick={() => setLooking((l) => !l)}>
          {t.situationButton}
        </button>
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={onGrid}>
          {t.toGrid}
        </button>
      </div>

      {looking ? (
        <LiveSituation situation={situation} set={set} nameOf={nameOf} onClose={() => setLooking(false)} />
      ) : (
      <div className="vr-keypad-body">
      <div className="vr-keypad-main">
      <div className={`vr-keypad-numbers${awaiting === 'numbers' ? ' awaiting' : ''}`} role="group" aria-label={t.keypadNumbers}>
        {keys.map(({ key, zone }, i) => (
          <button
            key={i}
            type="button"
            className={`vr-keypad-key${zone === null ? ' libero-slot' : ''}${key?.kind === 'libero' ? ' libero' : ''}${key && chosen?.number === key.number && chosen.kind === key.kind ? ' chosen' : ''}`}
            disabled={locked || !key || (!!skill && !active && !fits(key.kind, skill))}
            aria-pressed={!!key && chosen?.number === key.number && chosen.kind === key.kind}
            onClick={() => key && chooseKey(key)}
          >
            {zone !== null && <small className="vr-keypad-zone" aria-label={t.zone(zone)}>{t.zoneShort(zone)}</small>}
            {key && nameOf(key.number) && <small className="vr-keypad-name">{nameOf(key.number)}</small>}
            {key ? key.number : ''}
            {zone === null && <small>{t.libero}</small>}
          </button>
        ))}
      </div>

      <div className={`vr-keypad-skills${awaiting === 'skills' ? ' awaiting' : ''}`} role="group" aria-label={t.keypadSkills}>
        {allSkills.map((c) => {
          const usable = !active || fits(active.kind, c.skill);
          return (
            <button
              key={c.skill}
              type="button"
              className={`vr-keypad-skill${skill === c.skill ? ' chosen' : ''}`}
              disabled={locked || !usable}
              aria-pressed={skill === c.skill}
              onClick={() => chooseSkill(c.skill)}
            >
              {c.skill === 'P' ? t.setFault : m.skills[c.skill]}
            </button>
          );
        })}
      </div>

      <div className={`vr-keypad-evals${awaiting === 'evals' ? ' awaiting' : ''}`} role="group" aria-label={t.keypadEvaluations}>
        {(skill ? evaluations : (['#', '+', '!', '-', '/', '='] as const)).map((e) => (
          <button
            key={e}
            type="button"
            className="vr-keypad-eval"
            style={skill ? { background: tint(skill, e) } : undefined}
            disabled={locked || !skill || !active}
            title={skill ? m.codes[skill][e] : undefined}
            onClick={() => skill && active && enter(active, codeOf(skill, e))}
          >
            {e}
          </button>
        ))}
      </div>

      </div>
      {room.place !== 'none' && (
        <aside className="vr-keypad-legend" aria-label={t.legend} aria-live="polite">
          {legendSkill ? (
            <>
              <h3>{legendSkill === 'P' ? t.setFault : m.skills[legendSkill]}</h3>
              <dl>
                {evaluations.map((e) => (
                  <div key={e}>
                    <dt style={{ background: tint(legendSkill, e) }}>{e}</dt>
                    <dd>{m.codes[legendSkill][e]}</dd>
                  </div>
                ))}
              </dl>
            </>
          ) : (
            <p>{t.legendHint}</p>
          )}
        </aside>
      )}
      </div>
      )}

      <div className="vr-keypad-foot">
        <span aria-live="polite">{last ? t.keypadLast(last) : t.keypadHint}</span>
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" disabled={!canUndo} onClick={() => { setChosen(null); setSkill(null); onUndo(); }} aria-label={`${t.undoLabel}: ${undoText}`}>
          {t.undo}
        </button>
      </div>
    </section>
  );
}

type LegendPlace = 'side' | 'below' | 'none';

/**
 * Where the legend fits: on the right when the keypad is much wider than tall
 * (a desktop), below when it is tall enough to spare a band under the
 * evaluations (a tablet, a phone upright), nowhere otherwise (a phone sideways).
 */
function useLegendRoom() {
  const ref = useRef<HTMLElement>(null);
  const [place, setPlace] = useState<LegendPlace>('none');
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      const { width, height } = el.getBoundingClientRect();
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      setPlace((current) => {
        if (width >= 56 * rem && width >= 1.4 * height) return 'side';
        // Keep the band below while it fits, so the legend does not flicker as it takes its room.
        if (height >= (current === 'below' ? 26 : 30) * rem) return 'below';
        return width >= 56 * rem && current === 'side' && width >= 1.25 * height ? 'side' : 'none';
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, place };
}

/** The six on court and the liberos at the start of a set: proposed from the previous set, changed here. */
export function LineupDialog({
  set,
  proposed,
  nameOf,
  rotate: initialRotate,
  onCancel,
  onConfirm,
}: {
  set: number;
  proposed: Lineup;
  nameOf: (number: number) => string;
  /** The keypad follows the rotation (choice of the device). */
  rotate: boolean;
  onCancel: () => void;
  /** The lineup, and the names written next to its numbers (by number). */
  onConfirm: (lineup: Lineup, names: ReadonlyMap<number, string>, rotate: boolean) => void;
}) {
  const { m } = useI18n();
  const t = m.live;
  const [court, setCourt] = useState<string[]>(Array.from({ length: 6 }, (_, i) => (proposed.court[i] !== undefined ? String(proposed.court[i]) : '')));
  const [liberos, setLiberos] = useState<string[]>(Array.from({ length: 2 }, (_, i) => (proposed.liberos[i] !== undefined ? String(proposed.liberos[i]) : '')));
  const [names, setNames] = useState<ReadonlyMap<number, string>>(new Map());
  const [rotate, setRotate] = useState(initialRotate);
  const nameFor = (value: string) => (value === '' ? '' : (names.get(Number(value)) ?? nameOf(Number(value))));
  const digits = (text: string) => text.replace(/\D/g, '').slice(0, 2);
  const numbers = (list: string[]) => list.filter((x) => x !== '').map(Number);
  const all = [...numbers(court), ...numbers(liberos)];
  const repeated = all.length !== new Set(all).size;
  const ok = numbers(court).length > 0 && !repeated;
  const field = (value: string, label: string, onChange: (v: string) => void) => (
    <>
      <input inputMode="numeric" aria-label={label} value={value} placeholder="–" onChange={(e) => onChange(digits(e.target.value))} />
      <input
        className="vr-lineup-name"
        aria-label={t.nameFor(label)}
        placeholder={t.namePlaceholder}
        value={nameFor(value)}
        disabled={value === ''}
        onChange={(e) => setNames((n) => new Map(n).set(Number(value), e.target.value))}
      />
    </>
  );
  return (
    <div className="vr-live-overlay" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form
        className="vr-live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vr-live-lineup-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (ok) onConfirm({ court: numbers(court), liberos: numbers(liberos) }, new Map([...names].filter(([n]) => all.includes(n))), rotate);
        }}
      >
        <h2 id="vr-live-lineup-title">{t.lineupTitle(set)}</h2>
        <p>{t.lineupText}</p>
        <fieldset className="vr-lineup zones">
          <legend>{t.onCourt}</legend>
          {ZONE_ROWS.flat().map((zone) => {
            const i = zone - 1;
            return (
              <span key={zone}>
                <small aria-hidden="true">{t.zone(zone)}</small>
                {field(court[i]!, t.courtPlace(zone), (v) => setCourt((c) => c.map((x, j) => (j === i ? v : x))))}
              </span>
            );
          })}
        </fieldset>
        <fieldset className="vr-lineup">
          <legend>{t.liberos}</legend>
          {liberos.map((value, i) => (
            <span key={i}>{field(value, t.liberoPlace(i + 1), (v) => setLiberos((c) => c.map((x, j) => (j === i ? v : x))))}</span>
          ))}
        </fieldset>
        <label className="vr-check">
          <input type="checkbox" checked={rotate} onChange={(e) => setRotate(e.target.checked)} />
          <span>
            <strong>{t.rotate}</strong> {t.rotateText}
          </span>
        </label>
        {repeated && (
          <p className="vr-live-warning" role="status">
            {t.lineupRepeated}
          </p>
        )}
        <div className="vr-live-dialog-actions">
          <button type="button" className="vr-btn vr-btn-secondary" onClick={onCancel}>
            {t.back}
          </button>
          <button type="submit" className="vr-btn vr-live-primary" disabled={!ok}>
            {t.save}
          </button>
        </div>
      </form>
    </div>
  );
}

/** Steps through a list with the arrows; the number can also be typed (a shirt not in the list yet). */
function Stepper({
  label,
  value,
  options,
  onChange,
  typed,
  marked,
}: {
  label: string;
  value: number | null;
  options: readonly number[];
  onChange: (n: number | null) => void;
  typed?: boolean;
  /** The number already took part in a substitution of the set: shown grey. */
  marked?: boolean;
}) {
  const { m } = useI18n();
  const t = m.live;
  const at = value === null ? -1 : options.indexOf(value);
  const step = (delta: number) => {
    if (options.length === 0) return;
    const next = at < 0 ? (delta > 0 ? 0 : options.length - 1) : (at + delta + options.length) % options.length;
    onChange(options[next]!);
  };
  return (
    <div className="vr-sub-side">
      <span className="vr-sub-label">{label}</span>
      <button type="button" className="vr-sub-arrow" aria-label={t.previousNumber(label)} onClick={() => step(-1)} disabled={options.length === 0}>
        ▲
      </button>
      {typed ? (
        <input
          className={`vr-sub-number${marked ? ' marked' : ''}`}
          inputMode="numeric"
          aria-label={label}
          placeholder="–"
          value={value ?? ''}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, '').slice(0, 2);
            onChange(digits === '' ? null : Number(digits));
          }}
        />
      ) : (
        <output className={`vr-sub-number${marked ? ' marked' : ''}`} aria-label={label}>
          {value ?? '–'}
        </output>
      )}
      <button type="button" className="vr-sub-arrow" aria-label={t.nextNumber(label)} onClick={() => step(1)} disabled={options.length === 0}>
        ▼
      </button>
    </div>
  );
}

/**
 * A substitution of the six on court (liberos are not substitutions): who
 * leaves, on the left, and who comes in, on the right. Whoever came in with a
 * substitution can leave only for the one they replaced: the right side is
 * then locked on that number. Otherwise it steps through the numbers never
 * part of a substitution of the set, or takes a new one, typed.
 */
export function SubstitutionDialog({
  leave,
  enterFor,
  court,
  liberos,
  due,
  count,
  nameOf,
  involved,
  chosen,
  onCancel,
  onConfirm,
}: {
  /** Who can leave: on court and not in a closed pair. */
  leave: readonly number[];
  enterFor: (out: number) => { readonly locked: boolean; readonly options: readonly number[] };
  court: readonly number[];
  liberos: readonly number[];
  due: readonly Substitution[];
  count: number;
  /** The name already written for a shirt number. */
  nameOf: (number: number) => string;
  /** Numbers already part of a substitution of the set: shown grey. */
  involved: ReadonlySet<number>;
  /** The number chosen on the keypad before tapping "Substitution": it starts on the left. */
  chosen: number | null;
  onCancel: () => void;
  /** The substitution, and the name written for whoever comes in. */
  onConfirm: (sub: Substitution, name: string) => void;
}) {
  const { m } = useI18n();
  const t = m.live;
  const pick = (o: number | null) => (o === null ? null : (enterFor(o).options[0] ?? null));
  const initialOut = chosen ?? due[0]?.out ?? leave[0] ?? null;
  const [out, setOut] = useState<number | null>(initialOut);
  const [enter, setEnter] = useState<number | null>(pick(initialOut));
  const [names, setNames] = useState<ReadonlyMap<number, string>>(new Map());
  const allowed = out === null ? { locked: false, options: [] as readonly number[] } : enterFor(out);
  const enterName = enter === null ? '' : (names.get(enter) ?? nameOf(enter));
  const chooseOut = (n: number | null) => {
    setOut(n);
    // The right side follows: the one to bring back, or the first free number.
    setEnter(pick(n));
  };
  const problem =
    out === null || enter === null || !leave.includes(out)
      ? 'missing'
      : court.includes(enter)
        ? 'on-court'
        : liberos.includes(enter)
          ? 'libero'
          : !allowed.locked && involved.has(enter)
            ? 'used'
            : allowed.locked && enter !== allowed.options[0]
              ? 'missing'
              : null;
  return (
    <div className="vr-live-overlay" onKeyDown={(e) => e.key === 'Escape' && onCancel()}>
      <form
        className="vr-live-dialog"
        role="dialog"
        aria-modal="true"
        aria-labelledby="vr-live-sub-title"
        onSubmit={(e) => {
          e.preventDefault();
          if (!problem) onConfirm({ out: out!, in: enter! }, enterName);
        }}
      >
        <h2 id="vr-live-sub-title">{t.substitutionTitle}</h2>
        <p>{t.substitutionsDone(count)}</p>
        {leave.length === 0 ? (
          <p className="vr-live-warning" role="status">
            {t.noSubstitution}
          </p>
        ) : (
          <div className="vr-sub">
            <div className="vr-sub-enter">
              <Stepper label={t.leaves} value={out} options={leave} onChange={chooseOut} marked={out !== null && involved.has(out)} />
              <output className="vr-sub-name" aria-label={t.nameFor(t.leaves)}>
                {out === null ? '' : nameOf(out) || '—'}
              </output>
            </div>
            <span className="vr-sub-swap" aria-hidden="true">
              ⇄
            </span>
            <div className="vr-sub-enter">
              <Stepper label={t.enters} value={enter} options={allowed.locked ? [] : allowed.options} onChange={setEnter} typed={!allowed.locked} marked={enter !== null && involved.has(enter)} />
              <input
                className="vr-sub-name"
                aria-label={t.nameFor(t.enters)}
                placeholder={t.namePlaceholder}
                value={enterName}
                disabled={enter === null}
                onChange={(e) => enter !== null && setNames((n) => new Map(n).set(enter, e.target.value))}
              />
            </div>
          </div>
        )}
        {allowed.locked && enter !== null && <p className="vr-note">{t.returnOnly(out!, enter)}</p>}
        {out !== null && !leave.includes(out) && (
          <p className="vr-live-warning" role="status">
            {t.pairClosed(out)}
          </p>
        )}
        {problem && problem !== 'missing' && (
          <p className="vr-live-warning" role="status">
            {problem === 'on-court' ? t.alreadyOnCourt(enter!) : problem === 'used' ? t.numberUsed(enter!) : t.isLibero(enter!)}
          </p>
        )}
        <div className="vr-live-dialog-actions">
          <button type="button" className="vr-btn vr-btn-secondary" onClick={onCancel}>
            {t.back}
          </button>
          <button type="submit" className="vr-btn vr-live-primary" disabled={!!problem}>
            {t.confirmSubstitution}
          </button>
        </div>
      </form>
    </div>
  );
}
