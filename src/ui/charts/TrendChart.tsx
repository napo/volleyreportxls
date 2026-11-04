// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from 'react';
import { type Messages, useI18n } from '../../i18n';
import { type SetTrendRow, TREND_KEYS } from '../../report/chart-data';
import { useA11y } from '../a11y';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { Legend } from './Legend';
import { BASE_OPTION, GRID, SERIES, SURFACE, TEXT_PRIMARY, escapeHtml, percent } from './tokens';

/** Green for the serve, blue for the reception, orange for the attack; positivity solid, efficiency dashed. */
const SERVE = '#009e73';
const lines = (m: Messages) =>
  [
    { key: 'servePositivity', name: m.charts.servePos, color: SERVE },
    { key: 'receptionPositivity', name: m.charts.receptionPos, color: SERIES[0] },
    { key: 'receptionEfficiency', name: m.charts.receptionEff, color: SERIES[0], dash: 'dashed' },
    { key: 'attackPositivity', name: m.charts.attackPos, color: SERIES[1] },
    { key: 'attackEfficiency', name: m.charts.attackEff, color: SERIES[1], dash: 'dashed' },
  ] as const satisfies readonly { key: (typeof TREND_KEYS)[number]; name: string; color: string; dash?: 'dashed' }[];

/** Positivity is a share (no sign), efficiency a balance (with sign). */
const isEfficiency = (key: (typeof TREND_KEYS)[number]) => key.endsWith('Efficiency');
const formatted = (key: (typeof TREND_KEYS)[number], v: number | null) => (v === null ? '.' : isEfficiency(key) ? signedPercent(v) : percent(v));

export const TREND_CHART_HEIGHT = 260;

const signedPercent = (v: number) => `${v > 0 ? '+' : ''}${percent(v)}`;

/** The bottom of the axis: 0, or the quarter below the lowest value. */
const lowest = (rows: readonly SetTrendRow[]) =>
  Math.min(0, ...rows.flatMap((r) => [r.receptionEfficiency, r.attackEfficiency].map((v) => Math.floor((v ?? 0) * 4) / 4)));

export function trendChartOption(rows: readonly SetTrendRow[], m: Messages) {
  return {
    ...BASE_OPTION,
    grid: { top: 12, left: 8, right: 56, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: rows.map((r) => r.set),
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#c3cad0' } },
      axisLabel: { color: TEXT_PRIMARY },
    },
    // From 0 to 100%, lower when an efficiency is negative.
    yAxis: { type: 'value', min: lowest(rows), max: 1, interval: 0.25, axisLabel: { formatter: percent }, splitLine: { lineStyle: { color: GRID } } },
    legend: { show: false },
    tooltip: {
      ...BASE_OPTION.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#8a959e', width: 1 } },
      formatter: (items: { seriesIndex: number; marker: string; seriesName: string; value: number | null; axisValueLabel: string }[]) =>
        `${escapeHtml(items[0]?.axisValueLabel ?? '')}<br>` +
        items.map((i) => `${i.marker}${escapeHtml(i.seriesName)}: <b>${formatted(lines(m)[i.seriesIndex]!.key, i.value)}</b>`).join('<br>'),
    },
    series: lines(m).map((l) => ({
      name: l.name,
      type: 'line',
      data: rows.map((r) => r[l.key]),
      lineStyle: { width: 2, color: l.color, cap: 'round', join: 'round', type: 'dash' in l ? l.dash : 'solid' },
      itemStyle: { color: l.color, borderColor: SURFACE, borderWidth: 2 },
      symbol: 'dash' in l ? 'emptyCircle' : 'circle',
      symbolSize: 8,
      connectNulls: false,
      endLabel: { show: true, color: l.color, fontWeight: 600, formatter: (p: { value: number }) => formatted(l.key, p.value) },
      // Five lines can end close together: their labels move apart.
      labelLayout: { moveOverlap: 'shiftY' },
    })),
  };
}

/** Serve, reception and attack set by set (or match by match): one percentage axis, end-labelled lines. */
export function TrendChart({ rows, firstColumn, label }: { rows: readonly SetTrendRow[]; firstColumn?: string; label?: string }) {
  const { m } = useI18n();
  const access = useA11y();
  const option = useMemo(() => trendChartOption(rows, m), [rows, m, access]);

  return (
    <>
      <Legend mark="line" items={lines(m).map((l) => ({ label: l.name, color: l.color, ...('dash' in l && { dash: l.dash }) }))} />
      <EChart option={option} height={TREND_CHART_HEIGHT} label={label ?? m.charts.trendLabel} />
      <DataTable
        head={[firstColumn ?? m.charts.set, ...lines(m).map((l) => l.name)]}
        rows={rows.map((r) => [r.set, ...lines(m).map((l) => formatted(l.key, r[l.key]))])}
      />
    </>
  );
}
