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

import type { FormatOptions, ThresholdOptions } from '@perses-dev/components';
import { EChart, getFormattedAxis, useChartsTheme } from '@perses-dev/components';
import type { BucketTuple } from '@perses-dev/spec';
import type { CustomSeriesRenderItemAPI, CustomSeriesRenderItemParams, CustomSeriesRenderItemReturn } from 'echarts';
import { CustomChart } from 'echarts/charts';
import type { EChartsCoreOption } from 'echarts/core';
import { use as registerECharts } from 'echarts/core';
import type { ReactElement } from 'react';
import { useMemo } from 'react';

import type { LOG_BASE } from '../histogram-chart-model';
import { getColorFromThresholds } from '../utils';

registerECharts([CustomChart]);

export interface HistogramChartData {
  buckets: BucketTuple[];
}

export interface HistogramChartProps {
  width: number;
  height: number;
  data: HistogramChartData;
  format?: FormatOptions;
  min?: number;
  max?: number;
  thresholds?: ThresholdOptions;
  logBase?: LOG_BASE;
}

export function HistogramChart({
  width,
  height,
  data,
  format,
  min,
  max,
  thresholds,
  logBase,
}: HistogramChartProps): ReactElement | null {
  const chartsTheme = useChartsTheme();

  const transformedData = useMemo(() => {
    return data.buckets
      .map(([bucket, lowerBound, upperBound, count]) => {
        let lower = parseFloat(lowerBound.replace(/Inf$/, 'Infinity'));
        const upper = parseFloat(upperBound.replace(/Inf$/, 'Infinity'));
        const countValue = parseFloat(count);

        // For logarithmic scales, we need to handle non-positive lower bounds
        // since log(0) and log(negative) are undefined
        if (logBase !== undefined && lower <= 0) {
          // Skip buckets that would be entirely non-positive on a log scale
          if (upper <= 0) {
            return null;
          }
          // For buckets that span from 0 (or negative) to positive,
          // use a small fraction of the upper bound as the lower bound
          // This ensures the bucket is still visible on the log scale
          lower = Number.isFinite(upper) ? upper * 0.001 : 0.001;
        }

        return {
          value: [lower, upper, countValue, bucket],
          itemStyle: {
            color: getColorFromThresholds(
              parseFloat(lowerBound), // Use original lower bound for threshold coloring
              thresholds,
              chartsTheme,
              chartsTheme.echartsTheme[0] as string,
            ),
          },
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);
  }, [chartsTheme, data.buckets, logBase, thresholds]);

  const minXAxis: number | undefined = useMemo(() => {
    if (logBase !== undefined) {
      // For logarithmic scales, let ECharts auto-calculate the range based on data
      // to avoid issues with non-positive values
      return undefined;
    }

    if (min !== undefined) {
      return min;
    }

    if (transformedData && transformedData[0]) {
      const first = transformedData[0].value[0] ?? 0;
      if (Number.isFinite(first)) return Math.min(0, Math.floor(first));
      const bounds = transformedData.flatMap(({ value }) => value.slice(0, 2)).filter(Number.isFinite);
      const lowest = bounds.reduce((a, b) => Math.min(a, b), Infinity);
      return Number.isFinite(lowest) ? Math.min(0, Math.floor(lowest - Math.max(Math.abs(lowest) * 0.1, 1))) : -1;
    }
    return undefined;
  }, [logBase, min, transformedData]);

  const maxXAxis: number | undefined = useMemo(() => {
    if (max !== undefined) {
      return max;
    }
    if (transformedData && transformedData[transformedData.length - 1]) {
      const last = transformedData[transformedData.length - 1]?.value[1] ?? 1;
      if (Number.isFinite(last)) return Math.ceil(last);
      const bounds = transformedData.flatMap(({ value }) => value.slice(0, 2)).filter(Number.isFinite);
      const highest = bounds.reduce((a, b) => Math.max(a, b), -Infinity);
      return Number.isFinite(highest) ? Math.ceil(highest + Math.max(Math.abs(highest) * 0.1, 1)) : 1;
    }
    return undefined;
  }, [max, transformedData]);

  const option: EChartsCoreOption = useMemo(() => {
    if (!transformedData) return chartsTheme.noDataOption;

    // Build xAxis configuration based on whether logarithmic scale is requested
    const xAxisConfig: Record<string, unknown> = {
      scale: false,
      min: minXAxis,
      max: maxXAxis,
    };

    // Apply logarithmic scale settings if requested
    if (logBase !== undefined) {
      xAxisConfig.type = 'log';
      xAxisConfig.logBase = logBase;
    }

    return {
      title: {
        show: false,
      },
      tooltip: {},
      xAxis: xAxisConfig,
      yAxis: getFormattedAxis({}, format),
      series: [
        {
          type: 'custom',
          renderItem: function (
            params: CustomSeriesRenderItemParams,
            api: CustomSeriesRenderItemAPI,
          ): CustomSeriesRenderItemReturn {
            const lowerBound = api.value(0) as number;
            const upperBound = api.value(1) as number;
            const yValue = api.value(2) as number;

            // Get the pixel coordinates for the start and end points of the bar
            // Keep true infinite boundaries in the data/tooltip, but clip their geometry to the plot.
            const plotLower = lowerBound === -Infinity ? (minXAxis ?? 0) : lowerBound;
            const plotUpper = upperBound === Infinity ? (maxXAxis ?? 1) : upperBound;
            const startCoord = api.coord([plotLower, yValue], true);
            const endCoord = api.coord([plotUpper, 0], true);

            // Extract coordinates with safety checks
            const startX = startCoord?.[0];
            const startY = startCoord?.[1];
            const endX = endCoord?.[0];
            const endY = endCoord?.[1];

            // Check if coordinates are valid before proceeding
            if (startX === undefined || startY === undefined || endX === undefined || endY === undefined) {
              return null;
            }

            // For logarithmic scales, api.size() doesn't work correctly because
            // the visual width isn't linear. Instead, we calculate the width
            // directly from the pixel coordinates.
            const barWidth = lowerBound === upperBound ? 1 : endX - startX;
            const barHeight = endY - startY;

            const style = api.style?.();

            // Skip rendering if coordinates are invalid (can happen with log scale edge cases)
            if (
              !Number.isFinite(startX) ||
              !Number.isFinite(startY) ||
              !Number.isFinite(barWidth) ||
              !Number.isFinite(barHeight)
            ) {
              return null;
            }

            return {
              type: 'rect',
              shape: {
                x: startX,
                y: startY,
                width: barWidth,
                height: barHeight,
              },
              style: style,
            };
          },
          label: {
            show: false,
          },
          dimensions: ['from', 'to'],
          encode: {
            x: [0, 1],
            y: 2,
            tooltip: [0, 1],
            itemName: 2,
          },
          data: transformedData,
        },
      ],
    };
  }, [chartsTheme.noDataOption, format, logBase, maxXAxis, minXAxis, transformedData]);

  return (
    <EChart
      style={{
        width: width,
        height: height,
      }}
      sx={{
        padding: `${chartsTheme.container.padding.default}px`,
      }}
      option={option}
      theme={chartsTheme.echartsTheme}
    />
  );
}
