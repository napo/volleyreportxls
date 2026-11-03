// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { type ReactNode, useEffect, useRef } from 'react';
import { useI18n } from '../../i18n';
import { useA11y } from '../a11y';

/** The table twin of a chart: every value readable without hovering, and on paper (it opens for printing). */
export function DataTable({ head, rows }: { head: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  const { m } = useI18n();
  const { tables } = useA11y();
  const ref = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    let wasOpen = false;
    const before = () => {
      wasOpen = ref.current?.open ?? false;
      if (ref.current) ref.current.open = true;
    };
    const after = () => {
      if (ref.current) ref.current.open = wasOpen;
    };
    window.addEventListener('beforeprint', before);
    window.addEventListener('afterprint', after);
    return () => {
      window.removeEventListener('beforeprint', before);
      window.removeEventListener('afterprint', after);
    };
  }, []);

  return (
    // Remounted when the choice changes, so that it opens (or closes) every table.
    <details className="vr-data" ref={ref} key={String(tables)} open={tables}>
      <summary>{m.charts.showData}</summary>
      <div className="vr-scroll">
        <table className="vr-table">
          <thead>
            <tr>
              {head.map((h, i) => (
                <th key={h} className={i === 0 ? undefined : 'num'}>
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, i) => (
                  <td key={i} className={i === 0 ? undefined : 'num'}>
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}
