import { useMemo } from 'react';
import { type Messages, useI18n } from '../../i18n';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { Legend } from './Legend';
import { BASE_OPTION, GRID, LOST, TEXT_PRIMARY, WON, escapeHtml } from './tokens';

export interface WonLostRow {
  readonly label: string;
  readonly won: number;
  readonly lost: number;
}

const ROW_HEIGHT = 38;

/** Chart height in pixels for the given rows. */
export const wonLostChartHeight = (rows: readonly WonLostRow[]) => 36 + rows.length * ROW_HEIGHT;

export function wonLostChartOption(rows: readonly WonLostRow[], m: Messages) {
  const t = m.charts;
  const max = Math.max(1, ...rows.flatMap((r) => [r.won, r.lost]));
  const endLabel = (position: 'right' | 'left') => ({
    show: true,
    position,
    color: TEXT_PRIMARY,
    fontWeight: 600,
    formatter: (p: { value: number }) => (p.value === 0 ? '' : String(Math.abs(p.value))),
  });
  return {
    ...BASE_OPTION,
    grid: { top: 4, left: 8, right: 24, bottom: 8, containLabel: true },
    xAxis: {
      type: 'value',
      min: -max * 1.15,
      max: max * 1.15,
      axisLabel: { formatter: (v: number) => (Number.isInteger(v) ? String(Math.abs(v)) : '') },
      splitLine: { lineStyle: { color: GRID } },
    },
    yAxis: {
      type: 'category',
      inverse: true,
      data: rows.map((r) => r.label),
      axisTick: { show: false },
      axisLine: { lineStyle: { color: '#c3cad0' } },
      axisLabel: { color: TEXT_PRIMARY, fontWeight: 500 },
    },
    legend: { show: false },
    tooltip: {
      ...BASE_OPTION.tooltip,
      trigger: 'axis',
      axisPointer: { type: 'shadow', shadowStyle: { color: 'rgba(6,40,69,0.05)' } },
      formatter: (params: { dataIndex: number }[]) => {
        const row = rows[params[0]!.dataIndex]!;
        const key = (color: string) => `<span style="display:inline-block;width:12px;height:2px;background:${color};vertical-align:middle;margin-right:6px"></span>`;
        return (
          `${escapeHtml(row.label)}<br>` +
          `${key(WON)}<strong>${row.won}</strong> ${t.wonShort}<br>` +
          `${key(LOST)}<strong>${row.lost}</strong> ${t.lostShort}<br>` +
          `<span style="color:#7d7d7d">${t.net} ${row.won - row.lost > 0 ? '+' : ''}${row.won - row.lost}</span>`
        );
      },
    },
    series: [
      {
        name: t.won,
        type: 'bar',
        stack: 'balance',
        barMaxWidth: 20,
        itemStyle: { color: WON, borderRadius: [0, 4, 4, 0] },
        label: endLabel('right'),
        data: rows.map((r) => r.won),
      },
      {
        name: t.lost,
        type: 'bar',
        stack: 'balance',
        barMaxWidth: 20,
        itemStyle: { color: LOST, borderRadius: [4, 0, 0, 4] },
        label: endLabel('left'),
        data: rows.map((r) => -r.lost),
      },
    ],
  };
}

/** Diverging bars: points won to the right (blue), points lost to the left (orange). */
export function WonLostChart({ rows, title, firstColumn }: { rows: readonly WonLostRow[]; title: string; firstColumn: string }) {
  const { m } = useI18n();
  const t = m.charts;
  const option = useMemo(() => wonLostChartOption(rows, m), [rows, m]);

  if (rows.length === 0) return <p className="vr-note">{t.noPoints}</p>;
  return (
    <>
      <Legend mark="bar" items={[{ label: t.won, color: WON }, { label: t.lost, color: LOST }]} />
      <EChart option={option} height={wonLostChartHeight(rows)} label={title} />
      <DataTable head={[firstColumn, t.wonCol, t.lostCol, t.netCol]} rows={rows.map((r) => [r.label, r.won, r.lost, r.won - r.lost])} />
    </>
  );
}
