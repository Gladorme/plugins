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

import {
  Alert,
  Box,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Tab,
  Tabs,
} from '@mui/material';
import { ErrorAlert, ErrorBoundary, useId } from '@perses-dev/components';
import { Panel } from '@perses-dev/dashboards';
import { useExplorerManagerContext } from '@perses-dev/explore';
import {
  DataQueriesProvider,
  DatasourcePlugin,
  DatasourceSelect,
  DatasourceSelectValue,
  PluginMetadataWithModule,
  useListPluginMetadata,
  usePlugins,
} from '@perses-dev/plugin-system';
import { DatasourceSelector, QueryDefinition, UnknownSpec } from '@perses-dev/spec';
import { ReactElement, SyntheticEvent, useCallback, useMemo, useState } from 'react';

import {
  isOTelExplorerDatasourcePlugin,
  OTelAttributeFilter,
  OTelExplorerDatasourcePlugin,
  OTelSignal,
  OTelSignalCapability,
  OTelSignalInputs,
  OTEL_SIGNALS,
  validAttributeFilters,
} from '../model';
import { OTelQueryControls } from './OTelQueryControls';

type SignalQueries = Partial<Record<OTelSignal, QueryDefinition[]>>;
type SignalDatasources = Partial<Record<OTelSignal, DatasourceSelector>>;

export interface OTelExplorerQueryParams extends Partial<OTelSignalInputs> {
  signal?: OTelSignal;
  filters?: OTelAttributeFilter[];
  queries?: SignalQueries;
  datasources?: SignalDatasources;
}

interface OTelProvider {
  kind: string;
  displayName: string;
  plugin: OTelExplorerDatasourcePlugin;
}

const EMPTY_FILTERS: OTelAttributeFilter[] = [];
const EMPTY_QUERIES: QueryDefinition[] = [];
const EMPTY_DATASOURCE_METADATA: PluginMetadataWithModule[] = [];
const DATASOURCE_PLUGIN_TYPES = ['Datasource' as const];
const PANEL_HEIGHT = 700;
const RANGE_QUERY_OPTIONS = { mode: 'range' as const };
const INSTANT_QUERY_OPTIONS = { mode: 'instant' as const };
const PANEL_OPTIONS = { hideHeader: true };
const EXPLORER_SX = { width: '100%' };
const TABS_SX = { borderBottom: 1, borderColor: 'divider' };
const PROVIDER_STACK_DIRECTION = { xs: 'column' as const, md: 'row' as const };
const PROVIDER_CONTROL_SX = { minWidth: 280 };
const DATASOURCE_CONTROL_SX = { minWidth: 360 };

const DEFAULT_SIGNAL_INPUTS: OTelSignalInputs = {
  logSearch: '',
  logServiceName: '',
  logSeverity: '',
  metricName: '',
  metricsQueryMode: 'range',
  profileServiceName: '',
  profileType: '',
  traceMaxDuration: '',
  traceMinDuration: '',
  traceServiceName: '',
  traceSpanName: '',
  traceStatus: '',
};

const SIGNAL_LABELS: Record<OTelSignal, string> = {
  metrics: 'Metrics',
  logs: 'Logs',
  traces: 'Traces',
  profiles: 'Profiles',
};

const PANEL_KINDS: Record<OTelSignal, string> = {
  metrics: 'TimeSeriesChart',
  logs: 'LogsTable',
  traces: 'TraceTable',
  profiles: 'FlameChart',
};

export function getSignalPanelKind(signal: OTelSignal, metricsQueryMode: OTelSignalInputs['metricsQueryMode']): string {
  return signal === 'metrics' && metricsQueryMode === 'instant' ? 'TimeSeriesTable' : PANEL_KINDS[signal];
}

function getSignalQueryOptions(
  signal: OTelSignal,
  metricsQueryMode: OTelSignalInputs['metricsQueryMode'],
): typeof RANGE_QUERY_OPTIONS | typeof INSTANT_QUERY_OPTIONS | undefined {
  if (signal !== 'metrics') {
    return undefined;
  }
  return metricsQueryMode === 'instant' ? INSTANT_QUERY_OPTIONS : RANGE_QUERY_OPTIONS;
}

export function createSignalChangeData(
  data: OTelExplorerQueryParams,
  signal: OTelSignal,
  filters: OTelAttributeFilter[],
): OTelExplorerQueryParams {
  return { ...data, signal, filters };
}

const PANEL_SPECS: Record<OTelSignal, UnknownSpec> = {
  metrics: {},
  logs: {},
  traces: {},
  profiles: {
    palette: 'package-name',
    showSettings: true,
    showSeries: true,
    showTable: true,
    showFlameGraph: true,
    traceHeight: 25,
  },
};

function toProviders(
  metadata: PluginMetadataWithModule[],
  plugins: Array<DatasourcePlugin | undefined>,
): OTelProvider[] {
  return metadata.flatMap((item, index) => {
    const plugin = plugins[index];
    if (!plugin || !isOTelExplorerDatasourcePlugin(plugin)) {
      return [];
    }
    return [{ kind: item.spec.name, displayName: item.spec.display.name, plugin }];
  });
}

