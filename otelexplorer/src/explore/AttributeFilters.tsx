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
  IconButton,
  InputAdornment,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import DeleteIcon from 'mdi-material-ui/Delete';
import PlusIcon from 'mdi-material-ui/Plus';
import { ReactElement, ReactNode, SyntheticEvent, useCallback, useId, useMemo, useRef } from 'react';

import {
  createOTelAttributeFilter,
  OTelAttributeFilter,
  OTelAttributeOperator,
  OTelSignalCapability,
  OTelSuggestionArgs,
  validAttributeFilters,
} from '../model';

export type OTelSuggestionContext = Omit<OTelSuggestionArgs, 'abortSignal' | 'filters'>;

export interface AttributeFilterSuggestions {
  capability: OTelSignalCapability;
  context: OTelSuggestionContext;
}

export interface AttributeFiltersProps {
  value: OTelAttributeFilter[];
  onChange: (next: OTelAttributeFilter[]) => void;
  suggestions?: AttributeFilterSuggestions;
}

const ATTRIBUTE_NAME_SX = { minWidth: 210, '& .MuiOutlinedInput-root': { borderRadius: '4px 0 0 4px' } };
const OPERATOR_SX = { borderRadius: 0 };
const ATTRIBUTE_VALUE_SX = { minWidth: 210, '& .MuiOutlinedInput-root': { borderRadius: '0 4px 4px 0' } };
const ADD_ICON = <PlusIcon />;
const EMPTY_OPTIONS: string[] = [];
const SUGGESTIONS_STALE_TIME = 60_000;

function createInputSlotProps(params: AutocompleteRenderInputParams, endAdornment: ReactNode): object {
  return { input: { ...params.InputProps, endAdornment } };
}

interface AttributeFilterRowProps {
  filter: OTelAttributeFilter;
  filters: OTelAttributeFilter[];
  isNameLoading?: boolean;
  isValueLoading?: boolean;
  nameOptions?: string[];
  onFiltersChange: (next: OTelAttributeFilter[]) => void;
  valueOptions?: string[];
}

function AttributeFilterRow({
  filter,
  filters,
  isNameLoading,
  isValueLoading,
  nameOptions = EMPTY_OPTIONS,
  onFiltersChange,
  valueOptions = EMPTY_OPTIONS,
}: AttributeFilterRowProps): ReactElement {
  const updateFilter = useCallback(
    (next: OTelAttributeFilter): void => {
      onFiltersChange(filters.map((item) => (item.id === filter.id ? next : item)));
    },
    [filter.id, filters, onFiltersChange],
  );
  const handleNameChange = useCallback(
    (_: SyntheticEvent, value: string): void => updateFilter({ ...filter, key: value }),
    [filter, updateFilter],
  );
  const handleOperatorChange = useCallback(
    (event: SelectChangeEvent<OTelAttributeOperator>): void =>
      updateFilter({ ...filter, operator: event.target.value as OTelAttributeOperator }),
    [filter, updateFilter],
  );
  const handleValueChange = useCallback(
    (_: SyntheticEvent, value: string): void => updateFilter({ ...filter, value }),
    [filter, updateFilter],
  );
  const handleDelete = useCallback(
    (): void => onFiltersChange(filters.filter((item) => item.id !== filter.id)),
    [filter.id, filters, onFiltersChange],
  );
  const renderNameInput = useCallback(
    (params: AutocompleteRenderInputParams): ReactElement => (
      <TextField {...params} label="Attribute name" placeholder="service.name" />
    ),
    [],
  );
  const renderValueInput = useCallback(
    (params: AutocompleteRenderInputParams): ReactElement => {
      const endAdornment = (
        <InputAdornment position="end">
          {isValueLoading ? <CircularProgress color="inherit" size={20} /> : null}
          <IconButton aria-label={`Delete ${filter.key || 'attribute'} filter`} onClick={handleDelete} edge="end">
            <DeleteIcon />
          </IconButton>
        </InputAdornment>
      );
      const slotProps = createInputSlotProps(params, endAdornment);
      return <TextField {...params} label="Attribute value" slotProps={slotProps} />;
    },
    [filter.key, handleDelete, isValueLoading],
  );

  return (
    <Stack direction="row" alignItems="center">
      <Autocomplete
        freeSolo
        disableClearable
        loading={isNameLoading}
        options={nameOptions}
        inputValue={filter.key}
        value={filter.key}
        onInputChange={handleNameChange}
        sx={ATTRIBUTE_NAME_SX}
        renderInput={renderNameInput}
      />
      <Select
        aria-label={`Operator for ${filter.key || 'attribute'}`}
        value={filter.operator}
        onChange={handleOperatorChange}
        sx={OPERATOR_SX}
      >
        <MenuItem value="=">=</MenuItem>
        <MenuItem value="!=">!=</MenuItem>
        <MenuItem value="=~">=~</MenuItem>
        <MenuItem value="!~">!~</MenuItem>
      </Select>
      <Autocomplete
        freeSolo
        disableClearable
        loading={isValueLoading}
        options={valueOptions}
        inputValue={filter.value}
        value={filter.value}
        onInputChange={handleValueChange}
        sx={ATTRIBUTE_VALUE_SX}
        renderInput={renderValueInput}
      />
    </Stack>
  );
}

