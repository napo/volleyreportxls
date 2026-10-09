// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from 'react';
import { type Messages, useI18n } from '../../i18n';
import type { SetTrendRow } from '../../report/chart-data';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { Legend } from './Legend';
import { BASE_OPTION, GRID, SERIES, SURFACE, TEXT_PRIMARY, percent } from './tokens';

const lines = (m: Messages) =>
  [
    { key: 'receptionPositivity', name: m.charts.receptionPos, color: SERIES[0] },
    { key: 'attackPointRate', name: m.charts.attackPt, color: SERIES[1] },
  ] as const;

export const TREND_CHART_HEIGHT = 230;

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
    yAxis: { type: 'value', min: 0, max: 1, interval: 0.25, axisLabel: { formatter: percent }, splitLine: { lineStyle: { color: GRID } } },
    legend: { show: false },
    tooltip: {
      ...BASE_OPTION.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#8a959e', width: 1 } },
      valueFormatter: (v: number | null) => (v === null ? '.' : percent(v)),
    },
    series: lines(m).map((l) => ({
      name: l.name,
      type: 'line',
      data: rows.map((r) => r[l.key]),
      lineStyle: { width: 2, color: l.color, cap: 'round', join: 'round' },
      itemStyle: { color: l.color, borderColor: SURFACE, borderWidth: 2 },
      symbol: 'circle',
      symbolSize: 9,
      connectNulls: false,
      endLabel: { show: true, color: TEXT_PRIMARY, fontWeight: 600, formatter: (p: { value: number }) => percent(p.value) },
    })),
  };
}

/** Reception Pos% and attack Pt% set by set (or match by match): one percentage axis, end-labelled lines. */
export function TrendChart({ rows, firstColumn, label }: { rows: readonly SetTrendRow[]; firstColumn?: string; label?: string }) {
  const { m } = useI18n();
  const option = useMemo(() => trendChartOption(rows, m), [rows, m]);

  return (
    <>
      <Legend mark="line" items={lines(m).map((l) => ({ label: l.name, color: l.color }))} />
      <EChart option={option} height={TREND_CHART_HEIGHT} label={label ?? m.charts.trendLabel} />
      <DataTable
        head={[firstColumn ?? m.charts.set, m.charts.receptionPos, m.charts.attackPt]}
        rows={rows.map((r) => [
          r.set,
          r.receptionPositivity === null ? '.' : percent(r.receptionPositivity),
          r.attackPointRate === null ? '.' : percent(r.attackPointRate),
        ])}
      />
    </>
  );
}
