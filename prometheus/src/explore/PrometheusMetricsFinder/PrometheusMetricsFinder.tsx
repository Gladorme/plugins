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

import type { StackProps } from '@mui/material';
import {
  Button,
  Checkbox,
  CircularProgress,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  TextField,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { FuzzyMatchingInterval } from '@nexucis/fuzzy';
import { Fuzzy } from '@nexucis/fuzzy';
import { useExplorerQueryParams } from '@perses-dev/explore';
import { useDatasourceClient } from '@perses-dev/plugin-system';
import type { DatasourceSelector } from '@perses-dev/spec';
import ArrowLeftIcon from 'mdi-material-ui/ArrowLeft';
import CogIcon from 'mdi-material-ui/Cog';
import Magnify from 'mdi-material-ui/Magnify';
import type { MouseEvent, ReactElement } from 'react';
import { useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';

import { DEFAULT_PROM } from '../../model';
import type { MetricUsageProvider, PrometheusClient } from '../../model';
import { MetricList } from './display/list/MetricList';
import { FinderFilters } from './filter/FinderFilters';
import { MetricOverview } from './overview/MetricOverview';
import type { LabelFilter, Settings } from './types';
import { useMetricUsageProvider } from './useMetricUsageProvider';
import { useLabelValues } from './utils';

const PERSES_METRICS_FINDER_SETTINGS = 'PERSES_METRICS_FINDER_SETTINGS';
const EMPTY_FILTERS: LabelFilter[] = [];

function readSettings(): Settings {
  const defaults: Settings = { isMetadataEnabled: true, isPanelEnabled: false, isMetricUsageEnabled: true };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(PERSES_METRICS_FINDER_SETTINGS) ?? '{}');
    if (typeof stored !== 'object' || stored === null) return defaults;
    return {
      isMetadataEnabled:
        'isMetadataEnabled' in stored && typeof stored.isMetadataEnabled === 'boolean'
          ? stored.isMetadataEnabled
          : defaults.isMetadataEnabled,
      isPanelEnabled:
        'isPanelEnabled' in stored && typeof stored.isPanelEnabled === 'boolean'
          ? stored.isPanelEnabled
          : defaults.isPanelEnabled,
      isMetricUsageEnabled:
        'isMetricUsageEnabled' in stored && typeof stored.isMetricUsageEnabled === 'boolean'
          ? stored.isMetricUsageEnabled
          : defaults.isMetricUsageEnabled,
    };
  } catch {
    return defaults;
  }
}

export interface SettingsMenuProps {
  value: Settings;
  hasMetricUsage?: boolean;
  onChange: (value: Settings) => void;
}

export function SettingsMenu({ value, onChange, hasMetricUsage }: SettingsMenuProps): ReactElement {
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const open = Boolean(anchorEl);
  const handleClick = (event: MouseEvent<HTMLButtonElement>): void => {
    setAnchorEl(event.currentTarget);
  };
  const handleClose = (): void => {
    setAnchorEl(null);
  };

  return (
    <>
      <IconButton aria-label="settings" size="large" onClick={handleClick}>
        <CogIcon />
      </IconButton>
      <Menu id="finder-settings-menu" anchorEl={anchorEl} open={open} onClose={handleClose}>
        <MenuItem onClick={(e) => e.preventDefault()}>
          <FormControlLabel
            control={<Checkbox />}
            label="Enable Metadata"
            checked={value.isMetadataEnabled}
            onClick={() => onChange({ ...value, isMetadataEnabled: !value.isMetadataEnabled })}
          />
        </MenuItem>
        <MenuItem onClick={(e) => e.preventDefault()}>
          <FormControlLabel
            control={<Checkbox />}
            label="Enable Time Series Chart"
            checked={value.isPanelEnabled}
            onClick={() => onChange({ ...value, isPanelEnabled: !value.isPanelEnabled })}
          />
        </MenuItem>
        {hasMetricUsage && (
          <MenuItem
            role="menuitemcheckbox"
            aria-checked={value.isMetricUsageEnabled ?? true}
            onClick={() => onChange({ ...value, isMetricUsageEnabled: !(value.isMetricUsageEnabled ?? true) })}
          >
            <Checkbox checked={value.isMetricUsageEnabled ?? true} tabIndex={-1} aria-hidden />
            Enable Metric Usage
          </MenuItem>
        )}
      </Menu>
    </>
  );
}

export interface MetricNameExplorerProps extends StackProps {
  datasource: DatasourceSelector;
  filters: LabelFilter[];
  isMetadataEnabled?: boolean;
  metricUsage?: MetricUsageProvider;
  onExplore?: (metricName: string) => void;
}

