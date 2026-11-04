// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Who only received (usually the libero) cannot win points and is left out
 * of the comparison of points won and lost: their reception instead.
 */
import type { SquadRow } from '../../athletes/squad-history';
import { receiverLines } from '../../athletes/receivers';
import { useI18n } from '../../i18n';
import { ReceiversChart as Chart } from '../charts/ReceiversChart';

export function ReceiversChart({ rows }: { rows: readonly SquadRow[] }) {
  const { m } = useI18n();
  const t = m.receivers;
  const lines = receiverLines(rows);
  if (!lines.length) return null;
  return (
    <section className="vr-card">
      <div className="vr-card-head">
        <div>
          <h2>{t.title}</h2>
          <p>{t.text}</p>
        </div>
      </div>
      <Chart lines={lines} title={t.label} />
    </section>
  );
}
