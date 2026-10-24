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

import type * as Components from '@perses-dev/components';
import { ChartsProvider, EChart, testChartsTheme } from '@perses-dev/components';
import { render } from '@testing-library/react';
import type { CustomSeriesOption, CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams } from 'echarts';

import type { HistogramChartData } from './HistogramChart';
import { HistogramChart } from './HistogramChart';

vi.mock('@perses-dev/components', async (original) => ({
  ...(await original<typeof Components>()),
  EChart: vi.fn(() => null),
}));

const HISTOGRAM_DATA: HistogramChartData = {
  buckets: [
    [0, '-Infinity', '1', '2'],
    [0, '1', '4', '3'],
    [0, '4', 'Infinity', '1'],
  ],
};
const UNBOUNDED_DATA: HistogramChartData = { buckets: [[0, '-Inf', '+Inf', '1']] };

it('keeps infinite bucket boundaries while choosing finite plotting limits', () => {
  render(
    <ChartsProvider chartsTheme={testChartsTheme}>
      <HistogramChart width={400} height={250} data={HISTOGRAM_DATA} />
    </ChartsProvider>,
  );
  expect(vi.mocked(EChart).mock.calls.at(-1)?.[0].option).toMatchObject({
    xAxis: { min: 0, max: 5 },
    series: [{ data: [{ value: [-Infinity, 1, 2, 0] }, { value: [1, 4, 3, 0] }, { value: [4, Infinity, 1, 0] }] }],
  });
  const option = vi.mocked(EChart).mock.calls.at(-1)![0].option;
  const renderItem = (option.series as CustomSeriesOption[])[0]?.renderItem;
  function renderBucket(bucket: number[]): unknown {
    return renderItem?.(
      {} as CustomSeriesRenderItemParams,
      {
        value: (dim) => bucket[Number(dim)] ?? 0,
        coord: (values) => {
          const [x = 0, y = 0] = values as number[];
          // ECharts cannot turn infinite data values into pixel coordinates, even with clamping.
          return [Number.isFinite(x) ? x : NaN, 100 - y];
        },
      } as CustomSeriesRenderItemAPI,
    );
  }
  expect(renderBucket([-Infinity, 1, 2])).toMatchObject({ shape: { x: 0, width: 1, height: 2 } });
  expect(renderBucket([4, Infinity, 1])).toMatchObject({ shape: { x: 4, width: 1, height: 1 } });
});

it('honors an explicit zero maximum and supports a completely unbounded bucket', () => {
  render(
    <ChartsProvider chartsTheme={testChartsTheme}>
      <HistogramChart width={400} height={250} max={0} data={UNBOUNDED_DATA} />
    </ChartsProvider>,
  );
  expect(vi.mocked(EChart).mock.calls.at(-1)?.[0].option).toMatchObject({ xAxis: { min: -1, max: 0 } });
});