export function MetricNameExplorer({
  datasource,
  filters,
  isMetadataEnabled,
  metricUsage,
  onExplore,
  ...props
}: MetricNameExplorerProps): ReactElement {
  const { data, isLoading, error } = useLabelValues('__name__', filters, datasource);
  const [search, setSearch] = useState('');
  const fuzzy = useMemo(() => new Fuzzy({ includeMatches: true, excludedChars: [' '] }), []);

  const filteredResults: Array<{ original: string; intervals?: FuzzyMatchingInterval[] }> | undefined = useMemo(() => {
    if (search && data?.data) {
      return fuzzy.filter(search, data.data).toSorted((a, b) => b.score - a.score);
    }
    return undefined;
  }, [data, fuzzy, search]);

  if (error) {
    return <Stack width="100%">Error: {error.message}</Stack>;
  }

  if (isLoading) {
    return (
      <Stack width="100%" sx={{ alignItems: 'center', justifyContent: 'center' }}>
        <CircularProgress />
      </Stack>
    );
  }

  return (
    <Stack {...props}>
      <TextField
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search metric name..."
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <Magnify />
              </InputAdornment>
            ),
          },
        }}
      />
      <MetricList
        metricNames={data?.data ?? []}
        filteredResults={filteredResults}
        datasource={datasource}
        filters={filters}
        isMetadataEnabled={isMetadataEnabled}
        metricUsage={metricUsage}
        onExplore={onExplore}
      />
    </Stack>
  );
}

export interface PrometheusMetricsFinderProps extends Omit<StackProps, 'onChange'> {
  /** Overrides the datasource provider. Set false to disable usage entirely. */
  metricUsage?: MetricUsageProvider | false;
  value: {
    datasource: DatasourceSelector;
    filters: LabelFilter[];
    exploredMetric?: string;
  };
  onChange: ({
    datasource,
    filters,
    exploredMetric,
  }: {
    datasource: DatasourceSelector;
    filters: LabelFilter[];
    exploredMetric?: string;
  }) => void;
  onExplore?: (metricName: string) => void;
}

export function PrometheusMetricsFinder({
  value: { datasource = DEFAULT_PROM, filters = EMPTY_FILTERS, exploredMetric },
  metricUsage: metricUsageOverride,
  onChange,
  onExplore,
  ...props
}: PrometheusMetricsFinderProps): ReactElement {
  const { data: client } = useDatasourceClient<PrometheusClient>(datasource);
  const metricUsage = useMetricUsageProvider(client, metricUsageOverride);
  const [settings, setSettings] = useState<Settings>(readSettings);

  function handleSettingsUpdate(value: Settings): void {
    setSettings(value);
    try {
      localStorage.setItem(PERSES_METRICS_FINDER_SETTINGS, JSON.stringify(value));
    } catch {
      // Keep settings usable when browser storage is unavailable.
    }
  }

  const isMobileSize = useMediaQuery(useTheme().breakpoints.down('md'));

  // Remove duplicated filters and filters without label or labelValues
  const filteredFilters: LabelFilter[] = useMemo(() => {
    return filters.filter(({ label, labelValues }) => label && labelValues?.[0]);
  }, [filters]);

  const searchParams = useExplorerQueryParams({
    data: { tab: 'finder', datasource, filters, exploredMetric: undefined },
  });

  function setDatasource(value: DatasourceSelector): void {
    onChange({ datasource: value, filters, exploredMetric });
  }

  function setFilters(value: LabelFilter[]): void {
    onChange({ datasource, filters: value, exploredMetric });
  }

  return (
    <Stack {...props} gap={1}>
      <Stack direction={isMobileSize ? 'column' : 'row'} gap={2} justifyContent="space-between">
        <FinderFilters
          datasource={datasource ?? DEFAULT_PROM}
          filters={filters ?? []}
          filteredFilters={filteredFilters}
          onDatasourceChange={setDatasource}
          onFiltersChange={setFilters}
        />
        <Stack direction="row" gap={1} alignItems="center">
          {exploredMetric && (
            <Button
              variant="contained"
              aria-label="back to metric explorer"
              startIcon={<ArrowLeftIcon />}
              component={RouterLink}
              to={`?${searchParams}`}
            >
              Back
            </Button>
          )}
          <Stack
            direction="row"
            sx={{ width: isMobileSize ? '100%' : 'unset' }}
            justifyContent={isMobileSize ? 'end' : 'unset'}
            alignItems="center"
          >
            <SettingsMenu value={settings} onChange={handleSettingsUpdate} hasMetricUsage={!!metricUsage} />
          </Stack>
        </Stack>
      </Stack>
      {exploredMetric ? (
        <MetricOverview
          metricUsage={settings.isMetricUsageEnabled !== false ? metricUsage : undefined}
          metricName={exploredMetric}
          datasource={datasource ?? DEFAULT_PROM}
          filters={filteredFilters}
          isMetadataEnabled={settings.isMetadataEnabled}
          isPanelEnabled={settings.isPanelEnabled}
          onFiltersChange={setFilters}
          onExplore={onExplore}
        />
      ) : (
        <MetricNameExplorer
          metricUsage={settings.isMetricUsageEnabled !== false ? metricUsage : undefined}
          datasource={datasource ?? DEFAULT_PROM}
          filters={filteredFilters}
          isMetadataEnabled={settings.isMetadataEnabled}
          onExplore={onExplore}
        />
      )}
    </Stack>
  );
}
