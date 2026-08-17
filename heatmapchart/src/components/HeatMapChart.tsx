// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { useTheme } from '@mui/material';
import { FormatOptions, formatValue, useChartsTheme, useTimeZone } from '@perses-dev/components';
import { TimeScale } from '@perses-dev/spec';
import { colorGradientLegend, defineChart, rect } from '@tanstack/charts';
import { scaleLinear as compactScaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { scaleLinear, scaleLog } from 'd3-scale';
import { ReactElement, useMemo } from 'react';
import { LOG_BASE } from '../heat-map-chart-model';
import { getFormattedHeatmapAxisLabel } from '../utils';
import { TanStackChart } from './TanStackChart';

const DEFAULT_VISUAL_MAP_COLORS = [
  '#313695',
  '#4575b4',
  '#74add1',
  '#abd9e9',
  '#e0f3f8',
  '#ffffbf',
  '#fee090',
  '#fdae61',
  '#f46d43',
  '#d73027',
  '#a50026',
];

export type HeatMapData = [number, number, number, number | undefined];
export interface HeatMapDataItem {
  value: HeatMapData;
  label: string;
  itemStyle?: { color?: string; borderColor?: string; borderWidth?: number };
}
export interface HeatMapChartProps {
  width: number;
  height: number;
  data: HeatMapDataItem[];
  xAxisCategories: number[];
  yAxisFormat?: FormatOptions;
  countFormat?: FormatOptions;
  countMin?: number;
  countMax?: number;
  timeScale?: TimeScale;
  showVisualMap?: boolean;
  min?: number;
  max?: number;
  logBase?: LOG_BASE;
}

interface HeatMapRow {
  key: string;
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  count: number;
  label: string;
}

export function HeatMapChart({
  width,
  height,
  data,
  xAxisCategories,
  yAxisFormat,
  countFormat,
  countMin,
  countMax,
  timeScale,
  showVisualMap,
  min,
  max,
  logBase,
}: HeatMapChartProps): ReactElement | null {
  const chartsTheme = useChartsTheme();
  const theme = useTheme();
  const { timeZone } = useTimeZone();
  const rows = useMemo<HeatMapRow[]>(
    () =>
      data.flatMap(({ value: [x1, y1, y2, count], label }, index) =>
        typeof count === 'number' ? [{ key: `${index}-${x1}-${y1}`, x1, x2: x1 + 1, y1, y2, count, label }] : []
      ),
    [data]
  );
  const counts = rows.map((row) => row.count);
  const colorMin = countMin ?? Math.min(...counts, 0);
  const colorMax = countMax ?? Math.max(...counts, 1);
  const axisFormatter = useMemo(
    () => getFormattedHeatmapAxisLabel(timeScale?.rangeMs ?? 0, timeZone),
    [timeScale?.rangeMs, timeZone]
  );

  const definition = useMemo(() => {
    let yScale: typeof compactScaleLinear | ReturnType<typeof scaleLog<number, number>> = compactScaleLinear;
    if (logBase !== undefined) {
      const logScale = scaleLog<number, number>().base(logBase);
      if (min !== undefined && max !== undefined) logScale.domain([min, max]);
      yScale = logScale;
    }
    return defineChart({
      marks: [rect(rows, { x1: 'x1', x2: 'x2', y1: 'y1', y2: 'y2', color: 'count', key: 'key', inset: 0.5 })],
      x: {
        scale: compactScaleLinear().domain([0, Math.max(1, xAxisCategories.length)]),
        axis: {
          ticks: {
            values: xAxisCategories.map((_, index) => index),
            format: (index) => axisFormatter(xAxisCategories[Math.round(index)] ?? index),
          },
          tickLabels: { thin: true },
        },
      },
      y: {
        scale: yScale,
        axis: { ticks: { format: (value) => formatValue(value, yAxisFormat) }, tickLabels: { thin: true } },
      },
      color: {
        scale: scaleLinear<string>().domain([colorMin, colorMax]).range(DEFAULT_VISUAL_MAP_COLORS),
        legend: showVisualMap ? colorGradientLegend({ label: 'Count', steps: 9 }) : undefined,
      },
      margin: { top: 8, right: showVisualMap ? 56 : 8, bottom: 8, left: 8 },
      theme: { foreground: theme.palette.text.primary, background: theme.palette.background.default },
      tooltip: {
        use: tooltip,
        format: (point) =>
          `${point.datum.label}: ${formatValue(point.datum.y1, yAxisFormat)}–${formatValue(point.datum.y2, yAxisFormat)} · ${formatValue(point.datum.count, countFormat)}`,
      },
    });
  }, [
    axisFormatter,
    colorMax,
    colorMin,
    countFormat,
    logBase,
    max,
    min,
    rows,
    showVisualMap,
    theme.palette,
    xAxisCategories,
    yAxisFormat,
  ]);

  if (!rows.length) return null;
  const padding = chartsTheme.container.padding.default;
  return (
    <TanStackChart
      definition={definition}
      width={Math.max(1, width - padding * 2)}
      height={Math.max(1, height - padding * 2)}
      ariaLabel="Heat map"
    />
  );
}
