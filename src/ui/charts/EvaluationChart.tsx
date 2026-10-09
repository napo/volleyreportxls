// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useRef } from 'react';
import { EVALUATIONS } from '../../domain/codes';
import { type Messages, useI18n } from '../../i18n';
import type { EvaluationShareRow } from '../../report/chart-data';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { Legend } from './Legend';
import { useWidth } from './useWidth';
import {
  BASE_OPTION,
  EVALUATION_COLORS,
  EVALUATION_LABEL,
  GRID,
  TEXT_PRIMARY,
  escapeHtml,
  percent,
} from './tokens';

/** A percentage label needs about this many pixels inside its segment. */
const LABEL_PX = 38;
/** Room taken by the skill names on the left of the bars. */
const AXIS_LABELS_PX = 110;
const ROW_HEIGHT = 40;

/** Chart height in pixels for the given rows. */
export const evaluationChartHeight = (rows: readonly EvaluationShareRow[]) => 20 + rows.length * ROW_HEIGHT;

/** Minimum share labelled inside its segment for a chart this wide. */
export const minLabelledShareFor = (width: number) => (width > 0 ? LABEL_PX / Math.max(1, width - AXIS_LABELS_PX) : 1);

export function evaluationChartOption(rows: readonly EvaluationShareRow[], minLabelledShare: number, m: Messages) {
  const lastFilled = rows.map((row) => Math.max(...EVALUATIONS.map((e, i) => (row.counts[e] > 0 ? i : -1))));
  return {
    ...BASE_OPTION,
    grid: { top: 4, left: 8, right: 16, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      max: 1,
      axisLabel: { formatter: (v: number) => percent(v) },
      splitLine: { lineStyle: { color: GRID } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((r) => `${r.label} · ${r.total}`),
      axisTick: { show: false },
      axisLine: { show: false },
      axisLabel: { color: TEXT_PRIMARY, fontWeight: 500 },
    },
    legend: { show: false },
    tooltip: {
      ...BASE_OPTION.tooltip,
      trigger: 'item',
      formatter: (p: { seriesIndex: number; dataIndex: number }) => {
        const evaluation = EVALUATIONS[p.seriesIndex]!;
        const row = rows[p.dataIndex]!;
        const meaning = m.codes[row.skill][evaluation] ?? '';
        return (
          `<strong style="font-size:14px">${row.counts[evaluation]} · ${percent(row.shares[evaluation])}</strong><br>` +
          `${escapeHtml(row.label)} <b>${row.skill}${escapeHtml(evaluation)}</b><br>` +
          `<span style="color:#7d7d7d">${escapeHtml(meaning)}</span>`
        );
      },
    },
    series: EVALUATIONS.map((evaluation, ei) => ({
      name: `${evaluation}  ${m.evaluationNames[evaluation]}`,
      type: 'bar',
      stack: 'share',
      barMaxWidth: 24,
      itemStyle: { color: EVALUATION_COLORS[evaluation], borderColor: '#ffffff', borderWidth: 1 },
      emphasis: { focus: 'none', itemStyle: { opacity: 0.85 } },
      label: {
        show: true,
        color: EVALUATION_LABEL[evaluation],
        fontSize: 11,
        formatter: (p: { value: number }) => (p.value >= minLabelledShare ? percent(p.value) : ''),
      },
      data: rows.map((row, ri) => ({
        value: row.shares[evaluation],
        // 4px rounded data-end, square at the baseline.
        itemStyle: ei === lastFilled[ri] ? { borderRadius: [0, 4, 4, 0] } : {},
      })),
    })),
  };
}

/**
 * How the touches of each skill were evaluated: one 100% bar per skill,
 * segments from # (best, blue) to = (worst, orange) on a diverging scale.
 */
export function EvaluationChart({ rows, title }: { rows: readonly EvaluationShareRow[]; title: string }) {
  const { m } = useI18n();
  const box = useRef<HTMLDivElement>(null);
  const width = useWidth(box);
  // Label a segment only when the label fits inside it; otherwise tooltip and table carry the value.
  const minLabelledShare = minLabelledShareFor(width);
  const option = useMemo(() => evaluationChartOption(rows, minLabelledShare, m), [rows, minLabelledShare, m]);

  if (rows.length === 0) return <p className="vr-note">{m.charts.noTouches}</p>;
  return (
    <div ref={box}>
      <Legend mark="bar" items={EVALUATIONS.map((e) => ({ label: `${e}  ${m.evaluationNames[e]}`, color: EVALUATION_COLORS[e] }))} />
      <EChart option={option} height={evaluationChartHeight(rows)} label={title} />
      <DataTable
        head={[m.charts.skill, m.charts.tot, ...EVALUATIONS]}
        rows={rows.map((r) => [r.label, r.total, ...EVALUATIONS.map((e) => (r.counts[e] ? `${r.counts[e]} (${percent(r.shares[e])})` : '.'))])}
      />
    </div>
  );
}
