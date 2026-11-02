// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The names to look at: the whole roster always in view, one switch per name,
 * and a field that narrows it while typing (Enter switches the first name
 * found). The ids keep the order in which they were chosen.
 */
import { type KeyboardEvent, useState } from 'react';
import { useI18n } from '../../i18n';
import { fold } from '../match-table';

export interface NameOption {
  readonly id: string;
  readonly label: string;
  /** Also searched and shown greyed, e.g. the shirt numbers. */
  readonly hint?: string;
}

interface Props {
  readonly legend: string;
  readonly options: readonly NameOption[];
  /** The ids chosen, in the order chosen. */
  readonly selected: readonly string[];
  readonly onChange: (selected: readonly string[]) => void;
}

export function NamePicker({ legend, options, selected, onChange }: Props) {
  const t = useI18n().m.picker;
  const [query, setQuery] = useState('');

  const words = fold(query).split(/\s+/).filter(Boolean);
  const shown = options.filter((o) => words.every((w) => fold(`${o.label} ${o.hint ?? ''}`).includes(w)));
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && shown[0]) {
      e.preventDefault();
      toggle(shown[0].id);
      setQuery('');
    }
  };

  return (
    <fieldset className="vr-picker">
      <legend>{legend}</legend>
      <div className="vr-picker-head">
        <input type="search" aria-label={t.search} autoComplete="off" value={query} placeholder={t.search} onChange={(e) => setQuery(e.target.value)} onKeyDown={onKey} />
        <span className="vr-picker-count">{t.count(selected.length, options.length)}</span>
        <div className="vr-actions start">
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => onChange(options.map((o) => o.id))}>
            {t.all}
          </button>
          <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => onChange([])}>
            {t.clear}
          </button>
        </div>
      </div>
      <div className="vr-choices">
        {shown.length === 0 && <p className="vr-note">{t.noMatch}</p>}
        {shown.map((o) => (
          <label key={o.id} className="vr-choice">
            <input type="checkbox" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} />
            {o.label}
            {o.hint && <small>{o.hint}</small>}
          </label>
        ))}
      </div>
    </fieldset>
  );
}
