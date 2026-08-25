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
  Autocomplete,
  AutocompleteRenderInputParams,
  Button,
  CircularProgress,
  InputAdornment,
  MenuItem,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import { useDatasourceClient, useTimeRange } from '@perses-dev/plugin-system';
import { DatasourceSelector } from '@perses-dev/spec';
import { useQuery } from '@tanstack/react-query';
import { ChangeEvent, ReactElement, ReactNode, SyntheticEvent, useCallback, useMemo } from 'react';

import {
  isValidOTelDuration,
  OTelAttributeFilter,
  OTelMetricsQueryMode,
  OTelSignal,
  OTelSignalCapability,
  OTelSignalField,
  OTelSignalInputs,
  OTelTraceStatus,
  validAttributeFilters,
} from '../model';
import { AttributeFilterSuggestions, AttributeFilters, OTelSuggestionContext } from './AttributeFilters';

const EMPTY_OPTIONS: string[] = [];
const LOG_SEVERITY_OPTIONS = ['trace', 'debug', 'info', 'warn', 'error', 'fatal'];
const SIGNAL_FILTER_LABELS: Record<OTelSignal, string> = {
  metrics: 'Metrics filters',
  logs: 'Logs filters',
  traces: 'Traces filters',
  profiles: 'Profiles filters',
};
const CONTROLS_DIRECTION = { xs: 'column' as const, md: 'row' as const };
const FIELD_SX = { minWidth: 240, flex: 1 };
const WIDE_FIELD_SX = { minWidth: 320, flex: 2 };
const DURATION_FIELD_SX = { minWidth: 150, flex: 1 };
const SUGGESTIONS_STALE_TIME = 60_000;

function createInputSlotProps(params: AutocompleteRenderInputParams, endAdornment: ReactNode): object {
  return { input: { ...params.InputProps, endAdornment } };
}

interface SignalFieldAutocompleteProps {
  capability: OTelSignalCapability;
  context?: OTelSuggestionContext;
  field: OTelSignalField;
  filters: OTelAttributeFilter[];
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  staticOptions?: string[];
  value: string;
}

