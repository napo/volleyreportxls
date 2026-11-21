// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The note when scouting on the device starts: the grid (a replica of the
 * sheet) or the keypad (fills the sheet without moving over the grid).
 * It opens after "Start scouting" of a new match, and from About.
 */
import { useEffect, useRef } from 'react';
import grid from '../../assets/howto/6-tablet.webp';
import gridEn from '../../assets/howto/6-tablet-en.webp';
import keypad from '../../assets/howto/7a-tastierino.webp';
import keypadEn from '../../assets/howto/7a-tastierino-en.webp';
import { useI18n } from '../../i18n';
import { closeScoutModeNote, setShowScoutModeNote, useScoutModeNote } from '../guide';

export function ScoutModeDialog() {
  const { m, lang } = useI18n();
  const t = m.guide.mode;
  const { open, show } = useScoutModeNote();
  const dialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog ref={dialog} className="vr-guide vr-scout-mode" aria-labelledby="vr-scout-mode-title" onClose={closeScoutModeNote}>
      <div className="vr-guide-head">
        <h2 id="vr-scout-mode-title">{t.title}</h2>
        <button type="button" className="vr-icon-button" aria-label={t.close} onClick={closeScoutModeNote}>
          ×
        </button>
      </div>

      <div className="vr-scout-mode-options">
        <figure>
          <img src={lang === 'en' ? gridEn : grid} alt={t.gridAlt} />
          <figcaption>
            <span className="vr-btn vr-btn-secondary vr-btn-small vr-scout-mode-button" aria-hidden="true">
              {m.live.toGrid}
            </span>
            <p>{t.gridText}</p>
          </figcaption>
        </figure>
        <figure>
          <img className="portrait" src={lang === 'en' ? keypadEn : keypad} alt={t.keypadAlt} />
          <figcaption>
            <span className="vr-live-tool vr-scout-mode-button" aria-hidden="true">
              <strong>{m.live.toKeypad}</strong>
            </span>
            <p>{t.keypadText}</p>
          </figcaption>
        </figure>
      </div>

      <div className="vr-guide-foot vr-scout-mode-foot">
        <label className="vr-check vr-scout-mode-check">
          <input type="checkbox" checked={!show} onChange={(e) => setShowScoutModeNote(!e.target.checked)} />
          {t.dontShow}
        </label>
        <button type="button" className="vr-btn vr-btn-primary" onClick={closeScoutModeNote}>
          {t.done}
        </button>
      </div>
    </dialog>
  );
}
