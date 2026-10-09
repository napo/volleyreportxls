// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

import { useEffect, useRef } from 'react';
import { type EChartsCoreOption, echarts } from './echarts';

/** Renders an ECharts option and keeps it sized to its container. */
export function EChart({ option, height, label }: { option: EChartsCoreOption; height: number; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null);

  useEffect(() => {
    const element = ref.current!;
    chart.current = echarts.init(element, null, { renderer: 'svg' });
    const observer = new ResizeObserver(() => chart.current?.resize());
    observer.observe(element);
    return () => {
      observer.disconnect();
      chart.current?.dispose();
      chart.current = null;
    };
  }, []);

  useEffect(() => {
    chart.current?.setOption(option, { notMerge: true });
  }, [option]);

  return <div ref={ref} className="vr-chart" style={{ height }} role="img" aria-label={label} />;
}
