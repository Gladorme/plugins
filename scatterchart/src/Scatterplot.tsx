// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { formatValue, useChartsTheme, useTimeZone } from '@perses-dev/components';
import {
  replaceVariablesInString,
  useAllVariableValues,
  useRouterContext,
  useTimeRange,
} from '@perses-dev/plugin-system';
import { crosshair, defineChart, dot } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { ReactElement, useCallback, useMemo } from 'react';
import { ScatterTraceValue } from './ScatterChartPanel';
import { TanStackChart } from './TanStackChart';
import { createTimezoneAwareAxisFormatter } from './utils/timezone-formatter';

const DATE_FORMAT_OPTIONS: Intl.DateTimeFormatOptions = {
  year: 'numeric',
  month: 'long',
  day: 'numeric',
  hour: 'numeric',
  minute: 'numeric',
  second: 'numeric',
  fractionalSecondDigits: 3,
};

export interface ScatterplotProps {
  width: number;
  height: number;
  data: ScatterTraceValue[];
  link?: string;
}

export function Scatterplot({ width, height, data, link: linkTemplate }: ScatterplotProps): ReactElement {
  const chartsTheme = useChartsTheme();
  const { absoluteTimeRange } = useTimeRange();
  const { timeZone, dateFormatOptionsWithUserTimeZone } = useTimeZone();
  const variableValues = useAllVariableValues();
  const { navigate } = useRouterContext();
  const rangeMs = absoluteTimeRange.end.valueOf() - absoluteTimeRange.start.valueOf();
  const axisFormatter = useMemo(() => createTimezoneAwareAxisFormatter(rangeMs, timeZone), [rangeMs, timeZone]);
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, dateFormatOptionsWithUserTimeZone(DATE_FORMAT_OPTIONS)).format,
    [dateFormatOptionsWithUserTimeZone]
  );
  const palette = useMemo(() => (chartsTheme.echartsTheme.color ?? []) as string[], [chartsTheme.echartsTheme.color]);

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          dot(data, {
            x: 'startTimeMs',
            y: 'durationMs',
            r: 'pointRadius',
            color: 'color',
            key: 'traceId',
            stroke: chartsTheme.echartsTheme.backgroundColor as string | undefined,
            strokeWidth: 1,
          }),
          crosshair({ x: { label: false }, y: { label: false } }),
        ],
        x: {
          scale: scaleLinear().domain([absoluteTimeRange.start.valueOf(), absoluteTimeRange.end.valueOf()]),
          axis: { ticks: { format: axisFormatter }, tickLabels: { thin: true } },
        },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: {
            label: 'Duration',
            ticks: { count: 4, format: (value) => formatValue(value, { unit: 'milliseconds' }) },
          },
        },
        color: {
          domain: [...new Set(data.map((row) => row.color))],
          range: [...new Set(data.map((row) => row.color))],
        },
        margin: { top: 20, right: 20, bottom: 20, left: 16 },
        theme: { foreground: String(chartsTheme.echartsTheme.textStyle?.color ?? 'currentColor'), palette },
        focus: 'nearest-x',
        tooltip: {
          use: tooltip,
          format: (point) => {
            const row = point.datum;
            return [
              `Service name: ${row.rootServiceName}`,
              `Span name: ${row.rootTraceName}`,
              `Time: ${dateFormatter(row.startTime)}`,
              `Duration: ${formatValue(row.durationMs, { unit: 'milliseconds' })}`,
              `Span count: ${row.spanCount} (${row.errorCount} errors)`,
            ].join('\n');
          },
        },
      }),
    [absoluteTimeRange, axisFormatter, chartsTheme.echartsTheme, data, dateFormatter, palette]
  );

  const handleSelect = useCallback(
    (point: { datum: ScatterTraceValue } | null): void => {
      if (!point || !navigate || !linkTemplate) return;
      const link = replaceVariablesInString(linkTemplate, variableValues, point.datum.linkVariables);
      navigate(link);
    },
    [linkTemplate, navigate, variableValues]
  );

  return (
    <TanStackChart
      definition={definition}
      width={width}
      height={height}
      ariaLabel="Trace duration scatter chart"
      onSelect={handleSelect}
    />
  );
}
