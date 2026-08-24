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

import { Stack, TextField } from '@mui/material';
import {
  DatasourceSelect,
  DatasourceSelectProps,
  isVariableDatasource,
  OptionsEditorProps,
} from '@perses-dev/plugin-system';
import { produce } from 'immer';
import { ChangeEvent, ReactElement, useCallback, useMemo } from 'react';

import { ClickQLEditor } from '../components';
import { DATASOURCE_KIND, DEFAULT_DATASOURCE } from '../queries/constants';
import { useQueryState } from '../queries/query-editor-model';
import {
  ClickHouseLabelNamesVariableOptions,
  ClickHouseLabelValuesVariableOptions,
  ClickHouseQueryVariableOptions,
  ClickHouseVariableOptionsBase,
} from './types';

function ClickHouseVariableQueryControls<T extends ClickHouseVariableOptionsBase & { query: string }>(
  props: OptionsEditorProps<T>,
): ReactElement {
  const { onChange, value, isReadonly } = props;
  const { query, handleQueryChange, handleQueryBlur } = useQueryState(props);

  const handleDatasourceChange: DatasourceSelectProps['onChange'] = useCallback(
    (next) => {
      if (isVariableDatasource(next) || next.kind === DATASOURCE_KIND) {
        onChange(
          produce(value, (draft) => {
            draft.datasource = !isVariableDatasource(next) && next.name === undefined ? undefined : next;
          }),
        );
        return;
      }
      throw new Error('Got unexpected non-ClickHouse datasource selector');
    },
    [onChange, value],
  );

  return (
    <Stack spacing={2}>
      <DatasourceSelect
        datasourcePluginKind={DATASOURCE_KIND}
        value={value.datasource ?? DEFAULT_DATASOURCE}
        onChange={handleDatasourceChange}
        readOnly={isReadonly}
        labelId="clickhouse-variable-datasource-label"
        label="ClickHouse Datasource"
      />
      <ClickQLEditor
        value={query}
        onChange={handleQueryChange}
        onBlur={handleQueryBlur}
        readOnly={isReadonly}
        placeholder="Enter a ClickHouse SQL query"
      />
    </Stack>
  );
}

export function ClickHouseQueryVariableEditor(props: OptionsEditorProps<ClickHouseQueryVariableOptions>): ReactElement {
  return <ClickHouseVariableQueryControls {...props} />;
}

export function ClickHouseLabelNamesVariableEditor(
  props: OptionsEditorProps<ClickHouseLabelNamesVariableOptions>,
): ReactElement {
  return <ClickHouseVariableQueryControls {...props} />;
}

export function ClickHouseLabelValuesVariableEditor(
  props: OptionsEditorProps<ClickHouseLabelValuesVariableOptions>,
): ReactElement {
  const { onChange, value, isReadonly } = props;
  const inputSlotProps = useMemo(() => ({ input: { readOnly: isReadonly } }), [isReadonly]);
  const handleLabelNameChange = useCallback(
    (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      onChange(
        produce(value, (draft) => {
          draft.labelName = event.target.value;
        }),
      );
    },
    [onChange, value],
  );

  return (
    <Stack spacing={2}>
      <ClickHouseVariableQueryControls {...props} />
      <TextField
        required
        label="Label Name"
        value={value.labelName}
        onChange={handleLabelNameChange}
        slotProps={inputSlotProps}
        helperText="Column name or key in a ClickHouse Map/object column"
      />
    </Stack>
  );
}
