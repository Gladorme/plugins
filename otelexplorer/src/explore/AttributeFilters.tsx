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

import { Button, IconButton, MenuItem, Select, SelectChangeEvent, Stack, TextField } from '@mui/material';
import DeleteIcon from 'mdi-material-ui/Delete';
import PlusIcon from 'mdi-material-ui/Plus';
import { ChangeEvent, ReactElement, useCallback, useId, useRef } from 'react';

import { createOTelAttributeFilter, OTelAttributeFilter, OTelAttributeOperator } from '../model';

export interface AttributeFiltersProps {
  value: OTelAttributeFilter[];
  onChange: (next: OTelAttributeFilter[]) => void;
}

const ATTRIBUTE_NAME_SX = { minWidth: 210, '& .MuiOutlinedInput-root': { borderRadius: '4px 0 0 4px' } };
const OPERATOR_SX = { borderRadius: 0 };
const ATTRIBUTE_VALUE_SX = { minWidth: 210, '& .MuiOutlinedInput-root': { borderRadius: '0 4px 4px 0' } };
const ADD_ICON = <PlusIcon />;

function AttributeFilterRow({
  filter,
  filters,
  onFiltersChange,
}: {
  filter: OTelAttributeFilter;
  filters: OTelAttributeFilter[];
  onFiltersChange: (next: OTelAttributeFilter[]) => void;
}): ReactElement {
  const updateFilter = useCallback(
    (next: OTelAttributeFilter): void => {
      onFiltersChange(filters.map((item) => (item.id === filter.id ? next : item)));
    },
    [filter.id, filters, onFiltersChange],
  );
  const handleNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => updateFilter({ ...filter, key: event.target.value }),
    [filter, updateFilter],
  );
  const handleOperatorChange = useCallback(
    (event: SelectChangeEvent<OTelAttributeOperator>): void =>
      updateFilter({ ...filter, operator: event.target.value as OTelAttributeOperator }),
    [filter, updateFilter],
  );
  const handleValueChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>): void => updateFilter({ ...filter, value: event.target.value }),
    [filter, updateFilter],
  );
  const handleDelete = useCallback(
    (): void => onFiltersChange(filters.filter((item) => item.id !== filter.id)),
    [filter.id, filters, onFiltersChange],
  );

  return (
    <Stack direction="row" alignItems="center">
      <TextField
        label="Attribute name"
        placeholder="service.name"
        value={filter.key}
        onChange={handleNameChange}
        sx={ATTRIBUTE_NAME_SX}
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
      <TextField label="Attribute value" value={filter.value} onChange={handleValueChange} sx={ATTRIBUTE_VALUE_SX} />
      <IconButton aria-label={`Delete ${filter.key || 'attribute'} filter`} onClick={handleDelete}>
        <DeleteIcon />
      </IconButton>
    </Stack>
  );
}

export function AttributeFilters({ value, onChange }: AttributeFiltersProps): ReactElement {
  const idPrefix = useId();
  const nextId = useRef(0);
  const handleAdd = useCallback((): void => {
    const id = `${idPrefix}-${nextId.current}`;
    nextId.current += 1;
    onChange([...value, createOTelAttributeFilter(id)]);
  }, [idPrefix, onChange, value]);

  return (
    <Stack direction="row" alignItems="center" flexWrap="wrap" gap={1}>
      {value.map((filter) => (
        <AttributeFilterRow key={filter.id} filter={filter} filters={value} onFiltersChange={onChange} />
      ))}
      <Button startIcon={ADD_ICON} onClick={handleAdd}>
        Add attribute
      </Button>
    </Stack>
  );
}
