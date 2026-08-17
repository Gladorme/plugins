// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { Box } from '@mui/material';
import {
  ChartInstance,
  ChartInstanceFocusOpts,
  DEFAULT_TOOLTIP_CONFIG,
  FormatOptions,
  TooltipConfig,
  ZoomEventData,
  formatValue,
  getCommonTimeScale,
  useChartsContext,
  useTimeZone,
} from '@perses-dev/components';
import { TimeScale, TimeSeries } from '@perses-dev/spec';
import { areaY, barY, crosshair, defineChart, group, lineY, ruleX, stack } from '@tanstack/charts';
import { controlledSignal } from '@tanstack/charts/interaction/signal';
import { ZoomXChange, ZoomXWindow, zoomX } from '@tanstack/charts/interaction/zoom';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { scaleLog } from 'd3-scale';
import { forwardRef, MouseEvent, useEffect, useImperativeHandle, useMemo, useState } from 'react';
import { TanStackChart } from './TanStackChart';
import { createTimezoneAwareAxisFormatter } from './utils/timezone-formatter';
import { TimeSeriesAnnotation } from './utils/annotation';
import { TanStackYAxisOptions, TimeSeriesStyle } from './utils/data-transform';

export interface TimeChartProps {
  height: number;
  data: TimeSeries[];
  seriesMapping: TimeSeriesStyle[];
  annotations?: TimeSeriesAnnotation[];
  timeScale?: TimeScale;
  yAxis?: TanStackYAxisOptions;
  format?: FormatOptions;
  seriesFormatMap?: Map<string, FormatOptions>;
  tooltipConfig?: TooltipConfig;
  noDataVariant?: 'chart' | 'message';
  syncGroup?: string;
  isStackedBar?: boolean;
  onDataZoom?: (event: ZoomEventData) => void;
  onDoubleClick?: (event: MouseEvent) => void;
}

interface SeriesRow {
  key: string;
  seriesId: string;
  seriesName: string;
  time: number;
  value: number | null;
  color: string;
  type: 'line' | 'bar';
}
interface AnnotationRule {
  time: number;
  color: string;
}

