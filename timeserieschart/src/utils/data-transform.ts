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

import { LegacyTimeSeries, StepOptions, getCommonTimeScale } from '@perses-dev/components';
import { useTimeSeriesQueries, PanelData } from '@perses-dev/plugin-system';
import { TimeScale, TimeSeries, TimeSeriesData, TimeSeriesValueTuple } from '@perses-dev/spec';
import {
  DEFAULT_AREA_OPACITY,
  DEFAULT_CONNECT_NULLS,
  DEFAULT_LINE_WIDTH,
  DEFAULT_POINT_RADIUS,
  DEFAULT_Y_AXIS,
  POSITIVE_MIN_VALUE_MULTIPLIER,
  NEGATIVE_MIN_VALUE_MULTIPLIER,
  TimeSeriesChartVisualOptions,
  TimeSeriesChartYAxisOptions,
  LineStyleType,
} from '../time-series-chart-model';

export type RunningQueriesState = ReturnType<typeof useTimeSeriesQueries>;

export const EMPTY_GRAPH_DATA = {
  timeSeries: [],
  xAxis: [],
  legendItems: [],
};

export interface TimeSeriesStyle {
  type: 'line' | 'bar';
  id: string;
  datasetIndex: number;
  datasetId?: string;
  name: string;
  connectNulls?: boolean;
  color?: string;
  stack?: 'all';
  yAxisIndex?: number;
  showSymbol?: boolean;
  symbolSize?: number;
  lineStyle?: { width?: number; type?: LineStyleType | 'dashed'; opacity?: number };
  areaStyle?: { opacity?: number };
}

export interface TanStackYAxisOptions {
  show: boolean;
  min?: number | ((value: { min: number; max: number }) => number);
  max?: number;
  type?: 'log';
  logBase?: number;
}

export const HIDE_DATAPOINTS_LIMIT = 70;

export const BLUR_FADEOUT_OPACITY = 0.5;

/**
 * Given a list of running queries, calculates a common time scale for use on
 * the x axis (i.e. start/end dates and a step that is divisible into all of
 * the queries' steps).
 */
export function getCommonTimeScaleForQueries(queries: Array<PanelData<TimeSeriesData>>): TimeScale | undefined {
  const seriesData = queries.map((query) => query.data);
  return getCommonTimeScale(seriesData);
}

/**
 * Gets mark style metadata for regular time-series trends.
 */
export function getTimeSeries(
  id: string,
  datasetIndex: number,
  formattedName: string,
  visual: TimeSeriesChartVisualOptions,
  timeScale: TimeScale,
  paletteColor: string,
  querySettings?: { lineStyle?: LineStyleType; areaOpacity?: number; stack?: boolean },
  yAxisIndex?: number
): TimeSeriesStyle {
  const lineWidth = visual.lineWidth ?? DEFAULT_LINE_WIDTH;
  const pointRadius = visual.pointRadius ?? DEFAULT_POINT_RADIUS;
  const shouldStack = querySettings?.stack !== undefined ? querySettings.stack : visual.stack === 'all';

  // Shows datapoint symbols when selected time range is roughly 15 minutes or less
  const minuteMs = 60000;
  let showPoints = timeScale.rangeMs <= minuteMs * 15;
  // Allows overriding default behavior and opt-in to always show all symbols (can hurt performance)
  if (visual.showPoints === 'always') {
    showPoints = true;
  }

  if (visual.display === 'bar') {
    const series: TimeSeriesStyle = {
      type: 'bar',
      id: id,
      datasetIndex,
      name: formattedName,
      color: paletteColor,
      stack: shouldStack ? 'all' : undefined,
      yAxisIndex: yAxisIndex,
    };
    return series;
  }

  const series: TimeSeriesStyle = {
    type: 'line',
    id: id,
    datasetIndex,
    name: formattedName,
    connectNulls: visual.connectNulls ?? DEFAULT_CONNECT_NULLS,
    color: paletteColor,
    stack: shouldStack ? 'all' : undefined,
    yAxisIndex: yAxisIndex,
    showSymbol: showPoints,
    symbolSize: pointRadius,
    lineStyle: {
      width: lineWidth,
      type: (querySettings?.lineStyle ?? visual.lineStyle) as LineStyleType,
    },
    areaStyle: {
      opacity: querySettings?.areaOpacity ?? visual.areaOpacity ?? DEFAULT_AREA_OPACITY,
    },
  };
  return series;
}

