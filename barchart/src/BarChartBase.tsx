// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { Box } from '@mui/material';
import { FormatOptions, ModeOption, formatValue, useChartsTheme } from '@perses-dev/components';
import { barX, barY, colorLegend, defineChart, group, stack, text } from '@tanstack/charts';
import { scaleBand } from '@tanstack/charts/scales/band';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { ReactElement, useMemo } from 'react';
import { TanStackChart } from './TanStackChart';

const BAR_MIN_WIDTH = 14;
const BAR_GAP = 6;
const LEGEND_HEIGHT = 40;

export interface BarChartData {
  label: string;
  value: number | null;
}

export interface StackedBarChartSeries {
  name: string;
  values: Array<number | null>;
}

export interface StackedBarChartData {
  categories: string[];
  series: StackedBarChartSeries[];
}

export interface BarChartBaseProps {
  width: number;
  height: number;
  data: BarChartData[] | null;
  format?: FormatOptions;
  mode?: ModeOption;
  groupedData?: StackedBarChartData | null;
  isStacked?: boolean;
  orientation?: 'horizontal' | 'vertical';
}

interface BarRow {
  key: string;
  category: string;
  series: string;
  value: number;
}

export function BarChartBase({
  width,
  height,
  data,
  format = { unit: 'decimal' },
  mode = 'value',
  groupedData,
  isStacked = false,
  orientation = 'horizontal',
}: BarChartBaseProps): ReactElement {
  const chartsTheme = useChartsTheme();
  const isHorizontal = orientation === 'horizontal';
  const palette = useMemo(() => (chartsTheme.echartsTheme.color ?? []) as string[], [chartsTheme.echartsTheme.color]);

  const rows = useMemo<BarRow[]>(() => {
    if (groupedData) {
      return groupedData.series.flatMap((series) =>
        groupedData.categories.flatMap((category, index) => {
          const value = series.values[index];
          return typeof value === 'number'
            ? [{ key: `${category}-${series.name}`, category, series: series.name, value }]
            : [];
        })
      );
    }
    return (data ?? []).flatMap(({ label, value }) =>
      typeof value === 'number' ? [{ key: label, category: label, series: '', value }] : []
    );
  }, [data, groupedData]);

  const chartHeight = groupedData
    ? isHorizontal
      ? Math.max(height, groupedData.categories.length * (BAR_MIN_WIDTH + BAR_GAP) + LEGEND_HEIGHT)
      : height
    : Math.max(height, (data?.length ?? 0) * (BAR_MIN_WIDTH + BAR_GAP));

  const definition = useMemo(() => {
    const quantitativeAxis = {
      scale: scaleLinear,
      nice: true,
      grid: true,
      axis: { ticks: { format: (value: number) => formatValue(value, format) } },
    } as const;
    const categoricalAxis = {
      scale: () => scaleBand<string>().padding(0.18),
      axis: { tickLabels: { thin: true } },
    } as const;
    const layout = groupedData ? (isStacked ? stack() : group({ padding: 0.12 })) : undefined;
    const common = {
      key: 'key' as const,
      z: groupedData ? ('series' as const) : undefined,
      color: groupedData ? ('series' as const) : undefined,
      fill: groupedData ? undefined : palette[0],
      layout,
      radius: isStacked ? 0 : 4,
      maxThickness: groupedData ? undefined : BAR_MIN_WIDTH,
    };
    const marks = isHorizontal
      ? [
          barX(rows, { ...common, x: 'value', y: 'category' }),
          ...(groupedData
            ? []
            : [
                text(rows, {
                  x: 'value',
                  y: 'category',
                  text: (row) =>
                    mode === 'percentage'
                      ? formatValue(row.value, { unit: 'percent', decimalPlaces: format.decimalPlaces })
                      : formatValue(row.value, format),
                  anchor: 'start',
                  dx: 6,
                }),
              ]),
        ]
      : [
          barY(rows, { ...common, x: 'category', y: 'value' }),
          ...(groupedData
            ? []
            : [
                text(rows, {
                  x: 'category',
                  y: 'value',
                  text: (row) =>
                    mode === 'percentage'
                      ? formatValue(row.value, { unit: 'percent', decimalPlaces: format.decimalPlaces })
                      : formatValue(row.value, format),
                  dy: -6,
                }),
              ]),
        ];

    return defineChart({
      marks,
      x: isHorizontal ? quantitativeAxis : categoricalAxis,
      y: isHorizontal ? categoricalAxis : quantitativeAxis,
      color: groupedData
        ? {
            domain: groupedData.series.map((series) => series.name),
            range: palette,
            legend: colorLegend({ label: 'Series', placement: 'bottom' }),
          }
        : undefined,
      margin: { top: 8, right: 16, bottom: groupedData ? LEGEND_HEIGHT : 8, left: 8 },
      theme: {
        foreground: String(chartsTheme.echartsTheme.textStyle?.color ?? 'currentColor'),
        palette,
      },
      focus: groupedData ? (isHorizontal ? 'group-y' : 'group-x') : 'nearest',
      tooltip: {
        use: tooltip,
        format: (point) => `${point.datum.category}: ${formatValue(point.datum.value, format)}`,
        formatGroup: (points) =>
          [
            points[0]?.datum.category ?? '',
            ...points.map((point) => `${point.datum.series}: ${formatValue(point.datum.value, format)}`),
          ].join('\n'),
      },
    });
  }, [chartsTheme.echartsTheme.textStyle?.color, format, groupedData, isHorizontal, isStacked, mode, palette, rows]);

  return (
    <Box style={{ width, height }} sx={{ overflow: 'auto' }}>
      {rows.length > 0 ? (
        <TanStackChart definition={definition} width={width} height={chartHeight} ariaLabel="Bar chart" />
      ) : (
        <Box sx={{ alignItems: 'center', display: 'flex', height: '100%', justifyContent: 'center' }}>No data</Box>
      )}
    </Box>
  );
}
