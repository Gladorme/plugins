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

import { PanelProps } from '@perses-dev/plugin-system';
import { ReactElement, useMemo } from 'react';
import { NoDataOverlay, useChartsTheme } from '@perses-dev/components';
import { TraceData, TraceSearchResult } from '@perses-dev/spec';
import { Scatterplot } from './Scatterplot';
import { ScatterChartOptions } from './scatter-chart-model';

export interface ScatterTraceValue extends Omit<TraceSearchResult, 'startTimeUnixMs' | 'serviceStats'> {
  name: string;
  linkVariables: Record<string, string>;
  startTime: Date;
  startTimeMs: number;
  spanCount: number;
  errorCount: number;
  pointRadius: number;
  color: string;
}

export type ScatterChartPanelProps = PanelProps<ScatterChartOptions, TraceData>;

/** default size range of the circles diameter */
const DEFAULT_SIZE_RANGE: [number, number] = [6, 20];

/**
 * ScatterChartPanel transforms trace query results into tidy rows for the
 * TanStack scatter mark, including each point's size and color.
 *
 * @returns a `Scatterplot` component that visualizes the trace data.
 */
export function ScatterChartPanel(props: ScatterChartPanelProps): ReactElement | null {
  const { spec, contentDimensions, queryResults: traceResults } = props;
  const chartsTheme = useChartsTheme();
  const defaultColor = chartsTheme.thresholds.defaultColor || 'blue';
  const sizeRange = spec.sizeRange || DEFAULT_SIZE_RANGE;

  // Transform the Tempo API response into one tidy row per trace.
  const traces = useMemo(() => {
    const traces: Array<Omit<ScatterTraceValue, 'pointRadius' | 'color'>> = [];
    let minSpanCount: number | undefined;
    let maxSpanCount: number | undefined;
    for (const result of traceResults) {
      if (result.data.searchResult === undefined) continue;
      const dataSeries = result.data.searchResult.map((trace) => {
        let spanCount = 0;
        let errorCount = 0;
        for (const stats of Object.values(trace.serviceStats)) {
          spanCount += stats.spanCount;
          errorCount += stats.errorCount ?? 0;
        }

        if (minSpanCount === undefined || spanCount < minSpanCount) {
          minSpanCount = spanCount;
        }
        if (maxSpanCount === undefined || spanCount > maxSpanCount) {
          maxSpanCount = spanCount;
        }

        const pluginSpec = result.definition.spec.plugin.spec as { datasource?: { name?: string } } | undefined;
        const newTraceValue: Omit<ScatterTraceValue, 'pointRadius' | 'color'> = {
          ...trace,
          linkVariables: {
            datasourceName: pluginSpec?.datasource?.name ?? '',
            traceId: trace.traceId,
          },
          name: `${trace.rootServiceName}: ${trace.rootTraceName}`,
          startTime: new Date(trace.startTimeUnixMs), // convert unix epoch time to Date
          startTimeMs: trace.startTimeUnixMs,
          spanCount,
          errorCount,
        };
        return newTraceValue;
      });
      traces.push(...dataSeries);
    }
    const range: [number, number] = [minSpanCount ?? 0, maxSpanCount ?? 0];
    return traces.map((trace): ScatterTraceValue => ({
      ...trace,
      pointRadius: getSymbolSize(trace.spanCount, range, sizeRange) / 2,
      color: trace.errorCount > 0 ? 'red' : defaultColor,
    }));
  }, [defaultColor, sizeRange, traceResults]);

  const tracesFound = traceResults.some((traceData) => (traceData.data?.searchResult ?? []).length > 0);
  if (!tracesFound) {
    return <NoDataOverlay resource="traces" />;
  }

  if (contentDimensions === undefined) return null;

  return (
    <div data-testid="ScatterChartPanel_ScatterPlot">
      <Scatterplot width={contentDimensions.width} height={contentDimensions.height} data={traces} link={spec.link} />
    </div>
  );
}

// exported for tests
export function getSymbolSize(
  spanCount: number,
  spanCountRange: [number, number],
  sizeRange: [number, number]
): number {
  const [minSize, maxSize] = sizeRange;
  const [minSpanCount, maxSpanCount] = spanCountRange;

  // catch divison by zero
  if (maxSpanCount - minSpanCount === 0) {
    return maxSize;
  }

  // apply linear scale of spanCount from range [minSpanCount,maxSpanCount] to a value from range [minSize,maxSize]
  const rel = (spanCount - minSpanCount) / (maxSpanCount - minSpanCount);
  return minSize + (maxSize - minSize) * rel;
}
