// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { FormatOptions, ThresholdOptions, formatValue, useChartsTheme } from '@perses-dev/components';
import { BucketTuple } from '@perses-dev/spec';
import { defineChart, rect } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { tooltip } from '@tanstack/charts/tooltip';
import { scaleLog } from 'd3-scale';
import { ReactElement, useMemo } from 'react';
import { getColorFromThresholds } from '../utils';
import { LOG_BASE } from '../histogram-chart-model';
import { TanStackChart } from './TanStackChart';

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
interface HistogramRow {
  key: string;
  lower: number;
  upper: number;
  count: number;
  bucket: number;
  color: string;
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
  const palette = useMemo(() => (chartsTheme.echartsTheme.color ?? []) as string[], [chartsTheme.echartsTheme.color]);
  const rows = useMemo<HistogramRow[]>(
    () =>
      data.buckets.flatMap(([bucket, lowerBound, upperBound, count], index) => {
        let lower = Number.parseFloat(lowerBound);
        const upper = Number.parseFloat(upperBound);
        const countValue = Number.parseFloat(count);
        if (![lower, upper, countValue].every(Number.isFinite)) return [];
        if (logBase !== undefined && lower <= 0) {
          if (upper <= 0) return [];
          lower = upper * 0.001;
        }
        return [
          {
            key: `${index}-${bucket}`,
            lower,
            upper,
            count: countValue,
            bucket,
            color:
              getColorFromThresholds(Number.parseFloat(lowerBound), thresholds, chartsTheme, palette[0] ?? '#1976d2') ??
              palette[0] ??
              '#1976d2',
          },
        ];
      }),
    [chartsTheme, data.buckets, logBase, palette, thresholds]
  );

  const computedMin = min ?? (logBase === undefined ? Math.min(0, rows[0]?.lower ?? 0) : undefined);
  const computedMax = max ?? rows.at(-1)?.upper;
  const definition = useMemo(() => {
    let xScale: typeof scaleLinear | ReturnType<typeof scaleLinear> | ReturnType<typeof scaleLog<number, number>> =
      scaleLinear;
    if (logBase === undefined) {
      if (computedMin !== undefined && computedMax !== undefined) {
        xScale = scaleLinear().domain([computedMin, computedMax]);
      }
    } else {
      const logScale = scaleLog<number, number>().base(logBase);
      if (computedMin !== undefined && computedMax !== undefined) logScale.domain([computedMin, computedMax]);
      xScale = logScale;
    }
    const colors = [...new Set(rows.map((row) => row.color))];
    return defineChart({
      marks: [
        rect(rows, { x1: 'lower', x2: 'upper', y1: () => 0, y2: 'count', color: 'color', key: 'key', inset: 0.5 }),
      ],
      x: { scale: xScale, axis: { tickLabels: { thin: true } } },
      y: {
        scale: scaleLinear,
        nice: true,
        grid: true,
        axis: { ticks: { format: (value) => formatValue(value, format) } },
      },
      color: { domain: colors, range: colors },
      margin: 8,
      theme: { foreground: String(chartsTheme.echartsTheme.textStyle?.color ?? 'currentColor'), palette },
      tooltip: {
        use: tooltip,
        format: (point) =>
          `${point.datum.bucket}: ${point.datum.lower}–${point.datum.upper} · ${formatValue(point.datum.count, format)}`,
      },
    });
  }, [chartsTheme.echartsTheme.textStyle?.color, computedMax, computedMin, format, logBase, palette, rows]);
  if (!rows.length) return null;
  const padding = chartsTheme.container.padding.default;
  return (
    <TanStackChart
      definition={definition}
      width={Math.max(1, width - padding * 2)}
      height={Math.max(1, height - padding * 2)}
      ariaLabel="Histogram"
    />
  );
}
