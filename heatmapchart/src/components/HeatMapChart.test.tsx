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

import type { HeatMapDataItem } from './HeatMapChart';
import { HeatMapChart } from './HeatMapChart';

vi.mock('@perses-dev/components', async (original) => ({
  ...(await original<typeof Components>()),
  EChart: vi.fn(() => null),
  useTimeZone: vi.fn(() => ({ timeZone: 'UTC' })),
}));

const DATA: HeatMapDataItem[] = [
  { value: [0, -Infinity, 1, 2], label: '2' },
  { value: [0, 4, Infinity, 1], label: '1' },
];
const TIMES = [0, 1000];

it('renders tail and zero-width buckets with finite geometry while retaining tooltip bounds', () => {
  render(
    <ChartsProvider chartsTheme={testChartsTheme}>
      <HeatMapChart width={400} height={250} data={DATA} xAxisCategories={TIMES} min={0} max={5} />
    </ChartsProvider>,
  );
  const option = vi.mocked(EChart).mock.calls.at(-1)![0].option;
  const series = (option.series as CustomSeriesOption[])[0];
  expect(series?.data).toEqual(DATA);
  expect(option.xAxis).toMatchObject({ type: 'time', min: 0, max: 2000 });
  function renderBucket(bucket: number[]): unknown {
    const api: Partial<CustomSeriesRenderItemAPI> = {
      value: (dim) => bucket[Number(dim)] ?? 0,
      coord: (values) => {
        const [x = 0, y = 0] = values as number[];
        return [x / 100, Number.isFinite(y) ? 100 - y : NaN];
      },
      visual: vi.fn(),
    };
    return series?.renderItem?.({} as CustomSeriesRenderItemParams, api as CustomSeriesRenderItemAPI);
  }
  expect(renderBucket([0, -Infinity, 1, 2])).toMatchObject({ shape: { x: 0, y: 99, width: 10, height: 1 } });
  expect(renderBucket([0, 4, Infinity, 1])).toMatchObject({ shape: { x: 0, y: 95, width: 10, height: 1 } });
  expect(renderBucket([0, 0, 0, 3])).toMatchObject({ shape: { height: 1 } });
});
