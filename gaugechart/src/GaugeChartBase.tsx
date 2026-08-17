// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { Box, Typography } from '@mui/material';
import { FormatOptions, formatValue, useChartsTheme } from '@perses-dev/components';
import { defineChart } from '@tanstack/charts';
import { pie, polar, radialArc, radialRule } from '@tanstack/charts/polar';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import { ReactElement, useMemo } from 'react';
import { GaugeColorStop } from './thresholds';
import { TanStackChart } from './TanStackChart';

const GAUGE_SMALL_BREAKPOINT = 170;
const START_ANGLE = -Math.PI * 0.75;
const END_ANGLE = Math.PI * 0.75;

export type GaugeChartValue = number | null | undefined;
export type GaugeSeries = { value: GaugeChartValue; label: string };

export interface GaugeChartBaseProps {
  width: number;
  height: number;
  data: GaugeSeries;
  format: FormatOptions;
  axisLine: { lineStyle?: { color?: GaugeColorStop[]; width?: number } };
  max?: number;
  valueFontSize: string;
  progressWidth: number;
  titleFontSize: number;
}

interface GaugePart {
  id: string;
  value: number;
  color: string;
}

export function GaugeChartBase({
  width,
  height,
  data,
  format,
  axisLine,
  max = 100,
  valueFontSize,
  progressWidth,
  titleFontSize,
}: GaugeChartBaseProps): ReactElement {
  const chartsTheme = useChartsTheme();
  const boundedValue = Math.max(0, Math.min(max, data.value ?? 0));
  const fraction = max > 0 ? boundedValue / max : 0;
  const stops = useMemo<GaugeColorStop[]>(
    () => axisLine.lineStyle?.color ?? [[1, chartsTheme.thresholds.defaultColor]],
    [axisLine.lineStyle?.color, chartsTheme.thresholds.defaultColor]
  );
  const activeColor = stops.find(([stop]) => fraction <= stop)?.[1] ?? stops.at(-1)?.[1] ?? '#1976d2';

  const definition = useMemo(() => {
    const progress: GaugePart[] = [
      { id: 'value', value: fraction, color: activeColor },
      { id: 'remaining', value: Math.max(0, 1 - fraction), color: 'rgba(127,127,127,0.25)' },
    ];
    const thresholdParts: GaugePart[] = [];
    let previous = 0;
    stops.forEach(([stop, color], index) => {
      const boundedStop = Math.max(previous, Math.min(1, stop));
      thresholdParts.push({ id: `threshold-${index}`, value: boundedStop - previous, color });
      previous = boundedStop;
    });
    const progressSlices = pie(progress, { value: 'value', startAngle: START_ANGLE, endAngle: END_ANGLE });
    const thresholdSlices = pie(thresholdParts, { value: 'value', startAngle: START_ANGLE, endAngle: END_ANGLE });

    return defineChart({
      marks: [
        polar({
          inset: Math.max(6, chartsTheme.container.padding.default),
          radiusRatio: 0.95,
          startAngle: START_ANGLE,
          endAngle: END_ANGLE,
          angle: { scale: scaleLinear().domain([0, 1]) },
          radius: { scale: scaleLinear().domain([0, 1]) },
          marks: [
            radialArc(progressSlices, {
              key: 'id',
              innerRadius: ({ radius }) => Math.max(0, radius - progressWidth),
              fill: (part) => part.color,
              cornerRadius: progressWidth / 2,
            }),
            radialArc(thresholdSlices, {
              key: 'id',
              innerRadius: ({ radius }) => Math.max(0, radius - (axisLine.lineStyle?.width ?? 2)),
              fill: (part) => part.color,
            }),
            ...(width > GAUGE_SMALL_BREAKPOINT
              ? [
                  radialRule([fraction], {
                    angle: (value) => value,
                    radius1: 0.78,
                    radius2: 1,
                    stroke: activeColor,
                    strokeWidth: 3,
                  }),
                ]
              : []),
          ],
        }),
      ],
      guides: false,
      theme: {
        foreground: String(chartsTheme.echartsTheme.textStyle?.color ?? 'currentColor'),
      },
      pointer: false,
      keyboard: false,
    });
  }, [activeColor, axisLine.lineStyle?.width, chartsTheme, fraction, progressWidth, stops, width]);

  if (data.value === undefined) {
    return <Box sx={{ alignItems: 'center', display: 'flex', height, justifyContent: 'center', width }}>No data</Box>;
  }

  return (
    <Box sx={{ height, position: 'relative', width }}>
      <TanStackChart
        definition={definition}
        width={width}
        height={height}
        ariaLabel={`${data.label || 'Gauge'} value`}
      />
      <Box
        sx={{
          alignItems: 'center',
          display: 'flex',
          flexDirection: 'column',
          left: '10%',
          pointerEvents: 'none',
          position: 'absolute',
          top: '43%',
          width: '80%',
        }}
      >
        <Typography sx={{ color: activeColor, fontSize: valueFontSize, fontWeight: 700, lineHeight: 1.1 }}>
          {data.value === null ? 'null' : formatValue(data.value, format)}
        </Typography>
        {data.label && (
          <Typography noWrap sx={{ fontSize: titleFontSize, marginTop: 1, maxWidth: '100%' }}>
            {data.label}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