export const TimeSeriesChartBase = forwardRef<ChartInstance, TimeChartProps>(function TimeSeriesChartBase(
  {
    height,
    data,
    seriesMapping,
    annotations,
    timeScale: timeScaleProp,
    yAxis = { show: true },
    format,
    seriesFormatMap,
    isStackedBar = false,
    tooltipConfig = DEFAULT_TOOLTIP_CONFIG,
    noDataVariant = 'message',
    onDataZoom,
    onDoubleClick,
  },
  ref
) {
  const { chartsTheme, enablePinning } = useChartsContext();
  const { timeZone } = useTimeZone();
  const timeScale = useMemo<TimeScale>(() => {
    if (timeScaleProp) return timeScaleProp;
    const common = getCommonTimeScale(data);
    if (common) return common;
    const endMs = Date.now();
    const startMs = endMs - 5 * 365 * 24 * 60 * 60 * 1000;
    return { startMs, endMs, stepMs: 1, rangeMs: endMs - startMs };
  }, [data, timeScaleProp]);
  const [window, setWindow] = useState<ZoomXWindow<number>>({ start: timeScale.startMs, end: timeScale.endMs });
  useEffect(() => setWindow({ start: timeScale.startMs, end: timeScale.endMs }), [timeScale.endMs, timeScale.startMs]);

  useImperativeHandle(
    ref,
    () => ({
      highlightSeries(_options: ChartInstanceFocusOpts): void {},
      clearHighlightedSeries(): void {},
    }),
    []
  );

  const rows = useMemo<SeriesRow[]>(
    () =>
      data.flatMap((series, index) => {
        const style = seriesMapping[index];
        if (!style) return [];
        return series.values.map(([time, value], valueIndex) => ({
          key: `${style.id}-${time}-${valueIndex}`,
          seriesId: style.id,
          seriesName: style.name,
          time,
          value,
          color: style.color ?? '#1976d2',
          type: style.type,
        }));
      }),
    [data, seriesMapping]
  );
  const lineRows = rows.filter((row) => row.type === 'line' && (yAxis.type !== 'log' || (row.value ?? 0) > 0));
  const barRows = rows.filter((row) => row.type === 'bar' && (yAxis.type !== 'log' || (row.value ?? 0) > 0));
  const palette = seriesMapping.map((series) => series.color ?? '#1976d2');
  const seriesIds = seriesMapping.map((series) => series.id);
  const stackedLines = seriesMapping.some((series) => series.type === 'line' && series.stack === 'all');
  const areaOpacity = Math.max(0, ...seriesMapping.map((series) => series.areaStyle?.opacity ?? 0));
  const lineWidth = Math.max(1, ...seriesMapping.map((series) => series.lineStyle?.width ?? 1));
  const showPoints = seriesMapping.some((series) => series.showSymbol);
  const annotationRules = useMemo<AnnotationRule[]>(
    () =>
      (annotations ?? []).flatMap((annotation) => [
        { time: annotation.start, color: annotation.color ?? chartsTheme.thresholds.defaultColor },
        ...(annotation.end === undefined
          ? []
          : [{ time: annotation.end, color: annotation.color ?? chartsTheme.thresholds.defaultColor }]),
      ]),
    [annotations, chartsTheme.thresholds.defaultColor]
  );

  const values = rows.flatMap((row) => (typeof row.value === 'number' ? [row.value] : []));
  const dataMin = Math.min(...values, 0);
  const dataMax = Math.max(...values, 1);
  const resolvedMin =
    typeof yAxis.min === 'function' ? yAxis.min({ min: dataMin, max: dataMax }) : (yAxis.min ?? dataMin);
  const resolvedMax = yAxis.max ?? dataMax;
  const yScale = useMemo(
    () =>
      yAxis.type === 'log'
        ? scaleLog()
            .base(yAxis.logBase ?? 10)
            .domain([Math.max(Number.MIN_VALUE, resolvedMin), Math.max(resolvedMin * 2, resolvedMax)])
        : scaleLinear().domain(
            resolvedMin === resolvedMax ? [resolvedMin - 1, resolvedMax + 1] : [resolvedMin, resolvedMax]
          ),
    [resolvedMax, resolvedMin, yAxis.logBase, yAxis.type]
  );
  const timeFormatter = useMemo(
    () => createTimezoneAwareAxisFormatter(timeScale.rangeMs ?? 0, timeZone),
    [timeScale.rangeMs, timeZone]
  );

  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          areaY(lineRows, {
            x: 'time',
            y: 'value',
            z: 'seriesId',
            color: 'seriesId',
            key: 'key',
            fillOpacity: areaOpacity,
            layout: stackedLines ? stack() : undefined,
          }),
          lineY(lineRows, {
            x: 'time',
            y: 'value',
            z: 'seriesId',
            color: 'seriesId',
            key: 'key',
            points: showPoints,
            strokeWidth: lineWidth,
          }),
          barY(barRows, {
            x: 'time',
            y: 'value',
            z: 'seriesId',
            color: 'seriesId',
            key: 'key',
            layout: isStackedBar ? stack() : group({ padding: 0.12 }),
            maxThickness: 24,
          }),
          ruleX(annotationRules, { x: 'time', stroke: (rule) => rule.color, strokeWidth: 2, strokeDasharray: '5 4' }),
          crosshair({ x: { label: true }, y: false }),
        ],
        x: {
          scale: scaleLinear().domain([window.start, window.end]),
          axis: { ticks: { format: timeFormatter }, tickLabels: { thin: true } },
        },
        y: {
          scale: yScale,
          grid: yAxis.show,
          axis: yAxis.show
            ? { ticks: { format: (value): string => formatValue(value, format) }, tickLabels: { thin: true } }
            : false,
        },
        color: { domain: seriesIds, range: palette },
        margin: { top: 8, right: 8, bottom: 8, left: 8 },
        theme: {
          foreground: String(chartsTheme.echartsTheme.textStyle?.color ?? 'currentColor'),
          background: String(chartsTheme.echartsTheme.backgroundColor ?? 'transparent'),
          palette,
        },
        focus: 'group-x',
        maxFocusDistance: Number.POSITIVE_INFINITY,
        controls: [
          zoomX({
            window: controlledSignal<ZoomXWindow<number>, ZoomXChange<number>>(window, (next, { reason }): void => {
              setWindow(next);
              if (reason.type === 'commit') onDataZoom?.({ start: next.start, end: next.end });
            }),
            extent: [timeScale.startMs, timeScale.endMs],
            scaleExtent: [1, 64],
            ariaLabel: 'Zoom time range',
            format: timeFormatter,
          }),
        ],
        tooltip: tooltipConfig.hidden
          ? false
          : {
              use: tooltip,
              sticky: tooltipConfig.enablePinning && enablePinning,
              formatGroup: (points): string =>
                [
                  timeFormatter(Number(points[0]?.xValue ?? 0)),
                  ...points.map((point) => {
                    const pointFormat = seriesFormatMap?.get(point.datum.seriesId) ?? format;
                    const value = point.datum.value;
                    return `${point.datum.seriesName}: ${value === null ? 'No value' : formatValue(value, pointFormat)}`;
                  }),
                ].join('\n'),
            },
      }),
    [
      annotationRules,
      areaOpacity,
      barRows,
      chartsTheme.echartsTheme,
      enablePinning,
      format,
      isStackedBar,
      lineRows,
      lineWidth,
      onDataZoom,
      palette,
      seriesFormatMap,
      seriesIds,
      showPoints,
      stackedLines,
      timeFormatter,
      timeScale.endMs,
      timeScale.startMs,
      tooltipConfig.enablePinning,
      tooltipConfig.hidden,
      window,
      yAxis.show,
      yScale,
    ]
  );

  if (!rows.length && noDataVariant === 'message') {
    return <Box sx={{ alignItems: 'center', display: 'flex', height, justifyContent: 'center' }}>No data</Box>;
  }
  return (
    <Box
      style={{ height }}
      onDoubleClick={(event) => {
        setWindow({ start: timeScale.startMs, end: timeScale.endMs });
        if (onDoubleClick) onDoubleClick(event);
        else onDataZoom?.({ start: timeScale.startMs, end: timeScale.endMs });
      }}
    >
      <TanStackChart definition={definition} height={height} ariaLabel="Time series chart" />
    </Box>
  );
});
