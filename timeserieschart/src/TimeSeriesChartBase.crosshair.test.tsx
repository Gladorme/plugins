// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
// http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

import { ChartsProvider, testChartsTheme } from '@perses-dev/components';
import type { TimeChartSeriesMapping } from '@perses-dev/components';
import type { TimeSeries } from '@perses-dev/spec';
import { render } from '@testing-library/react';
import { BarChart, LineChart, ScatterChart } from 'echarts/charts';
import {
  DatasetComponent,
  DataZoomComponent,
  GridComponent,
  MarkAreaComponent,
  MarkLineComponent,
  MarkPointComponent,
  TitleComponent,
  ToolboxComponent,
  TooltipComponent,
} from 'echarts/components';
import type * as EChartsCore from 'echarts/core';
import type { ECharts, EChartsCoreOption } from 'echarts/core';
import { init } from 'echarts/core';
import { SVGRenderer } from 'echarts/renderers';

import { TimeSeriesChartBase } from './TimeSeriesChartBase';

vi.mock('use-resize-observer', () => ({ default: vi.fn(() => ({ ref: vi.fn() })) }));

const SERIES_COUNT = 20;
const STEP_MS = 1000;
const DATA: TimeSeries[] = Array.from({ length: SERIES_COUNT }, (_series, seriesIdx) => ({
  name: `series-${seriesIdx}`,
  values: Array.from({ length: 50 }, (_point, pointIdx) => [pointIdx * STEP_MS, seriesIdx + pointIdx]),
}));
const TIME_SCALE = { startMs: 0, endMs: 49 * STEP_MS, stepMs: STEP_MS, rangeMs: 49 * STEP_MS };

function seriesMapping(type: 'line' | 'bar', stack?: string): TimeChartSeriesMapping {
  return DATA.map((series, datasetIndex) => ({ id: series.name, name: series.name, type, datasetIndex, stack }));
}

/** Renders TimeSeriesChartBase with the mocked ECharts module and returns the option it sets. */
function renderOption(mapping: TimeChartSeriesMapping, isStackedBar = false): EChartsCoreOption {
  const setOption = vi.fn();
  vi.mocked(init).mockReturnValue({
    setOption,
    resize: vi.fn(),
    getWidth: (): number => 500,
    getHeight: (): number => 300,
    dispose: vi.fn(),
    isDisposed: (): boolean => false,
    on: vi.fn(),
    off: vi.fn(),
    dispatchAction: vi.fn(),
  } as unknown as ECharts);
  render(
    <ChartsProvider chartsTheme={testChartsTheme}>
      <TimeSeriesChartBase
        height={300}
        data={DATA}
        seriesMapping={mapping}
        timeScale={TIME_SCALE}
        isStackedBar={isStackedBar}
      />
    </ChartsProvider>,
  );
  return setOption.mock.calls.at(-1)?.[0];
}

type TooltipShow = { tooltip?: { show?: boolean } };

describe('TimeSeriesChartBase crosshair', () => {
  it('only involves the first series in the ECharts axis tooltip search', () => {
    const option = renderOption(seriesMapping('line'));
    const series = option.series as TooltipShow[];
    expect(series[0]?.tooltip?.show).not.toBe(false);
    expect(series.slice(1, SERIES_COUNT).every((s) => s.tooltip?.show === false)).toBe(true);
  });

  it('keeps every series in the ECharts item tooltip of stacked bars', () => {
    const option = renderOption(seriesMapping('bar', 'all'), true);
    const series = option.series as TooltipShow[];
    expect(series.slice(0, SERIES_COUNT).some((s) => s.tooltip?.show === false)).toBe(false);
  });

  it('syncs the crosshair across charts without searching every series', async () => {
    const option = renderOption(seriesMapping('line'));
    const echarts = await vi.importActual<typeof EChartsCore>('echarts/core');
    echarts.use([
      LineChart,
      BarChart,
      ScatterChart,
      GridComponent,
      DatasetComponent,
      DataZoomComponent,
      MarkAreaComponent,
      MarkLineComponent,
      MarkPointComponent,
      TitleComponent,
      ToolboxComponent,
      TooltipComponent,
      SVGRenderer,
    ]);
    // jsdom has no canvas to measure axis labels.
    echarts.setPlatformAPI({ measureText: (text?: string) => ({ width: (text ?? '').length * 6 }) });
    function createConnectedChart(): ECharts {
      const chart = echarts.init(null, undefined, { renderer: 'svg', ssr: true, width: 500, height: 300 });
      chart.setOption(option, true);
      chart.group = 'crosshair-test';
      return chart;
    }
    const hovered = createConnectedChart();
    const synced = createConnectedChart();
    echarts.connect('crosshair-test');

    hovered.dispatchAction({ type: 'updateAxisPointer', x: 250, y: 150 });

    type AxisPointerState = { xAxis: Array<{ axisPointer?: { status?: string; value?: number } }> };
    const hoveredPointer = (hovered.getOption() as AxisPointerState).xAxis[0]?.axisPointer;
    const syncedPointer = (synced.getOption() as AxisPointerState).xAxis[0]?.axisPointer;
    expect(hoveredPointer?.status).toBe('show');
    expect(syncedPointer?.status).toBe('show');
    expect(syncedPointer?.value).toBe(hoveredPointer?.value);
    hovered.dispose();
    synced.dispose();
  });
});
