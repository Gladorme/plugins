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

import { Stack, Typography, SxProps, useMediaQuery, useTheme } from '@mui/material';
import { useChartsTheme } from '@perses-dev/components';
import { PanelProps } from '@perses-dev/plugin-system';
import { ProfileData, StackTrace } from '@perses-dev/spec';
import { TitleComponentOption } from 'echarts';
import { FC, useMemo, useState } from 'react';

import { FlameChartOptions } from '../flame-chart-model';
import { filterStackTraceById, getMaxDepth } from '../utils/data-transform';
import { FlameChart } from './FlameChart';
import { SeriesChart } from './SeriesChart';
import { Settings } from './Settings';
import { TableChart } from './TableChart';

const LARGE_PANEL_THRESHOLD = 600;
const DEFAULT_SERIES_CHART_HEIGHT = 200;

export type FlameChartPanelProps = PanelProps<FlameChartOptions, ProfileData>;

interface FlameChartPanelState {
  sourceSpec: FlameChartOptions;
  liveSpec: FlameChartOptions;
  selectedId: number;
  searchValue: string;
}

function getCurrentPanelState(state: FlameChartPanelState, spec: FlameChartOptions): FlameChartPanelState {
  if (state.sourceSpec === spec) {
    return state;
  }
  return { sourceSpec: spec, liveSpec: spec, selectedId: 0, searchValue: '' };
}

export const FlameChartPanel: FC<FlameChartPanelProps> = (props) => {
  const { contentDimensions, queryResults, spec } = props;

  const isMobileSize = useMediaQuery(useTheme().breakpoints.down('sm'));

  const [panelState, setPanelState] = useState<FlameChartPanelState>(() => ({
    sourceSpec: spec,
    liveSpec: spec,
    selectedId: 0,
    searchValue: '',
  }));
  const { liveSpec, selectedId, searchValue } = getCurrentPanelState(panelState, spec);

  const chartsTheme = useChartsTheme();
  const flameChartData = useMemo(() => {
    return queryResults[0];
  }, [queryResults]);

  const selectedStackTrace: StackTrace | undefined = useMemo(() => {
    if (!flameChartData) return undefined;
    if (!selectedId) return flameChartData.data.profile.stackTrace;

    return filterStackTraceById(flameChartData.data.profile.stackTrace, selectedId);
  }, [flameChartData, selectedId]);

  const maxDepth: number = useMemo(
    () => (selectedStackTrace ? getMaxDepth(selectedStackTrace) : 0),
    [selectedStackTrace],
  );

  const noDataTextStyle = (chartsTheme.noDataOption.title as TitleComponentOption).textStyle as SxProps;

  const onChangePalette = (newPalette: 'package-name' | 'value'): void => {
    setPanelState((previousState) => {
      const currentState = getCurrentPanelState(previousState, spec);
      return { ...currentState, liveSpec: { ...currentState.liveSpec, palette: newPalette } };
    });
  };

  const onDisplayChange = (value: 'table' | 'flame-graph' | 'both' | 'none'): void => {
    let showTable = true;
    let showFlameGraph = true;
    if (value === 'table') {
      showFlameGraph = false;
    } else if (value === 'flame-graph') {
      showTable = false;
    }
    setPanelState((previousState) => {
      const currentState = getCurrentPanelState(previousState, spec);
      return { ...currentState, liveSpec: { ...currentState.liveSpec, showTable, showFlameGraph } };
    });
  };

  const onSelectedIdChange = (newSelectedId: number): void => {
    setPanelState((previousState) => ({
      ...getCurrentPanelState(previousState, spec),
      selectedId: newSelectedId,
    }));
  };

  const onSearchValueChange = (newSearchValue: string): void => {
    setPanelState((previousState) => ({
      ...getCurrentPanelState(previousState, spec),
      searchValue: newSearchValue,
    }));
  };

  if (!contentDimensions) return null;

  let padding = 0;
  if (liveSpec.showSeries && liveSpec.showSettings) {
    padding = 32;
  } else if (liveSpec.showSeries || liveSpec.showSettings) {
    padding = 16;
  }

  const SETTINGS_HEIGHT = liveSpec.showSettings ? 30 : 0;

  const seriesChartHeight = liveSpec.showSeries ? Math.min(contentDimensions.height, DEFAULT_SERIES_CHART_HEIGHT) : 0;

  const reservedHeight =
    contentDimensions.height > LARGE_PANEL_THRESHOLD ? seriesChartHeight + SETTINGS_HEIGHT + padding : 0;
  const availableChartHeight = contentDimensions.height - reservedHeight;
  const tableFlameChartHeight = liveSpec.traceHeight
    ? Math.max(availableChartHeight, maxDepth * liveSpec.traceHeight)
    : availableChartHeight;

  let tableChartWidth = contentDimensions.width;
  if (!isMobileSize && liveSpec.showFlameGraph) {
    tableChartWidth = 0.4 * contentDimensions.width;
  }

  let flameChartWidth = contentDimensions.width;
  if (!isMobileSize && liveSpec.showTable) {
    flameChartWidth = 0.6 * contentDimensions.width;
  }

  // TODO (gladorme): allow users to override height (useful for explorer for stack traces with high depth)
  return (
    <Stack
      height={contentDimensions.height}
      width={contentDimensions.width}
      justifyContent="center"
      alignItems="center"
    >
      {queryResults.length > 1 && (
        // display a message if there is more than one query
        <Typography sx={{ ...noDataTextStyle }}>
          There is more than one query. Please make sure that you provided only one query.
        </Typography>
      )}
      {queryResults.length <= 1 && flameChartData && (
        <Stack
          gap={2}
          sx={{
            overflowY: 'auto',
            scrollbarGutter: 'stable both-edges',
            paddingTop: liveSpec.showSettings || liveSpec.showSeries ? 1 : 0,
          }}
        >
          {liveSpec.showSeries && (
            <SeriesChart width={contentDimensions.width} height={seriesChartHeight} data={flameChartData.data} />
          )}
          {liveSpec.showSettings && (
            <Settings
              onSelectedIdChange={onSelectedIdChange}
              onChangePalette={onChangePalette}
              onDisplayChange={onDisplayChange}
              value={liveSpec}
              selectedId={selectedId}
            />
          )}
          <Stack
            direction={isMobileSize ? 'column' : 'row'}
            justifyContent="center"
            alignItems={isMobileSize ? 'center' : 'top'}
          >
            {liveSpec.showTable && (
              <TableChart
                width={tableChartWidth}
                height={tableFlameChartHeight}
                data={flameChartData.data}
                searchValue={searchValue}
                onSearchValueChange={onSearchValueChange}
                onSelectedIdChange={onSelectedIdChange}
              />
            )}
            {liveSpec.showFlameGraph && (
              <FlameChart
                width={flameChartWidth}
                height={tableFlameChartHeight}
                data={flameChartData.data}
                palette={liveSpec.palette}
                selectedId={selectedId}
                searchValue={searchValue}
                onSelectedIdChange={onSelectedIdChange}
              />
            )}
          </Stack>
        </Stack>
      )}
      {queryResults.length <= 1 && !flameChartData && <Typography sx={{ ...noDataTextStyle }}>No data</Typography>}
    </Stack>
  );
};