function SignalFieldAutocomplete({
  capability,
  context,
  field,
  filters,
  label,
  onChange,
  placeholder,
  staticOptions = EMPTY_OPTIONS,
  value,
}: SignalFieldAutocompleteProps): ReactElement {
  const validFilters = useMemo(() => validAttributeFilters(filters), [filters]);
  const { data: discoveredOptions = EMPTY_OPTIONS, isLoading } = useQuery({
    enabled: context !== undefined && capability.getSignalFieldValues !== undefined,
    queryKey: [
      'otelExplorer',
      context?.datasource,
      context?.start.getTime(),
      context?.end.getTime(),
      validFilters,
      context?.logSearch,
      context?.logServiceName,
      context?.logSeverity,
      context?.traceServiceName,
      context?.traceSpanName,
      context?.traceStatus,
      context?.traceMinDuration,
      context?.traceMaxDuration,
      context?.profileServiceName,
      context?.profileType,
      'signalFieldValues',
      field,
    ],
    queryFn: ({ signal }) =>
      capability.getSignalFieldValues!({ ...context!, abortSignal: signal, field, filters: validFilters }),
    staleTime: SUGGESTIONS_STALE_TIME,
  });
  const options = useMemo(
    () => [...new Set([...staticOptions, ...discoveredOptions])].toSorted(),
    [discoveredOptions, staticOptions],
  );
  const handleChange = useCallback((_: SyntheticEvent, next: string): void => onChange(next), [onChange]);
  const renderInput = useCallback(
    (params: AutocompleteRenderInputParams): ReactElement => {
      const endAdornment = (
        <InputAdornment position="end">
          {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
          {params.InputProps.endAdornment}
        </InputAdornment>
      );
      return (
        <TextField
          {...params}
          label={label}
          placeholder={placeholder}
          slotProps={createInputSlotProps(params, endAdornment)}
        />
      );
    },
    [isLoading, label, placeholder],
  );

  return (
    <Autocomplete
      freeSolo
      options={options}
      inputValue={value}
      value={value}
      onInputChange={handleChange}
      loading={isLoading}
      sx={FIELD_SX}
      renderInput={renderInput}
    />
  );
}

interface SignalControlsProps {
  capability: OTelSignalCapability;
  context?: OTelSuggestionContext;
  filters: OTelAttributeFilter[];
  inputs: OTelSignalInputs;
  onChange: (next: Partial<OTelSignalInputs>) => void;
}

function MetricControls({ capability, context, filters, inputs, onChange }: SignalControlsProps): ReactElement {
  const validFilters = useMemo(() => validAttributeFilters(filters), [filters]);
  const { data: metricNames = EMPTY_OPTIONS, isLoading } = useQuery({
    enabled: context !== undefined && capability.getMetricNames !== undefined,
    queryKey: [
      'otelExplorer',
      context?.datasource,
      context?.start.getTime(),
      context?.end.getTime(),
      validFilters,
      'metricNames',
    ],
    queryFn: ({ signal }) => capability.getMetricNames!({ ...context!, abortSignal: signal, filters: validFilters }),
    staleTime: SUGGESTIONS_STALE_TIME,
  });
  const handleMetricNameChange = useCallback(
    (_: SyntheticEvent, value: string): void => onChange({ metricName: value }),
    [onChange],
  );
  const handleQueryModeChange = useCallback(
    (_: SyntheticEvent, value: OTelMetricsQueryMode | null): void => {
      if (value) {
        onChange({ metricsQueryMode: value });
      }
    },
    [onChange],
  );
  const renderMetricNameInput = useCallback(
    (params: AutocompleteRenderInputParams): ReactElement => {
      const endAdornment = (
        <InputAdornment position="end">
          {isLoading ? <CircularProgress color="inherit" size={20} /> : null}
          {params.InputProps.endAdornment}
        </InputAdornment>
      );
      return (
        <TextField
          {...params}
          label="Metric name"
          placeholder="All metrics"
          slotProps={createInputSlotProps(params, endAdornment)}
        />
      );
    },
    [isLoading],
  );

  return (
    <Stack direction={CONTROLS_DIRECTION} gap={1} alignItems="center">
      <Autocomplete
        freeSolo
        options={metricNames}
        inputValue={inputs.metricName}
        value={inputs.metricName}
        onInputChange={handleMetricNameChange}
        loading={isLoading}
        sx={WIDE_FIELD_SX}
        renderInput={renderMetricNameInput}
      />
      <ToggleButtonGroup
        exclusive
        value={inputs.metricsQueryMode}
        onChange={handleQueryModeChange}
        aria-label="Metrics query mode"
      >
        <ToggleButton value="range">Range</ToggleButton>
        <ToggleButton value="instant">Instant</ToggleButton>
      </ToggleButtonGroup>
    </Stack>
  );
}

function LogControls({ capability, context, filters, inputs, onChange }: SignalControlsProps): ReactElement {
  const handleServiceChange = useCallback((value: string): void => onChange({ logServiceName: value }), [onChange]);
  const handleSeverityChange = useCallback((value: string): void => onChange({ logSeverity: value }), [onChange]);
  const handleSearchChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => onChange({ logSearch: event.target.value }),
    [onChange],
  );

  return (
    <Stack direction={CONTROLS_DIRECTION} gap={1} alignItems="center">
      <SignalFieldAutocomplete
        capability={capability}
        context={context}
        field="log.service.name"
        filters={filters}
        label="Service name"
        onChange={handleServiceChange}
        placeholder="All services"
        value={inputs.logServiceName}
      />
      <TextField
        label="Search log lines"
        placeholder="Text contained in the log line"
        value={inputs.logSearch}
        onChange={handleSearchChange}
        sx={WIDE_FIELD_SX}
      />
      <SignalFieldAutocomplete
        capability={capability}
        context={context}
        field="log.severity"
        filters={filters}
        label="Severity"
        onChange={handleSeverityChange}
        placeholder="All levels"
        staticOptions={LOG_SEVERITY_OPTIONS}
        value={inputs.logSeverity}
      />
    </Stack>
  );
}

function TraceControls({ capability, context, filters, inputs, onChange }: SignalControlsProps): ReactElement {
  const minDurationValid = isValidOTelDuration(inputs.traceMinDuration);
  const maxDurationValid = isValidOTelDuration(inputs.traceMaxDuration);
  const handleServiceChange = useCallback((value: string): void => onChange({ traceServiceName: value }), [onChange]);
  const handleSpanChange = useCallback((value: string): void => onChange({ traceSpanName: value }), [onChange]);
  const handleStatusChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => onChange({ traceStatus: event.target.value as OTelTraceStatus }),
    [onChange],
  );
  const handleMinDurationChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => onChange({ traceMinDuration: event.target.value }),
    [onChange],
  );
  const handleMaxDurationChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => onChange({ traceMaxDuration: event.target.value }),
    [onChange],
  );

  return (
    <Stack gap={1}>
      <Stack direction={CONTROLS_DIRECTION} gap={1} alignItems="center">
        <SignalFieldAutocomplete
          capability={capability}
          context={context}
          field="trace.service.name"
          filters={filters}
          label="Service name"
          onChange={handleServiceChange}
          placeholder="All services"
          value={inputs.traceServiceName}
        />
        <SignalFieldAutocomplete
          capability={capability}
          context={context}
          field="trace.span.name"
          filters={filters}
          label="Span name"
          onChange={handleSpanChange}
          placeholder="All spans"
          value={inputs.traceSpanName}
        />
        <TextField select label="Status" value={inputs.traceStatus} onChange={handleStatusChange} sx={FIELD_SX}>
          <MenuItem value="">Any status</MenuItem>
          <MenuItem value="unset">Unset</MenuItem>
          <MenuItem value="ok">OK</MenuItem>
          <MenuItem value="error">Error</MenuItem>
        </TextField>
      </Stack>
      <Stack direction={CONTROLS_DIRECTION} gap={1}>
        <TextField
          label="Min duration"
          placeholder="100ms"
          value={inputs.traceMinDuration}
          onChange={handleMinDurationChange}
          error={!minDurationValid}
          helperText={minDurationValid ? undefined : 'Use a duration such as 100ms, 1.5s, or 2m.'}
          sx={DURATION_FIELD_SX}
        />
        <TextField
          label="Max duration"
          placeholder="5s"
          value={inputs.traceMaxDuration}
          onChange={handleMaxDurationChange}
          error={!maxDurationValid}
          helperText={maxDurationValid ? undefined : 'Use a duration such as 100ms, 1.5s, or 2m.'}
          sx={DURATION_FIELD_SX}
        />
      </Stack>
    </Stack>
  );
}