interface SuggestedAttributeFilterRowProps extends Omit<AttributeFilterRowProps, 'nameOptions' | 'valueOptions'> {
  suggestions: AttributeFilterSuggestions;
}

function SuggestedAttributeFilterRow({
  filter,
  filters,
  onFiltersChange,
  suggestions: { capability, context },
}: SuggestedAttributeFilterRowProps): ReactElement {
  const otherFilters = useMemo(
    () => validAttributeFilters(filters.filter((item) => item.id !== filter.id)),
    [filter.id, filters],
  );
  const queryKey = [
    'otelExplorer',
    context.datasource,
    context.metricName,
    context.metricsQueryMode,
    context.logSearch,
    context.logServiceName,
    context.logSeverity,
    context.traceServiceName,
    context.traceSpanName,
    context.traceStatus,
    context.traceMinDuration,
    context.traceMaxDuration,
    context.profileServiceName,
    context.profileType,
    context.start.getTime(),
    context.end.getTime(),
    otherFilters,
  ];
  const { data: nameOptions = EMPTY_OPTIONS, isFetching: isNameLoading } = useQuery({
    enabled: capability.getAttributeNames !== undefined,
    queryKey: [...queryKey, 'attributeNames'],
    queryFn: ({ signal }) => capability.getAttributeNames!({ ...context, abortSignal: signal, filters: otherFilters }),
    staleTime: SUGGESTIONS_STALE_TIME,
  });
  const { data: valueOptions = EMPTY_OPTIONS, isFetching: isValueLoading } = useQuery({
    enabled: filter.key.trim() !== '' && capability.getAttributeValues !== undefined,
    queryKey: [...queryKey, 'attributeValues', filter.key],
    queryFn: ({ signal }) =>
      capability.getAttributeValues!({
        ...context,
        abortSignal: signal,
        attribute: filter.key,
        filters: otherFilters,
      }),
    staleTime: SUGGESTIONS_STALE_TIME,
  });

  return (
    <AttributeFilterRow
      filter={filter}
      filters={filters}
      isNameLoading={isNameLoading}
      isValueLoading={isValueLoading}
      nameOptions={nameOptions}
      onFiltersChange={onFiltersChange}
      valueOptions={valueOptions}
    />
  );
}

export function AttributeFilters({ value, onChange, suggestions }: AttributeFiltersProps): ReactElement {
  const idPrefix = useId();
  const nextId = useRef(0);
  const handleAdd = useCallback((): void => {
    const id = `${idPrefix}-${nextId.current}`;
    nextId.current += 1;
    onChange([...value, createOTelAttributeFilter(id)]);
  }, [idPrefix, onChange, value]);

  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
      {value.map((filter) =>
        suggestions ? (
          <SuggestedAttributeFilterRow
            key={filter.id}
            filter={filter}
            filters={value}
            onFiltersChange={onChange}
            suggestions={suggestions}
          />
        ) : (
          <AttributeFilterRow key={filter.id} filter={filter} filters={value} onFiltersChange={onChange} />
        ),
      )}
      <Button startIcon={ADD_ICON} onClick={handleAdd}>
        Add attribute
      </Button>
    </Stack>
  );
}
