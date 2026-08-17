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

import { FC, ReactNode, useMemo } from 'react';
import { Box, Typography, styled, useTheme } from '@mui/material';
import { FontSizeOption, FormatOptions, GraphSeries, useChartsTheme } from '@perses-dev/components';
import { areaY, defineChart, lineY } from '@tanstack/charts';
import { scaleLinear } from '@tanstack/charts/scales/linear';
import chroma from 'chroma-js';
import { useOptimalFontSize } from './utils/calculate-font-size';
import { formatStatChartValue } from './utils/format-stat-chart-value';
import { StatSparklineStyle } from './utils/data-transform';
import { ColorMode } from './stat-chart-model';
import { TanStackChart } from './TanStackChart';

const LINE_HEIGHT = 1.2;
const SERIES_NAME_MAX_FONT_SIZE = 30;
const SERIES_NAME_FONT_WEIGHT = 400;
const VALUE_FONT_WEIGHT = 700;
const WHITE_COLOR_CODE = '#FFFFFF';
const BLACK_COLOR_CODE = '#000000';

export interface StatChartData {
  color: string;
  calculatedValue?: string | number | null;
  seriesData?: GraphSeries;
}

export interface StatChartProps {
  width: number;
  height: number;
  data: StatChartData;
  format?: FormatOptions;
  sparkline?: StatSparklineStyle;
  showSeriesName?: boolean;
  valueFontSize?: FontSizeOption;
  colorMode?: ColorMode;
}