function ProfileControls({ capability, context, filters, inputs, onChange }: SignalControlsProps): ReactElement {
  const handleServiceChange = useCallback((value: string): void => onChange({ profileServiceName: value }), [onChange]);
  const handleProfileTypeChange = useCallback((value: string): void => onChange({ profileType: value }), [onChange]);

  return (
    <Stack direction={CONTROLS_DIRECTION} gap={1} alignItems="center">
      <SignalFieldAutocomplete
        capability={capability}
        context={context}
        field="profile.service.name"
        filters={filters}
        label="Service name"
        onChange={handleServiceChange}
        placeholder="All services"
        value={inputs.profileServiceName}
      />
      <SignalFieldAutocomplete
        capability={capability}
        context={context}
        field="profile.type"
        filters={filters}
        label="Profile type"
        onChange={handleProfileTypeChange}
        placeholder="Select a profile type"
        value={inputs.profileType}
      />
    </Stack>
  );
}

function SignalControls(props: SignalControlsProps & { signal: OTelSignal }): ReactElement {
  switch (props.signal) {
    case 'metrics':
      return <MetricControls {...props} />;
    case 'logs':
      return <LogControls {...props} />;
    case 'traces':
      return <TraceControls {...props} />;
    case 'profiles':
      return <ProfileControls {...props} />;
  }
}

export interface OTelQueryControlsProps {
  capability: OTelSignalCapability;
  datasource: DatasourceSelector;
  filters: OTelAttributeFilter[];
  inputs: OTelSignalInputs;
  onFiltersChange: (next: OTelAttributeFilter[]) => void;
  onInputsChange: (next: Partial<OTelSignalInputs>) => void;
  onQueryRun: () => void;
  signal: OTelSignal;
}

export function OTelQueryControls({
  capability,
  datasource,
  filters,
  inputs,
  onFiltersChange,
  onInputsChange,
  onQueryRun,
  signal,
}: OTelQueryControlsProps): ReactElement {
  const { data: client } = useDatasourceClient<unknown>(datasource);
  const { absoluteTimeRange } = useTimeRange();
  const context = useMemo<OTelSuggestionContext | undefined>(() => {
    if (client === undefined) {
      return undefined;
    }
    return {
      ...inputs,
      client,
      datasource,
      end: absoluteTimeRange.end,
      start: absoluteTimeRange.start,
    };
  }, [absoluteTimeRange.end, absoluteTimeRange.start, client, datasource, inputs]);
  const suggestions = useMemo<AttributeFilterSuggestions | undefined>(
    () => (context ? { capability, context } : undefined),
    [capability, context],
  );
  const queryDisabled =
    signal === 'traces' &&
    (!isValidOTelDuration(inputs.traceMinDuration) || !isValidOTelDuration(inputs.traceMaxDuration));

  return (
    <Stack gap={2}>
      <Stack gap={1}>
        <Typography variant="subtitle2">{SIGNAL_FILTER_LABELS[signal]}</Typography>
        <SignalControls
          capability={capability}
          context={context}
          filters={filters}
          inputs={inputs}
          onChange={onInputsChange}
          signal={signal}
        />
      </Stack>
      <Stack gap={1}>
        <Typography variant="subtitle2">Attributes</Typography>
        <AttributeFilters value={filters} onChange={onFiltersChange} suggestions={suggestions} />
      </Stack>
      <Button fullWidth variant="contained" onClick={onQueryRun} disabled={queryDisabled}>
        Run query
      </Button>
    </Stack>
  );
}
