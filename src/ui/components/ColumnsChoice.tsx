// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The "!" and "/" columns to keep, skill by skill, with buttons that select or
 * clear all of them and those of one skill. Used by the live sheet and by the
 * printable form; "#", "+", "-" and "=" are always there.
 */
import type { ReactNode } from 'react';
import type { ScoutCodeString } from '../../domain/codes';
import { useI18n } from '../../i18n';
import { OPTIONAL_CODES } from '../../matches/record';

type OptionalSkill = 'B' | 'M' | 'A' | 'R';

const SKILLS: readonly OptionalSkill[] = [...new Set(OPTIONAL_CODES.map((code) => code[0] as OptionalSkill))];

export function ColumnsChoice({
  hidden,
  onChange,
  note,
  skillLabel,
}: {
  hidden: ReadonlySet<ScoutCodeString>;
  onChange: (hidden: ReadonlySet<ScoutCodeString>) => void;
  /** Something to add after a column (e.g. touches already counted in it). */
  note?: (code: ScoutCodeString) => ReactNode;
  skillLabel?: (skill: OptionalSkill) => string;
}) {
  const { m } = useI18n();
  const t = m.formColumns;
  const set = (codes: readonly ScoutCodeString[], keep: boolean) => {
    const next = new Set(hidden);
    for (const code of codes) {
      if (keep) next.delete(code);
      else next.add(code);
    }
    onChange(next);
  };
  const allKept = OPTIONAL_CODES.every((code) => !hidden.has(code));
  return (
    <>
      <div className="vr-columns-all">
        <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => set(OPTIONAL_CODES, !allKept)}>
          {allKept ? t.clearAll : t.selectAll}
        </button>
      </div>
      <div className="vr-live-columns">
        {SKILLS.map((skill) => {
          const codes = OPTIONAL_CODES.filter((code) => code[0] === skill);
          const kept = codes.every((code) => !hidden.has(code));
          return (
            <fieldset key={skill}>
              <legend>{skillLabel?.(skill) ?? m.skills[skill]}</legend>
              <button type="button" className="vr-link-button vr-columns-skill" onClick={() => set(codes, !kept)}>
                {kept ? t.clearSkill : t.selectSkill}
              </button>
              {codes.map((code) => {
                const evaluation = code.slice(1) as '!' | '/';
                return (
                  <label key={code} className="vr-check">
                    <input type="checkbox" checked={!hidden.has(code)} onChange={(e) => set([code], e.target.checked)} />
                    <span>
                      <strong>
                        <em>{evaluation}</em>
                      </strong>{' '}
                      {m.codes[skill][evaluation]}
                      {note?.(code)}
                    </span>
                  </label>
                );
              })}
            </fieldset>
          );
        })}
      </div>
    </>
  );
}
