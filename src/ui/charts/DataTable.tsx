import type { ReactNode } from 'react';
import { useI18n } from '../../i18n';

/** The table twin of a chart: every value readable without hovering. */
export function DataTable({ head, rows }: { head: readonly string[]; rows: readonly (readonly ReactNode[])[] }) {
  const { m } = useI18n();
  return (
    <details className="vr-data">
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