function SignalResults({
  signal,
  queries,
  metricsQueryMode,
}: {
  signal: OTelSignal;
  queries: QueryDefinition[];
  metricsQueryMode: OTelSignalInputs['metricsQueryMode'];
}): ReactElement | null {
  const resetKeys = useMemo(() => [signal, metricsQueryMode, queries], [metricsQueryMode, queries, signal]);
  const queryOptions = getSignalQueryOptions(signal, metricsQueryMode);
  const definition = useMemo(
    () => ({
      kind: 'Panel' as const,
      spec: {
        queries,
        display: { name: '' },
        plugin: { kind: getSignalPanelKind(signal, metricsQueryMode), spec: PANEL_SPECS[signal] },
      },
    }),
    [metricsQueryMode, queries, signal],
  );

  if (queries.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorAlert} resetKeys={resetKeys}>
      <DataQueriesProvider definitions={queries} options={queryOptions}>
        <Box height={PANEL_HEIGHT}>
          <Panel panelOptions={PANEL_OPTIONS} definition={definition} />
        </Box>
      </DataQueriesProvider>
    </ErrorBoundary>
  );
}

interface ProviderSelectorProps {
  providers: OTelProvider[];
  selectedProvider: OTelProvider;
  datasource: DatasourceSelector;
  onProviderChange: (kind: string) => void;
  onDatasourceChange: (next: DatasourceSelector) => void;
}

