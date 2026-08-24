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
  Button,
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
  validAttributeFilters,
} from '../model';
import { AttributeFilters } from './AttributeFilters';

type SignalQueries = Partial<Record<OTelSignal, QueryDefinition[]>>;
type SignalDatasources = Partial<Record<OTelSignal, DatasourceSelector>>;

interface OTelExplorerQueryParams {
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
const PANEL_OPTIONS = { hideHeader: true };
const EXPLORER_SX = { width: '100%' };
const TABS_SX = { borderBottom: 1, borderColor: 'divider' };
const PROVIDER_STACK_DIRECTION = { xs: 'column' as const, md: 'row' as const };
const PROVIDER_CONTROL_SX = { minWidth: 280 };
const DATASOURCE_CONTROL_SX = { minWidth: 360 };
const RUN_BUTTON_SX = { alignSelf: 'flex-end' };

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

function SignalResults({ signal, queries }: { signal: OTelSignal; queries: QueryDefinition[] }): ReactElement | null {
  const resetKeys = useMemo(() => [signal, queries], [queries, signal]);
  const definition = useMemo(
    () => ({
      kind: 'Panel' as const,
      spec: {
        queries,
        display: { name: '' },
        plugin: { kind: PANEL_KINDS[signal], spec: PANEL_SPECS[signal] },
      },
    }),
    [queries, signal],
  );

  if (queries.length === 0) {
    return null;
  }

  return (
    <ErrorBoundary FallbackComponent={ErrorAlert} resetKeys={resetKeys}>
      <DataQueriesProvider definitions={queries} options={signal === 'metrics' ? RANGE_QUERY_OPTIONS : undefined}>
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

export function OTelExplorer(): ReactElement {
  const { data, setData } = useExplorerManagerContext<OTelExplorerQueryParams>();
  const { signal = 'metrics', filters = EMPTY_FILTERS, queries = {}, datasources = {} } = data;
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
      const nextQueries = [capability.createQuery({ datasource, filters: nextFilters })];
      setApplyError(undefined);
      updateData({
        queries: { ...queries, [signal]: nextQueries },
        datasources: { ...datasources, [signal]: datasource },
      });
    } catch (error) {
      setApplyError(error instanceof Error ? error.message : 'The datasource could not create the query.');
    }
  }, [capability, datasource, datasources, filters, queries, signal, updateData]);
  const handleSignalChange = useCallback(
    (_: SyntheticEvent, next: OTelSignal): void => {
      setApplyError(undefined);
      updateData({ signal: next });
    },
    [updateData],
  );
  const handleFiltersChange = useCallback(
    (next: OTelAttributeFilter[]): void => updateData({ filters: next }),
    [updateData],
  );
  return (
    <Stack gap={2} sx={EXPLORER_SX}>
      <Tabs value={signal} onChange={handleSignalChange} variant="scrollable" sx={TABS_SX}>
        {Object.entries(SIGNAL_LABELS).map(([value, label]) => (
          <Tab key={value} value={value} label={label} />
        ))}
      </Tabs>

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
          <AttributeFilters value={filters} onChange={handleFiltersChange} />
          {applyError && <Alert severity="error">{applyError}</Alert>}
          <Button variant="contained" onClick={handleQueryRun} sx={RUN_BUTTON_SX}>
            Run query
          </Button>
          <SignalResults signal={signal} queries={executedQueries} />
        </Stack>
      )}
    </Stack>
  );
}
