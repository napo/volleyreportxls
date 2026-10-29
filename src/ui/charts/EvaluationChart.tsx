// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useMemo, useRef } from 'react';
import { EVALUATION_SCALES, type Evaluation } from '../../domain/codes';
import { type Messages, useI18n } from '../../i18n';
import type { EvaluationShareRow } from '../../report/chart-data';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { useWidth } from './useWidth';
import {
  BASE_OPTION,
  GRID,
  SCALE_COLORS,
  SCALE_LABELS,
  TEXT_PRIMARY,
  escapeHtml,
  percent,
} from './tokens';

/** A label (symbol and percentage) needs about this many pixels inside its segment. */
const LABEL_PX = 50;
/** Room taken by the skill names on the left of the bars. */
const AXIS_LABELS_PX = 110;
const ROW_HEIGHT = 40;

/** Chart height in pixels for the given rows. */
export const evaluationChartHeight = (rows: readonly EvaluationShareRow[]) => 20 + rows.length * ROW_HEIGHT;

/** Minimum share labelled inside its segment for a chart this wide. */
export const minLabelledShareFor = (width: number) => (width > 0 ? LABEL_PX / Math.max(1, width - AXIS_LABELS_PX) : 1);

/** One series per place on the scale: the same place holds different symbols in different skills (serve "/" is second). */
const PLACES = SCALE_COLORS.map((_, i) => i);
const evaluationAt = (row: EvaluationShareRow, place: number): Evaluation => EVALUATION_SCALES[row.skill][place]!;

export function evaluationChartOption(rows: readonly EvaluationShareRow[], minLabelledShare: number, m: Messages) {
  const lastFilled = rows.map((row) => Math.max(...PLACES.map((i) => (row.counts[evaluationAt(row, i)] > 0 ? i : -1))));
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
        const row = rows[p.dataIndex]!;
        const evaluation = evaluationAt(row, p.seriesIndex);
        const meaning = m.codes[row.skill][evaluation] ?? '';
        return (
          `<strong style="font-size:14px">${row.counts[evaluation]} · ${percent(row.shares[evaluation])}</strong><br>` +
          `${escapeHtml(row.label)} <b>${row.skill}${escapeHtml(evaluation)}</b><br>` +
          `<span style="color:#7d7d7d">${escapeHtml(meaning)}</span>`
        );
      },
    },
    series: PLACES.map((place) => ({
      name: m.charts.scalePlace(place + 1),
      type: 'bar',
      stack: 'share',
      barMaxWidth: 24,
      itemStyle: { color: SCALE_COLORS[place], borderColor: '#ffffff', borderWidth: 1 },
      emphasis: { focus: 'none', itemStyle: { opacity: 0.85 } },
      label: {
        show: true,
        color: SCALE_LABELS[place],
        fontSize: 11,
        formatter: (p: { value: number; dataIndex: number }) =>
          p.value >= minLabelledShare ? `${evaluationAt(rows[p.dataIndex]!, place)} ${percent(p.value)}` : '',
      },
      data: rows.map((row, ri) => ({
        value: row.shares[evaluationAt(row, place)],
        // 4px rounded data-end, square at the baseline.
        itemStyle: place === lastFilled[ri] ? { borderRadius: [0, 4, 4, 0] } : {},
      })),
    })),
  };
}

/**
 * How the touches of each skill were evaluated: one 100% bar per skill,
 * segments from the most favourable evaluation of that skill (green) to the
 * least favourable (red), each labelled with its symbol.
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
      <ScaleLegend m={m} />
      <EChart option={option} height={evaluationChartHeight(rows)} label={title} />
      <DataTable
        head={[m.charts.skill, m.charts.tot, ...PLACES.map((i) => m.charts.scalePlace(i + 1))]}
        rows={rows.map((r) => [
          r.label,
          r.total,
          ...PLACES.map((i) => {
            const e = evaluationAt(r, i);
            return r.counts[e] ? `${e} ${r.counts[e]} (${percent(r.shares[e])})` : '.';
          }),
        ])}
      />
    </div>
  );
}

/** The colours from the most to the least favourable: the symbols are on the bars. */
function ScaleLegend({ m }: { m: Messages }) {
  return (
    <p className="vr-legend vr-scale-legend">
      <span>{m.charts.scaleBest}</span>
      <span className="vr-scale-keys" aria-hidden="true">
        {SCALE_COLORS.map((color) => (
          <span key={color} className="vr-legend-key bar" style={{ background: color }} />
        ))}
      </span>
      <span>{m.charts.scaleWorst}</span>
    </p>
  );
}
