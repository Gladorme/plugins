// Copyright The Perses Authors
// Licensed under the Apache License, Version 2.0 (the "License");

import { Box, useTheme } from '@mui/material';
import { FormatOptions, ModeOption, formatValue, useChartsTheme } from '@perses-dev/components';
import { defineChart } from '@tanstack/charts';
import { pie, polar, radialArc, radialText } from '@tanstack/charts/polar';
import { tooltip } from '@tanstack/charts/tooltip';
import { ReactElement, useMemo } from 'react';
import { TanStackChart } from './TanStackChart';

export interface PieChartData {
  id?: string;
  name: string;
  value: number | null;
  itemStyle?: { color: string };
}

export interface PieChartBaseProps {
  width: number;
  height: number;
  data: PieChartData[] | null;
  mode?: ModeOption;
  showLabels?: boolean;
  formatOptions?: FormatOptions;
}

interface PieRow {
  id: string;
  name: string;
  value: number;
  color: string;
}

export function PieChartBase({
  width,
  height,
  data,
  mode,
  formatOptions,
  showLabels,
}: PieChartBaseProps): ReactElement {
  const chartsTheme = useChartsTheme();
  const muiTheme = useTheme();
  const palette = useMemo(() => (chartsTheme.echartsTheme.color ?? []) as string[], [chartsTheme.echartsTheme.color]);
  const rows = useMemo<PieRow[]>(
    () =>
      (data ?? []).flatMap((row, index) =>
        typeof row.value === 'number' && row.value >= 0
          ? [
              {
                id: row.id ?? row.name,
                name: row.name,
                value: row.value,
                color: row.itemStyle?.color ?? palette[index % Math.max(1, palette.length)] ?? '#1976d2',
              },
            ]
          : []
      ),
    [data, palette]
  );

  const definition = useMemo(() => {
    const slices = pie(rows, { value: 'value', gapAngle: 0.01 });
    return defineChart({
      marks: [
        polar({
          inset: 4,
          radiusRatio: 0.9,
          marks: [
            radialArc(slices, {
              key: 'id',
              fill: (slice) => slice.color,
              cornerRadius: 5,
              stroke: muiTheme.palette.background.default,
              strokeWidth: 2,
            }),
            ...(showLabels
              ? [
                  radialText(slices, {
                    key: 'id',
                    angle: 'angle',
                    radius: 0.62,
                    text: (slice) =>
                      mode === 'percentage'
                        ? `${slice.name}: ${formatValue(slice.fraction * 100, {
                            unit: 'percent',
                            decimalPlaces: formatOptions?.decimalPlaces,
                          })}`
                        : `${slice.name}: ${formatValue(slice.value, formatOptions)}`,
                    fill: muiTheme.palette.getContrastText(muiTheme.palette.background.paper),
                    fontSize: 12,
                    fontWeight: 700,
                    anchor: 'middle',
                  }),
                ]
              : []),
          ],
        }),
      ],
      guides: false,
      theme: { foreground: muiTheme.palette.text.primary, palette },
      tooltip: {
        use: tooltip,
        format: (point) => {
          const slice = point.datum;
          return `${slice.name}: ${formatValue(slice.value, formatOptions)} (${formatValue(slice.fraction * 100, {
            unit: 'percent',
            decimalPlaces: formatOptions?.decimalPlaces,
          })})`;
        },
      },
    });
  }, [formatOptions, mode, muiTheme.palette, palette, rows, showLabels]);

  return (
    <Box style={{ width, height }} sx={{ overflow: 'auto' }}>
      {rows.length ? (
        <TanStackChart definition={definition} width={width} height={height} ariaLabel="Pie chart" />
      ) : (
        <Box sx={{ alignItems: 'center', display: 'flex', height: '100%', justifyContent: 'center' }}>No data</Box>
      )}
    </Box>
  );
}
