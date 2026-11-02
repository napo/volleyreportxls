// SPDX-FileCopyrightText: 2026 Maurizio Napolitano <maurizio.napolitano@gmail.com>
// SPDX-License-Identifier: AGPL-3.0-or-later

/** ECharts with only the pieces the app uses (tree-shaken), rendered as SVG. */
import { BarChart, LineChart, RadarChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, RadarComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, RadarChart, RadarComponent, GridComponent, LegendComponent, TooltipComponent, AriaComponent, SVGRenderer]);

export { echarts };
export type { EChartsCoreOption } from 'echarts/core';
