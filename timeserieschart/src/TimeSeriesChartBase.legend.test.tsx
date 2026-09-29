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

import type { ChartInstance } from '@perses-dev/components';
import { ChartsProvider, testChartsTheme } from '@perses-dev/components';
import type { TimeSeries } from '@perses-dev/spec';
import { render } from '@testing-library/react';
import type { ECharts } from 'echarts/core';
import { init } from 'echarts/core';
import { createRef } from 'react';

import { TimeSeriesChartBase } from './TimeSeriesChartBase';

vi.mock('use-resize-observer', () => ({ default: vi.fn(() => ({ ref: vi.fn() })) }));

const DATA: TimeSeries[] = [{ name: 'series', values: [[1000, 2]] }];
const SERIES_MAPPING = [{ id: 'series', type: 'line' as const, datasetIndex: 0 }];
const TIME_SCALE = { startMs: 0, endMs: 1000, stepMs: 1000, rangeMs: 1000 };

describe('TimeSeriesChartBase legend highlight', () => {
  it('does not replay legend highlights on the charts of the sync group', () => {
    const dispatchAction = vi.fn();
    vi.mocked(init).mockReturnValue({
      dispatchAction,
      setOption: vi.fn(),
      resize: vi.fn(),
      getWidth: (): number => 500,
      getHeight: (): number => 300,
      dispose: vi.fn(),
      isDisposed: (): boolean => false,
      on: vi.fn(),
      off: vi.fn(),
    } as unknown as ECharts);
    const ref = createRef<ChartInstance>();
    render(
      <ChartsProvider chartsTheme={testChartsTheme}>
        <TimeSeriesChartBase ref={ref} height={300} data={DATA} seriesMapping={SERIES_MAPPING} timeScale={TIME_SCALE} />
      </ChartsProvider>,
    );

    ref.current?.highlightSeries({ name: 'series' });

    expect(dispatchAction).toHaveBeenCalledWith({ type: 'highlight', seriesId: 'series', escapeConnect: true });
  });
});
