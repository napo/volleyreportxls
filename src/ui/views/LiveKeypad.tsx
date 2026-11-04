// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Scouting with the keypad of the live sheet, made for phones: the shirt
 * number, then the skill, then the evaluation; the touch goes into the sheet
 * below. Eight keys: the six on court and the two liberos (a libero has only
 * reception and set, as on the form). Buttons light up in that order; an
 * evaluation alone in its skill is entered with the skill.
 */
import { useState } from 'react';
import type { Evaluation, ScoutCodeString, Skill } from '../../domain/codes';
import { useI18n } from '../../i18n';
import type { Lineup, RowKind } from '../../matches/record';
import { evaluationTint } from '../../report/evaluation-colors';
import { codeOf, skillColumns } from '../components/counts-columns';

const tint = (skill: Skill, evaluation: Evaluation) => `rgb(${evaluationTint(skill, evaluation).map((v) => Math.round(v * 255)).join(' ')})`;

interface Chosen {
  readonly number: number;
  readonly kind: RowKind;
}

export interface KeypadProps {
  readonly set: number;
  readonly lineup: Lineup;
  readonly untracked: ReadonlySet<ScoutCodeString>;
  readonly locked: boolean;
  /** The last touch, as shown at the bottom ("7 · A#"), or null. */
  readonly last: string | null;
  readonly canUndo: boolean;
  readonly undoText: string;
  readonly onTouch: (number: number, kind: RowKind, code: ScoutCodeString) => void;
  readonly onUndo: () => void;
  readonly onLineup: () => void;
  readonly onGrid: () => void;
}

export function LiveKeypad({ set, lineup, untracked, locked, last, canUndo, undoText, onTouch, onUndo, onLineup, onGrid }: KeypadProps) {
  const { m } = useI18n();
  const t = m.live;
  const [chosen, setChosen] = useState<Chosen | null>(null);
  const [skill, setSkill] = useState<Skill | null>(null);

  const keys: (Chosen | null)[] = [
    ...Array.from({ length: 6 }, (_, i) => (lineup.court[i] !== undefined ? { number: lineup.court[i]!, kind: 'player' as const } : null)),
    ...Array.from({ length: 2 }, (_, i) => (lineup.liberos[i] !== undefined ? { number: lineup.liberos[i]!, kind: 'libero' as const } : null)),
  ];
  // Skills of the chosen key (a libero has fewer), each with the evaluations shown in the sheet.
  const skills = skillColumns(chosen?.kind ?? 'player').map((c) => ({
    skill: c.skill,
    evaluations: c.evaluations.filter((e) => !untracked.has(codeOf(c.skill, e))),
  }));
  const allSkills = skillColumns('player');
  const evaluations = skills.find((c) => c.skill === skill)?.evaluations ?? [];

  const enter = (code: ScoutCodeString) => {
    if (!chosen) return;
    onTouch(chosen.number, chosen.kind, code);
    setChosen(null);
    setSkill(null);
  };
  const chooseSkill = (s: Skill) => {
    const only = skills.find((c) => c.skill === s)?.evaluations;
    if (only?.length === 1) enter(codeOf(s, only[0]!));
    else setSkill(s);
  };

  return (
    <section className="vr-keypad" aria-label={t.keypad}>
      <div className="vr-keypad-head">
        <strong>{t.set(set)}</strong>
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={onLineup} disabled={locked}>
          {t.lineup}
        </button>
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={onGrid}>
          {t.toGrid}
        </button>
      </div>

      <div className="vr-keypad-numbers" role="group" aria-label={t.keypadNumbers}>
        {keys.map((key, i) => (
          <button
            key={i}
            type="button"
            className={`vr-keypad-key${key?.kind === 'libero' ? ' libero' : ''}${key && chosen?.number === key.number && chosen.kind === key.kind ? ' chosen' : ''}`}
            disabled={locked || !key}
            aria-pressed={!!key && chosen?.number === key.number && chosen.kind === key.kind}
            onClick={() => {
              if (!key) return;
              setChosen(key);
              setSkill(null);
            }}
          >
            {key ? key.number : ''}
            {i >= 6 && <small>{t.libero}</small>}
          </button>
        ))}
      </div>

      <div className="vr-keypad-skills" role="group" aria-label={t.keypadSkills}>
        {allSkills.map((c) => {
          const usable = !!chosen && skills.some((x) => x.skill === c.skill);
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

      <div className="vr-keypad-evals" role="group" aria-label={t.keypadEvaluations}>
        {(skill ? evaluations : (['#', '+', '!', '-', '/', '='] as const)).map((e) => (
          <button
            key={e}
            type="button"
            className="vr-keypad-eval"
            style={skill ? { background: tint(skill, e) } : undefined}
            disabled={locked || !skill}
            title={skill ? m.codes[skill][e] : undefined}
            onClick={() => skill && enter(codeOf(skill, e))}
          >
            {e}
          </button>
        ))}
      </div>

      <div className="vr-keypad-foot">
        <span aria-live="polite">{last ? t.keypadLast(last) : t.keypadHint}</span>
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" disabled={!canUndo} onClick={onUndo} aria-label={`${t.undoLabel}: ${undoText}`}>
          {t.undo}
        </button>
      </div>
    </section>
  );
}

/** The six on court and the liberos at the start of a set: proposed from the previous set, changed here. */
export function LineupDialog({
  set,
  proposed,
  onCancel,
  onConfirm,
}: {
  set: number;
  proposed: Lineup;
  onCancel: () => void;
  onConfirm: (lineup: Lineup) => void;
}) {
  const { m } = useI18n();
  const t = m.live;
  const [court, setCourt] = useState<string[]>(Array.from({ length: 6 }, (_, i) => (proposed.court[i] !== undefined ? String(proposed.court[i]) : '')));
  const [liberos, setLiberos] = useState<string[]>(Array.from({ length: 2 }, (_, i) => (proposed.liberos[i] !== undefined ? String(proposed.liberos[i]) : '')));
  const digits = (text: string) => text.replace(/\D/g, '').slice(0, 2);
  const numbers = (list: string[]) => list.filter((x) => x !== '').map(Number);
  const all = [...numbers(court), ...numbers(liberos)];
  const repeated = all.length !== new Set(all).size;
  const ok = numbers(court).length > 0 && !repeated;
  const field = (value: string, label: string, onChange: (v: string) => void) => (
    <input inputMode="numeric" aria-label={label} value={value} placeholder="–" onChange={(e) => onChange(digits(e.target.value))} />
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
          if (ok) onConfirm({ court: numbers(court), liberos: numbers(liberos) });
        }}
      >
        <h2 id="vr-live-lineup-title">{t.lineupTitle(set)}</h2>
        <p>{t.lineupText}</p>
        <fieldset className="vr-lineup">
          <legend>{t.onCourt}</legend>
          {court.map((value, i) => (
            <span key={i}>{field(value, t.courtPlace(i + 1), (v) => setCourt((c) => c.map((x, j) => (j === i ? v : x))))}</span>
          ))}
        </fieldset>
        <fieldset className="vr-lineup">
          <legend>{t.liberos}</legend>
          {liberos.map((value, i) => (
            <span key={i}>{field(value, t.liberoPlace(i + 1), (v) => setLiberos((c) => c.map((x, j) => (j === i ? v : x))))}</span>
          ))}
        </fieldset>
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
