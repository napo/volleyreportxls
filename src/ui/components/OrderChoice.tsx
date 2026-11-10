// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The order of serve, block, attack and reception, from left to right, moved
 * with arrows; set faults stay last. Used by the live sheet and by the
 * printable form.
 */
import { useI18n } from '../../i18n';
import type { MovableSkill } from './counts-columns';

export function OrderChoice({
  order,
  onChange,
  text,
  heading = true,
}: {
  order: readonly MovableSkill[];
  onChange: (order: MovableSkill[]) => void;
  text: string;
  /** False inside a fieldset whose legend already asks for the order. */
  heading?: boolean;
}) {
  const { m } = useI18n();
  const t = m.live;
  const move = (i: number, delta: number) => {
    const next = [...order];
    [next[i], next[i + delta]] = [next[i + delta]!, next[i]!];
    onChange(next);
  };
  return (
    <>
      {heading && <h3 className="vr-live-order-title">{t.orderTitle}</h3>}
      <p>{text}</p>
      <ol className="vr-live-order">
        {order.map((skill, i) => (
          <li key={skill}>
            <span>{m.skills[skill]}</span>
            <button type="button" className="vr-sub-arrow" aria-label={t.moveUp(m.skills[skill])} disabled={i === 0} onClick={() => move(i, -1)}>
              ◀
            </button>
            <button type="button" className="vr-sub-arrow" aria-label={t.moveDown(m.skills[skill])} disabled={i === order.length - 1} onClick={() => move(i, 1)}>
              ▶
            </button>
          </li>
        ))}
        <li className="fixed">
          <span>{m.skills.P}</span>
        </li>
      </ol>
    </>
  );
}