/**
 * Gets threshold-specific line series styles
 * markLine cannot be used since it does not update yAxis max / min
 * and threshold data needs to show in the tooltip
 */
export function getThresholdSeries(name: string, threshold: StepOptions, seriesIndex: number): TimeSeriesStyle {
  return {
    type: 'line',
    name: name,
    id: name,
    datasetId: name,
    datasetIndex: seriesIndex,
    color: threshold.color,
    lineStyle: {
      type: 'dashed',
      width: 2,
    },
  };
}

/**
 * Converts percent threshold into absolute step value
 * If max is undefined, use the max value from time series data as default
 */
export function convertPercentThreshold(
  percent: number,
  data: LegacyTimeSeries[] | TimeSeries[],
  max?: number,
  min?: number
): number {
  const percentDecimal = percent / 100;
  const adjustedMax = max ?? findMax(data);
  const adjustedMin = min ?? 0;
  const total = adjustedMax - adjustedMin;
  return percentDecimal * total + adjustedMin;
}

function findMax(data: LegacyTimeSeries[] | TimeSeries[]): number {
  let max = 0;
  if (data.length && data[0] !== undefined && (data as TimeSeries[])[0]?.values) {
    (data as TimeSeries[]).forEach((series) => {
      series.values.forEach((valueTuple: TimeSeriesValueTuple) => {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const [_, value] = valueTuple;
        // Use the absolute value so percent thresholds compute correctly against
        // negated series (e.g. when `querySettings[].negativeY` is enabled).
        if (typeof value === 'number' && Math.abs(value) > max) {
          max = Math.abs(value);
        }
      });
    });
  } else {
    (data as LegacyTimeSeries[]).forEach((series) => {
      if (series.data !== undefined) {
        series.data.forEach((value: unknown) => {
          if (typeof value === 'number' && Math.abs(value) > max) {
            max = Math.abs(value);
          }
        });
      }
    });
  }
  return max;
}

/**
 * Converts a Perses panel y-axis specification to TanStack scale options.
 * Handles both linear and logarithmic scales with appropriate min/max calculations.
 */
export function convertPanelYAxis(inputAxis: TimeSeriesChartYAxisOptions = {}): TanStackYAxisOptions {
  // Determine the appropriate min value based on scale type and user input
  let minValue: TanStackYAxisOptions['min'];
  if (inputAxis.logBase !== undefined) {
    // For logarithmic scales without explicit min:
    // Let the logarithmic scale infer its range from data to avoid issues with
    // function-based calculations which can result in improper ranges (e.g., 1-10)
    minValue = undefined;
  } else if (inputAxis?.min !== undefined) {
    // User explicitly set a min value - use it for both linear and log scales
    minValue = inputAxis.min;
  } else {
    // For linear scales without explicit min:
    // Use dynamic calculation with padding for better visualization
    minValue = (value): number => {
      if (value.min >= 0 && value.min <= 1) {
        // Helps with PercentDecimal units, or datasets that return 0 or 1 booleans
        return 0;
      }

      // Note: We can tweak the MULTIPLIER constants if we want
      // TODO: Experiment with using a padding that is based on the difference between max value and min value
      if (value.min > 0) {
        return roundDown(value.min * POSITIVE_MIN_VALUE_MULTIPLIER);
      } else {
        return roundDown(value.min * NEGATIVE_MIN_VALUE_MULTIPLIER);
      }
    };
  }

  // Build the yAxis configuration
  const yAxis: TanStackYAxisOptions = {
    show: inputAxis?.show ?? DEFAULT_Y_AXIS.show ?? true,
    min: minValue,
    max: inputAxis?.max,
  };

  // Apply logarithmic scale settings if requested
  if (inputAxis.logBase !== undefined) {
    return {
      ...yAxis,
      type: 'log',
      logBase: inputAxis.logBase,
    };
  }

  return yAxis;
}

/**
 * Rounds down to nearest number with one significant digit.
 *
 * Examples:
 * 1. 675 --> 600
 * 2. 0.567 --> 0.5
 * 3. -12 --> -20
 */
export function roundDown(num: number): number {
  if (num === 0) return 0;
  const magnitude = Math.floor(Math.log10(Math.abs(num)));
  const firstDigit = Math.floor(num / Math.pow(10, magnitude));
  return Number(`${firstDigit}e${magnitude}`);
}
