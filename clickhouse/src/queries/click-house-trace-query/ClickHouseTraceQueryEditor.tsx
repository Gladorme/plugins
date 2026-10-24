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

import { MenuItem, TextField } from '@mui/material';
import type { OptionsEditorProps } from '@perses-dev/plugin-system';
import type { ReactElement, ChangeEvent } from 'react';
import { useCallback } from 'react';

import { ClickHouseQueryEditor } from '../../components/ClickHouseQueryEditor';
import { TRACE_DETAIL_EXAMPLE, TRACE_SEARCH_EXAMPLE } from '../../components/query-examples';
import type { ClickHouseTraceQuerySpec } from './types';

export function ClickHouseTraceQueryEditor(props: OptionsEditorProps<ClickHouseTraceQuerySpec>): ReactElement {
  const { value, onChange } = props;
  const handleMode = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, mode: event.target.value === 'trace' ? 'trace' : 'search' });
    },
    [value, onChange],
  );
  const handleTable = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, table: event.target.value || undefined });
    },
    [value, onChange],
  );
  return (
    <ClickHouseQueryEditor {...props} examples={TRACE_SEARCH_EXAMPLE + '\n\n' + TRACE_DETAIL_EXAMPLE}>
      <TextField select label="Result type" value={value.mode ?? 'search'} onChange={handleMode}>
        <MenuItem value="search">Trace search</MenuItem>
        <MenuItem value="trace">Trace detail</MenuItem>
      </TextField>
      <TextField
        label="Trace lookup table"
        value={value.table ?? ''}
        placeholder="otel_traces"
        helperText="Used when entering a trace ID directly."
        onChange={handleTable}
      />
    </ClickHouseQueryEditor>
  );
}
