// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The trend of one indicator of an athlete, match by match (or set by set),
 * with two flat reference lines: the athlete's average (dashed, same colour)
 * and the team's (dotted, grey).
 */
import { useMemo } from 'react';
import { type ProfileAxis, rangeOf } from '../../athletes/profile';
import { type Messages, useI18n } from '../../i18n';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { Legend } from './Legend';
import { BASE_OPTION, GRID, SERIES, SURFACE, TEXT_PRIMARY, TEXT_SECONDARY, percent } from './tokens';

export interface TrendPoint {
  readonly label: string;
  readonly value: number | null;
}

/** Positivity is a share (no sign), efficiency a balance (with sign). */
export function formatIndicator(axis: ProfileAxis, value: number | null): string {
  if (value === null) return '.';
  if (axis === 'serve' || axis === 'reception') return percent(value);
  return `${value > 0 ? '+' : ''}${percent(value)}`;
}

export const INDICATOR_TREND_HEIGHT = 220;

const lines = (m: Messages) => [
  { name: m.profile.own, color: SERIES[0] },
  { name: m.profile.ownAverage, color: SERIES[0], dash: 'dashed' as const },
  { name: m.profile.teamAverage, color: TEXT_SECONDARY, dash: 'dotted' as const },
];

export function indicatorTrendOption(points: readonly TrendPoint[], axis: ProfileAxis, own: number | null, team: number | null, m: Messages) {
  const { min, max } = rangeOf(axis, [...points.map((p) => p.value), own, team]);
  const flat = (value: number | null) => points.map(() => value);
  const [athlete, ownLine, teamLine] = lines(m);
  return {
    ...BASE_OPTION,
    grid: { top: 12, left: 8, right: 56, bottom: 8, containLabel: true },
    xAxis: {
      type: 'category',
      data: points.map((p) => p.label),
      boundaryGap: false,
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#c3cad0' } },
      axisLabel: { color: TEXT_PRIMARY },
    },
    yAxis: { type: 'value', min, max, axisLabel: { formatter: (v: number) => formatIndicator(axis, v) }, splitLine: { lineStyle: { color: GRID } } },
    legend: { show: false, data: lines(m).map((l) => l.name) },
    tooltip: {
      ...BASE_OPTION.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'line', lineStyle: { color: '#8a959e', width: 1 } },
      valueFormatter: (v: number | null) => formatIndicator(axis, v),
    },
    series: [
      {
        name: athlete!.name,
        type: 'line',
        data: points.map((p) => p.value),
        lineStyle: { width: 2, color: athlete!.color },
        itemStyle: { color: athlete!.color, borderColor: SURFACE, borderWidth: 2 },
        symbol: 'circle',
        symbolSize: 9,
        connectNulls: false,
        endLabel: { show: true, color: TEXT_PRIMARY, fontWeight: 600, formatter: (p: { value: number }) => formatIndicator(axis, p.value) },
      },
      // The averages are read in the legend, the table and the data: no label at their end, where it would cover the last point.
      ...[
        { line: ownLine!, value: own, type: 'dashed' },
        { line: teamLine!, value: team, type: 'dotted' },
      ].map(({ line, value, type }) => ({
        name: line.name,
        type: 'line',
        data: flat(value),
        symbol: 'none',
        lineStyle: { width: 1.5, color: line.color, type },
        itemStyle: { color: line.color },
      })),
    ],
  };
}

interface Props {
  readonly points: readonly TrendPoint[];
  readonly axis: ProfileAxis;
  readonly own: number | null;
  readonly team: number | null;
  readonly firstColumn: string;
  readonly label: string;
}

export function IndicatorTrendChart({ points, axis, own, team, firstColumn, label }: Props) {
  const { m } = useI18n();
  const option = useMemo(() => indicatorTrendOption(points, axis, own, team, m), [points, axis, own, team, m]);
  return (
    <>
      <Legend mark="line" items={lines(m).map((l) => ({ label: l.name, color: l.color, ...(l.dash && { dash: l.dash }) }))} />
      <EChart option={option} height={INDICATOR_TREND_HEIGHT} label={label} />
      <DataTable
        head={[firstColumn, m.profile.axes[axis]]}
        rows={[
          ...points.map((p) => [p.label, formatIndicator(axis, p.value)]),
          [m.profile.ownAverage, formatIndicator(axis, own)],
          [m.profile.teamAverage, formatIndicator(axis, team)],
        ]}
      />
    </>
  );
}
