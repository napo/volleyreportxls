// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from 'react';
import { type Messages, useI18n } from '../../i18n';
import { type SetTrendRow, TREND_KEYS } from '../../report/chart-data';
import { useA11y } from '../a11y';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { BASE_OPTION, GRID, SERIES, TEXT_PRIMARY, escapeHtml, percent } from './tokens';

/** Same colours as the trend: green serve, blue reception, orange attack. */
const SERVE = '#009e73';
const BARS = (m: Messages) =>
  [
    { key: 'servePositivity', name: m.charts.servePos, color: SERVE },
    { key: 'receptionPositivity', name: m.charts.receptionPos, color: SERIES[0] },
    { key: 'receptionEfficiency', name: m.charts.receptionEff, color: SERIES[0] },
    { key: 'attackPositivity', name: m.charts.attackPos, color: SERIES[1] },
    { key: 'attackEfficiency', name: m.charts.attackEff, color: SERIES[1] },
  ] as const satisfies readonly { key: (typeof TREND_KEYS)[number]; name: string; color: string }[];

const signed = (key: string, v: number) => (key.endsWith('Efficiency') && v > 0 ? `+${percent(v)}` : percent(v));
const ROW_HEIGHT = 40;

/** The final percentages (whole match, or the matches together) of serve, reception and attack. */
export const finalPercentRows = (final: SetTrendRow, m: Messages) =>
  BARS(m).flatMap((b) => (final[b.key] === null ? [] : [{ key: b.key, name: b.name, color: b.color, value: final[b.key]! }]));

export function finalPercentOption(rows: ReturnType<typeof finalPercentRows>) {
  return {
    ...BASE_OPTION,
    grid: { top: 4, left: 8, right: 48, bottom: 8, containLabel: true },
    xAxis: { type: 'value', min: Math.min(0, ...rows.map((r) => Math.floor(r.value * 4) / 4)), max: 1, interval: 0.25, axisLabel: { formatter: percent }, splitLine: { lineStyle: { color: GRID } } },
    yAxis: { type: 'category', inverse: true, data: rows.map((r) => r.name), axisTick: { show: false }, axisLine: { lineStyle: { color: '#c3cad0' } }, axisLabel: { color: TEXT_PRIMARY, fontWeight: 500 } },
    legend: { show: false },
    tooltip: {
      ...BASE_OPTION.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(6,40,69,0.05)' } },
      formatter: (items: { dataIndex: number }[]) => {
        const r = rows[items[0]!.dataIndex]!;
        return `${escapeHtml(r.name)}: <b>${signed(r.key, r.value)}</b>`;
      },
    },
    series: [
      {
        type: 'bar',
        barMaxWidth: 22,
        label: { show: true, position: 'right', color: TEXT_PRIMARY, fontWeight: 600, formatter: (p: { dataIndex: number }) => signed(rows[p.dataIndex]!.key, rows[p.dataIndex]!.value) },
        data: rows.map((r) => ({ value: r.value, itemStyle: { color: r.color, borderRadius: [0, 4, 4, 0] } })),
      },
    ],
  };
}

export function FinalPercentChart({ final, title }: { final: SetTrendRow; title: string }) {
  const { m } = useI18n();
  const access = useA11y();
  const rows = useMemo(() => finalPercentRows(final, m), [final, m]);
  const option = useMemo(() => finalPercentOption(rows), [rows, m, access]);
  if (rows.length === 0) return <p className="vr-note">{m.charts.noPoints}</p>;
  return (
    <>
      <EChart option={option} height={20 + rows.length * ROW_HEIGHT} label={title} />
      <DataTable head={[m.charts.skill, '%']} rows={rows.map((r) => [r.name, signed(r.key, r.value)])} />
    </>
  );
}