export const StatChartBase: FC<StatChartProps> = (props) => {
  const {
    width,
    height,
    data,
    data: { color },
    sparkline,
    showSeriesName,
    format,
    valueFontSize,
    colorMode,
  } = props;

  const {
    palette: {
      mode: paletteMode,
      text: { secondary },
    },
  } = useTheme();
  const chartsTheme = useChartsTheme();
  const formattedValue = formatStatChartValue(data.calculatedValue, format);
  const containerPadding = chartsTheme.container.padding.default;

  // calculate series name font size and height
  let seriesNameFontSize = useOptimalFontSize({
    text: data?.seriesData?.name ?? '',
    fontWeight: SERIES_NAME_FONT_WEIGHT,
    width,
    height: height * 0.125, // assume series name will take 12.5% of available height
    lineHeight: LINE_HEIGHT,
    maxSize: SERIES_NAME_MAX_FONT_SIZE,
  });

  const seriesNameHeight = showSeriesName ? seriesNameFontSize * LINE_HEIGHT + containerPadding : 0;

  // calculate value font size and height
  const availableWidth = width - containerPadding * 2;
  const availableHeight = height - seriesNameHeight;
  const optimalValueFontSize = useOptimalFontSize({
    text: formattedValue,
    // override the font size if user selects it in the settings
    fontSizeOverride: valueFontSize,
    fontWeight: VALUE_FONT_WEIGHT,
    // without sparkline, use only 50% of the available width so it looks better for multiseries
    width: sparkline ? availableWidth : availableWidth * 0.5,
    // with sparkline, use only 25% of available height to leave room for chart
    // without sparkline, value should take up 90% of available space
    height: sparkline ? availableHeight * 0.25 : availableHeight * 0.9,
    lineHeight: LINE_HEIGHT,
  });
  const valueFontHeight = optimalValueFontSize * LINE_HEIGHT;

  // make sure the series name font size is slightly smaller than value font size
  seriesNameFontSize = Math.min(optimalValueFontSize * 0.7, seriesNameFontSize);

  const sparklineDefinition = useMemo(() => {
    if (!data.seriesData || !sparkline) return undefined;
    const rows = data.seriesData.values.map(([time, value], index) => ({ id: index, time, value }));
    const stroke = colorMode === 'background_solid' ? WHITE_COLOR_CODE : sparkline.lineStyle.color;
    const fill = colorMode === 'background_solid' ? WHITE_COLOR_CODE : sparkline.areaStyle.color;
    return defineChart({
      marks: [
        areaY(rows, { x: 'time', y: 'value', fill, fillOpacity: sparkline.areaStyle.opacity }),
        lineY(rows, {
          x: 'time',
          y: 'value',
          key: 'id',
          stroke,
          strokeOpacity: sparkline.lineStyle.opacity,
          strokeWidth: sparkline.lineStyle.width,
        }),
      ],
      x: { scale: scaleLinear, axis: false },
      y: { scale: scaleLinear, axis: false },
      guides: false,
      margin: 0,
      pointer: false,
      keyboard: false,
    });
  }, [colorMode, data.seriesData, sparkline]);

  const textAlignment = sparkline ? 'auto' : 'center';

  const styledFormattedValue = useMemo(() => {
    let valueColor = '';

    switch (colorMode) {
      case 'background_solid':
        valueColor =
          chroma.contrast(color, WHITE_COLOR_CODE) > chroma.contrast(color, BLACK_COLOR_CODE)
            ? WHITE_COLOR_CODE
            : BLACK_COLOR_CODE;
        break;
      case 'none':
        valueColor = paletteMode === 'dark' ? WHITE_COLOR_CODE : BLACK_COLOR_CODE;
        break;
      case 'value':
      default:
        valueColor = color;
        break;
    }

    return (
      <Value variant="h3" color={valueColor} fontSize={optimalValueFontSize} padding={containerPadding}>
        {formattedValue}
      </Value>
    );
  }, [colorMode, containerPadding, optimalValueFontSize, formattedValue, color, paletteMode]);

  const seriesName = useMemo((): ReactNode | null => {
    if (!showSeriesName) return null;

    let textColor = '';

    switch (colorMode) {
      case 'background_solid':
        textColor =
          chroma.contrast(color, WHITE_COLOR_CODE) > chroma.contrast(color, BLACK_COLOR_CODE)
            ? WHITE_COLOR_CODE
            : BLACK_COLOR_CODE;
        break;
      case 'none':
      case 'value':
      default:
        textColor = secondary;
        break;
    }

    return (
      <SeriesName padding={containerPadding} fontSize={seriesNameFontSize} color={textColor}>
        {data.seriesData?.name}
      </SeriesName>
    );
  }, [colorMode, showSeriesName, secondary, color, containerPadding, seriesNameFontSize, data?.seriesData?.name]);

  return (
    <Box
      sx={{
        height: '100%',
        width: '100%',
        backgroundColor: colorMode === 'background_solid' ? color : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: textAlignment,
        alignItems: textAlignment,
      }}
    >
      {seriesName}
      {styledFormattedValue}
      {sparklineDefinition && (
        <TanStackChart
          definition={sparklineDefinition}
          height={Math.max(1, Math.floor(height - seriesNameHeight - valueFontHeight))}
          ariaLabel={`${data.seriesData?.name ?? 'Value'} sparkline`}
        />
      )}
    </Box>
  );
};

const SeriesName = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'padding' && prop !== 'fontSize',
})<{ padding?: number; fontSize?: number; textAlignment?: string; color?: string }>(({ padding, fontSize, color }) => ({
  color: color,
  padding: `${padding}px`,
  fontSize: `${fontSize}px`,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
}));

const Value = styled(Typography, {
  shouldForwardProp: (prop) => prop !== 'color' && prop !== 'padding' && prop !== 'fontSize' && prop !== 'sparkline',
})<{ color?: string; padding?: number; fontSize?: number; sparkline?: boolean }>(
  ({ theme, color, padding, fontSize, sparkline }) => ({
    color: color ?? theme.palette.text.primary,
    fontSize: `${fontSize}px`,
    padding: sparkline ? `${padding}px ${padding}px 0 ${padding}px` : ` 0 ${padding}px`,
    whiteSpace: 'nowrap',
    lineHeight: LINE_HEIGHT,
  })
);
