// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo } from 'react';
import type { ReceiverLine } from '../../athletes/receivers';
import { EVALUATION_SCALES } from '../../domain/codes';
import { type Messages, useI18n } from '../../i18n';
import { useA11y } from '../a11y';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { ScaleLegend } from './EvaluationChart';
import { formatIndicator } from './IndicatorTrendChart';
import { BASE_OPTION, GRID, TEXT_PRIMARY, chartSize, escapeHtml, scaleColors, scaleLabels } from './tokens';

const SCALE = EVALUATION_SCALES.R;
const ROW_HEIGHT = 44;

/** Chart height in pixels for the given lines. */
export const receiversChartHeight = (lines: readonly ReceiverLine[]) => 36 + lines.length * ROW_HEIGHT;

const summary = (l: ReceiverLine, m: Messages) =>
  `${m.receivers.positivityShort} ${formatIndicator('reception', l.positivity)} · ${m.receivers.efficiencyShort} ${formatIndicator('receptionEfficiency', l.efficiency)}`;

/**
 * One bar per athlete, as long as the receptions, split by evaluation from #
 * (perfect) to = (ace conceded); positivity and efficiency at its end.
 */
export function receiversChartOption(lines: readonly ReceiverLine[], m: Messages) {
  const max = Math.max(1, ...lines.map((l) => l.receptions));
  return {
    ...BASE_OPTION,
    // Room on the right for positivity and efficiency.
    grid: { top: 4, left: 8, right: 150, bottom: 8, containLabel: true },
    xAxis: { type: 'value', minInterval: 1, splitLine: { lineStyle: { color: GRID } } },
    yAxis: {
      type: 'category',
      inverse: true,
      data: lines.map((l) => `${l.label} · ${l.receptions}`),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: TEXT_PRIMARY, fontWeight: 500 },
    },
    legend: { show: false },
    tooltip: {
      ...BASE_OPTION.tooltip,
      trigger: 'item',
      formatter: (p: { seriesIndex: number; dataIndex: number }) => {
        const line = lines[p.dataIndex]!;
        if (p.seriesIndex >= SCALE.length) return `${escapeHtml(line.label)}<br>${escapeHtml(summary(line, m))}`;
        const e = SCALE[p.seriesIndex]!;
        return (
          `<strong style="font-size:14px">${line.counts[e]} / ${line.receptions}</strong><br>` +
          `${escapeHtml(line.label)} <b>R${escapeHtml(e)}</b><br>` +
          `<span style="color:#7d7d7d">${escapeHtml(m.codes.R[e] ?? '')}</span>`
        );
      },
    },
    series: [
      ...SCALE.map((e, place) => ({
        name: `R${e}`,
        type: 'bar',
        stack: 'receptions',
        barMaxWidth: 24,
        itemStyle: { color: scaleColors()[place], borderColor: '#ffffff', borderWidth: 1 },
        emphasis: { focus: 'none', itemStyle: { opacity: 0.85 } },
        label: {
          show: true,
          color: scaleLabels()[place],
          fontSize: chartSize(11),
          // Inside the segment only when it fits; the table has every number.
          formatter: (p: { value: number }) => (p.value > 0 && p.value / max >= 0.06 ? `${e} ${p.value}` : ''),
        },
        data: lines.map((l) => l.counts[e]),
      })),
      // Positivity and efficiency at the end of the bar: an empty segment that carries the label.
      {
        type: 'bar',
        stack: 'receptions',
        silent: true,
        itemStyle: { color: 'transparent' },
        label: { show: true, position: 'right', distance: 8, color: TEXT_PRIMARY, fontWeight: 600, fontSize: chartSize(12), formatter: (p: { dataIndex: number }) => summary(lines[p.dataIndex]!, m) },
        data: lines.map(() => 0),
      },
    ],
  };
}

export function ReceiversChart({ lines, title }: { lines: readonly ReceiverLine[]; title: string }) {
  const { m } = useI18n();
  const t = m.receivers;
  const access = useA11y();
  const option = useMemo(() => receiversChartOption(lines, m), [lines, m, access]);
  return (
    <>
      <ScaleLegend m={m} />
      <EChart option={option} height={receiversChartHeight(lines)} label={title} />
      <DataTable
        head={[m.athletes.athlete, t.receptions, t.perfect, t.positivity, t.efficiency, t.aces]}
        rows={lines.map((l) => [l.label, l.receptions, l.perfect, formatIndicator('reception', l.positivity), formatIndicator('receptionEfficiency', l.efficiency), l.aces])}
      />
    </>
  );
}
