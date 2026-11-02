// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * The profile of an athlete against references (last match, own total, team).
 * With three meaningful indicators or more: a radar on fixed scales. With
 * fewer (a libero has only reception): one small bar chart per indicator,
 * side by side, since a radar of one or two axes says nothing.
 */
import { useMemo } from 'react';
import { PROFILE_AXES, type Profile, type ProfileAxis, onScale } from '../../athletes/profile';
import { type Messages, useI18n } from '../../i18n';
import { DataTable } from './DataTable';
import { EChart } from './EChart';
import { Legend } from './Legend';
import { BASE_OPTION, GRID, SERIES, SURFACE, TEXT_PRIMARY, TEXT_SECONDARY, escapeHtml, percent } from './tokens';

export interface ProfileSeries {
  readonly kind: keyof typeof STYLES;
  readonly name: string;
  readonly values: Profile;
}

/** The athlete in blue, the last match in orange, the team in grey and dashed. */
const STYLES = {
  athlete: { color: SERIES[0], dash: 'solid', area: 0.18 },
  last: { color: SERIES[1], dash: 'solid', area: 0 },
  team: { color: TEXT_SECONDARY, dash: 'dashed', area: 0 },
} as const;

export function formatProfileValue(axis: ProfileAxis, value: number | null): string {
  if (value === null) return '.';
  if (axis === 'reception') return percent(value);
  return `${value > 0 ? '+' : ''}${percent(value)}`;
}

const axisName = (axis: ProfileAxis, m: Messages) => m.profile.axes[axis];

/** The fixed scale of an axis, from the centre of the radar to its edge. */
function scaleOf(axis: ProfileAxis): string {
  const { min, max } = PROFILE_AXES.find((a) => a.id === axis)!;
  return `${formatProfileValue(axis, min)} → ${formatProfileValue(axis, max)}`;
}

export const PROFILE_RADAR_HEIGHT = 300;
const BAR_HEIGHT = 170;

export function profileRadarOption(series: readonly ProfileSeries[], axes: readonly ProfileAxis[], m: Messages) {
  return {
    ...BASE_OPTION,
    tooltip: {
      ...BASE_OPTION.tooltip,
      trigger: 'item',
      formatter: (p: { dataIndex: number }) => {
        const s = series[p.dataIndex]!;
        const lines = axes.map((a) => `${escapeHtml(axisName(a, m))}: <b>${formatProfileValue(a, s.values[a])}</b>`);
        return `<b>${escapeHtml(s.name)}</b><br>${lines.join('<br>')}`;
      },
    },
    // Hidden on screen (the HTML legend is above), in this order in the images for the PDF.
    legend: { show: false, data: series.map((s) => s.name) },
    radar: {
      indicator: axes.map((a) => ({ name: axisName(a, m), min: 0, max: 1 })),
      radius: '52%',
      splitNumber: 4,
      // "Ricezione Pos%" on two lines: on a phone it would not fit beside the radar.
      axisName: { color: TEXT_PRIMARY, fontWeight: 500, formatter: (name: string) => name.replace(' ', '\n') },
      splitLine: { lineStyle: { color: GRID } },
      splitArea: { show: false },
      axisLine: { lineStyle: { color: GRID } },
    },
    series: [
      {
        type: 'radar',
        symbol: 'circle',
        symbolSize: 6,
        // Reversed: the first series (the athlete) is drawn last, on top.
        data: series
          .map((s) => ({
            name: s.name,
            value: axes.map((a) => (s.values[a] === null ? '-' : onScale(a, s.values[a]!))),
            lineStyle: { color: STYLES[s.kind].color, width: 2, type: STYLES[s.kind].dash },
            itemStyle: { color: STYLES[s.kind].color, borderColor: SURFACE, borderWidth: 1 },
            areaStyle: STYLES[s.kind].area ? { color: STYLES[s.kind].color, opacity: STYLES[s.kind].area } : undefined,
          }))
          .reverse(),
      },
    ],
  };
}

export function profileBarOption(series: readonly ProfileSeries[], axis: ProfileAxis, m: Messages) {
  const { min, max } = PROFILE_AXES.find((a) => a.id === axis)!;
  return {
    ...BASE_OPTION,
    grid: { top: 20, left: 8, right: 8, bottom: 8, containLabel: true },
    xAxis: { type: 'category', data: series.map((s) => s.name), axisTick: { show: false }, axisLabel: { show: false }, axisLine: { lineStyle: { color: GRID } } },
    yAxis: {
      type: 'value',
      // Bars start from zero.
      min: Math.min(0, min),
      max,
      axisLabel: { formatter: (v: number) => formatProfileValue(axis, v) },
      splitLine: { lineStyle: { color: GRID } },
    },
    tooltip: { ...BASE_OPTION.tooltip, trigger: 'item', formatter: (p: { name: string; value: number }) => `${escapeHtml(p.name)}: <b>${formatProfileValue(axis, p.value)}</b>` },
    series: [
      {
        type: 'bar',
        barWidth: '55%',
        data: series.map((s) => ({ value: s.values[axis], itemStyle: { color: STYLES[s.kind].color, borderRadius: [3, 3, 0, 0] } })),
        label: { show: true, position: 'top', color: TEXT_PRIMARY, formatter: (p: { value: number | null }) => formatProfileValue(axis, p.value) },
      },
    ],
  };
}

interface Props {
  readonly series: readonly ProfileSeries[];
  /** The indicators that say something for the athlete. */
  readonly axes: readonly ProfileAxis[];
  readonly label: string;
}

export function ProfileChart({ series, axes, label }: Props) {
  const { m } = useI18n();
  const radar = axes.length >= 3;
  const options = useMemo(
    () => (radar ? [profileRadarOption(series, axes, m)] : axes.map((a) => profileBarOption(series, a, m))),
    [radar, series, axes, m],
  );

  if (axes.length === 0) return <p className="vr-note">{m.profile.none}</p>;
  return (
    <>
      <Legend mark={radar ? 'line' : 'bar'} items={series.map((s) => ({ label: s.name, color: STYLES[s.kind].color }))} />
      {radar ? (
        <EChart option={options[0]!} height={PROFILE_RADAR_HEIGHT} label={label} />
      ) : (
        <div className="vr-profile-bars">
          {options.map((option, i) => (
            <figure key={axes[i]}>
              <figcaption>{axisName(axes[i]!, m)}</figcaption>
              <EChart option={option} height={BAR_HEIGHT} label={`${label}: ${axisName(axes[i]!, m)}`} />
            </figure>
          ))}
        </div>
      )}
      <DataTable
        head={[m.profile.indicator, m.profile.scale, ...series.map((s) => s.name)]}
        rows={axes.map((a) => [axisName(a, m), scaleOf(a), ...series.map((s) => formatProfileValue(a, s.values[a]))])}
      />
    </>
  );
}
