// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { Stack, useTheme } from '@mui/material';
import { ProfileData, Timeline } from '@perses-dev/spec';
import { crosshair, defineChart, lineY } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { ReactElement, useMemo } from 'react';
import { formatItemValue } from '../utils/format';
import { TanStackChart } from './TanStackChart';

const LINE_WIDTH = 1.25;
interface SeriesRow {
  id: number;
  time: number;
  value: number;
}
export interface SeriesChartProps {
  width: number;
  height: number;
  data: ProfileData;
}

export function SeriesChart({ width, height, data }: SeriesChartProps): ReactElement {
  const theme = useTheme();
  const rows = useMemo<SeriesRow[]>(() => {
    const timeline: Timeline = data.timeline || ({} as Timeline);
    return timeline.samples.map((sample, index) => ({
      id: index,
      time: (timeline.startTime + index * timeline.durationDelta) * 1000,
      value: Number(sample),
    }));
  }, [data.timeline]);
  const extent = useMemo<[number, number]>(() => [rows[0]?.time ?? 0, rows.at(-1)?.time ?? 1], [rows]);
  const definition = useMemo(
    () =>
      defineChart({
        marks: [
          lineY(rows, {
            x: 'time',
            y: 'value',
            key: 'id',
            points: true,
            stroke: theme.palette.primary.main,
            strokeOpacity: 0.95,
            strokeWidth: LINE_WIDTH,
          }),
          crosshair({ x: { label: true }, y: false }),
        ],
        x: { scale: scaleLinear().domain(extent), axis: { tickLabels: { thin: true } } },
        y: {
          scale: scaleLinear,
          nice: true,
          grid: true,
          axis: { ticks: { format: (value) => formatItemValue(data.metadata?.units, value) } },
        },
        margin: 10,
        theme: { foreground: theme.palette.text.primary, background: theme.palette.background.default },
        focus: 'nearest-x',
        tooltip: {
          use: tooltip,
          format: (point) =>
            `${new Date(point.datum.time).toLocaleString()}\n${data.metadata?.name ?? ''}: ${formatItemValue(data.metadata?.units, point.datum.value)}`,
        },
      }),
    [data.metadata, extent, rows, theme.palette]
  );
  return (
    <Stack width={width} height={height} alignItems="center" justifyContent="center">
      <TanStackChart
        definition={definition}
        width={width}
        height={height}
        ariaLabel={`${data.metadata?.name ?? 'Profile'} time series`}
      />
    </Stack>
  );
}
