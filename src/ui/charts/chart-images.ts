// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/**
 * Charts drawn offscreen as PNG for the PDF: same options as on screen, with
 * the legend inside the image. The canvas renderer (loaded only here) uses
 * the app's embedded fonts, which an SVG turned into an image would not.
 */
import { CanvasRenderer } from 'echarts/renderers';
import type { ChartImage } from '../../pdf/charts-pdf';
import { type EChartsCoreOption, echarts } from './echarts';
import { FONT, TEXT_PRIMARY } from './tokens';

echarts.use([CanvasRenderer]);

/** Width of the drawing: on A4 (190 mm) a 12 px label prints at about 8 pt. */
export const PDF_CHART_WIDTH = 800;
const LEGEND_HEIGHT = 30;
const PIXEL_RATIO = 2.5;

function bytesOf(dataUrl: string): Uint8Array {
  const binary = atob(dataUrl.slice(dataUrl.indexOf(',') + 1));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}

/** The chart with its legend on top, without animation, as a PNG. */
export async function chartImage(option: EChartsCoreOption, height: number, legend = true): Promise<ChartImage> {
  await document.fonts.ready;
  const total = height + (legend ? LEGEND_HEIGHT : 0);
  const element = document.createElement('div');
  const chart = echarts.init(element, null, { renderer: 'canvas', width: PDF_CHART_WIDTH, height: total, devicePixelRatio: PIXEL_RATIO });
  try {
    const grid = (option as { grid?: { top?: number } }).grid ?? {};
    chart.setOption({
      ...option,
      animation: false,
      ...(legend && {
        grid: { ...grid, top: (grid.top ?? 0) + LEGEND_HEIGHT },
        legend: { show: true, top: 0, left: 0, itemWidth: 14, itemHeight: 10, textStyle: { fontFamily: FONT, color: TEXT_PRIMARY, fontSize: 12 } },
      }),
    });
    const png = bytesOf(chart.getDataURL({ type: 'png', pixelRatio: PIXEL_RATIO, backgroundColor: '#ffffff' }));
    return { png, width: PDF_CHART_WIDTH, height: total };
  } finally {
    chart.dispose();
  }
}
