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

import { TextField } from '@mui/material';
import type { OptionsEditorProps, VariablePlugin } from '@perses-dev/plugin-system';
import type { ReactElement, ChangeEvent } from 'react';
import { useCallback } from 'react';

import { ClickHouseQueryEditor } from '../components/ClickHouseQueryEditor';
import { VARIABLE_EXAMPLE } from '../components/query-examples';
import { queryDependencies } from '../model/query';
import { getVariableOptions } from './get-variable-options';
import type { ClickHouseVariableSpec } from './types';

function VariableEditor(props: OptionsEditorProps<ClickHouseVariableSpec>): ReactElement {
  const { value, onChange } = props;
  const handleValueColumn = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, valueColumn: event.target.value || undefined });
    },
    [value, onChange],
  );
  const handleLabelColumn = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange({ ...value, labelColumn: event.target.value || undefined });
    },
    [value, onChange],
  );
  return (
    <ClickHouseQueryEditor {...props} examples={VARIABLE_EXAMPLE}>
      <TextField
        label="Value column"
        value={value.valueColumn ?? ''}
        placeholder="value (or first column)"
        onChange={handleValueColumn}
      />
      <TextField
        label="Label column"
        value={value.labelColumn ?? ''}
        placeholder="label (or value)"
        onChange={handleLabelColumn}
      />
    </ClickHouseQueryEditor>
  );
}

export const ClickHouseVariable: VariablePlugin<ClickHouseVariableSpec> = {
  getVariableOptions,
  dependsOn: queryDependencies,
  OptionsEditorComponent: VariableEditor,
  createInitialOptions: () => ({ query: VARIABLE_EXAMPLE }),
};
