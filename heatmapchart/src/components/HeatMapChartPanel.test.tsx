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

import type { BucketTuple } from '@perses-dev/spec';
import { render } from '@testing-library/react';

import { HeatMapChart } from './HeatMapChart';
import type { HeatMapChartPanelProps } from './HeatMapChartPanel';
import { HeatMapChartPanel } from './HeatMapChartPanel';

vi.mock('./HeatMapChart', () => ({ HeatMapChart: vi.fn(() => null) }));

function panelProps(buckets: BucketTuple[]): HeatMapChartPanelProps {
  return {
    spec: {},
    contentDimensions: { width: 400, height: 250 },
    queryResults: [
      {
        definition: { kind: 'TimeSeriesQuery', spec: { plugin: { kind: 'ClickHouseTimeSeriesQuery', spec: {} } } },
        data: {
          timeRange: { start: new Date(0), end: new Date(1000) },
          stepMs: 1000,
          series: [{ name: 'duration', values: [[0, 2]], histograms: [[0, { count: 3, sum: '2', buckets }]] }],
        },
      },
    ],
  };
}

function renderBuckets(buckets: BucketTuple[]): void {
  render(<HeatMapChartPanel {...panelProps(buckets)} />);
}

it('provides finite axes while preserving tail bucket counts, bounds and sample positions', () => {
  renderBuckets([
    [0, '-Infinity', '1', '2'],
    [0, '1', 'Infinity', '1'],
  ]);
  const props = vi.mocked(HeatMapChart).mock.calls.at(-1)?.[0];
  expect(props?.min).toBeLessThan(1);
  expect(props?.max).toBeGreaterThan(1);
  expect(props?.data).toEqual([
    { value: [0, -Infinity, 1, 2], label: '2' },
    { value: [0, 1, Infinity, 1], label: '1' },
  ]);
});

it('gives a completely unbounded distribution a finite viewport', () => {
  renderBuckets([[0, '-Inf', '+Inf', '3']]);
  const props = vi.mocked(HeatMapChart).mock.calls.at(-1)?.[0];
  expect(Number.isFinite(props?.min)).toBe(true);
  expect(Number.isFinite(props?.max)).toBe(true);
});

it('preserves irregular sample timestamps and missing intervals instead of assigning all buckets to index -1', () => {
  const props = panelProps([[0, '0', '1', '2']]);
  const result = props.queryResults[0]!;
  result.data.timeRange = { start: new Date(100), end: new Date(5000) };
  result.data.series[0]!.histograms = [
    [0.234, { count: 2, sum: '1', buckets: [[0, '0', '1', '2']] }],
    [1.239, { count: 3, sum: '1', buckets: [[0, '0', '1', '3']] }],
    [4.236, { count: 4, sum: '1', buckets: [[0, '0', '1', '4']] }],
  ];
  render(<HeatMapChartPanel {...props} />);
  const chart = vi.mocked(HeatMapChart).mock.calls.at(-1)?.[0];
  expect(chart?.xAxisCategories).toEqual([234, 1239, 4236]);
  expect(chart?.data.map((bucket) => bucket.value)).toEqual([
    [234, 0, 1, 2],
    [1239, 0, 1, 3],
    [4236, 0, 1, 4],
  ]);
  expect(chart?.timeScale).toMatchObject({ startMs: 100, endMs: 5000, stepMs: 1000 });
});
