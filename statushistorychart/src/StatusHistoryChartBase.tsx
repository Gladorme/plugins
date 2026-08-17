// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { Box, Typography, useTheme } from '@mui/material';
import { useChartsTheme, useTimeZone } from '@perses-dev/components';
import { TimeScale } from '@perses-dev/spec';
import { cell, defineChart } from '@tanstack/charts';
import { scaleBand } from '@tanstack/charts/scales/band';
import { tooltip } from '@tanstack/charts/tooltip';
import { FC, useMemo } from 'react';
import { TanStackChart } from './TanStackChart';
import { getFormattedStatusHistoryAxisLabel } from './utils/get-formatted-axis-label';

export type StatusHistoryData = [number, number, number | undefined];
export interface StatusHistoryDataItem {
  value: StatusHistoryData;
  label?: string;
  itemStyle?: { color?: string; borderColor?: string; borderWidth?: number };
}
export interface StatusHistoryChartBaseProps {
  height: number;
  data: StatusHistoryDataItem[];
  xAxisCategories: number[];
  yAxisCategories: string[];
  timeScale?: TimeScale;
  colors?: Array<{ value: number | string; color: string }>;
}
interface StatusRow {
  key: string;
  x: number;
  y: number;
  value: number;
  label: string;
  color: string;
}

export const StatusHistoryChartBase: FC<StatusHistoryChartBaseProps> = ({
  height,
  data,
  xAxisCategories,
  yAxisCategories,
  timeScale,
  colors,
}) => {
  const { timeZone } = useTimeZone();
  const chartsTheme = useChartsTheme();
  const theme = useTheme();
  const palette = useMemo(() => (chartsTheme.echartsTheme.color ?? []) as string[], [chartsTheme.echartsTheme.color]);
  const rows = useMemo<StatusRow[]>(
    () =>
      data.flatMap(({ value: [x, y, value], label, itemStyle }, index) => {
        if (value === undefined) return [];
        const configured = colors?.find((entry) => String(entry.value) === String(value))?.color;
        return [
          {
            key: `${index}-${x}-${y}`,
            x,
            y,
            value,
            label: label ?? '',
            color: itemStyle?.color ?? configured ?? palette[0] ?? '#1976d2',
          },
        ];
      }),
    [colors, data, palette]
  );
  const timeFormatter = useMemo(
    () => getFormattedStatusHistoryAxisLabel(timeScale?.rangeMs ?? 0, timeZone),
    [timeScale?.rangeMs, timeZone]
  );
  const definition = useMemo(() => {
    const resolvedColors = [...new Set(rows.map((row) => row.color))];
    return defineChart({
      marks: [cell(rows, { x: 'x', y: 'y', color: 'color', key: 'key', inset: 0.5 })],
      x: {
        scale: () =>
          scaleBand<number>()
            .domain(xAxisCategories.map((_, index) => index))
            .padding(0),
        axis: {
          ticks: { format: (index) => timeFormatter(xAxisCategories[index] ?? index) },
          tickLabels: { thin: true },
        },
      },
      y: {
        scale: () =>
          scaleBand<number>()
            .domain(yAxisCategories.map((_, index) => index))
            .padding(0),
        axis: { ticks: { format: (index) => yAxisCategories[index] ?? String(index) }, tickLabels: { thin: true } },
      },
      color: { domain: resolvedColors, range: resolvedColors },
      margin: { top: 8, right: 8, bottom: 8, left: 8 },
      theme: { foreground: theme.palette.text.primary, background: theme.palette.background.default, palette },
      tooltip: {
        use: tooltip,
        format: (point) => `${point.datum.label || yAxisCategories[point.datum.y] || 'Status'}: ${point.datum.value}`,
      },
    });
  }, [palette, rows, theme.palette, timeFormatter, xAxisCategories, yAxisCategories]);

  return (
    <Box sx={{ alignItems: 'center', display: 'flex', height, justifyContent: 'center', overflow: 'auto' }}>
      {rows.length ? (
        <TanStackChart definition={definition} height={height} ariaLabel="Status history chart" />
      ) : (
        <Typography color="text.secondary">No data</Typography>
      )}
    </Box>
  );
};
