/** ECharts with only the pieces the app uses (tree-shaken), rendered as SVG. */
import { BarChart, LineChart } from 'echarts/charts';
import { AriaComponent, GridComponent, LegendComponent, TooltipComponent } from 'echarts/components';
import * as echarts from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

echarts.use([BarChart, LineChart, GridComponent, LegendComponent, TooltipComponent, AriaComponent, SVGRenderer]);

export { echarts };
export type { EChartsCoreOption } from 'echarts/core';
