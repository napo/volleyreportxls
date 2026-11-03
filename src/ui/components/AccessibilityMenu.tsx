// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** The accessibility choices, next to the language: a button that opens a small panel of switches. */
import { useEffect, useId, useRef, useState } from 'react';
import { type A11y, a11yChanged, resetA11y, setA11y, useA11y } from '../a11y';
import { useI18n } from '../../i18n';

/** A person with open arms in a circle: the usual sign of accessibility, drawn here. */
function AccessIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="10" />
      <circle cx="12" cy="7" r="1.4" fill="currentColor" stroke="none" />
      <path d="M7 10l5 1 5-1M12 11v4M12 15l-2.5 4M12 15l2.5 4" />
    </svg>
  );
}

const SWITCHES = ['colorblind', 'contrast', 'still', 'legible', 'tables', 'explain'] as const satisfies readonly (keyof A11y)[];

export function AccessibilityMenu() {
  const { m } = useI18n();
  const t = m.a11y;
  const choices = useA11y();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const panel = useId();

  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const help: Partial<Record<(typeof SWITCHES)[number], string>> = { colorblind: t.colorblindHelp, legible: t.legibleHelp };

  return (
    <div className="vr-access" ref={root}>
      <button type="button" aria-expanded={open} aria-controls={panel} aria-label={t.label} title={t.label} onClick={() => setOpen(!open)}>
        <AccessIcon />
      </button>
      {open && (
        <div id={panel} className="vr-access-panel" role="group" aria-label={t.label}>
          <p className="vr-access-title">{t.label}</p>
          <p className="vr-note">{t.intro}</p>
          <fieldset className="vr-access-text">
            <legend>{t.text}</legend>
            <div className="vr-indicator-choice">
              {t.textSizes.map((label, i) => (
                <button key={label} type="button" aria-pressed={choices.text === i} onClick={() => setA11y({ text: i as A11y['text'] })}>
                  {label}
                </button>
              ))}
            </div>
          </fieldset>
          {SWITCHES.map((key) => (
            <label key={key} className="vr-check vr-access-switch">
              <input type="checkbox" checked={choices[key]} onChange={(e) => setA11y({ [key]: e.target.checked })} />
              <span>
                {t[key]}
                {help[key] && <small>{help[key]}</small>}
              </span>
            </label>
          ))}
          <div className="vr-actions start">
            {a11yChanged() && (
              <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={resetA11y}>
                {t.reset}
              </button>
            )}
            <button type="button" className="vr-btn vr-btn-secondary vr-btn-small" onClick={() => setOpen(false)}>
              {t.close}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
