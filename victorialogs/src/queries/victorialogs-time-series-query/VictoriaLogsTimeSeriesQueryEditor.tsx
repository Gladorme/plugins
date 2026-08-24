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

import { InputLabel, Stack } from '@mui/material';
import { createModEnterHandler } from '@perses-dev/dashboards';
import type { DatasourceSelectProps, OptionsEditorProps } from '@perses-dev/plugin-system';
import { DatasourceSelect, isVariableDatasource, useDatasourceSelectValueToSelector } from '@perses-dev/plugin-system';
import type { ReactElement } from 'react';
import { useCallback, useState } from 'react';

import { LogsQLEditor } from '../../components/logsql-editor';
import type { VictoriaLogsDatasourceSelector } from '../../model/selectors';
import { VICTORIALOGS_DATASOURCE_KIND } from '../../model/selectors';
import { DATASOURCE_KIND, DEFAULT_DATASOURCE } from '../constants';
import type { VictoriaLogsTimeSeriesQuerySpec } from './types';

type VictoriaLogsQueryEditorProps = OptionsEditorProps<VictoriaLogsTimeSeriesQuerySpec>;

export function VictoriaLogsQueryEditor(props: VictoriaLogsQueryEditorProps): ReactElement {
  const { onChange, value } = props;
  const { datasource } = value;
  const datasourceSelectValue = datasource ?? DEFAULT_DATASOURCE;
  const selectedDatasource = useDatasourceSelectValueToSelector(
    datasourceSelectValue,
    VICTORIALOGS_DATASOURCE_KIND,
  ) as VictoriaLogsDatasourceSelector;

  const handleDatasourceChange: DatasourceSelectProps['onChange'] = (newDatasourceSelection) => {
    if (!isVariableDatasource(newDatasourceSelection) && newDatasourceSelection.kind === DATASOURCE_KIND) {
      onChange({ ...value, datasource: newDatasourceSelection });
      return;
    }

    throw new Error('Got unexpected non VictoriaLogsQuery datasource selection');
  };

  // Immediate query execution on Enter or blur
  const handleQueryExecute = useCallback(
    (query: string) => {
      onChange({ ...value, query });
    },
    [onChange, value],
  );

  return (
    <Stack spacing={1.5} paddingBottom={1}>
      <div>
        <InputLabel
          sx={{
            display: 'block',
            marginBottom: '4px',
            fontWeight: 500,
          }}
        >
          Datasource
        </InputLabel>
        <DatasourceSelect
          datasourcePluginKind={DATASOURCE_KIND}
          value={selectedDatasource}
          onChange={handleDatasourceChange}
          label="VictoriaLogs Datasource"
          notched
        />
      </div>

      <div>
        <InputLabel
          sx={{
            display: 'block',
            marginBottom: '4px',
            fontWeight: 500,
          }}
        >
          LogsQL Query
        </InputLabel>
        <QueryInput key={value.query} query={value.query} onExecute={handleQueryExecute} />
      </div>
    </Stack>
  );
}

interface QueryInputProps {
  query: string;
  onExecute: (query: string) => void;
}

function QueryInput({ query, onExecute }: QueryInputProps): ReactElement {
  const [localQuery, setLocalQuery] = useState(query);

  return (
    <LogsQLEditor
      value={localQuery}
      onChange={setLocalQuery}
      onBlur={() => onExecute(localQuery)}
      onKeyDown={createModEnterHandler(() => onExecute(localQuery))}
      placeholder='Enter LogsQL query (e.g. {job="mysql"} |= "error")'
    />
  );
}