function ProviderSelector({
  providers,
  selectedProvider,
  datasource,
  onProviderChange,
  onDatasourceChange,
}: ProviderSelectorProps): ReactElement {
  const providerLabelId = useId('otel-provider-label');
  const datasourceLabelId = useId('otel-datasource-label');

  const handleDatasourceChange = useCallback(
    (next: DatasourceSelectValue): void => {
      if (typeof next === 'object' && 'kind' in next) {
        onDatasourceChange(next);
      }
    },
    [onDatasourceChange],
  );
  const handleProviderChange = useCallback(
    (event: SelectChangeEvent): void => onProviderChange(event.target.value),
    [onProviderChange],
  );

  return (
    <Stack direction={PROVIDER_STACK_DIRECTION} gap={2}>
      <FormControl sx={PROVIDER_CONTROL_SX}>
        <InputLabel id={providerLabelId}>Signal provider</InputLabel>
        <Select
          labelId={providerLabelId}
          label="Signal provider"
          value={selectedProvider.kind}
          onChange={handleProviderChange}
        >
          {providers.map((provider) => (
            <MenuItem key={provider.kind} value={provider.kind}>
              {provider.displayName}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
      <FormControl sx={DATASOURCE_CONTROL_SX}>
        <InputLabel id={datasourceLabelId} shrink>
          Datasource
        </InputLabel>
        <DatasourceSelect
          datasourcePluginKind={selectedProvider.kind}
          value={datasource}
          onChange={handleDatasourceChange}
          labelId={datasourceLabelId}
          label="Datasource"
          notched
        />
      </FormControl>
    </Stack>
  );
}

interface SignalNavigationProps {
  signal: OTelSignal;
  onChange: (event: SyntheticEvent, signal: OTelSignal) => void;
}

export function SignalNavigation({ signal, onChange }: SignalNavigationProps): ReactElement {
  return (
    <Tabs
      aria-label="OpenTelemetry signals"
      value={signal}
      onChange={onChange}
      variant="scrollable"
      selectionFollowsFocus
      sx={TABS_SX}
    >
      {OTEL_SIGNALS.map((value) => (
        <Tab key={value} value={value} label={SIGNAL_LABELS[value]} />
      ))}
    </Tabs>
  );
}

export function OTelExplorer(): ReactElement {
  const { data, setData } = useExplorerManagerContext<OTelExplorerQueryParams>();
  const { signal = 'metrics', filters = EMPTY_FILTERS, queries = {}, datasources = {} } = data;
  const inputs = useMemo<OTelSignalInputs>(
    () => ({
      logSearch: data.logSearch ?? DEFAULT_SIGNAL_INPUTS.logSearch,
      logServiceName: data.logServiceName ?? DEFAULT_SIGNAL_INPUTS.logServiceName,
      logSeverity: data.logSeverity ?? DEFAULT_SIGNAL_INPUTS.logSeverity,
      metricName: data.metricName ?? DEFAULT_SIGNAL_INPUTS.metricName,
      metricsQueryMode: data.metricsQueryMode ?? DEFAULT_SIGNAL_INPUTS.metricsQueryMode,
      profileServiceName: data.profileServiceName ?? DEFAULT_SIGNAL_INPUTS.profileServiceName,
      profileType: data.profileType ?? DEFAULT_SIGNAL_INPUTS.profileType,
      traceMaxDuration: data.traceMaxDuration ?? DEFAULT_SIGNAL_INPUTS.traceMaxDuration,
      traceMinDuration: data.traceMinDuration ?? DEFAULT_SIGNAL_INPUTS.traceMinDuration,
      traceServiceName: data.traceServiceName ?? DEFAULT_SIGNAL_INPUTS.traceServiceName,
      traceSpanName: data.traceSpanName ?? DEFAULT_SIGNAL_INPUTS.traceSpanName,
      traceStatus: data.traceStatus ?? DEFAULT_SIGNAL_INPUTS.traceStatus,
    }),
    [
      data.logSearch,
      data.logServiceName,
      data.logSeverity,
      data.metricName,
      data.metricsQueryMode,
      data.profileServiceName,
      data.profileType,
      data.traceMaxDuration,
      data.traceMinDuration,
      data.traceServiceName,
      data.traceSpanName,
      data.traceStatus,
    ],
  );
  const [applyError, setApplyError] = useState<string>();

  const { data: datasourceMetadata = EMPTY_DATASOURCE_METADATA } = useListPluginMetadata(DATASOURCE_PLUGIN_TYPES);
  const datasourcePluginKinds = useMemo(
    () => datasourceMetadata.map((item) => ({ kind: item.spec.name })),
    [datasourceMetadata],
  );
  const pluginResults = usePlugins('Datasource', datasourcePluginKinds);
  const providerPlugins = useMemo(() => pluginResults.map((result) => result.data), [pluginResults]);
  const providers = useMemo(
    () => toProviders(datasourceMetadata, providerPlugins),
    [datasourceMetadata, providerPlugins],
  );
  const signalProviders = useMemo(
    () => providers.filter((provider) => provider.plugin.otelExplorer[signal] !== undefined),
    [providers, signal],
  );
  const selectedDatasource = datasources[signal];
  const selectedProvider =
    signalProviders.find((provider) => provider.kind === selectedDatasource?.kind) ?? signalProviders[0];
  let datasource: DatasourceSelector | undefined;
  if (selectedProvider) {
    datasource =
      selectedDatasource?.kind === selectedProvider.kind ? selectedDatasource : { kind: selectedProvider.kind };
  }
  const capability: OTelSignalCapability | undefined = selectedProvider?.plugin.otelExplorer[signal];
  const executedQueries = queries[signal] ?? EMPTY_QUERIES;

  const updateData = useCallback(
    (next: Partial<OTelExplorerQueryParams>): void => setData({ ...data, ...next }),
    [data, setData],
  );

  const handleProviderChange = useCallback(
    (kind: string): void => {
      setApplyError(undefined);
      updateData({
        datasources: { ...datasources, [signal]: { kind } },
        queries: { ...queries, [signal]: EMPTY_QUERIES },
      });
    },
    [datasources, queries, signal, updateData],
  );

  const handleDatasourceChange = useCallback(
    (next: DatasourceSelector): void => {
      setApplyError(undefined);
      updateData({
        datasources: { ...datasources, [signal]: next },
        queries: { ...queries, [signal]: EMPTY_QUERIES },
      });
    },
    [datasources, queries, signal, updateData],
  );

  const handleQueryRun = useCallback((): void => {
    if (!capability || !datasource) {
      return;
    }

    const nextFilters = validAttributeFilters(filters);
    try {
      const nextQueries = [capability.createQuery({ ...inputs, datasource, filters: nextFilters })];
      setApplyError(undefined);
      updateData({
        queries: { ...queries, [signal]: nextQueries },
        datasources: { ...datasources, [signal]: datasource },
      });
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : 'The datasource could not create the query.');
    }
  }, [capability, datasource, datasources, filters, inputs, queries, signal, updateData]);
  const handleSignalChange = useCallback(
    (_: SyntheticEvent, next: OTelSignal): void => {
      setApplyError(undefined);
      setData(createSignalChangeData(data, next, filters));
    },
    [data, filters, setData],
  );
  const handleFiltersChange = useCallback(
    (next: OTelAttributeFilter[]): void => updateData({ filters: next }),
    [updateData],
  );
  const handleInputsChange = useCallback((next: Partial<OTelSignalInputs>): void => updateData(next), [updateData]);
  return (
    <Stack gap={2} sx={EXPLORER_SX}>
      <SignalNavigation signal={signal} onChange={handleSignalChange} />

      {signalProviders.length === 0 || !selectedProvider || !datasource || !capability ? (
        <Alert severity="info">
          No installed datasource advertises {SIGNAL_LABELS[signal].toLocaleLowerCase()} support for the OpenTelemetry
          explorer.
        </Alert>
      ) : (
        <Stack gap={2}>
          <ProviderSelector
            providers={signalProviders}
            selectedProvider={selectedProvider}
            datasource={datasource}
            onProviderChange={handleProviderChange}
            onDatasourceChange={handleDatasourceChange}
          />
          <OTelQueryControls
            capability={capability}
            datasource={datasource}
            filters={filters}
            inputs={inputs}
            onFiltersChange={handleFiltersChange}
            onInputsChange={handleInputsChange}
            onQueryRun={handleQueryRun}
            signal={signal}
          />
          {applyError && <Alert severity="error">{applyError}</Alert>}
          <SignalResults signal={signal} queries={executedQueries} metricsQueryMode={inputs.metricsQueryMode} />
        </Stack>
      )}
    </Stack>
  );
}
