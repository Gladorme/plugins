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

import type * as ComponentsModule from '@perses-dev/components';
import { ChartsProvider, testChartsTheme } from '@perses-dev/components';
import type * as DashboardsModule from '@perses-dev/dashboards';
import type { AnnotationSpecWithData } from '@perses-dev/dashboards';
import { TimeRangeContext } from '@perses-dev/plugin-system';
import type { TimeRangeValue } from '@perses-dev/spec';
import { toAbsoluteTimeRange } from '@perses-dev/spec';
import { render } from '@testing-library/react';
import type { ReactElement } from 'react';

import { MOCK_TIME_SERIES_DATA_MULTIVALUE } from './test/mock-query-results';
import type { TimeSeriesChartProps } from './TimeSeriesChartPanel';
import { TimeSeriesChartPanel } from './TimeSeriesChartPanel';

type ContentWithLegendProps = Parameters<typeof ComponentsModule.ContentWithLegend>[0];

const { legendPropsHistory } = vi.hoisted(() => ({
  legendPropsHistory: [] as Array<ContentWithLegendProps['legendProps']>,
}));

// Only the props handed to the legend matter here, so the legend and chart are not rendered.
vi.mock('@perses-dev/components', async (importOriginal) => ({
  ...(await importOriginal<typeof ComponentsModule>()),
  ContentWithLegend: (props: ContentWithLegendProps): null => {
    legendPropsHistory.push(props.legendProps);
    return null;
  },
}));

vi.mock('@perses-dev/dashboards', async (importOriginal) => ({
  ...(await importOriginal<typeof DashboardsModule>()),
  usePanelAnnotationsWithData: (): AnnotationSpecWithData[] => [],
}));

const TIME_RANGE: TimeRangeValue = { pastDuration: '1h' };
const TIME_RANGE_CONTEXT = {
  refreshIntervalInMs: 0,
  setRefreshInterval: (): Record<string, unknown> => ({}),
  timeRange: TIME_RANGE,
  setTimeRange: (): Record<string, unknown> => ({}),
  absoluteTimeRange: toAbsoluteTimeRange(TIME_RANGE),
  refresh: vi.fn(),
};
const PANEL_SPEC: TimeSeriesChartProps['spec'] = { legend: { position: 'bottom', mode: 'table', values: ['mean'] } };
const QUERY_RESULTS: TimeSeriesChartProps['queryResults'] = [
  {
    definition: { kind: 'TimeSeriesQuery', spec: { plugin: { kind: 'PrometheusTimeSeriesQuery', spec: {} } } },
    data: MOCK_TIME_SERIES_DATA_MULTIVALUE,
  },
];

const SMALL_PANEL = { width: 500, height: 400 };
const WIDE_PANEL = { width: 600, height: 400 };

function panel(contentDimensions: TimeSeriesChartProps['contentDimensions']): ReactElement {
  return (
    <ChartsProvider chartsTheme={testChartsTheme}>
      <TimeRangeContext.Provider value={TIME_RANGE_CONTEXT}>
        <TimeSeriesChartPanel spec={PANEL_SPEC} contentDimensions={contentDimensions} queryResults={QUERY_RESULTS} />
      </TimeRangeContext.Provider>
    </ChartsProvider>
  );
}

describe('TimeSeriesChartPanel legend props', () => {
  it('keeps legend handlers and table props stable across panel renders', () => {
    const { rerender } = render(panel(SMALL_PANEL));
    const initial = legendPropsHistory.at(-1);
    expect(initial).toBeDefined();

    rerender(panel(WIDE_PANEL));
    const next = legendPropsHistory.at(-1);

    expect(next).not.toBe(initial);
    expect(next?.onItemMouseOver).toBe(initial?.onItemMouseOver);
    expect(next?.onItemMouseOut).toBe(initial?.onItemMouseOut);
    expect(next?.tableProps).toBe(initial?.tableProps);
  });
});
